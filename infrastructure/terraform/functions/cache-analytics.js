// Cache Analytics Lambda Function for DirectFanz Platform
// Analyzes cache performance and provides optimization recommendations

const AWS = require('aws-sdk');

const cloudwatch = new AWS.CloudWatch();
const cloudfront = new AWS.CloudFront();
const sns = new AWS.SNS();

const PROJECT_NAME = process.env.PROJECT_NAME || '${project_name}';
const ENVIRONMENT = process.env.ENVIRONMENT || '${environment}';
const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

exports.handler = async (event) => {
    console.log('Starting cache analytics analysis...');
    
    try {
        // Get cache performance metrics
        const cacheMetrics = await getCacheMetrics();
        
        // Analyze cache performance
        const analysis = await analyzeCachePerformance(cacheMetrics);
        
        // Generate recommendations
        const recommendations = generateOptimizationRecommendations(analysis);
        
        // Send alerts if performance is below threshold
        if (recommendations.length > 0) {
            await sendOptimizationAlert(analysis, recommendations);
        }
        
        // Log analysis results
        console.log('Cache analysis completed:', {
            cacheHitRate: analysis.cacheHitRate,
            originLatency: analysis.originLatency,
            recommendationsCount: recommendations.length
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Cache analytics completed',
                analysis,
                recommendations
            })
        };
        
    } catch (error) {
        console.error('Error in cache analytics:', error);
        
        // Send error notification
        await sns.publish({
            TopicArn: SNS_TOPIC_ARN,
            Subject: `Cache Analytics Failed - ${PROJECT_NAME}`,
            Message: `Error occurred during cache analytics: ${error.message}`
        }).promise();
        
        throw error;
    }
};

