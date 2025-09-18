#!/usr/bin/env node

const http = require('http');
const https = require('https');

const HEALTH_CHECK_TIMEOUT = 5000;
const MAX_RETRIES = 3;

class HealthChecker {
  constructor() {
    this.checks = [
      { name: 'HTTP Server', fn: this.checkHttpServer.bind(this) },
      { name: 'Database Connection', fn: this.checkDatabase.bind(this) },
      { name: 'Redis Connection', fn: this.checkRedis.bind(this) },
      { name: 'Memory Usage', fn: this.checkMemoryUsage.bind(this) },
    ];
  }

  async checkHttpServer() {
    return new Promise((resolve, reject) => {
      const port = process.env.PORT || 3000;
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/api/health',
        method: 'GET',
        timeout: HEALTH_CHECK_TIMEOUT,
      };

      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve('HTTP server is responding');
        } else {
          reject(new Error(`HTTP server returned status ${res.statusCode}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTP server health check timed out'));
      });

      req.on('error', (err) => {
        reject(new Error(`HTTP server error: ${err.message}`));
      });

      req.end();
    });
  }

  async checkDatabase() {
    try {
      // This would typically use your database client
      // For now, we'll just check if DATABASE_URL is set
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL not configured');
      }
      return 'Database configuration is present';
    } catch (error) {
      throw new Error(`Database check failed: ${error.message}`);
    }
  }

  async checkRedis() {
    try {
      // This would typically use your Redis client
      // For now, we'll just check if REDIS_URL is set
      if (!process.env.REDIS_URL) {
        throw new Error('REDIS_URL not configured');
      }
      return 'Redis configuration is present';
    } catch (error) {
      throw new Error(`Redis check failed: ${error.message}`);
    }
  }

  async checkMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    // Alert if heap usage is over 500MB
    if (heapUsedMB > 500) {
      throw new Error(`High memory usage: ${heapUsedMB}MB heap used`);
    }
    
    return `Memory usage: ${heapUsedMB}MB/${heapTotalMB}MB heap`;
  }

  async runCheck(check, retries = 0) {
    try {
      const result = await check.fn();
      console.log(`✅ ${check.name}: ${result}`);
      return { success: true, message: result };
    } catch (error) {
      if (retries < MAX_RETRIES) {
        console.log(`⚠️  ${check.name} failed, retrying... (${retries + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.runCheck(check, retries + 1);
      }
      console.error(`❌ ${check.name}: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async runAll() {
    console.log('🔍 Running health checks...');
    const results = await Promise.all(
      this.checks.map(check => this.runCheck(check))
    );

    const failed = results.filter(result => !result.success);
    
    if (failed.length === 0) {
      console.log('✅ All health checks passed');
      process.exit(0);
    } else {
      console.error(`❌ ${failed.length}/${results.length} health checks failed`);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Health check received SIGTERM, exiting...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Health check received SIGINT, exiting...');
  process.exit(0);
});

// Run health checks
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runAll().catch((error) => {
    console.error('Health check error:', error);
    process.exit(1);
  });
}

module.exports = HealthChecker;