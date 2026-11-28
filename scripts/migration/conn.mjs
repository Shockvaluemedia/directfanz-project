#!/usr/bin/env node
// Turns a Postgres URL held in an environment variable into libpq settings
// without ever printing the password or putting it on a command line.
//
//   node conn.mjs <ENV_VAR_NAME> <pgpass-file-to-write>
//
// Writes the password (if any) to the pgpass file with mode 0600 and prints
// only non-secret KEY=value lines (host, port, database, user, sslmode) on
// stdout for lib.sh to read. Exits non-zero with a message that never
// contains the URL when the variable is missing or malformed.
import { writeFileSync, chmodSync } from 'node:fs';

const [, , varName, passFile] = process.argv;
if (!varName || !passFile) {
  console.error('usage: conn.mjs <ENV_VAR_NAME> <pgpass-file>');
  process.exit(2);
}

const raw = process.env[varName];
if (!raw) {
  console.error(`${varName} is not set`);
  process.exit(2);
}

let url;
try {
  url = new URL(raw);
} catch {
  console.error(`${varName} is not a valid URL (value not shown)`);
  process.exit(2);
}

if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
  console.error(`${varName} must start with postgres:// or postgresql://`);
  process.exit(2);
}

const host = url.hostname.replace(/^\[|\]$/g, '');
const port = url.port || '5432';
const database = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres';
const user = decodeURIComponent(url.username || '');
const password = decodeURIComponent(url.password || '');
const sslmode = url.searchParams.get('sslmode') || 'require';

// Only plain characters are allowed in the values handed back to the shell.
const safe = /^[A-Za-z0-9._@%+-]*$/;
for (const [k, v] of Object.entries({ host, port, database, user, sslmode })) {
  if (!safe.test(v)) {
    console.error(`${varName}: ${k} contains characters these scripts do not accept`);
    process.exit(2);
  }
}
if (!host || !user) {
  console.error(`${varName} needs a host and a user`);
  process.exit(2);
}
if (url.searchParams.get('pgbouncer') === 'true' || port === '6543') {
  console.error(
    `${varName} points at a transaction pooler (port 6543 or pgbouncer=true). ` +
      'pg_dump and pg_restore need a direct or session connection (usually port 5432).'
  );
  process.exit(2);
}

// pgpass format: host:port:database:user:password, with \ and : escaped.
const esc = s => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
writeFileSync(
  passFile,
  `${esc(host)}:${esc(port)}:${esc(database)}:${esc(user)}:${esc(password)}\n`,
  {
    mode: 0o600,
  }
);
chmodSync(passFile, 0o600);

process.stdout.write(
  [
    `HOST=${host}`,
    `PORT=${port}`,
    `DATABASE=${database}`,
    `USER=${user}`,
    `SSLMODE=${sslmode}`,
  ].join('\n') + '\n'
);
