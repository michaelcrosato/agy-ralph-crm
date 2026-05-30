import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const DRIZZLE_DIR =
  process.env.DRIZZLE_DIR_OVERRIDE ||
  path.join(REPO_ROOT, "packages", "db", "drizzle");
const JOURNAL_PATH = path.join(DRIZZLE_DIR, "meta", "_journal.json");

function main() {
  console.log("=========================================");
  console.log(" DRIZZLE MIGRATION VALIDATION GATE");
  console.log("=========================================");

  if (!fs.existsSync(DRIZZLE_DIR)) {
    console.log("[INFO] Drizzle directory does not exist yet. Skipping check.");
    process.exit(0);
  }

  if (!fs.existsSync(JOURNAL_PATH)) {
    console.error("[ERROR] Drizzle journal not found at meta/_journal.json.");
    process.exit(1);
  }

  let journal;
  try {
    const journalRaw = fs.readFileSync(JOURNAL_PATH, "utf8");
    journal = JSON.parse(journalRaw);
  } catch (error) {
    console.error(
      "[ERROR] Failed to read or parse _journal.json:",
      error.message,
    );
    process.exit(1);
  }

  const entries = journal.entries || [];
  console.log(`Analyzing ${entries.length} migration journal entries...`);

  // 1. Validate idx sequence continuity
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.idx !== i) {
      console.error(
        `[ERROR] Migration index sequence is broken. Expected index ${i}, but found index ${entry.idx} for tag "${entry.tag}".`,
      );
      process.exit(1);
    }
  }
  console.log("✓ Migration index (idx) sequence is strictly sequential.");

  // 2. Validate tag files exist on disk
  const journalTags = new Set();
  for (const entry of entries) {
    const tag = entry.tag;
    journalTags.add(tag);

    const sqlPath = path.join(DRIZZLE_DIR, `${tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      console.error(
        `[ERROR] Migration tag "${tag}" exists in the journal but has no matching SQL file at packages/db/drizzle/${tag}.sql.`,
      );
      process.exit(1);
    }
  }
  console.log("✓ Every journal entry matches a physical SQL file on disk.");

  // 3. Scan physical SQL files on disk for gaps or branch duplicates
  let sqlFiles;
  try {
    sqlFiles = fs
      .readdirSync(DRIZZLE_DIR)
      .filter((file) => file.endsWith(".sql"));
  } catch (error) {
    console.error(
      "[ERROR] Failed to read packages/db/drizzle directory:",
      error.message,
    );
    process.exit(1);
  }

  const prefixes = new Map();
  for (const file of sqlFiles) {
    const tag = file.slice(0, -4); // remove '.sql'

    // Check if SQL file is cataloged in the journal
    if (!journalTags.has(tag)) {
      console.error(
        `[ERROR] SQL file "${file}" exists on disk but is missing an entry in meta/_journal.json.`,
      );
      process.exit(1);
    }

    // Check prefix uniqueness (first 4 digits)
    const prefix = file.slice(0, 4);
    if (!/^\d{4}$/.test(prefix)) {
      console.error(
        `[ERROR] SQL file "${file}" has an invalid prefix pattern. Expected 4 digits.`,
      );
      process.exit(1);
    }

    if (prefixes.has(prefix)) {
      const existingFile = prefixes.get(prefix);
      console.error(
        `[ERROR] Migration conflict detected! Multiple files share the same prefix index "${prefix}":`,
      );
      console.error(`  - packages/db/drizzle/${existingFile}`);
      console.error(`  - packages/db/drizzle/${file}`);
      console.error(
        "Please resolve this prefix collision by rolling back one of the branches or regenerating migrations.",
      );
      process.exit(1);
    }
    prefixes.set(prefix, file);
  }

  console.log(
    "✓ No duplicate migration prefixes or uncataloged SQL files detected.",
  );
  console.log("Drizzle migrations are 100% healthy and verified.");
  process.exit(0);
}

main();
