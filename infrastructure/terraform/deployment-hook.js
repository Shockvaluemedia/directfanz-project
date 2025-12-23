// Lambda function for CodeDeploy deployment hooks
const AWS = require('aws-sdk');

const ecs = new AWS.ECS();
const cloudwatch = new AWS.CloudWatch();
const sns = new AWS.SNS();
const codedeploy = new AWS.CodeDeploy();

exports.handler = async (event) => {
    console.log('Deployment hook event:', JSON.stringify(event, null, 2));
    
    const deploymentId = event.DeploymentId;
    const lifecycleEventHookExecutionId = event.LifecycleEventHookExecutionId;
    const clusterName = process.env.CLUSTER_NAME;
    const snsTopicArn = process.env.SNS_TOPIC_ARN;
    
    try {
        // Perform health checks and validation
        const healthCheckResult = await performHealthChecks(clusterName);
        
        if (healthCheckResult.success) {
            // Signal success to CodeDeploy
            await codedeploy.putLifecycleEventHookExecutionStatus({
                deploymentId: deploymentId,
                lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
                status: 'Succeeded'
            }).promise();
            
            // Send success notification
            await sns.publish({
                TopicArn: snsTopicArn,
                Subject: 'Deployment Hook Success',
                Message: `Deployment ${deploymentId} health checks passed successfully`
            }).promise();
            
            return { statusCode: 200, body: 'Success' };
        } else {
            // Signal failure to CodeDeploy
            await codedeploy.putLifecycleEventHookExecutionStatus({
                deploymentId: deploymentId,
                lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
                status: 'Failed'
            }).promise();
            
            // Send failure notification
            await sns.publish({
                TopicArn: snsTopicArn,
                Subject: 'Deployment Hook Failure',
                Message: `Deployment ${deploymentId} health checks failed: ${healthCheckResult.error}`
            }).promise();
            
            return { statusCode: 500, body: 'Health checks failed' };
        }
    } catch (error) {
        console.error('Error in deployment hook:', error);
        
        // Signal failure to CodeDeploy
        await codedeploy.putLifecycleEventHookExecutionStatus({
            deploymentId: deploymentId,
            lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
            status: 'Failed'
        }).promise();
        
        return { statusCode: 500, body: 'Internal error' };
    }
};

async function performHealthChecks(clusterName) {
    try {
        // Get all services in the cluster
        const services = await ecs.listServices({
            cluster: clusterName
        }).promise();
        
        if (services.serviceArns.length === 0) {
            return { success: false, error: 'No services found in cluster' };
        }
        
        // Describe services to get detailed information
        const serviceDetails = await ecs.describeServices({
            cluster: clusterName,
            services: services.serviceArns
        }).promise();
        
        // Check each service health
        for (const service of serviceDetails.services) {
            // Check if service is stable
            if (service.status !== 'ACTIVE') {
                return { 
                    success: false, 
                    error: `Service ${service.serviceName} is not active (status: ${service.status})` 
                };
            }
            
            // Check if desired count matches running count
            if (service.runningCount < service.desiredCount) {
                return { 
                    success: false, 
                    error: `Service ${service.serviceName} has ${service.runningCount} running tasks but desires ${service.desiredCount}` 
                };
            }
            
            // Check if there are any pending tasks (indicating instability)
            if (service.pendingCount > 0) {
                return { 
                    success: false, 
                    error: `Service ${service.serviceName} has ${service.pendingCount} pending tasks` 
                };
            }
        }
        
        // Check CloudWatch metrics for the past 5 minutes
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5 minutes ago
        
        for (const service of serviceDetails.services) {
            // Check CPU utilization
            const cpuMetrics = await cloudwatch.getMetricStatistics({
                Namespace: 'AWS/ECS',
                MetricName: 'CPUUtilization',
                Dimensions: [
                    {
                        Name: 'ServiceName',
                        Value: service.serviceName
                    },
                    {
                        Name: 'ClusterName',
                        Value: clusterName
                    }
                ],
                StartTime: startTime,
                EndTime: endTime,
                Period: 300,
                Statistics: ['Average']
            }).promise();
            
            // Check if CPU is reasonable (not too high indicating stress)
            if (cpuMetrics.Datapoints.length > 0) {
                const avgCpu = cpuMetrics.Datapoints.reduce((sum, dp) => sum + dp.Average, 0) / cpuMetrics.Datapoints.length;
                if (avgCpu > 90) {
                    return { 
                        success: false, 
                        error: `Service ${service.serviceName} has high CPU utilization: ${avgCpu.toFixed(2)}%` 
                    };
                }
            }
            
            // Check Memory utilization
            const memoryMetrics = await cloudwatch.getMetricStatistics({
                Namespace: 'AWS/ECS',
                MetricName: 'MemoryUtilization',
                Dimensions: [
                    {
                        Name: 'ServiceName',
                        Value: service.serviceName
                    },
                    {
                        Name: 'ClusterName',
                        Value: clusterName
                    }
                ],
                StartTime: startTime,
                EndTime: endTime,
                Period: 300,
                Statistics: ['Average']
            }).promise();
            
            // Check if Memory is reasonable
            if (memoryMetrics.Datapoints.length > 0) {
                const avgMemory = memoryMetrics.Datapoints.reduce((sum, dp) => sum + dp.Average, 0) / memoryMetrics.Datapoints.length;
                if (avgMemory > 95) {
                    return { 
                        success: false, 
                        error: `Service ${service.serviceName} has high memory utilization: ${avgMemory.toFixed(2)}%` 
                    };
                }
            }
        }
        
        return { success: true };
    } catch (error) {
        console.error('Health check error:', error);
        return { success: false, error: error.message };
    }
}