/**
 * Load testing script for Direct Fan Platform
 * 
 * This script simulates concurrent users performing various actions on the platform
 * to test system performance under load.
 * 
 * Usage: npm run test:load [-- --users=100 --duration=60]
 */

const http = require('http');
const https = require('https');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { program } = require('commander');

// Parse command line arguments
program
  .option('--users <number>', 'Number of concurrent users', 100)
  .option('--duration <number>', 'Test duration in seconds', 60)
  .option('--ramp-up <number>', 'Ramp up time in seconds', 10)
  .option('--target <string>', 'Target URL', 'http://localhost:3000')
  .parse();

const options = program.opts();

// Main thread logic
if (isMainThread) {
  const startTime = Date.now();
  const endTime = startTime + (options.duration * 1000);
  const userCount = parseInt(options.users);
  const rampUpTime = parseInt(options.rampUp) * 1000;
  const target = options.target;
  
  console.log(`Starting load test with ${userCount} concurrent users for ${options.duration} seconds`);
  console.log(`Target: ${target}`);
  console.log(`Ramp up time: ${options.rampUp} seconds`);
  
  // Statistics
  const stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimeTotal: 0,
    minResponseTime: Number.MAX_SAFE_INTEGER,
    maxResponseTime: 0,
    statusCodes: {},
    activeUsers: 0,
    completedUsers: 0,
  };
  
  // Create workers for each simulated user
  const userDelay = rampUpTime / userCount;
  
  for (let i = 0; i < userCount; i++) {
    setTimeout(() => {
      stats.activeUsers++;
      
      const worker = new Worker(__filename, {
        workerData: {
          userId: i,
          endTime,
          target,
        }
      });
      
      worker.on('message', (message) => {
        if (message.type === 'result') {
          stats.totalRequests++;
          
          if (message.success) {
            stats.successfulRequests++;
          } else {
            stats.failedRequests++;
          }
          
          stats.responseTimeTotal += message.responseTime;
          stats.minResponseTime = Math.min(stats.minResponseTime, message.responseTime);
          stats.maxResponseTime = Math.max(stats.maxResponseTime, message.responseTime);
          
          if (!stats.statusCodes[message.statusCode]) {
            stats.statusCodes[message.statusCode] = 0;
          }
          stats.statusCodes[message.statusCode]++;
        } else if (message.type === 'complete') {
          stats.activeUsers--;
          stats.completedUsers++;
          
          if (stats.completedUsers === userCount) {
            // All users have completed their scenarios
            printResults(stats, startTime);
            process.exit(0);
          }
        }
      });
      
      worker.on('error', (err) => {
        console.error(`Worker error: ${err}`);
        stats.activeUsers--;
        stats.completedUsers++;
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker exited with code ${code}`);
        }
        
        if (stats.completedUsers === userCount) {
          // All users have completed their scenarios
          printResults(stats, startTime);
          process.exit(0);
        }
      });
    }, i * userDelay);
  }
  
  // Print intermediate results every 5 seconds
  const intervalId = setInterval(() => {
    const elapsedTime = (Date.now() - startTime) / 1000;
    console.log(`--- ${elapsedTime.toFixed(1)}s elapsed ---`);
    console.log(`Active users: ${stats.activeUsers}`);
    console.log(`Requests: ${stats.totalRequests} (${stats.successfulRequests} successful, ${stats.failedRequests} failed)`);
    
    if (stats.totalRequests > 0) {
      const avgResponseTime = stats.responseTimeTotal / stats.totalRequests;
      console.log(`Avg response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`RPS: ${(stats.totalRequests / elapsedTime).toFixed(2)}`);
    }
    
    console.log('');
  }, 5000);
  
  // Ensure we stop after the specified duration
  setTimeout(() => {
    clearInterval(intervalId);
    console.log('Test duration completed');
    printResults(stats, startTime);
    process.exit(0);
  }, options.duration * 1000 + 1000); // Add 1 second buffer
  
} else {
  // Worker thread logic - simulates a single user
  const { userId, endTime, target } = workerData;
  
  // Define user scenarios
  const scenarios = [
    { weight: 40, name: 'browse', path: '/' },
    { weight: 20, name: 'discover', path: '/discover' },
    { weight: 15, name: 'artist_profile', path: '/artist/artist-1' },
    { weight: 10, name: 'fan_dashboard', path: '/dashboard/fan' },
    { weight: 10, name: 'artist_dashboard', path: '/dashboard/artist' },
    { weight: 5, name: 'content', path: '/artist/artist-1/content/content-1' },
  ];
  
  // Select scenarios based on weight
  function selectScenario() {
    const totalWeight = scenarios.reduce((sum, scenario) => sum + scenario.weight, 0);
    const randomArray = new Uint32Array(1);
    require('crypto').getRandomValues(randomArray);
    let random = (randomArray[0] / (0xFFFFFFFF + 1)) * totalWeight;
    
    for (const scenario of scenarios) {
      random -= scenario.weight;
      if (random <= 0) {
        return scenario;
      }
    }
    
    return scenarios[0]; // Fallback
  }
  
  // Simulate user behavior
  async function simulateUser() {
    try {
      // Continue until the test duration is reached
      while (Date.now() < endTime) {
        const scenario = selectScenario();
        await makeRequest(scenario);
        
        // Random pause between 1-5 seconds to simulate user behavior
        const randomArray = new Uint32Array(1);
        require('crypto').getRandomValues(randomArray);
        const delay = 1000 + (randomArray[0] / (0xFFFFFFFF + 1)) * 4000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      parentPort.postMessage({ type: 'complete', userId });
    } catch (error) {
      console.error(`User ${userId} error: ${error.message}`);
      parentPort.postMessage({ type: 'complete', userId });
    }
  }
  
  // Make HTTP request
  function makeRequest(scenario) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const url = `${target}${scenario.path}`;
      
      const client = url.startsWith('https') ? https : http;
      
      const req = client.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          parentPort.postMessage({
            type: 'result',
            userId,
            scenario: scenario.name,
            url,
            statusCode: res.statusCode,
            responseTime,
            success: res.statusCode >= 200 && res.statusCode < 400,
          });
          
          resolve();
        });
      });
      
      req.on('error', (error) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        parentPort.postMessage({
          type: 'result',
          userId,
          scenario: scenario.name,
          url,
          statusCode: 0,
          responseTime,
          success: false,
          error: error.message,
        });
        
        resolve();
      });
      
      req.end();
    });
  }
  
  // Start simulating user
  simulateUser();
}

// Print final test results
function printResults(stats, startTime) {
  const testDuration = (Date.now() - startTime) / 1000;
  
  console.log('\n========== LOAD TEST RESULTS ==========');
  console.log(`Test duration: ${testDuration.toFixed(2)} seconds`);
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Successful requests: ${stats.successfulRequests} (${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Failed requests: ${stats.failedRequests} (${((stats.failedRequests / stats.totalRequests) * 100).toFixed(2)}%)`);
  
  if (stats.totalRequests > 0) {
    console.log(`Requests per second: ${(stats.totalRequests / testDuration).toFixed(2)}`);
    console.log(`Average response time: ${(stats.responseTimeTotal / stats.totalRequests).toFixed(2)}ms`);
    console.log(`Min response time: ${stats.minResponseTime}ms`);
    console.log(`Max response time: ${stats.maxResponseTime}ms`);
  }
  
  console.log('\nStatus code distribution:');
  Object.entries(stats.statusCodes).forEach(([code, count]) => {
    console.log(`  ${code}: ${count} (${((count / stats.totalRequests) * 100).toFixed(2)}%)`);
  });
  
  console.log('\n=======================================');
}