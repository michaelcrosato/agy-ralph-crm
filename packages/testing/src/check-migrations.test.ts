import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const scratchDir = path.join(repoRoot, "scratch");
const testDir = path.join(scratchDir, "test-migrations-run");
const scriptPath = path.join(
  repoRoot,
  "scripts",
  "agent",
  "check-migrations.mjs",
);

describe("Drizzle Migrations Validation Gate (TICKET009 / BG-004)", () => {
  beforeAll(() => {
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir);
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir);
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  interface JournalEntry {
    idx: number;
    tag: string;
  }

  function createMockStructure(
    journalEntries: JournalEntry[],
    sqlFiles: string[],
  ) {
    // Recreate clean sandboxed structure
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir);
    fs.mkdirSync(path.join(testDir, "meta"));

    // Write mock journal
    const journal = {
      version: "7",
      dialect: "postgresql",
      entries: journalEntries,
    };
    fs.writeFileSync(
      path.join(testDir, "meta", "_journal.json"),
      JSON.stringify(journal),
      "utf8",
    );

    // Write empty physical SQL files
    for (const sql of sqlFiles) {
      fs.writeFileSync(path.join(testDir, sql), "-- mock migration", "utf8");
    }
  }

  it("passes cleanly with correct, sequential journal and matching SQL files", () => {
    createMockStructure(
      [
        { idx: 0, tag: "0000_spooky" },
        { idx: 1, tag: "0001_happy" },
      ],
      ["0000_spooky.sql", "0001_happy.sql"],
    );

    const result = execSync(`node "${scriptPath}"`, {
      env: { ...process.env, DRIZZLE_DIR_OVERRIDE: testDir },
      encoding: "utf8",
    });

    expect(result).toContain(
      "Drizzle migrations are 100% healthy and verified",
    );
  });

  it("fails when idx sequence contains a gap", () => {
    createMockStructure(
      [
        { idx: 0, tag: "0000_spooky" },
        { idx: 2, tag: "0002_sad" }, // gap at 1
      ],
      ["0000_spooky.sql", "0002_sad.sql"],
    );

    expect(() => {
      execSync(`node "${scriptPath}"`, {
        env: { ...process.env, DRIZZLE_DIR_OVERRIDE: testDir },
        stdio: "pipe",
      });
    }).toThrow("Expected index 1, but found index 2");
  });

  it("fails when a SQL file is missing for a journal entry", () => {
    createMockStructure(
      [{ idx: 0, tag: "0000_spooky" }],
      [], // missing 0000_spooky.sql on disk
    );

    expect(() => {
      execSync(`node "${scriptPath}"`, {
        env: { ...process.env, DRIZZLE_DIR_OVERRIDE: testDir },
        stdio: "pipe",
      });
    }).toThrow("exists in the journal but has no matching SQL file");
  });

  it("fails when an extra uncataloged SQL file is present on disk", () => {
    createMockStructure(
      [{ idx: 0, tag: "0000_spooky" }],
      ["0000_spooky.sql", "0001_uncataloged.sql"],
    );

    expect(() => {
      execSync(`node "${scriptPath}"`, {
        env: { ...process.env, DRIZZLE_DIR_OVERRIDE: testDir },
        stdio: "pipe",
      });
    }).toThrow("missing an entry in meta/_journal.json");
  });

  it("fails when duplicate prefix SQL files exist", () => {
    // Both cataloged in journal but colliding on prefix index
    createMockStructure(
      [
        { idx: 0, tag: "0000_spooky" },
        { idx: 1, tag: "0000_double" },
      ],
      ["0000_spooky.sql", "0000_double.sql"],
    );

    expect(() => {
      execSync(`node "${scriptPath}"`, {
        env: { ...process.env, DRIZZLE_DIR_OVERRIDE: testDir },
        stdio: "pipe",
      });
    }).toThrow("Multiple files share the same prefix index");
  });
});
