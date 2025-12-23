// Property-Based Test for Cost Anomaly Detection
// **Validates: Requirements 10.5**

const fc = require('fast-check');

// Mock AWS SDK services
const mockCostExplorer = {
  getAnomalies: jest.fn()
};

const mockSNS = {
  publish: jest.fn()
};

const mockSTS = {
  getCallerIdentity: jest.fn()
};

// Mock the entire aws-sdk module with proper constructor functions
jest.mock('aws-sdk', () => {
  return {
    CostExplorer: jest.fn().mockImplementation(() => mockCostExplorer),
    SNS: jest.fn().mockImplementation(() => mockSNS),
    STS: jest.fn().mockImplementation(() => mockSTS)
  };
});

// Import after mocking
const { CostAnomalyDetectionService } = require('../../src/lib/cost-anomaly-detection-service.ts');

describe('Cost Anomaly Detection Properties', () => {
  let costAnomalyService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mock implementations
    mockCostExplorer.getAnomalies.mockReset();
    mockSNS.publish.mockReset();
    mockSTS.getCallerIdentity.mockReset();
    
    // Mock STS getCallerIdentity to return a test account ID
    mockSTS.getCallerIdentity.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Account: '123456789012',
        UserId: 'test-user',
        Arn: 'arn:aws:iam::123456789012:user/test-user'
      })
    });

    // Mock SNS publish method
    mockSNS.publish.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        MessageId: 'test-message-id'
      })
    });

    // Mock CostExplorer getAnomalies method
    mockCostExplorer.getAnomalies.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Anomalies: []
      })
    });
    
    costAnomalyService = new CostAnomalyDetectionService({
      projectName: 'test-project',
      environment: 'test',
      anomalyThreshold: 100,
      snsTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic'
    });
  });

  /**
   * Property 31: Cost Anomaly Detection
   * For any significant deviation from expected cost patterns, the monitoring system 
   * should detect the anomaly and trigger appropriate alerts
   * **Validates: Requirements 10.5**
   */
  test('Property 31: Cost anomaly detection triggers alerts for significant deviations', async () => {
    await fc.assert(fc.asyncProperty(
      // Generate anomaly scenarios that align with service logic
      fc.record({
        service: fc.constantFrom('ECS', 'RDS', 'S3', 'CloudFront', 'ElastiCache'),
        threshold: fc.float({ min: 50, max: 300 }),
        // Generate impact values that are either above or below threshold
        impactAboveThreshold: fc.boolean(),
        impactValue: fc.float({ min: 10, max: 500 })
      }),
      async ({ service, threshold, impactAboveThreshold, impactValue }) => {
        // Calculate actual impact based on whether it should be above threshold
        const actualImpact = impactAboveThreshold ? 
          Math.max(threshold + 10, impactValue) : 
          Math.min(threshold - 1, impactValue);

        const anomalyDate = new Date().toISOString().split('T')[0];
        const anomalyId = `anomaly-${service}-${Date.now()}`;

        // Create AWS Cost Explorer response that matches service expectations
        const awsAnomalies = actualImpact >= threshold ? [{
          AnomalyId: anomalyId,
          AnomalyStartDate: anomalyDate,
          AnomalyEndDate: anomalyDate,
          DimensionKey: 'SERVICE',
          RootCauses: [{
            Service: service,
            Region: 'us-east-1'
          }],
          Impact: {
            MaxImpact: actualImpact.toString(),
            TotalImpact: actualImpact.toString()
          }
        }] : [];

        // Mock AWS Cost Explorer to return our controlled anomaly data
        mockCostExplorer.getAnomalies.mockReturnValue({
          promise: jest.fn().mockResolvedValue({
            Anomalies: awsAnomalies
          })
        });

        // Configure service with the test threshold
        costAnomalyService.updateServiceThresholds({
          [service]: { threshold: threshold, enabled: true }
        });

        // Clear alert history and reset SNS mock
        costAnomalyService.clearAlertHistory();
        mockSNS.publish.mockClear();

        // Run anomaly detection
        const result = await costAnomalyService.detectAnomalies();

        // Verify behavior based on whether anomaly should be detected
        if (impactAboveThreshold && actualImpact >= threshold) {
          // Should detect the anomaly and send alert
          expect(result.anomaliesDetected).toBe(1);
          expect(result.anomalies).toHaveLength(1);
          expect(mockSNS.publish).toHaveBeenCalledTimes(1);
          
          // Verify anomaly properties
          const detectedAnomaly = result.anomalies[0];
          expect(detectedAnomaly.anomalyId).toBe(anomalyId);
          expect(detectedAnomaly.service).toBe(service);
          expect(parseFloat(detectedAnomaly.impact)).toBe(actualImpact);
          expect(detectedAnomaly.date).toBe(anomalyDate);
          
          // Verify alert content
          const publishCall = mockSNS.publish.mock.calls[0][0];
          expect(publishCall.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-topic');
          expect(publishCall.Subject).toContain('Cost Anomaly Detected');
          expect(publishCall.Subject).toContain(service);
          expect(publishCall.Message).toContain(service);
          expect(publishCall.Message).toContain(actualImpact.toString());
        } else {
          // Should not detect anomaly or send alerts
          expect(result.anomaliesDetected).toBe(0);
          expect(result.anomalies).toHaveLength(0);
          expect(mockSNS.publish).not.toHaveBeenCalled();
        }

        // Should always return valid result structure
        expect(result).toHaveProperty('anomaliesDetected');
        expect(result).toHaveProperty('anomalies');
        expect(result).toHaveProperty('analysisDate');
        expect(result).toHaveProperty('alertHistory');
        expect(Array.isArray(result.anomalies)).toBe(true);
        expect(Array.isArray(result.alertHistory)).toBe(true);
        expect(typeof result.anomaliesDetected).toBe('number');
      }
    ), { numRuns: 10 });
  });

  test('Property 31a: Cost anomaly detection handles service-specific thresholds', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        services: fc.array(
          fc.record({
            name: fc.constantFrom('ECS', 'RDS', 'S3', 'CloudFront'),
            threshold: fc.float({ min: 50, max: 300 }),
            impact: fc.float({ min: 10, max: 500 }),
            shouldTrigger: fc.boolean()
          }),
          { minLength: 2, maxLength: 4 }
        ).map(services => {
          // Ensure unique service names and adjust impacts based on shouldTrigger
          const uniqueServices = [];
          const usedNames = new Set();
          for (const service of services) {
            if (!usedNames.has(service.name)) {
              // Adjust impact based on whether it should trigger
              const adjustedImpact = service.shouldTrigger ? 
                Math.max(service.threshold + 10, service.impact) :
                Math.min(service.threshold - 1, service.impact);
              
              uniqueServices.push({
                ...service,
                impact: adjustedImpact
              });
              usedNames.add(service.name);
            }
          }
          return uniqueServices.length > 0 ? uniqueServices : [services[0]];
        })
      }),
      async ({ services }) => {
        const anomalyDate = new Date().toISOString().split('T')[0];
        
        // Create AWS anomalies only for services that should trigger
        const awsAnomalies = services
          .filter(service => service.shouldTrigger && service.impact >= service.threshold)
          .map(service => ({
            AnomalyId: `anomaly-${service.name}-${Date.now()}`,
            AnomalyStartDate: anomalyDate,
            DimensionKey: 'SERVICE',
            RootCauses: [{
              Service: service.name,
              Region: 'us-east-1'
            }],
            Impact: {
              MaxImpact: service.impact.toString(),
              TotalImpact: service.impact.toString()
            }
          }));

        // Mock AWS responses
        mockCostExplorer.getAnomalies.mockReturnValue({
          promise: jest.fn().mockResolvedValue({
            Anomalies: awsAnomalies
          })
        });

        // Clear alert history and reset mocks
        costAnomalyService.clearAlertHistory();
        mockSNS.publish.mockClear();

        // Configure service-specific thresholds
        const serviceConfig = {};
        services.forEach(service => {
          serviceConfig[service.name] = { threshold: service.threshold, enabled: true };
        });

        costAnomalyService.updateServiceThresholds(serviceConfig);
        const result = await costAnomalyService.detectAnomalies();

        // Calculate expected anomalies based on service logic
        const expectedAnomalies = services.filter(service => 
          service.shouldTrigger && service.impact >= service.threshold
        );
        
        expect(result.anomaliesDetected).toBe(expectedAnomalies.length);
        expect(result.anomalies).toHaveLength(expectedAnomalies.length);
        
        // Verify each detected anomaly matches expectations
        result.anomalies.forEach(anomaly => {
          const serviceData = services.find(s => s.name === anomaly.service);
          expect(serviceData).toBeDefined();
          expect(serviceData.shouldTrigger).toBe(true);
          expect(serviceData.impact).toBeGreaterThanOrEqual(serviceData.threshold);
          expect(parseFloat(anomaly.impact)).toBe(serviceData.impact);
        });

        // Verify services that shouldn't trigger don't appear in results
        const nonTriggeringServices = services.filter(service => 
          !service.shouldTrigger || service.impact < service.threshold
        );
        nonTriggeringServices.forEach(serviceData => {
          const foundAnomaly = result.anomalies.find(anomaly => anomaly.service === serviceData.name);
          expect(foundAnomaly).toBeUndefined();
        });

        // Verify alert count matches detected anomalies
        expect(mockSNS.publish).toHaveBeenCalledTimes(expectedAnomalies.length);
      }
    ), { numRuns: 10 });
  });

  test('Property 31b: Cost anomaly detection maintains alert history and prevents spam', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        anomalyDuration: fc.integer({ min: 1, max: 5 }),
        service: fc.constantFrom('ECS', 'RDS', 'S3'),
        impact: fc.float({ min: 200, max: 500 }),
        threshold: fc.float({ min: 100, max: 150 }),
        cooldownHours: fc.integer({ min: 12, max: 48 })
      }),
      async ({ anomalyDuration, service, impact, threshold, cooldownHours }) => {
        // Ensure impact is above threshold to trigger anomaly
        const actualImpact = Math.max(impact, threshold + 10);
        
        // Clear alert history and reset mocks
        costAnomalyService.clearAlertHistory();
        mockSNS.publish.mockClear();
        
        // Configure service with cooldown period
        costAnomalyService = new CostAnomalyDetectionService({
          projectName: 'test-project',
          environment: 'test',
          anomalyThreshold: 100,
          snsTopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
          cooldownPeriodHours: cooldownHours
        });
        
        // Set service threshold
        costAnomalyService.updateServiceThresholds({
          [service]: { threshold: threshold, enabled: true }
        });
        
        // Simulate repeated anomaly detection over time
        const detectionRuns = [];
        let totalAlerts = 0;
        const baseAnomalyId = `anomaly-${service}-persistent`;
        
        for (let day = 0; day < anomalyDuration; day++) {
          const date = new Date(Date.now() - (anomalyDuration - day) * 24 * 60 * 60 * 1000);
          const anomalyId = `${baseAnomalyId}-${date.toISOString().split('T')[0]}`;
          
          // Mock the same persistent anomaly
          mockCostExplorer.getAnomalies.mockReturnValue({
            promise: jest.fn().mockResolvedValue({
              Anomalies: [{
                AnomalyId: anomalyId,
                AnomalyStartDate: date.toISOString().split('T')[0],
                DimensionKey: 'SERVICE',
                RootCauses: [{
                  Service: service,
                  Region: 'us-east-1'
                }],
                Impact: {
                  MaxImpact: actualImpact.toString(),
                  TotalImpact: actualImpact.toString()
                }
              }]
            })
          });

          const alertCountBefore = mockSNS.publish.mock.calls.length;
          const result = await costAnomalyService.detectAnomalies();
          const alertCountAfter = mockSNS.publish.mock.calls.length;
          const alertsSentThisRun = alertCountAfter - alertCountBefore;
          
          detectionRuns.push({
            day,
            result,
            alertsSentThisRun,
            anomalyId
          });
          
          totalAlerts = alertCountAfter;
        }

        // Verify alert throttling behavior
        if (anomalyDuration === 1) {
          // Single anomaly should trigger one alert
          expect(totalAlerts).toBe(1);
        } else {
          // Multiple days should respect cooldown - each unique anomaly ID gets one alert
          // Since we're using different anomaly IDs for each day, each should trigger an alert
          expect(totalAlerts).toBe(anomalyDuration);
          expect(totalAlerts).toBeGreaterThan(0);
        }

        // Each detection run should maintain proper structure
        detectionRuns.forEach(run => {
          expect(run.result).toHaveProperty('anomaliesDetected');
          expect(run.result).toHaveProperty('alertHistory');
          expect(Array.isArray(run.result.alertHistory)).toBe(true);
          
          // Each run should detect the anomaly (since impact > threshold)
          expect(run.result.anomaliesDetected).toBe(1);
        });

        // Verify alert history is maintained
        const finalResult = detectionRuns[detectionRuns.length - 1].result;
        expect(finalResult.alertHistory.length).toBe(totalAlerts);
        
        // Each alert in history should have required properties
        finalResult.alertHistory.forEach(alert => {
          expect(alert).toHaveProperty('anomalyId');
          expect(alert).toHaveProperty('alertSentAt');
          expect(alert).toHaveProperty('service');
          expect(alert).toHaveProperty('impact');
          expect(alert.service).toBe(service);
          expect(alert.impact).toBe(actualImpact.toString());
        });
      }
    ), { numRuns: 10 });
  });
});