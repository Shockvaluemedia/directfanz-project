// Cache Warmer Lambda Function for DirectFanz Platform
// Proactively warms CloudFront cache to improve performance

const AWS = require('aws-sdk');
const https = require('https');
const http = require('http');

const cloudfront = new AWS.CloudFront();

const PROJECT_NAME = process.env.PROJECT_NAME || '${project_name}';
const ENVIRONMENT = process.env.ENVIRONMENT || '${environment}';
const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const CACHE_WARMING_URLS = JSON.parse(process.env.CACHE_WARMING_URLS || '[]');

exports.handler = async (event) => {
    console.log('Starting cache warming process...');
    
    try {
        // Get CloudFront distribution details
        const distribution = await getDistribution();
        const domainName = distribution.DomainName;
        
        // Warm cache for each URL
        const warmingResults = await Promise.allSettled(
            CACHE_WARMING_URLS.map(url => warmCacheForUrl(domainName, url))
        );
        
        // Analyze results
        const successful = warmingResults.filter(result => result.status === 'fulfilled').length;
        const failed = warmingResults.filter(result => result.status === 'rejected').length;
        
        console.log(`Cache warming completed: ${successful} successful, ${failed} failed`);
        
        // Log failed requests for debugging
        warmingResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Failed to warm cache for ${CACHE_WARMING_URLS[index]}:`, result.reason);
            }
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Cache warming completed',
                successful,
                failed,
                totalUrls: CACHE_WARMING_URLS.length
            })
        };
        
    } catch (error) {
        console.error('Error in cache warming process:', error);
        throw error;
    }
};

async function getDistribution() {
    const params = {
        Id: DISTRIBUTION_ID
    };
    
    const result = await cloudfront.getDistribution(params).promise();
    return result.Distribution;
}

async function warmCacheForUrl(domainName, url) {
    return new Promise((resolve, reject) => {
        const fullUrl = `https://${domainName}${url}`;
        console.log(`Warming cache for: ${fullUrl}`);
        
        const options = {
            method: 'GET',
            timeout: 30000,
            headers: {
                'User-Agent': `${PROJECT_NAME}-cache-warmer/${ENVIRONMENT}`,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        };
        
        const request = https.request(fullUrl, options, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                const cacheStatus = response.headers['x-cache'] || 'Unknown';
                const age = response.headers['age'] || '0';
                
                console.log(`Cache warming result for ${url}:`, {
                    statusCode: response.statusCode,
                    cacheStatus,
                    age,
                    contentLength: data.length
                });
                
                if (response.statusCode >= 200 && response.statusCode < 400) {
                    resolve({
                        url,
                        statusCode: response.statusCode,
                        cacheStatus,
                        age: parseInt(age),
                        contentLength: data.length
                    });
                } else {
                    reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                }
            });
        });
        
        request.on('error', (error) => {
            console.error(`Request error for ${url}:`, error);
            reject(error);
        });
        
        request.on('timeout', () => {
            console.error(`Request timeout for ${url}`);
            request.destroy();
            reject(new Error(`Timeout for ${url}`));
        });
        
        request.end();
    });
}

// Additional cache warming strategies
async function warmCacheWithVariations(domainName, baseUrl) {
    const variations = [
        baseUrl,
        `${baseUrl}?v=${Date.now()}`, // Cache busting
        `${baseUrl}?mobile=true`,     // Mobile variation
        `${baseUrl}?webp=true`        // WebP variation
    ];
    
    const results = await Promise.allSettled(
        variations.map(url => warmCacheForUrl(domainName, url))
    );
    
    return results;
}

// Intelligent cache warming based on popular content
async function warmPopularContent(domainName) {
    // This would typically integrate with analytics to identify popular content
    const popularUrls = [
        '/trending',
        '/popular-creators',
        '/featured-content',
        '/api/trending-streams'
    ];
    
    const results = await Promise.allSettled(
        popularUrls.map(url => warmCacheForUrl(domainName, url))
    );
    
    return results;
}

// Geographic cache warming
async function warmCacheByRegion(domainName, urls) {
    // This would make requests from different CloudFront edge locations
    // to ensure cache is warmed globally
    const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
    
    // For now, we'll just warm the cache normally
    // In a full implementation, this would use different edge locations
    return await Promise.allSettled(
        urls.map(url => warmCacheForUrl(domainName, url))
    );
}