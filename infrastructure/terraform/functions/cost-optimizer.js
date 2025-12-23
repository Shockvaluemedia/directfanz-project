// Cost Optimizer Lambda Function for DirectFanz Platform
// Analyzes AWS costs and provides optimization recommendations

const AWS = require('aws-sdk');

const costExplorer = new AWS.CostExplorer({ region: 'us-east-1' });
const ecs = new AWS.ECS();
const rds = new AWS.RDS();
const sns = new AWS.SNS();

const PROJECT_NAME = process.env.PROJECT_NAME || '${project_name}';
const ENVIRONMENT = process.env.ENVIRONMENT || '${environment}';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

exports.handler = async (event) => {
    console.log('Starting cost optimization analysis...');
    
    try {
        const recommendations = [];
        
        // Get cost and usage data for the last 30 days
        const costData = await getCostAndUsage();
        
        // Analyze ECS costs and utilization
        const ecsRecommendations = await analyzeECSCosts();
        recommendations.push(...ecsRecommendations);
        
        // Analyze RDS costs and utilization
        const rdsRecommendations = await analyzeRDSCosts();
        recommendations.push(...rdsRecommendations);
        
        // Analyze S3 costs and storage patterns
        const s3Recommendations = await analyzeS3Costs(costData);
        recommendations.push(...s3Recommendations);
        
        // Get AWS rightsizing recommendations
        const rightsizingRecommendations = await getRightsizingRecommendations();
        recommendations.push(...rightsizingRecommendations);
        
        // Get Reserved Instance recommendations
        const riRecommendations = await getReservedInstanceRecommendations();
        recommendations.push(...riRecommendations);
        
        // Send recommendations via SNS
        if (recommendations.length > 0) {
            await sendRecommendations(recommendations, costData);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Cost optimization analysis completed',
                recommendationsCount: recommendations.length
            })
        };
        
    } catch (error) {
        console.error('Error in cost optimization analysis:', error);
        
        // Send error notification
        await sns.publish({
            TopicArn: SNS_TOPIC_ARN,
            Subject: `Cost Optimization Analysis Failed - ${PROJECT_NAME}`,
            Message: `Error occurred during cost optimization analysis: ${error.message}`
        }).promise();
        
        throw error;
    }
};

async function getCostAndUsage() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const params = {
        TimePeriod: {
            Start: startDate.toISOString().split('T')[0],
            End: endDate.toISOString().split('T')[0]
        },
        Granularity: 'DAILY',
        Metrics: ['BlendedCost', 'UsageQuantity'],
        GroupBy: [
            {
                Type: 'DIMENSION',
                Key: 'SERVICE'
            }
        ]
    };
    
    const result = await costExplorer.getCostAndUsage(params).promise();
    return result;
}

