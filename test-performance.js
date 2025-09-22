import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const db = new sqlite3.verbose().Database(dbPath);

console.log('🚀 DirectFanZ Database Performance Test');
console.log('=====================================\n');

// Test queries that should benefit from our indexes
const testQueries = [
  {
    name: 'Users by Role Query',
    query: `SELECT role, COUNT(*) as count FROM users GROUP BY role`,
    description: 'Tests users_role_idx index'
  },
  {
    name: 'Recent Users Query',
    query: `SELECT COUNT(*) FROM users WHERE createdAt >= datetime('now', '-7 days')`,
    description: 'Tests users_createdAt_idx index'
  },
  {
    name: 'Artist Content Count',
    query: `SELECT COUNT(*) FROM content WHERE artistId IN (SELECT id FROM users WHERE role = 'ARTIST' LIMIT 1)`,
    description: 'Tests content_artistId_idx index'
  },
  {
    name: 'Recent Content Query',
    query: `SELECT COUNT(*) FROM content WHERE createdAt >= datetime('now', '-7 days')`,
    description: 'Tests content_createdAt_idx index'
  },
  {
    name: 'Active Subscriptions',
    query: `SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE'`,
    description: 'Tests subscriptions_status_idx index'
  }
];

// Function to run a single query and measure performance
function runQuery(queryInfo) {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime.bigint();
    
    db.all(queryInfo.query, [], (err, rows) => {
      if (err) {
        console.error(`❌ Error in ${queryInfo.name}:`, err.message);
        resolve({ name: queryInfo.name, error: err.message, duration: 0 });
        return;
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      
      console.log(`✅ ${queryInfo.name}:`);
      console.log(`   Duration: ${duration.toFixed(2)}ms`);
      console.log(`   Result: ${Array.isArray(rows) ? rows.length : 1} row(s)`);
      console.log(`   Description: ${queryInfo.description}\n`);
      
      resolve({ 
        name: queryInfo.name, 
        duration: duration.toFixed(2),
        rowCount: Array.isArray(rows) ? rows.length : 1,
        description: queryInfo.description
      });
    });
  });
}

// Run all performance tests
async function runPerformanceTests() {
  console.log('🔍 Testing database query performance...\n');
  
  const results = [];
  
  for (const queryInfo of testQueries) {
    const result = await runQuery(queryInfo);
    results.push(result);
  }
  
  // Summary
  console.log('📊 Performance Test Summary:');
  console.log('============================');
  
  const totalDuration = results.reduce((sum, r) => sum + parseFloat(r.duration || 0), 0);
  console.log(`Total Query Time: ${totalDuration.toFixed(2)}ms`);
  console.log(`Average Query Time: ${(totalDuration / results.length).toFixed(2)}ms`);
  
  const slowQueries = results.filter(r => parseFloat(r.duration || 0) > 10);
  if (slowQueries.length > 0) {
    console.log(`\n⚠️  Slow queries (>10ms): ${slowQueries.length}`);
    slowQueries.forEach(q => {
      console.log(`   - ${q.name}: ${q.duration}ms`);
    });
  } else {
    console.log('\n🎉 All queries are fast (<10ms)!');
  }
  
  // Index effectiveness check
  console.log('\n🎯 Index Effectiveness Check:');
  db.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%_idx'", [], (err, indexes) => {
    if (err) {
      console.error('Error checking indexes:', err);
    } else {
      console.log(`Total custom indexes created: ${indexes.length}`);
      console.log('Indexes:', indexes.map(i => i.name).join(', '));
    }
    
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('\n✅ Performance test completed successfully!');
      }
    });
  });
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runPerformanceTests().catch(console.error);