const fs = require("fs");
const path = require("path");

const migrationFile = path.join(
  __dirname,
  "../packages/db/drizzle/0000_spooky_black_knight.sql",
);
const content = fs.readFileSync(migrationFile, "utf8");

// Parse table names and check if they contain "org_id" column
const createTableRegex = /CREATE TABLE "([^"]+)" \(([\s\S]+?)\);/g;
let match;
const tablesWithOrgId = [];

while ((match = createTableRegex.exec(content)) !== null) {
  const tableName = match[1];
  const columns = match[2];
  if (columns.includes('"org_id"')) {
    tablesWithOrgId.push(tableName);
  }
}

console.log(`Found ${tablesWithOrgId.length} tables with org_id:`);
console.log(tablesWithOrgId);

// Generate RLS policy SQL statements
const sqlStatements = [];
for (const table of tablesWithOrgId) {
  sqlStatements.push(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
  sqlStatements.push(
    `CREATE POLICY "tenant_isolation" ON "${table}" USING ("org_id" = current_setting('app.current_org_id', true));`,
  );
}

const migrationDir = path.join(__dirname, "../packages/db/drizzle");
const nextMigrationFile = path.join(migrationDir, "0001_enable_rls.sql");

// Ensure the directory exists and write
fs.writeFileSync(nextMigrationFile, sqlStatements.join("\n") + "\n");
console.log(`Wrote migration to ${nextMigrationFile}`);
