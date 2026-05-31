import crypto from "node:crypto";
import postgres from "postgres";

const GENESIS_HASH = "0".repeat(64);

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function formatLocalToUtcIso(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds())
    .padStart(2, "0")
    .padEnd(3, "0")
    .slice(0, 3);
  return `${y}-${m}-${d}T${h}:${min}:${s}.${ms}Z`;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function computeAuditHash(record, seq, prevHash) {
  return sha256(`${prevHash}|${seq}|${stableStringify(record)}`);
}

async function main() {
  console.log("=========================================");
  console.log(" AUDIT LOG CRYPTOGRAPHIC INTEGRITY CHECK");
  console.log("=========================================");

  const dbUrl =
    process.env.DB_URL || "postgres://postgres:postgres@localhost:5432/crm";
  const dbDriver = process.env.DB_DRIVER || "mock";

  if (dbDriver !== "pg") {
    console.log(
      "[INFO] DB_DRIVER is not set to 'pg'. Skipping live PostgreSQL audit log chain verification.",
    );
    process.exit(0);
  }

  let sql;
  try {
    sql = postgres(dbUrl, { max: 1 });
  } catch (error) {
    console.error(
      "[ERROR] Failed to initialize postgres client:",
      error.message,
    );
    process.exit(1);
  }

  try {
    console.log(
      `Connecting to database at ${dbUrl.replace(/:[^:@]+@/, ":****@")}...`,
    );

    // Check if table audit_logs exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'audit_logs'
      );
    `;

    if (!tableCheck[0]?.exists) {
      console.log(
        "[INFO] Table 'audit_logs' does not exist yet. Skipping check.",
      );
      await sql.end();
      process.exit(0);
    }

    // Query all logs ordered by org_id, then seq
    const rows = await sql`
      SELECT id, org_id, record_id, record_type, action, user_id, changes, seq, prev_hash, hash, created_at
      FROM audit_logs
      ORDER BY org_id ASC, seq ASC, created_at ASC, id ASC
    `;

    if (rows.length === 0) {
      console.log(
        "[SUCCESS] No audit logs found in the database. Chain is vacuously secure.",
      );
      await sql.end();
      process.exit(0);
    }

    console.log(
      `Retrieved ${rows.length} audit logs. Verifying tenant cryptographic chains...`,
    );

    // Group logs by organization
    const orgGroups = {};
    for (const row of rows) {
      if (!orgGroups[row.org_id]) {
        orgGroups[row.org_id] = [];
      }
      orgGroups[row.org_id].push(row);
    }

    let totalVerified = 0;
    let hasErrors = false;

    for (const [orgId, logs] of Object.entries(orgGroups)) {
      console.log(`\nTenant Org: ${orgId} (${logs.length} logs)`);

      let expectedSeq = 0;
      let expectedPrevHash = GENESIS_HASH;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];

        // 1. Verify index sequence
        if (log.seq !== expectedSeq) {
          console.error(
            `[FAIL] Log ID ${log.id}: broken sequence index. Expected seq=${expectedSeq}, found seq=${log.seq}`,
          );
          hasErrors = true;
          break;
        }

        // 2. Verify previous hash chaining
        if (log.prev_hash !== expectedPrevHash) {
          console.error(
            `[FAIL] Log ID ${log.id}: broken hash chain link. Expected prev_hash=${expectedPrevHash}, found prev_hash=${log.prev_hash}`,
          );
          hasErrors = true;
          break;
        }

        // 3. Verify cryptographic hash
        const recordToHash = {
          orgId: log.org_id,
          recordId: log.record_id,
          recordType: log.record_type,
          action: log.action,
          userId: log.user_id,
          changes: log.changes,
          createdAt: formatLocalToUtcIso(log.created_at),
        };

        const computedHash = computeAuditHash(
          recordToHash,
          log.seq,
          log.prev_hash,
        );
        if (log.hash !== computedHash) {
          console.error(
            `[FAIL] Log ID ${log.id}: Tampering detected! Cryptographic mismatch.`,
          );
          console.error(`  Stored hash:   ${log.hash}`);
          console.error(`  Computed hash: ${computedHash}`);
          console.error(
            `  Record payload stringify:`,
            stableStringify(recordToHash),
          );
          console.error(`  Raw DB record:`, JSON.stringify(log));
          hasErrors = true;
          break;
        }

        // Move to next log in chain
        expectedSeq++;
        expectedPrevHash = log.hash;
        totalVerified++;
      }
    }

    await sql.end();

    if (hasErrors) {
      console.error(
        "\n[CRITICAL] Cryptographic integrity audit failed. Tampering or chain corruption detected.",
      );
      process.exit(1);
    }

    console.log(
      `\n[SUCCESS] Verification complete. Verified ${totalVerified} logs across ${Object.keys(orgGroups).length} tenants.`,
    );
    console.log(
      "All cryptographic audit chains are perfectly intact and verified.",
    );
    process.exit(0);
  } catch (error) {
    console.error(
      "\n[ERROR] An error occurred during verification:",
      error.message,
    );
    if (sql) {
      await sql.end();
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal uncaught error in verification pipeline:", err);
  process.exit(1);
});