async function analyzeECSCosts() {
    const recommendations = [];
    
    try {
        // Get ECS cluster information
        const clusters = await ecs.describeClusters({
            clusters: [`${PROJECT_NAME}-cluster`]
        }).promise();
        
        if (clusters.clusters.length === 0) {
            return recommendations;
        }
        
        // Get ECS services
        const services = await ecs.describeServices({
            cluster: `${PROJECT_NAME}-cluster`
        }).promise();
        
        for (const service of services.services) {
            // Analyze service utilization
            const taskDefinition = await ecs.describeTaskDefinition({
                taskDefinition: service.taskDefinition
            }).promise();
            
            const cpuReservation = parseInt(taskDefinition.taskDefinition.cpu);
            const memoryReservation = parseInt(taskDefinition.taskDefinition.memory);
            
            // Check if service is over-provisioned
            if (service.runningCount > 0) {
                // Recommend Spot instances if not already using them
                if (!service.capacityProviderStrategy || 
                    !service.capacityProviderStrategy.some(cp => cp.capacityProvider === 'FARGATE_SPOT')) {
                    
                    recommendations.push({
                        type: 'ECS_SPOT_INSTANCES',
                        service: service.serviceName,
                        description: `Consider using Spot instances for ${service.serviceName} to reduce costs by 60-70%`,
                        estimatedSavings: calculateSpotSavings(cpuReservation, memoryReservation, service.runningCount),
                        priority: 'HIGH'
                    });
                }
                
                // Check for right-sizing opportunities
                if (cpuReservation >= 2048 || memoryReservation >= 4096) {
                    recommendations.push({
                        type: 'ECS_RIGHTSIZING',
                        service: service.serviceName,
                        description: `Review resource allocation for ${service.serviceName}. Consider reducing CPU/memory if utilization is low`,
                        currentCPU: cpuReservation,
                        currentMemory: memoryReservation,
                        priority: 'MEDIUM'
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('Error analyzing ECS costs:', error);
    }
    
    return recommendations;
}

async function analyzeRDSCosts() {
    const recommendations = [];
    
    try {
        // Get RDS instances
        const instances = await rds.describeDBInstances().promise();
        
        for (const instance of instances.DBInstances) {
            if (instance.DBInstanceIdentifier.includes(PROJECT_NAME)) {
                // Check for Reserved Instance opportunities
                if (!instance.DBInstanceClass.includes('reserved')) {
                    recommendations.push({
                        type: 'RDS_RESERVED_INSTANCES',
                        instance: instance.DBInstanceIdentifier,
                        instanceClass: instance.DBInstanceClass,
                        description: `Consider Reserved Instances for ${instance.DBInstanceIdentifier} to save 30-60%`,
                        estimatedSavings: 'Up to 60% for 3-year term',
                        priority: 'HIGH'
                    });
                }
                
                // Check for storage optimization
                if (instance.AllocatedStorage > 100) {
                    recommendations.push({
                        type: 'RDS_STORAGE_OPTIMIZATION',
                        instance: instance.DBInstanceIdentifier,
                        description: `Review storage usage for ${instance.DBInstanceIdentifier}. Consider GP3 storage type for better cost/performance`,
                        currentStorage: instance.AllocatedStorage,
                        priority: 'MEDIUM'
                    });
                }
                
                // Check for Multi-AZ optimization
                if (instance.MultiAZ && ENVIRONMENT !== 'prod') {
                    recommendations.push({
                        type: 'RDS_MULTI_AZ_OPTIMIZATION',
                        instance: instance.DBInstanceIdentifier,
                        description: `Consider disabling Multi-AZ for non-production instance ${instance.DBInstanceIdentifier}`,
                        estimatedSavings: 'Up to 50% cost reduction',
                        priority: 'MEDIUM'
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('Error analyzing RDS costs:', error);
    }
    
    return recommendations;
}

async function analyzeS3Costs(costData) {
    const recommendations = [];
    
    try {
        // Find S3 costs from cost data
        const s3Costs = costData.ResultsByTime.reduce((total, timeRange) => {
            const s3Group = timeRange.Groups.find(group => 
                group.Keys.includes('Amazon Simple Storage Service')
            );
            if (s3Group) {
                total += parseFloat(s3Group.Metrics.BlendedCost.Amount);
            }
            return total;
        }, 0);
        
        if (s3Costs > 50) { // If S3 costs are significant
            recommendations.push({
                type: 'S3_INTELLIGENT_TIERING',
                description: 'Enable S3 Intelligent Tiering to automatically optimize storage costs',
                currentMonthlyCost: s3Costs.toFixed(2),
                estimatedSavings: 'Up to 40% on infrequently accessed data',
                priority: 'HIGH'
            });
            
            recommendations.push({
                type: 'S3_LIFECYCLE_POLICIES',
                description: 'Implement lifecycle policies to transition old content to cheaper storage classes',
                estimatedSavings: 'Up to 80% for archived content',
                priority: 'MEDIUM'
            });
        }
        
    } catch (error) {
        console.error('Error analyzing S3 costs:', error);
    }
    
    return recommendations;
}

async function getRightsizingRecommendations() {
    const recommendations = [];
    
    try {
        const params = {
            Service: 'AmazonECS',
            Configuration: {
                BenefitsConsidered: true,
                RecommendationTarget: 'SAME_INSTANCE_FAMILY'
            }
        };
        
        const result = await costExplorer.getRightsizingRecommendation(params).promise();
        
        for (const recommendation of result.RightsizingRecommendations) {
            if (recommendation.RightsizingType === 'Modify') {
                recommendations.push({
                    type: 'AWS_RIGHTSIZING',
                    resourceId: recommendation.ResourceId,
                    description: `AWS recommends modifying ${recommendation.ResourceId}`,
                    currentInstanceType: recommendation.CurrentInstance?.ResourceDetails?.EC2ResourceDetails?.InstanceType,
                    recommendedInstanceType: recommendation.ModifyRecommendationDetail?.TargetInstances?.[0]?.ResourceDetails?.EC2ResourceDetails?.InstanceType,
                    estimatedSavings: recommendation.ModifyRecommendationDetail?.TargetInstances?.[0]?.EstimatedMonthlySavings?.Amount,
                    priority: 'HIGH'
                });
            }
        }
        
    } catch (error) {
        console.error('Error getting rightsizing recommendations:', error);
    }
    
    return recommendations;
}

async function getReservedInstanceRecommendations() {
    const recommendations = [];
    
    try {
        const params = {
            Service: 'Amazon Relational Database Service',
            TermInYears: 'ONE_YEAR',
            PaymentOption: 'PARTIAL_UPFRONT'
        };
        
        const result = await costExplorer.getReservationPurchaseRecommendation(params).promise();
        
        for (const recommendation of result.Recommendations) {
            recommendations.push({
                type: 'RESERVED_INSTANCES',
                service: 'RDS',
                description: `Consider purchasing Reserved Instances for RDS`,
                instanceType: recommendation.RecommendationDetails?.InstanceDetails?.RDSInstanceDetails?.InstanceType,
                estimatedSavings: recommendation.RecommendationDetails?.EstimatedMonthlySavingsAmount,
                upfrontCost: recommendation.RecommendationDetails?.UpfrontCost,
                priority: 'HIGH'
            });
        }
        
    } catch (error) {
        console.error('Error getting Reserved Instance recommendations:', error);
    }
    
    return recommendations;
}

function calculateSpotSavings(cpu, memory, taskCount) {
    // Rough calculation based on Fargate pricing
    const hourlyCostOnDemand = ((cpu / 1024) * 0.04048 + (memory / 1024) * 0.004445) * taskCount;
    const hourlyCostSpot = hourlyCostOnDemand * 0.3; // Assume 70% savings
    const monthlySavings = (hourlyCostOnDemand - hourlyCostSpot) * 24 * 30;
    
    return `$${monthlySavings.toFixed(2)} per month`;
}

async function sendRecommendations(recommendations, costData) {
    const totalCost = costData.ResultsByTime.reduce((total, timeRange) => {
        return total + timeRange.Total.BlendedCost.Amount;
    }, 0);
    
    const message = formatRecommendationsMessage(recommendations, totalCost);
    
    await sns.publish({
        TopicArn: SNS_TOPIC_ARN,
        Subject: `Cost Optimization Recommendations - ${PROJECT_NAME}`,
        Message: message
    }).promise();
}

function formatRecommendationsMessage(recommendations, totalCost) {
    let message = `Cost Optimization Report for ${PROJECT_NAME} (${ENVIRONMENT})\n\n`;
    message += `Total Cost (Last 30 days): $${totalCost.toFixed(2)}\n\n`;
    message += `Found ${recommendations.length} optimization opportunities:\n\n`;
    
    const highPriority = recommendations.filter(r => r.priority === 'HIGH');
    const mediumPriority = recommendations.filter(r => r.priority === 'MEDIUM');
    
    if (highPriority.length > 0) {
        message += "HIGH PRIORITY RECOMMENDATIONS:\n";
        message += "================================\n";
        highPriority.forEach((rec, index) => {
            message += `${index + 1}. ${rec.type}: ${rec.description}\n`;
            if (rec.estimatedSavings) {
                message += `   Estimated Savings: ${rec.estimatedSavings}\n`;
            }
            message += "\n";
        });
    }
    
    if (mediumPriority.length > 0) {
        message += "MEDIUM PRIORITY RECOMMENDATIONS:\n";
        message += "=================================\n";
        mediumPriority.forEach((rec, index) => {
            message += `${index + 1}. ${rec.type}: ${rec.description}\n`;
            if (rec.estimatedSavings) {
                message += `   Estimated Savings: ${rec.estimatedSavings}\n`;
            }
            message += "\n";
        });
    }
    
    message += "\nNext Steps:\n";
    message += "1. Review recommendations with your team\n";
    message += "2. Implement high-priority optimizations first\n";
    message += "3. Monitor cost impact after changes\n";
    message += "4. Schedule regular cost optimization reviews\n\n";
    
    message += `Dashboard: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=${PROJECT_NAME}-cost-monitoring\n`;
    
    return message;
}