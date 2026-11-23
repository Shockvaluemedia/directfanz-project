#!/usr/bin/env tsx
/**
 * Copies files referenced in the database from Vercel Blob into the private
 * S3 bucket and rewrites the references the app can serve from S3.
 *
 * Dry run by default: reads the database, prints the plan, and makes no
 * network calls and no writes. Nothing is ever deleted from Blob.
 *
 *   npx tsx scripts/migrate-blob-to-s3.ts                      # dry run
 *   npx tsx scripts/migrate-blob-to-s3.ts --apply --confirm-bucket=<bucket>
 *
 * Options:
 *   --apply                 Copy files and rewrite rows (needs --confirm-bucket).
 *   --confirm-bucket=NAME   Must equal AWS_S3_BUCKET_NAME; guards against the wrong target.
 *   --source-host=HOST      Extra Blob host to accept (repeatable). This
 *                           deployment's own store (from BLOB_READ_WRITE_TOKEN)
 *                           is always accepted.
 *   --concurrency=N         Parallel copies (default 4, max 16).
 *   --report=PATH           Write the full JSON report to PATH.
 *
 * Environment: DATABASE_URL, AWS_S3_BUCKET_NAME, AWS_REGION,
 * and AWS credentials from the default provider chain (an IAM role, never
 * keys pasted into a shell). The script never prints secrets.
 */
import { writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { getObjectStorage, storageBucket } from '../src/lib/storage';
import { migrateBlobToS3, type MigrationDb } from '../src/lib/storage/blob-migration';

function argValues(name: string): string[] {
  const prefix = `--${name}=`;
  return process.argv.filter(arg => arg.startsWith(prefix)).map(arg => arg.slice(prefix.length));
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0]);
    return;
  }

  const apply = process.argv.includes('--apply');
  const bucket = storageBucket();
  if (apply) {
    const confirm = argValues('confirm-bucket')[0];
    if (!bucket || confirm !== bucket) {
      console.error('Refusing to apply: --confirm-bucket must equal AWS_S3_BUCKET_NAME.');
      process.exitCode = 2;
      return;
    }
  }

  const prisma = new PrismaClient();
  try {
    const report = await migrateBlobToS3({
      db: prisma as unknown as MigrationDb,
      storage: apply ? getObjectStorage() : null,
      apply,
      sourceHosts: argValues('source-host'),
      concurrency: Number(argValues('concurrency')[0]) || undefined,
      log: line => console.log(line),
    });

    const reportPath = argValues('report')[0];
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const skippedByReason = report.skipped.reduce<Record<string, number>>((acc, item) => {
      acc[item.reason] = (acc[item.reason] ?? 0) + 1;
      return acc;
    }, {});

    console.log('');
    console.log(apply ? 'APPLIED' : 'DRY RUN (nothing copied or changed)');
    console.log(`Target bucket:          ${bucket ?? '(AWS_S3_BUCKET_NAME not set)'}`);
    console.log(`Distinct Blob files:    ${report.files.length}`);
    console.log(`Rows to point at S3:    ${report.rowsRewritten}${apply ? ' (rewritten)' : ''}`);
    console.log(`Rows left on Blob:      ${report.rowsLeftOnBlob} (copied, but no S3 route for that column yet)`);
    if (apply) {
      console.log(`Copied:                 ${report.copied}`);
      console.log(`Already in S3:          ${report.alreadyPresent}`);
      console.log(`Failed:                 ${report.failed.length}`);
    }
    for (const [reason, count] of Object.entries(skippedByReason)) {
      console.log(`Skipped (${reason}): ${count}`);
    }
    for (const file of report.files.slice(0, 5)) {
      console.log(`  e.g. ${file.key}`);
    }
    if (report.failed.length > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('Migration failed:', (error as Error).message);
  process.exitCode = 1;
});
