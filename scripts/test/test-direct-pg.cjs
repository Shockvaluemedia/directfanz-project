require('dotenv').config({ path: '.env.local' });

async function testDirectPostgres() {
  console.log('=== Direct PostgreSQL Test ===');
  
  try {
    // Install pg if not available
    let pg;
    try {
      pg = require('pg');
    } catch (e) {
      console.log('Installing pg package...');
      const { execSync } = require('child_process');
      execSync('npm install pg --save-dev', { stdio: 'inherit' });
      pg = require('pg');
    }
    
    const { Pool } = pg;
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    console.log('Attempting direct PostgreSQL connection...');
    
    const client = await pool.connect();
    console.log('✅ Direct PostgreSQL connection successful');
    
    const result = await client.query(`
      SELECT id, email, role, (password IS NOT NULL) as has_password 
      FROM users 
      WHERE email = $1
    `, ['creator@test.com']);
    
    console.log('Query results:');
    console.log('Rows found:', result.rows.length);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('User:', user.email);
      console.log('Role:', user.role);
      console.log('Has password:', user.has_password);
    } else {
      console.log('❌ No user found with email creator@test.com');
    }
    
    client.release();
    await pool.end();
    console.log('Connection closed successfully');
    
  } catch (error) {
    console.error('Error during direct PostgreSQL test:', error.message);
  }
}

testDirectPostgres();