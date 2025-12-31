#!/usr/bin/env node

console.log('🧪 Testing Homepage Functionality\n');

// Test 1: Start dev server and check if it loads
console.log('1. Starting development server...');
const { spawn } = require('child_process');

const server = spawn('npm', ['run', 'dev'], { 
  stdio: 'pipe',
  cwd: process.cwd()
});

let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Ready') || output.includes('localhost:3000')) {
    serverReady = true;
    console.log('✅ Server started successfully');
    
    // Test homepage after 3 seconds
    setTimeout(() => {
      console.log('\n2. Testing homepage...');
      const http = require('http');
      
      const req = http.get('http://localhost:3000', (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Homepage loads successfully');
          console.log('✅ Status:', res.statusCode);
        } else {
          console.log('❌ Homepage failed:', res.statusCode);
        }
        
        server.kill();
        process.exit(0);
      });
      
      req.on('error', (err) => {
        console.log('❌ Connection failed:', err.message);
        server.kill();
        process.exit(1);
      });
      
      req.setTimeout(10000, () => {
        console.log('❌ Request timeout');
        server.kill();
        process.exit(1);
      });
    }, 3000);
  }
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  if (error.includes('Error') || error.includes('Failed')) {
    console.log('❌ Server error:', error);
    server.kill();
    process.exit(1);
  }
});

// Timeout after 30 seconds
setTimeout(() => {
  if (!serverReady) {
    console.log('❌ Server failed to start within 30 seconds');
    server.kill();
    process.exit(1);
  }
}, 30000);