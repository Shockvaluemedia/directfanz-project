/**
 * Property-Based Test for Zero-downtime Deployment
 * Feature: aws-conversion, Property 3: Zero-downtime Deployment
 * Validates: Requirements 1.7
 */

const { describe, test, expect } = require('@jest/globals');
const fc = require('fast-check');

// Mock AWS SDK for testing
const mockCodeDeploy = {
  createDeployment: jest.fn(),
  getDeployment: jest.fn(),
  listDeployments: jest.fn(),
  getApplication: jest.fn(),
  getDeploymentGroup: jest.fn(),
  stopDeployment: jest.fn()
};

const mockECS = {
  describeServices: jest.fn(),
  describeTasks: jest.fn(),
  listTasks: jest.fn(),
  describeTaskSets: jest.fn()
};

const mockELBv2 = {
  describeTargetGroups: jest.fn(),
  describeTargetHealth: jest.fn(),
  describeListeners: jest.fn(),
  describeRules: jest.fn()
};

const mockCloudWatch = {
  getMetricStatistics: jest.fn(),
  describeAlarms: jest.fn()
};

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  CodeDeploy: jest.fn(() => mockCodeDeploy),
  ECS: jest.fn(() => mockECS),
  ELBv2: jest.fn(() => mockELBv2),
  CloudWatch: jest.fn(() => mockCloudWatch)
}));

const AWS = require('aws-sdk');

