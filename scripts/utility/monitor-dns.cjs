#!/usr/bin/env node

/**
 * DirectFanz.io DNS Monitoring Script
 * Monitors DNS propagation progress for the custom domain
 */

const { spawn } = require('child_process');
const { promisify } = require('util');

// Configuration
const DOMAIN = 'directfanz.io';
const WWW_DOMAIN = 'www.directfanz.io';
const TARGET_IP = '76.76.21.21'; // Vercel IP from domain setup guide
const TARGET_CNAME = 'cname.vercel-dns.com';
const CHECK_INTERVAL = 30000; // 30 seconds
const MAX_CHECKS = 120; // 60 minutes worth of checks

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function log(color, prefix, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors[color]}${prefix}${colors.reset} ${message}`);
}

function logInfo(message) { log('blue', 'ℹ️ INFO:', message); }
function logSuccess(message) { log('green', '✅ SUCCESS:', message); }
function logWarning(message) { log('yellow', '⚠️  WARNING:', message); }
function logError(message) { log('red', '❌ ERROR:', message); }
function logProgress(message) { log('cyan', '🔄 CHECKING:', message); }
function logDNS(message) { log('magenta', '🌐 DNS:', message); }

// DNS lookup helper
function nslookup(domain) {
  return new Promise((resolve, reject) => {
    const nslookup = spawn('nslookup', [domain]);
    let output = '';
    let error = '';

    nslookup.stdout.on('data', (data) => {
      output += data.toString();
    });

    nslookup.stderr.on('data', (data) => {
      error += data.toString();
    });

    nslookup.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(error || `nslookup failed with code ${code}`));
      }
    });

    nslookup.on('error', (err) => {
      reject(err);
    });
  });
}

// Parse nslookup output for A records
function parseARecord(output) {
  const lines = output.split('\n');
  const addresses = [];
  
  for (const line of lines) {
    if (line.includes('Address:') && !line.includes('#53')) {
      const match = line.match(/Address:\s*(.+)/);
      if (match) {
        addresses.push(match[1].trim());
      }
    }
  }
  
  return addresses;
}

// Parse nslookup output for CNAME records
function parseCNAME(output) {
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (line.includes('canonical name')) {
      const match = line.match(/canonical name = (.+)/);
      if (match) {
        return match[1].trim();
      }
    }
  }
  
  return null;
}

// Check DNS status for a domain
async function checkDNS(domain, type = 'A') {
  try {
    logProgress(`Checking ${type} record for ${domain}`);
    const output = await nslookup(domain);
    
    if (type === 'A') {
      const addresses = parseARecord(output);
      return { success: true, addresses, output };
    } else if (type === 'CNAME') {
      const cname = parseCNAME(output);
      return { success: true, cname, output };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Comprehensive DNS check
async function performDNSCheck() {
  const results = {
    apex: { configured: false, correct: false },
    www: { configured: false, correct: false },
    timestamp: new Date().toISOString()
  };

  console.log('\n' + '='.repeat(60));
  logDNS('Starting DNS propagation check...');

  // Check apex domain (directfanz.io)
  const apexResult = await checkDNS(DOMAIN, 'A');
  
  if (apexResult.success && apexResult.addresses.length > 0) {
    results.apex.configured = true;
    const currentIP = apexResult.addresses[0];
    
    logInfo(`${DOMAIN} → ${currentIP}`);
    
    if (currentIP === TARGET_IP) {
      results.apex.correct = true;
      logSuccess('✓ Apex domain correctly pointing to Vercel');
    } else if (currentIP === '76.76.19.19') {
      logWarning('⚠ Apex domain still pointing to Hostinger parking page');
      logInfo('Need to update A record to: 76.76.21.21');
    } else {
      logWarning(`⚠ Apex domain pointing to unexpected IP: ${currentIP}`);
    }
  } else {
    logError(`❌ Failed to resolve ${DOMAIN}: ${apexResult.error}`);
  }

  // Check www subdomain
  const wwwResult = await checkDNS(WWW_DOMAIN, 'CNAME');
  
  if (wwwResult.success && wwwResult.cname) {
    results.www.configured = true;
    logInfo(`${WWW_DOMAIN} → ${wwwResult.cname}`);
    
    if (wwwResult.cname === TARGET_CNAME) {
      results.www.correct = true;
      logSuccess('✓ WWW subdomain correctly configured');
    } else {
      logWarning(`⚠ WWW subdomain pointing to: ${wwwResult.cname}`);
    }
  } else {
    logError(`❌ Failed to resolve ${WWW_DOMAIN}: ${wwwResult.error}`);
  }

  // Overall status
  console.log('\n📊 DNS Status Summary:');
  console.log(`   Apex Domain (${DOMAIN}): ${results.apex.correct ? '✅ Ready' : '❌ Needs Update'}`);
  console.log(`   WWW Subdomain (${WWW_DOMAIN}): ${results.www.correct ? '✅ Ready' : '❌ Needs Update'}`);
  
  const overallReady = results.apex.correct && results.www.correct;
  
  if (overallReady) {
    logSuccess('🎉 DNS fully propagated! Domain ready for testing.');
    console.log('\n💡 Next Steps:');
    console.log('   • Run: node test-domain.cjs');
    console.log('   • All domain tests should now pass');
    console.log('   • DirectFanz.io should be fully operational\n');
    return true;
  } else {
    logInfo('DNS propagation still in progress...');
    
    if (!results.apex.correct) {
      console.log('\n🛠️  Required DNS Changes at Hostinger:');
      console.log(`   • A Record: @ → ${TARGET_IP}`);
    }
    
    console.log('\n⏱️  DNS propagation can take 15 minutes to 48 hours');
    console.log('   • Changes are usually visible within 30 minutes');
    console.log('   • Full global propagation may take longer\n');
  }
  
  return false;
}

// Monitor DNS with periodic checks
async function monitorDNS() {
  console.log('🌐 DirectFanz.io DNS Propagation Monitor');
  console.log(`Target: ${DOMAIN} → ${TARGET_IP}`);
  console.log(`Checking every ${CHECK_INTERVAL/1000} seconds\n`);
  
  logInfo('Starting DNS monitoring...');
  logInfo('Press Ctrl+C to stop monitoring');

  let checkCount = 0;
  let isReady = false;

  while (checkCount < MAX_CHECKS && !isReady) {
    checkCount++;
    
    try {
      isReady = await performDNSCheck();
      
      if (isReady) {
        logSuccess('🚀 DNS propagation complete!');
        break;
      }
      
      // Wait before next check
      if (checkCount < MAX_CHECKS) {
        const remaining = MAX_CHECKS - checkCount;
        logInfo(`Waiting ${CHECK_INTERVAL/1000}s before next check... (${remaining} checks remaining)`);
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
      }
      
    } catch (error) {
      logError(`DNS check failed: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
  }

  if (!isReady) {
    logWarning('⏰ Maximum monitoring time reached');
    console.log('\n💡 If DNS still isn\'t working:');
    console.log('   • Verify DNS settings at Hostinger');
    console.log('   • Contact Hostinger support if needed');
    console.log('   • Run this script again later');
  }

  return isReady;
}