async function getCacheMetrics() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const metrics = {};
    
    // Get cache hit rate
    const cacheHitRateParams = {
        Namespace: 'AWS/CloudFront',
        MetricName: 'CacheHitRate',
        Dimensions: [
            {
                Name: 'DistributionId',
                Value: DISTRIBUTION_ID
            }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 hour
        Statistics: ['Average']
    };
    
    const cacheHitRateResult = await cloudwatch.getMetricStatistics(cacheHitRateParams).promise();
    metrics.cacheHitRate = cacheHitRateResult.Datapoints;
    
    // Get origin latency
    const originLatencyParams = {
        Namespace: 'AWS/CloudFront',
        MetricName: 'OriginLatency',
        Dimensions: [
            {
                Name: 'DistributionId',
                Value: DISTRIBUTION_ID
            }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Average', 'Maximum']
    };
    
    const originLatencyResult = await cloudwatch.getMetricStatistics(originLatencyParams).promise();
    metrics.originLatency = originLatencyResult.Datapoints;
    
    // Get request count
    const requestCountParams = {
        Namespace: 'AWS/CloudFront',
        MetricName: 'Requests',
        Dimensions: [
            {
                Name: 'DistributionId',
                Value: DISTRIBUTION_ID
            }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Sum']
    };
    
    const requestCountResult = await cloudwatch.getMetricStatistics(requestCountParams).promise();
    metrics.requestCount = requestCountResult.Datapoints;
    
    // Get bytes downloaded
    const bytesDownloadedParams = {
        Namespace: 'AWS/CloudFront',
        MetricName: 'BytesDownloaded',
        Dimensions: [
            {
                Name: 'DistributionId',
                Value: DISTRIBUTION_ID
            }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Sum']
    };
    
    const bytesDownloadedResult = await cloudwatch.getMetricStatistics(bytesDownloadedParams).promise();
    metrics.bytesDownloaded = bytesDownloadedResult.Datapoints;
    
    // Get 4xx error rate
    const errorRateParams = {
        Namespace: 'AWS/CloudFront',
        MetricName: '4xxErrorRate',
        Dimensions: [
            {
                Name: 'DistributionId',
                Value: DISTRIBUTION_ID
            }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Average']
    };
    
    const errorRateResult = await cloudwatch.getMetricStatistics(errorRateParams).promise();
    metrics.errorRate = errorRateResult.Datapoints;
    
    return metrics;
}

async function analyzeCachePerformance(metrics) {
    const analysis = {
        period: '24 hours',
        timestamp: new Date().toISOString()
    };
    
    // Analyze cache hit rate
    if (metrics.cacheHitRate && metrics.cacheHitRate.length > 0) {
        const hitRates = metrics.cacheHitRate.map(dp => dp.Average);
        analysis.cacheHitRate = {
            average: hitRates.reduce((a, b) => a + b, 0) / hitRates.length,
            minimum: Math.min(...hitRates),
            maximum: Math.max(...hitRates),
            trend: calculateTrend(metrics.cacheHitRate)
        };
    }
    
    // Analyze origin latency
    if (metrics.originLatency && metrics.originLatency.length > 0) {
        const latencies = metrics.originLatency.map(dp => dp.Average);
        analysis.originLatency = {
            average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            minimum: Math.min(...latencies),
            maximum: Math.max(...metrics.originLatency.map(dp => dp.Maximum)),
            trend: calculateTrend(metrics.originLatency)
        };
    }
    
    // Analyze request patterns
    if (metrics.requestCount && metrics.requestCount.length > 0) {
        const requests = metrics.requestCount.map(dp => dp.Sum);
        analysis.requestCount = {
            total: requests.reduce((a, b) => a + b, 0),
            average: requests.reduce((a, b) => a + b, 0) / requests.length,
            peak: Math.max(...requests),
            trend: calculateTrend(metrics.requestCount)
        };
    }
    
    // Analyze bandwidth usage
    if (metrics.bytesDownloaded && metrics.bytesDownloaded.length > 0) {
        const bytes = metrics.bytesDownloaded.map(dp => dp.Sum);
        analysis.bandwidth = {
            total: bytes.reduce((a, b) => a + b, 0),
            average: bytes.reduce((a, b) => a + b, 0) / bytes.length,
            peak: Math.max(...bytes),
            trend: calculateTrend(metrics.bytesDownloaded)
        };
    }
    
    // Analyze error rates
    if (metrics.errorRate && metrics.errorRate.length > 0) {
        const errors = metrics.errorRate.map(dp => dp.Average);
        analysis.errorRate = {
            average: errors.reduce((a, b) => a + b, 0) / errors.length,
            maximum: Math.max(...errors),
            trend: calculateTrend(metrics.errorRate)
        };
    }
    
    return analysis;
}

function calculateTrend(datapoints) {
    if (!datapoints || datapoints.length < 2) {
        return 'insufficient_data';
    }
    
    // Sort by timestamp
    const sorted = datapoints.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
    
    // Calculate simple trend (first half vs second half)
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);
    
    const firstAvg = firstHalf.reduce((sum, dp) => sum + (dp.Average || dp.Sum || dp.Maximum), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, dp) => sum + (dp.Average || dp.Sum || dp.Maximum), 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
}

function generateOptimizationRecommendations(analysis) {
    const recommendations = [];
    
    // Cache hit rate recommendations
    if (analysis.cacheHitRate && analysis.cacheHitRate.average < 85) {
        recommendations.push({
            type: 'CACHE_HIT_RATE',
            priority: 'HIGH',
            title: 'Low Cache Hit Rate Detected',
            description: `Current cache hit rate is ${analysis.cacheHitRate.average.toFixed(1)}%, below the 85% target`,
            suggestions: [
                'Review cache policies for frequently accessed content',
                'Increase TTL values for static assets',
                'Implement cache warming for popular content',
                'Optimize query string and header forwarding'
            ],
            estimatedImpact: 'Up to 20% reduction in origin requests'
        });
    }
    
    // Origin latency recommendations
    if (analysis.originLatency && analysis.originLatency.average > 500) {
        recommendations.push({
            type: 'ORIGIN_LATENCY',
            priority: 'MEDIUM',
            title: 'High Origin Latency Detected',
            description: `Average origin latency is ${analysis.originLatency.average.toFixed(0)}ms, above the 500ms threshold`,
            suggestions: [
                'Optimize application response times',
                'Consider using origin shield',
                'Review database query performance',
                'Implement application-level caching'
            ],
            estimatedImpact: 'Improved user experience and reduced cache misses'
        });
    }
    
    // Error rate recommendations
    if (analysis.errorRate && analysis.errorRate.average > 2) {
        recommendations.push({
            type: 'ERROR_RATE',
            priority: 'HIGH',
            title: 'High Error Rate Detected',
            description: `4xx error rate is ${analysis.errorRate.average.toFixed(1)}%, above the 2% threshold`,
            suggestions: [
                'Review application logs for common errors',
                'Implement proper error pages',
                'Check for broken links or missing resources',
                'Optimize URL routing and redirects'
            ],
            estimatedImpact: 'Improved user experience and cache efficiency'
        });
    }
    
    // Trend-based recommendations
    if (analysis.cacheHitRate && analysis.cacheHitRate.trend === 'decreasing') {
        recommendations.push({
            type: 'CACHE_TREND',
            priority: 'MEDIUM',
            title: 'Declining Cache Performance',
            description: 'Cache hit rate is trending downward over the past 24 hours',
            suggestions: [
                'Investigate recent application changes',
                'Review new content types and caching rules',
                'Check for increased dynamic content',
                'Consider adjusting cache policies'
            ],
            estimatedImpact: 'Prevent further cache performance degradation'
        });
    }
    
    return recommendations;
}

async function sendOptimizationAlert(analysis, recommendations) {
    const highPriorityRecommendations = recommendations.filter(r => r.priority === 'HIGH');
    
    if (highPriorityRecommendations.length === 0) {
        return; // Only send alerts for high priority issues
    }
    
    const subject = `Cache Optimization Alert - ${PROJECT_NAME}`;
    const message = formatOptimizationMessage(analysis, recommendations);
    
    await sns.publish({
        TopicArn: SNS_TOPIC_ARN,
        Subject: subject,
        Message: message
    }).promise();
}

function formatOptimizationMessage(analysis, recommendations) {
    let message = `Cache Performance Report - ${PROJECT_NAME} (${ENVIRONMENT})\n\n`;
    
    message += `Analysis Period: ${analysis.period}\n`;
    message += `Report Generated: ${analysis.timestamp}\n\n`;
    
    message += "PERFORMANCE SUMMARY:\n";
    message += "===================\n";
    
    if (analysis.cacheHitRate) {
        message += `Cache Hit Rate: ${analysis.cacheHitRate.average.toFixed(1)}% (Target: 85%+)\n`;
    }
    
    if (analysis.originLatency) {
        message += `Origin Latency: ${analysis.originLatency.average.toFixed(0)}ms (Target: <500ms)\n`;
    }
    
    if (analysis.errorRate) {
        message += `Error Rate: ${analysis.errorRate.average.toFixed(1)}% (Target: <2%)\n`;
    }
    
    if (analysis.requestCount) {
        message += `Total Requests: ${analysis.requestCount.total.toLocaleString()}\n`;
    }
    
    message += "\nOPTIMIZATION RECOMMENDATIONS:\n";
    message += "=============================\n";
    
    recommendations.forEach((rec, index) => {
        message += `${index + 1}. ${rec.title} (${rec.priority} Priority)\n`;
        message += `   ${rec.description}\n`;
        message += `   Estimated Impact: ${rec.estimatedImpact}\n`;
        message += `   Suggestions:\n`;
        rec.suggestions.forEach(suggestion => {
            message += `   - ${suggestion}\n`;
        });
        message += "\n";
    });
    
    message += "NEXT STEPS:\n";
    message += "===========\n";
    message += "1. Review high-priority recommendations immediately\n";
    message += "2. Implement suggested optimizations\n";
    message += "3. Monitor cache performance after changes\n";
    message += "4. Schedule regular cache performance reviews\n\n";
    
    message += `CloudFront Console: https://console.aws.amazon.com/cloudfront/home#distribution-settings:${DISTRIBUTION_ID}\n`;
    message += `CloudWatch Metrics: https://console.aws.amazon.com/cloudwatch/home#metricsV2:graph=~();search=AWS/CloudFront\n`;
    
    return message;
}