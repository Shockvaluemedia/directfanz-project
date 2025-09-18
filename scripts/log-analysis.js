#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

/**
 * Log Analysis and Aggregation Tool for Direct Fan Platform
 * 
 * This script analyzes application logs to extract insights,
 * detect patterns, and generate reports for production monitoring.
 */

class LogAnalyzer {
  constructor(options = {}) {
    this.logDir = options.logDir || './logs';
    this.outputDir = options.outputDir || './log-reports';
    this.timeRange = options.timeRange || { hours: 24 }; // Last 24 hours by default
    this.patterns = {
      error: /ERROR|error/,
      warning: /WARN|warn|warning/,
      security: /security|auth|login|Security/i,
      performance: /slow|timeout|performance|duration/i,
      business: /payment|subscription|signup|login/i,
    };
    this.metrics = {
      totalLines: 0,
      errorCount: 0,
      warningCount: 0,
      securityEvents: 0,
      performanceIssues: 0,
      businessEvents: 0,
      uniqueUsers: new Set(),
      apiEndpoints: new Map(),
      errorTypes: new Map(),
      responseTimeDistribution: [],
      statusCodes: new Map(),
      hourlyActivity: new Array(24).fill(0),
    };
  }

  async analyze() {
    console.log('🔍 Starting log analysis...');
    
    try {
      await this.ensureOutputDir();
      const logFiles = await this.findLogFiles();
      
      if (logFiles.length === 0) {
        console.log('❌ No log files found in', this.logDir);
        return;
      }

      console.log(`📄 Found ${logFiles.length} log files`);
      
      for (const logFile of logFiles) {
        console.log(`📖 Analyzing ${logFile}...`);
        await this.analyzeLogFile(logFile);
      }

      await this.generateReports();
      console.log('✅ Log analysis completed');
      
    } catch (error) {
      console.error('❌ Log analysis failed:', error.message);
      throw error;
    }
  }

  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async findLogFiles() {
    try {
      const files = await fs.readdir(this.logDir);
      return files
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(this.logDir, file));
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📁 Log directory not found, creating it...');
        await fs.mkdir(this.logDir, { recursive: true });
        return [];
      }
      throw error;
    }
  }

  async analyzeLogFile(filePath) {
    const fileStream = require('fs').createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      this.analyzeLine(line);
    }
  }

  analyzeLine(line) {
    this.metrics.totalLines++;
    
    try {
      // Try to parse as JSON first (structured logs)
      const logEntry = JSON.parse(line);
      this.analyzeStructuredLog(logEntry);
    } catch {
      // Fall back to plain text analysis
      this.analyzePlainTextLog(line);
    }
  }

  analyzeStructuredLog(logEntry) {
    const { level, message, timestamp, context = {}, metadata = {} } = logEntry;
    
    // Count log levels
    if (level === 'error' || level === 'ERROR') {
      this.metrics.errorCount++;
      this.recordErrorType(logEntry.error?.name || 'Unknown Error');
    } else if (level === 'warn' || level === 'WARN') {
      this.metrics.warningCount++;
    }

    // Extract user information
    if (context.userId) {
      this.metrics.uniqueUsers.add(context.userId);
    }

    // Track API endpoints
    if (context.method && context.url) {
      const endpoint = `${context.method} ${context.url}`;
      this.metrics.apiEndpoints.set(
        endpoint, 
        (this.metrics.apiEndpoints.get(endpoint) || 0) + 1
      );
    }

    // Track status codes
    if (context.statusCode) {
      this.metrics.statusCodes.set(
        context.statusCode,
        (this.metrics.statusCodes.get(context.statusCode) || 0) + 1
      );
    }

    // Track response times
    if (context.duration) {
      this.metrics.responseTimeDistribution.push(context.duration);
    }

    // Track hourly activity
    if (timestamp) {
      const hour = new Date(timestamp).getHours();
      this.metrics.hourlyActivity[hour]++;
    }

    // Pattern matching
    const fullText = `${level} ${message} ${JSON.stringify(context)} ${JSON.stringify(metadata)}`;
    this.checkPatterns(fullText);
  }

  analyzePlainTextLog(line) {
    // Extract timestamp if possible
    const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    if (timestampMatch) {
      const hour = new Date(timestampMatch[1]).getHours();
      if (!isNaN(hour)) {
        this.metrics.hourlyActivity[hour]++;
      }
    }

    // Check for log levels
    if (/ERROR|error/.test(line)) {
      this.metrics.errorCount++;
    } else if (/WARN|warn|warning/i.test(line)) {
      this.metrics.warningCount++;
    }

    this.checkPatterns(line);
  }

  checkPatterns(text) {
    if (this.patterns.security.test(text)) {
      this.metrics.securityEvents++;
    }
    if (this.patterns.performance.test(text)) {
      this.metrics.performanceIssues++;
    }
    if (this.patterns.business.test(text)) {
      this.metrics.businessEvents++;
    }
  }

  recordErrorType(errorType) {
    this.metrics.errorTypes.set(
      errorType,
      (this.metrics.errorTypes.get(errorType) || 0) + 1
    );
  }

  async generateReports() {
    console.log('📊 Generating reports...');
    
    await Promise.all([
      this.generateSummaryReport(),
      this.generateErrorReport(),
      this.generatePerformanceReport(),
      this.generateSecurityReport(),
      this.generateBusinessReport(),
    ]);
  }

  async generateSummaryReport() {
    const report = {
      timestamp: new Date().toISOString(),
      timeRange: this.timeRange,
      summary: {
        totalLogLines: this.metrics.totalLines,
        errorRate: this.metrics.totalLines > 0 ? 
          (this.metrics.errorCount / this.metrics.totalLines * 100).toFixed(2) + '%' : '0%',
        warningRate: this.metrics.totalLines > 0 ? 
          (this.metrics.warningCount / this.metrics.totalLines * 100).toFixed(2) + '%' : '0%',
        uniqueUsers: this.metrics.uniqueUsers.size,
        totalApiRequests: Array.from(this.metrics.apiEndpoints.values())
          .reduce((sum, count) => sum + count, 0),
        securityEvents: this.metrics.securityEvents,
        performanceIssues: this.metrics.performanceIssues,
        businessEvents: this.metrics.businessEvents,
      },
      topEndpoints: this.getTopEndpoints(10),
      statusCodeDistribution: Object.fromEntries(this.metrics.statusCodes),
      hourlyActivity: this.metrics.hourlyActivity,
      responseTimeStats: this.calculateResponseTimeStats(),
    };

    await this.writeReport('summary.json', report);
    await this.generateSummaryMarkdown(report);
  }

  async generateErrorReport() {
    const errorReport = {
      timestamp: new Date().toISOString(),
      totalErrors: this.metrics.errorCount,
      errorTypes: Object.fromEntries(this.metrics.errorTypes),
      errorRate: this.metrics.totalLines > 0 ? 
        (this.metrics.errorCount / this.metrics.totalLines * 100).toFixed(2) + '%' : '0%',
      recommendations: this.generateErrorRecommendations(),
    };

    await this.writeReport('errors.json', errorReport);
  }

  async generatePerformanceReport() {
    const stats = this.calculateResponseTimeStats();
    const performanceReport = {
      timestamp: new Date().toISOString(),
      responseTimeStats: stats,
      slowRequests: this.metrics.responseTimeDistribution.filter(time => time > 2000).length,
      performanceIssues: this.metrics.performanceIssues,
      recommendations: this.generatePerformanceRecommendations(stats),
    };

    await this.writeReport('performance.json', performanceReport);
  }

  async generateSecurityReport() {
    const securityReport = {
      timestamp: new Date().toISOString(),
      securityEvents: this.metrics.securityEvents,
      recommendations: this.generateSecurityRecommendations(),
    };

    await this.writeReport('security.json', securityReport);
  }

  async generateBusinessReport() {
    const businessReport = {
      timestamp: new Date().toISOString(),
      businessEvents: this.metrics.businessEvents,
      activeUsers: this.metrics.uniqueUsers.size,
      topEndpoints: this.getTopEndpoints(5),
      recommendations: this.generateBusinessRecommendations(),
    };

    await this.writeReport('business.json', businessReport);
  }

  async generateSummaryMarkdown(report) {
    const markdown = `# Log Analysis Report

Generated: ${new Date().toLocaleString()}

## Summary

- **Total Log Lines**: ${report.summary.totalLogLines.toLocaleString()}
- **Error Rate**: ${report.summary.errorRate}
- **Warning Rate**: ${report.summary.warningRate}
- **Unique Users**: ${report.summary.uniqueUsers}
- **Total API Requests**: ${report.summary.totalApiRequests.toLocaleString()}
- **Security Events**: ${report.summary.securityEvents}
- **Performance Issues**: ${report.summary.performanceIssues}
- **Business Events**: ${report.summary.businessEvents}

## Top API Endpoints

${report.topEndpoints.map((endpoint, index) => 
  `${index + 1}. \`${endpoint.endpoint}\` - ${endpoint.count} requests`
).join('\n')}