// One-time DNS check
async function checkOnce() {
  console.log('🌐 DirectFanz.io DNS Status Check\n');
  
  const isReady = await performDNSCheck();
  
  if (isReady) {
    console.log('\n🎯 Recommendation: Run domain tests now');
    console.log('   node test-domain.cjs');
  } else {
    console.log('\n🎯 Recommendation: Run continuous monitoring');
    console.log('   node monitor-dns.cjs --monitor');
  }
  
  return isReady;
}

// Global DNS propagation check using multiple DNS servers
async function checkGlobalPropagation() {
  const dnsServers = [
    { name: 'Google', server: '8.8.8.8' },
    { name: 'Cloudflare', server: '1.1.1.1' },
    { name: 'OpenDNS', server: '208.67.222.222' }
  ];
  
  console.log('🌍 Checking global DNS propagation...\n');
  
  for (const dns of dnsServers) {
    try {
      logProgress(`Checking via ${dns.name} DNS (${dns.server})`);
      
      const result = await new Promise((resolve, reject) => {
        const dig = spawn('dig', [`@${dns.server}`, DOMAIN, 'A', '+short']);
        let output = '';
        
        dig.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        dig.on('close', (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`dig failed with code ${code}`));
          }
        });
        
        dig.on('error', reject);
      });
      
      if (result) {
        const ip = result.split('\n')[0];
        if (ip === TARGET_IP) {
          logSuccess(`✓ ${dns.name}: ${ip} (Correct)`);
        } else {
          logWarning(`⚠ ${dns.name}: ${ip} (Old record)`);
        }
      } else {
        logError(`❌ ${dns.name}: No response`);
      }
      
    } catch (error) {
      logError(`❌ ${dns.name}: ${error.message}`);
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n🛑 DNS monitoring stopped by user');
  process.exit(0);
});

// Main execution
async function main() {
  try {
    switch (command) {
      case '--monitor':
      case '-m':
        await monitorDNS();
        break;
      case '--global':
      case '-g':
        await checkGlobalPropagation();
        break;
      case '--help':
      case '-h':
        console.log('DirectFanz.io DNS Monitor\n');
        console.log('Usage:');
        console.log('  node monitor-dns.cjs           # Single DNS check');
        console.log('  node monitor-dns.cjs --monitor # Continuous monitoring');
        console.log('  node monitor-dns.cjs --global  # Check global propagation');
        console.log('  node monitor-dns.cjs --help    # Show this help\n');
        break;
      default:
        const isReady = await checkOnce();
        process.exit(isReady ? 0 : 1);
    }
  } catch (error) {
    logError(`Script failed: ${error.message}`);
    process.exit(1);
  }
}

// Export for testing
if (require.main === module) {
  main();
}

module.exports = { checkDNS, performDNSCheck, monitorDNS };