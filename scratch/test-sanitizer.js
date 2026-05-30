import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd());
const logPath = path.join(repoRoot, 'test_output.log');

const rawLog = `
Some log line.
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
apiKey: "my-super-secret-api-key-12345"
password=foobar12345
-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBz9bU1bO0v7uM5/7f3g3Q==
-----END EC PRIVATE KEY-----
normal line here.
`;

fs.writeFileSync(logPath, rawLog, 'utf8');

console.log('--- Original Content ---');
console.log(rawLog);

console.log('--- Running rotate-logs.mjs ---');
const out = execSync('node scripts/agent/rotate-logs.mjs', { encoding: 'utf8' });
console.log(out);

console.log('--- Sanitized Content ---');
console.log(fs.readFileSync(logPath, 'utf8'));