## Response Time Statistics

- **Average**: ${report.responseTimeStats.average}ms
- **Median**: ${report.responseTimeStats.median}ms
- **95th Percentile**: ${report.responseTimeStats.p95}ms
- **99th Percentile**: ${report.responseTimeStats.p99}ms

## Status Code Distribution

${Object.entries(report.statusCodeDistribution).map(([code, count]) =>
  `- **${code}**: ${count} (${((count / report.summary.totalApiRequests) * 100).toFixed(1)}%)`
).join('\n')}

## Hourly Activity

Peak activity hours:
${report.hourlyActivity.map((count, hour) => ({ hour, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 5)
  .map(({ hour, count }) => `- **${hour}:00-${hour + 1}:00**: ${count} events`)
  .join('\n')}
`;

    await this.writeReport('summary.md', markdown);
  }

  getTopEndpoints(limit) {
    return Array.from(this.metrics.apiEndpoints.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  calculateResponseTimeStats() {
    const times = this.metrics.responseTimeDistribution.sort((a, b) => a - b);
    if (times.length === 0) return null;

    const sum = times.reduce((a, b) => a + b, 0);
    const average = Math.round(sum / times.length);
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];

    return { average, median, p95, p99, count: times.length };
  }

  generateErrorRecommendations() {
    const recommendations = [];
    
    if (this.metrics.errorCount > this.metrics.totalLines * 0.05) {
      recommendations.push('High error rate detected (>5%). Investigate root causes immediately.');
    }
    
    const topError = Array.from(this.metrics.errorTypes.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topError && topError[1] > 10) {
      recommendations.push(`Most frequent error: ${topError[0]} (${topError[1]} occurrences). Focus debugging efforts here.`);
    }
    
    return recommendations;
  }

  generatePerformanceRecommendations(stats) {
    const recommendations = [];
    
    if (stats && stats.p95 > 2000) {
      recommendations.push('95th percentile response time >2s. Consider performance optimizations.');
    }
    
    if (this.metrics.performanceIssues > 100) {
      recommendations.push('High number of performance-related log entries. Review slow queries and operations.');
    }
    
    return recommendations;
  }

  generateSecurityRecommendations() {
    const recommendations = [];
    
    if (this.metrics.securityEvents > 50) {
      recommendations.push('High number of security events detected. Review for potential threats.');
    }
    
    return recommendations;
  }

  generateBusinessRecommendations() {
    const recommendations = [];
    
    if (this.metrics.uniqueUsers.size < 10) {
      recommendations.push('Low user activity detected. Consider user engagement strategies.');
    }
    
    return recommendations;
  }

  async writeReport(filename, data) {
    const filePath = path.join(this.outputDir, filename);
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`📄 Generated report: ${filename}`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) {
      options[key] = value;
    }
  }

  console.log('🚀 Direct Fan Platform Log Analyzer');
  console.log('=====================================');
  
  const analyzer = new LogAnalyzer(options);
  
  try {
    await analyzer.analyze();
    
    console.log('\n📊 Analysis Summary:');
    console.log(`- Total Lines: ${analyzer.metrics.totalLines.toLocaleString()}`);
    console.log(`- Errors: ${analyzer.metrics.errorCount}`);
    console.log(`- Warnings: ${analyzer.metrics.warningCount}`);
    console.log(`- Unique Users: ${analyzer.metrics.uniqueUsers.size}`);
    console.log(`- Security Events: ${analyzer.metrics.securityEvents}`);
    console.log(`- Performance Issues: ${analyzer.metrics.performanceIssues}`);
    console.log(`\n📁 Reports generated in: ${analyzer.outputDir}`);
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LogAnalyzer;