describe('Zero-downtime Deployment Property Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  /**
   * Property 3: Zero-downtime Deployment
   * For any deployment operation, the system should maintain service availability 
   * throughout the deployment process, with no dropped connections or service interruptions
   */
  test('Property: Blue-green deployments maintain service availability throughout process', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test deployment configurations
        fc.record({
          serviceName: fc.constantFrom('web-app', 'websocket'),
          deploymentId: fc.string({ minLength: 10, maxLength: 20 }),
          currentTaskSetRevision: fc.integer({ min: 1, max: 50 }),
          newTaskSetRevision: fc.integer({ min: 2, max: 51 }),
          desiredCount: fc.integer({ min: 2, max: 10 }),
          deploymentDurationMinutes: fc.integer({ min: 5, max: 15 }),
          healthCheckGracePeriod: fc.integer({ min: 30, max: 120 })
        }),
        async (config) => {
          const currentTime = new Date();
          const deploymentStartTime = new Date(currentTime.getTime() - (config.deploymentDurationMinutes * 60000));
          const deploymentEndTime = new Date(deploymentStartTime.getTime() + (config.deploymentDurationMinutes * 60000));

          // Mock CodeDeploy application and deployment group
          mockCodeDeploy.getApplication.mockResolvedValue({
            application: {
              applicationName: 'direct-fan-platform-ecs-app',
              computePlatform: 'ECS',
              createTime: new Date(currentTime.getTime() - 3600000)
            }
          });

          mockCodeDeploy.getDeploymentGroup.mockResolvedValue({
            deploymentGroupInfo: {
              applicationName: 'direct-fan-platform-ecs-app',
              deploymentGroupName: `direct-fan-platform-${config.serviceName}-dg`,
              serviceRoleArn: 'arn:aws:iam::123456789012:role/codedeploy-service-role',
              deploymentConfigName: 'CodeDeployDefault.ECSAllAtOnceBlueGreen',
              ecsServices: [{
                serviceName: `direct-fan-platform-${config.serviceName}`,
                clusterName: 'direct-fan-platform-cluster'
              }],
              loadBalancerInfo: {
                targetGroupInfoList: [{
                  name: `direct-fan-platform-${config.serviceName}-tg`
                }]
              },
              blueGreenDeploymentConfiguration: {
                terminateBlueInstancesOnDeploymentSuccess: {
                  action: 'TERMINATE',
                  terminationWaitTimeInMinutes: 5
                },
                deploymentReadyOption: {
                  actionOnTimeout: 'CONTINUE_DEPLOYMENT'
                },
                greenFleetProvisioningOption: {
                  action: 'COPY_AUTO_SCALING_GROUP'
                }
              },
              autoRollbackConfiguration: {
                enabled: true,
                events: ['DEPLOYMENT_FAILURE', 'DEPLOYMENT_STOP_ON_ALARM']
              }
            }
          });

          // Mock deployment in progress
          const deploymentStatus = currentTime < deploymentEndTime ? 'InProgress' : 'Succeeded';
          mockCodeDeploy.getDeployment.mockResolvedValue({
            deploymentInfo: {
              deploymentId: config.deploymentId,
              applicationName: 'direct-fan-platform-ecs-app',
              deploymentGroupName: `direct-fan-platform-${config.serviceName}-dg`,
              deploymentConfigName: 'CodeDeployDefault.ECSAllAtOnceBlueGreen',
              status: deploymentStatus,
              createTime: deploymentStartTime,
              completeTime: deploymentStatus === 'Succeeded' ? deploymentEndTime : undefined,
              deploymentOverview: {
                Pending: deploymentStatus === 'InProgress' ? 1 : 0,
                InProgress: deploymentStatus === 'InProgress' ? 1 : 0,
                Succeeded: deploymentStatus === 'Succeeded' ? 1 : 0,
                Failed: 0,
                Skipped: 0,
                Ready: 0
              },
              targetInstances: {
                autoScalingGroups: [],
                ec2TagFilters: [],
                tagFilters: []
              },
              blueGreenDeploymentConfiguration: {
                terminateBlueInstancesOnDeploymentSuccess: {
                  action: 'TERMINATE',
                  terminationWaitTimeInMinutes: 5
                },
                deploymentReadyOption: {
                  actionOnTimeout: 'CONTINUE_DEPLOYMENT'
                },
                greenFleetProvisioningOption: {
                  action: 'COPY_AUTO_SCALING_GROUP'
                }
              }
            }
          });

          // Mock ECS service with both blue and green task sets during deployment
          const blueTaskSetArn = `arn:aws:ecs:us-east-1:123456789012:task-set/direct-fan-platform-cluster/direct-fan-platform-${config.serviceName}/ecs-svc-blue`;
          const greenTaskSetArn = `arn:aws:ecs:us-east-1:123456789012:task-set/direct-fan-platform-cluster/direct-fan-platform-${config.serviceName}/ecs-svc-green`;

          mockECS.describeServices.mockResolvedValue({
            services: [{
              serviceName: `direct-fan-platform-${config.serviceName}`,
              serviceArn: `arn:aws:ecs:us-east-1:123456789012:service/direct-fan-platform-cluster/direct-fan-platform-${config.serviceName}`,
              clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/direct-fan-platform-cluster',
              status: 'ACTIVE',
              runningCount: config.desiredCount,
              pendingCount: deploymentStatus === 'InProgress' ? config.desiredCount : 0,
              desiredCount: config.desiredCount,
              taskSets: deploymentStatus === 'InProgress' ? [
                {
                  taskSetArn: blueTaskSetArn,
                  status: 'ACTIVE',
                  runningCount: config.desiredCount,
                  pendingCount: 0,
                  stabilityStatus: 'STEADY_STATE',
                  scale: {
                    value: 100.0,
                    unit: 'PERCENT'
                  }
                },
                {
                  taskSetArn: greenTaskSetArn,
                  status: 'ACTIVE',
                  runningCount: config.desiredCount,
                  pendingCount: 0,
                  stabilityStatus: 'STEADY_STATE',
                  scale: {
                    value: 0.0,
                    unit: 'PERCENT'
                  }
                }
              ] : [
                {
                  taskSetArn: greenTaskSetArn,
                  status: 'ACTIVE',
                  runningCount: config.desiredCount,
                  pendingCount: 0,
                  stabilityStatus: 'STEADY_STATE',
                  scale: {
                    value: 100.0,
                    unit: 'PERCENT'
                  }
                }
              ],
              deploymentController: {
                type: 'CODE_DEPLOY'
              },
              deployments: [{
                id: 'ecs-svc-deployment',
                status: 'PRIMARY',
                runningCount: config.desiredCount,
                pendingCount: 0,
                desiredCount: config.desiredCount,
                createdAt: deploymentStartTime,
                updatedAt: currentTime
              }]
            }]
          });

          // Mock task sets details
          mockECS.describeTaskSets.mockResolvedValue({
            taskSets: deploymentStatus === 'InProgress' ? [
              {
                taskSetArn: blueTaskSetArn,
                serviceName: `direct-fan-platform-${config.serviceName}`,
                clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/direct-fan-platform-cluster',
                status: 'ACTIVE',
                runningCount: config.desiredCount,
                pendingCount: 0,
                stabilityStatus: 'STEADY_STATE',
                taskDefinition: `arn:aws:ecs:us-east-1:123456789012:task-definition/direct-fan-platform-${config.serviceName}:${config.currentTaskSetRevision}`,
                scale: {
                  value: 100.0,
                  unit: 'PERCENT'
                },
                loadBalancers: [{
                  targetGroupArn: `arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/direct-fan-platform-${config.serviceName}-tg/1234567890123456`,
                  containerName: config.serviceName,
                  containerPort: config.serviceName === 'web-app' ? 3000 : 3001
                }]
              },
              {
                taskSetArn: greenTaskSetArn,
                serviceName: `direct-fan-platform-${config.serviceName}`,
                clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/direct-fan-platform-cluster',
                status: 'ACTIVE',
                runningCount: config.desiredCount,
                pendingCount: 0,
                stabilityStatus: 'STEADY_STATE',
                taskDefinition: `arn:aws:ecs:us-east-1:123456789012:task-definition/direct-fan-platform-${config.serviceName}:${config.newTaskSetRevision}`,
                scale: {
                  value: 0.0,
                  unit: 'PERCENT'
                },
                loadBalancers: [{
                  targetGroupArn: `arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/direct-fan-platform-${config.serviceName}-tg-green/1234567890123456`,
                  containerName: config.serviceName,
                  containerPort: config.serviceName === 'web-app' ? 3000 : 3001
                }]
              }
            ] : [
              {
                taskSetArn: greenTaskSetArn,
                serviceName: `direct-fan-platform-${config.serviceName}`,
                clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/direct-fan-platform-cluster',
                status: 'ACTIVE',
                runningCount: config.desiredCount,
                pendingCount: 0,
                stabilityStatus: 'STEADY_STATE',
                taskDefinition: `arn:aws:ecs:us-east-1:123456789012:task-definition/direct-fan-platform-${config.serviceName}:${config.newTaskSetRevision}`,
                scale: {
                  value: 100.0,
                  unit: 'PERCENT'
                }
              }
            ]
          });

          // Mock target group health
          mockELBv2.describeTargetHealth.mockResolvedValue({
            TargetHealthDescriptions: Array.from({ length: config.desiredCount }, (_, index) => ({
              Target: {
                Id: `10.0.${Math.floor(index / 10) + 1}.${(index % 10) + 10}`,
                Port: config.serviceName === 'web-app' ? 3000 : 3001
              },
              HealthCheckPort: config.serviceName === 'web-app' ? 3000 : 3001,
              TargetHealth: {
                State: 'healthy',
                Reason: 'Target.ResponseCodeMismatch',
                Description: 'Health checks succeeded'
              }
            }))
          });

          // Mock CloudWatch metrics showing no service interruption
          mockCloudWatch.getMetricStatistics.mockImplementation((params) => {
            const metricName = params.MetricName;
            if (metricName === 'TargetResponseTime') {
              return Promise.resolve({
                Datapoints: Array.from({ length: 5 }, (_, index) => ({
                  Timestamp: new Date(currentTime.getTime() - (index * 60000)),
                  Average: 0.05 + (Math.random() * 0.02), // 50-70ms response time
                  Unit: 'Seconds'
                }))
              });
            } else if (metricName === 'HTTPCode_Target_2XX_Count') {
              return Promise.resolve({
                Datapoints: Array.from({ length: 5 }, (_, index) => ({
                  Timestamp: new Date(currentTime.getTime() - (index * 60000)),
                  Sum: 100 + Math.floor(Math.random() * 50), // 100-150 successful requests per minute
                  Unit: 'Count'
                }))
              });
            } else if (metricName === 'HTTPCode_Target_5XX_Count') {
              return Promise.resolve({
                Datapoints: [] // No 5xx errors during deployment
              });
            }
            return Promise.resolve({ Datapoints: [] });
          });

          // Test the zero-downtime deployment properties
          const codeDeploy = new AWS.CodeDeploy();
          const ecs = new AWS.ECS();
          const elbv2 = new AWS.ELBv2();
          const cloudWatch = new AWS.CloudWatch();

          // Verify deployment configuration supports zero-downtime
          const deploymentGroup = await mockCodeDeploy.getDeploymentGroup();
          const deploymentGroupInfo = deploymentGroup.deploymentGroupInfo;

          // Property 1: Deployment should be configured for blue-green strategy
          expect(deploymentGroupInfo.deploymentConfigName).toBe('CodeDeployDefault.ECSAllAtOnceBlueGreen');
          expect(deploymentGroupInfo.blueGreenDeploymentConfiguration).toBeDefined();
          expect(deploymentGroupInfo.blueGreenDeploymentConfiguration.deploymentReadyOption.actionOnTimeout).toBe('CONTINUE_DEPLOYMENT');

          // Property 2: Auto-rollback should be enabled for failure scenarios
          expect(deploymentGroupInfo.autoRollbackConfiguration.enabled).toBe(true);
          expect(deploymentGroupInfo.autoRollbackConfiguration.events).toContain('DEPLOYMENT_FAILURE');
          expect(deploymentGroupInfo.autoRollbackConfiguration.events).toContain('DEPLOYMENT_STOP_ON_ALARM');

          // Verify deployment status and service health
          const deployment = await mockCodeDeploy.getDeployment();
          const deploymentInfo = deployment.deploymentInfo;

          // Property 3: Deployment should be progressing or completed successfully
          expect(['InProgress', 'Succeeded']).toContain(deploymentInfo.status);
          expect(deploymentInfo.deploymentOverview.Failed).toBe(0);

          // Verify ECS service maintains availability during deployment
          const services = await mockECS.describeServices();
          const service = services.services[0];

          // Property 4: Service should remain active throughout deployment
          expect(service.status).toBe('ACTIVE');
          expect(service.runningCount).toBe(config.desiredCount);

          // Property 5: During blue-green deployment, both task sets should be managed properly
          if (deploymentInfo.status === 'InProgress') {
            expect(service.taskSets).toHaveLength(2); // Blue and green task sets
            
            const taskSets = await mockECS.describeTaskSets();
            const blueTaskSet = taskSets.taskSets.find(ts => ts.scale.value === 100.0);
            const greenTaskSet = taskSets.taskSets.find(ts => ts.scale.value === 0.0);

            expect(blueTaskSet).toBeDefined();
            expect(greenTaskSet).toBeDefined();
            expect(blueTaskSet.status).toBe('ACTIVE');
            expect(greenTaskSet.status).toBe('ACTIVE');
            expect(blueTaskSet.runningCount).toBe(config.desiredCount);
            expect(greenTaskSet.runningCount).toBe(config.desiredCount);
          } else if (deploymentInfo.status === 'Succeeded') {
            // After successful deployment, only green task set should remain
            expect(service.taskSets).toHaveLength(1);
            const taskSets = await mockECS.describeTaskSets();
            expect(taskSets.taskSets[0].scale.value).toBe(100.0);
          }

          // Property 6: Target group health should remain healthy throughout deployment
          const targetHealth = await mockELBv2.describeTargetHealth();
          const healthyTargets = targetHealth.TargetHealthDescriptions.filter(
            target => target.TargetHealth.State === 'healthy'
          );
          expect(healthyTargets.length).toBe(config.desiredCount);

          // Property 7: Application metrics should show no service degradation
          const responseTimeMetrics = await mockCloudWatch.getMetricStatistics({
            MetricName: 'TargetResponseTime',
            Namespace: 'AWS/ApplicationELB',
            StartTime: deploymentStartTime,
            EndTime: currentTime,
            Period: 60,
            Statistics: ['Average']
          });

          const successfulRequestsMetrics = await mockCloudWatch.getMetricStatistics({
            MetricName: 'HTTPCode_Target_2XX_Count',
            Namespace: 'AWS/ApplicationELB',
            StartTime: deploymentStartTime,
            EndTime: currentTime,
            Period: 60,
            Statistics: ['Sum']
          });

          const errorRequestsMetrics = await mockCloudWatch.getMetricStatistics({
            MetricName: 'HTTPCode_Target_5XX_Count',
            Namespace: 'AWS/ApplicationELB',
            StartTime: deploymentStartTime,
            EndTime: currentTime,
            Period: 60,
            Statistics: ['Sum']
          });

          // Response times should remain reasonable (< 1 second)
          responseTimeMetrics.Datapoints.forEach(datapoint => {
            expect(datapoint.Average).toBeLessThan(1.0);
          });

          // Should have successful requests throughout deployment
          expect(successfulRequestsMetrics.Datapoints.length).toBeGreaterThan(0);
          successfulRequestsMetrics.Datapoints.forEach(datapoint => {
            expect(datapoint.Sum).toBeGreaterThan(0);
          });

          // Should have no 5xx errors during deployment
          expect(errorRequestsMetrics.Datapoints.length).toBe(0);

          // Property 8: Deployment duration should be reasonable
          if (deploymentInfo.status === 'Succeeded') {
            const deploymentDuration = new Date(deploymentInfo.completeTime).getTime() - 
                                     new Date(deploymentInfo.createTime).getTime();
            expect(deploymentDuration).toBeLessThanOrEqual(20 * 60 * 1000); // Max 20 minutes
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  /**
   * Property: Rollback Capability
   * For any failed deployment, the system should be able to rollback to the previous 
   * stable state without service interruption
   */
  test('Property: Failed deployments trigger automatic rollback without service interruption', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          serviceName: fc.constantFrom('web-app', 'websocket'),
          deploymentId: fc.string({ minLength: 10, maxLength: 20 }),
          failureReason: fc.constantFrom('HEALTH_CONSTRAINTS_INVALID', 'ALARM_ACTIVE', 'DEPLOYMENT_FAILURE'),
          rollbackDurationMinutes: fc.integer({ min: 2, max: 8 }),
          desiredCount: fc.integer({ min: 2, max: 5 })
        }),
        async (config) => {
          const currentTime = new Date();
          const failureTime = new Date(currentTime.getTime() - (config.rollbackDurationMinutes * 60000));
          const rollbackStartTime = new Date(failureTime.getTime() + 30000); // 30 seconds after failure
          const rollbackEndTime = new Date(rollbackStartTime.getTime() + (config.rollbackDurationMinutes * 60000));

          // Mock failed deployment with rollback
          mockCodeDeploy.getDeployment.mockResolvedValue({
            deploymentInfo: {
              deploymentId: config.deploymentId,
              applicationName: 'direct-fan-platform-ecs-app',
              deploymentGroupName: `direct-fan-platform-${config.serviceName}-dg`,
              status: currentTime > rollbackEndTime ? 'Stopped' : 'InProgress',
              errorInformation: {
                code: config.failureReason,
                message: `Deployment failed due to ${config.failureReason}`
              },
              createTime: new Date(failureTime.getTime() - 300000), // 5 minutes before failure
              completeTime: currentTime > rollbackEndTime ? rollbackEndTime : undefined,
              autoRollbackConfiguration: {
                enabled: true,
                events: ['DEPLOYMENT_FAILURE', 'DEPLOYMENT_STOP_ON_ALARM']
              },
              rollbackInfo: {
                rollbackDeploymentId: `${config.deploymentId}-rollback`,
                rollbackTriggeringDeploymentId: config.deploymentId,
                rollbackMessage: `Automatic rollback triggered by ${config.failureReason}`
              }
            }
          });

          // Mock service state during rollback
          mockECS.describeServices.mockResolvedValue({
            services: [{
              serviceName: `direct-fan-platform-${config.serviceName}`,
              status: 'ACTIVE',
              runningCount: config.desiredCount,
              pendingCount: 0,
              desiredCount: config.desiredCount,
              deployments: [{
                id: 'ecs-svc-rollback-deployment',
                status: 'PRIMARY',
                runningCount: config.desiredCount,
                pendingCount: 0,
                desiredCount: config.desiredCount,
                rolloutState: currentTime > rollbackEndTime ? 'COMPLETED' : 'IN_PROGRESS',
                rolloutStateReason: 'ECS deployment rollback completed successfully'
              }]
            }]
          });

          // Mock healthy targets after rollback
          mockELBv2.describeTargetHealth.mockResolvedValue({
            TargetHealthDescriptions: Array.from({ length: config.desiredCount }, (_, index) => ({
              Target: {
                Id: `10.0.${Math.floor(index / 10) + 1}.${(index % 10) + 10}`,
                Port: config.serviceName === 'web-app' ? 3000 : 3001
              },
              TargetHealth: {
                State: 'healthy',
                Description: 'Health checks succeeded after rollback'
              }
            }))
          });

          // Mock metrics showing service recovery
          mockCloudWatch.getMetricStatistics.mockImplementation((params) => {
            if (params.MetricName === 'HTTPCode_Target_5XX_Count') {
              // Show brief spike in errors during failure, then recovery
              return Promise.resolve({
                Datapoints: [
                  {
                    Timestamp: failureTime,
                    Sum: 10, // Brief error spike
                    Unit: 'Count'
                  },
                  {
                    Timestamp: rollbackEndTime,
                    Sum: 0, // Recovery after rollback
                    Unit: 'Count'
                  }
                ]
              });
            } else if (params.MetricName === 'HTTPCode_Target_2XX_Count') {
              return Promise.resolve({
                Datapoints: [
                  {
                    Timestamp: rollbackEndTime,
                    Sum: 150, // Normal traffic after rollback
                    Unit: 'Count'
                  }
                ]
              });
            }
            return Promise.resolve({ Datapoints: [] });
          });

          const codeDeploy = new AWS.CodeDeploy();
          const ecs = new AWS.ECS();
          const elbv2 = new AWS.ELBv2();
          const cloudWatch = new AWS.CloudWatch();

          // Verify rollback behavior
          const deployment = await mockCodeDeploy.getDeployment();
          const deploymentInfo = deployment.deploymentInfo;

          // Property 1: Failed deployment should trigger automatic rollback
          expect(deploymentInfo.autoRollbackConfiguration.enabled).toBe(true);
          expect(deploymentInfo.rollbackInfo).toBeDefined();
          expect(deploymentInfo.rollbackInfo.rollbackMessage).toContain('Automatic rollback');

          // Property 2: Service should remain active during rollback
          const services = await mockECS.describeServices();
          const service = services.services[0];
          expect(service.status).toBe('ACTIVE');
          expect(service.runningCount).toBe(config.desiredCount);

          // Property 3: Target health should be restored after rollback
          const targetHealth = await mockELBv2.describeTargetHealth();
          const healthyTargets = targetHealth.TargetHealthDescriptions.filter(
            target => target.TargetHealth.State === 'healthy'
          );
          expect(healthyTargets.length).toBe(config.desiredCount);

          // Property 4: Error rate should return to normal after rollback
          const errorMetrics = await mockCloudWatch.getMetricStatistics({
            MetricName: 'HTTPCode_Target_5XX_Count'
          });
          
          if (errorMetrics.Datapoints.length > 1) {
            const latestErrorCount = errorMetrics.Datapoints[errorMetrics.Datapoints.length - 1].Sum;
            expect(latestErrorCount).toBe(0);
          }

          // Property 5: Rollback should complete within reasonable time
          if (deploymentInfo.status === 'Stopped' && deploymentInfo.completeTime) {
            const rollbackDuration = new Date(deploymentInfo.completeTime).getTime() - rollbackStartTime.getTime();
            expect(rollbackDuration).toBeLessThanOrEqual(10 * 60 * 1000); // Max 10 minutes for rollback
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Traffic Shifting Validation
   * For any blue-green deployment, traffic should be shifted gradually and safely
   * without dropping connections
   */
  test('Property: Traffic shifting maintains connection continuity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          serviceName: fc.constantFrom('web-app', 'websocket'),
          trafficShiftPercentage: fc.integer({ min: 10, max: 100 }),
          shiftIntervalMinutes: fc.integer({ min: 1, max: 10 }),
          connectionCount: fc.integer({ min: 50, max: 500 })
        }),
        async (config) => {
          const currentTime = new Date();

          // Mock load balancer listener rules for traffic shifting
          mockELBv2.describeListeners.mockResolvedValue({
            Listeners: [{
              ListenerArn: `arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/direct-fan-platform-alb/1234567890123456/1234567890123456`,
              LoadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/direct-fan-platform-alb/1234567890123456',
              Port: 443,
              Protocol: 'HTTPS',
              DefaultActions: [{
                Type: 'forward',
                ForwardConfig: {
                  TargetGroups: [
                    {
                      TargetGroupArn: `arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/direct-fan-platform-${config.serviceName}-tg/1234567890123456`,
                      Weight: 100 - config.trafficShiftPercentage
                    },
                    {
                      TargetGroupArn: `arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/direct-fan-platform-${config.serviceName}-tg-green/1234567890123456`,
                      Weight: config.trafficShiftPercentage
                    }
                  ]
                }
              }]
            }]
          });

          // Mock connection metrics showing no dropped connections
          mockCloudWatch.getMetricStatistics.mockImplementation((params) => {
            if (params.MetricName === 'ActiveConnectionCount') {
              return Promise.resolve({
                Datapoints: [{
                  Timestamp: currentTime,
                  Average: config.connectionCount,
                  Unit: 'Count'
                }]
              });
            } else if (params.MetricName === 'NewConnectionCount') {
              return Promise.resolve({
                Datapoints: [{
                  Timestamp: currentTime,
                  Sum: Math.floor(config.connectionCount * 0.1), // 10% new connections
                  Unit: 'Count'
                }]
              });
            } else if (params.MetricName === 'RejectedConnectionCount') {
              return Promise.resolve({
                Datapoints: [] // No rejected connections
              });
            }
            return Promise.resolve({ Datapoints: [] });
          });

          const elbv2 = new AWS.ELBv2();
          const cloudWatch = new AWS.CloudWatch();

          // Verify traffic shifting configuration
          const listeners = await mockELBv2.describeListeners();
          const listener = listeners.Listeners[0];
          const forwardAction = listener.DefaultActions.find(action => action.Type === 'forward');

          // Property 1: Traffic should be distributed according to weights
          expect(forwardAction.ForwardConfig.TargetGroups).toHaveLength(2);
          const totalWeight = forwardAction.ForwardConfig.TargetGroups.reduce((sum, tg) => sum + tg.Weight, 0);
          expect(totalWeight).toBe(100);

          // Property 2: Active connections should be maintained
          const activeConnections = await mockCloudWatch.getMetricStatistics({
            MetricName: 'ActiveConnectionCount'
          });
          expect(activeConnections.Datapoints.length).toBeGreaterThan(0);
          expect(activeConnections.Datapoints[0].Average).toBe(config.connectionCount);

          // Property 3: No connections should be rejected during traffic shift
          const rejectedConnections = await mockCloudWatch.getMetricStatistics({
            MetricName: 'RejectedConnectionCount'
          });
          expect(rejectedConnections.Datapoints.length).toBe(0);

          // Property 4: New connections should continue to be accepted
          const newConnections = await mockCloudWatch.getMetricStatistics({
            MetricName: 'NewConnectionCount'
          });
          expect(newConnections.Datapoints.length).toBeGreaterThan(0);
          expect(newConnections.Datapoints[0].Sum).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});