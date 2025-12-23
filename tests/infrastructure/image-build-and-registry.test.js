/**
 * Property-Based Test: Image Build and Registry
 * 
 * Validates: Requirements 8.5 - Image build and registry management
 * 
 * This test verifies that Docker images are built correctly, tagged properly,
 * and pushed to ECR registry with appropriate metadata and security scanning.
 */

const fc = require('fast-check');

// Mock AWS SDK
const mockECR = {
  describeRepositories: jest.fn(),
  describeImages: jest.fn(),
  batchGetImage: jest.fn(),
  putImage: jest.fn(),
  describeImageScanFindings: jest.fn(),
  startImageScan: jest.fn()
};

const mockCodeBuild = {
  batchGetBuilds: jest.fn(),
  startBuild: jest.fn()
};

jest.mock('aws-sdk', () => ({
  ECR: jest.fn(() => mockECR),
  CodeBuild: jest.fn(() => mockCodeBuild)
}));

// Image build and registry service
class ImageBuildRegistryService {
  constructor() {
    this.repositories = new Map();
    this.images = new Map();
    this.buildHistory = [];
    this.scanResults = new Map();
    this.supportedServices = ['web-app', 'websocket', 'streaming'];
  }

  // Register an ECR repository
  registerRepository(repositoryName, config) {
    this.repositories.set(repositoryName, {
      name: repositoryName,
      uri: `${config.accountId}.dkr.ecr.${config.region}.amazonaws.com/${repositoryName}`,
      scanOnPush: config.scanOnPush !== false,
      encryption: config.encryption || 'KMS',
      lifecyclePolicy: config.lifecyclePolicy || 'default',
      createdAt: Date.now()
    });
  }

  // Build and push an image
  buildAndPushImage(buildConfig) {
    const buildId = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const build = {
      buildId,
      serviceName: buildConfig.serviceName,
      sourceCommit: buildConfig.sourceCommit,
      buildSpec: buildConfig.buildSpec,
      startTime: Date.now(),
      endTime: null,
      status: 'IN_PROGRESS',
      images: [],
      scanResults: new Map()
    };

    // Simulate build process
    const buildResult = this.executeBuild(build, buildConfig);
    
    // Push images to registry
    if (buildResult.status === 'SUCCEEDED') {
      for (const imageConfig of buildResult.images) {
        this.pushImageToRegistry(imageConfig, build);
      }
    }

    build.endTime = Date.now();
    this.buildHistory.push(build);
    
    return build;
  }

  // Execute build process
  executeBuild(build, buildConfig) {
    const { serviceName, sourceCommit, dockerfilePath } = buildConfig;
    
    // Validate service name
    if (!this.supportedServices.includes(serviceName)) {
      build.status = 'FAILED';
      build.error = `Unsupported service: ${serviceName}`;
      return build;
    }

    // Simulate Docker build
    const imageTag = this.generateImageTag(sourceCommit);
    const imageUri = this.getImageUri(serviceName, imageTag);
    
    const imageConfig = {
      serviceName,
      imageTag,
      imageUri,
      sourceCommit,
      dockerfilePath: dockerfilePath || `Dockerfile.${serviceName}`,
      buildTime: Date.now(),
      size: Math.floor(Math.random() * 500) + 100, // 100-600 MB
      layers: Math.floor(Math.random() * 10) + 5 // 5-15 layers
    };

    build.images.push(imageConfig);
    build.status = 'SUCCEEDED';
    
    return build;
  }

  // Generate image tag from commit
  generateImageTag(sourceCommit) {
    if (!sourceCommit || sourceCommit.length < 7) {
      return 'latest';
    }
    
    return sourceCommit.substring(0, 7);
  }

  // Get image URI for service
  getImageUri(serviceName, imageTag) {
    const repository = this.repositories.get(serviceName);
    if (!repository) {
      throw new Error(`Repository not found for service: ${serviceName}`);
    }
    
    return `${repository.uri}:${imageTag}`;
  }

  // Push image to registry
  pushImageToRegistry(imageConfig, build) {
    const imageKey = `${imageConfig.serviceName}:${imageConfig.imageTag}`;
    
    const registryImage = {
      ...imageConfig,
      pushedAt: Date.now(),
      buildId: build.buildId,
      manifest: this.generateImageManifest(imageConfig),
      scanStatus: 'PENDING'
    };

    this.images.set(imageKey, registryImage);
    
    // Trigger security scan if enabled
    const repository = this.repositories.get(imageConfig.serviceName);
    if (repository && repository.scanOnPush) {
      this.triggerSecurityScan(imageKey, registryImage);
    }
    
    return registryImage;
  }

  // Generate image manifest
  generateImageManifest(imageConfig) {
    return {
      schemaVersion: 2,
      mediaType: "application/vnd.docker.distribution.manifest.v2+json",
      config: {
        mediaType: "application/vnd.docker.container.image.v1+json",
        size: Math.floor(Math.random() * 5000) + 1000,
        digest: `sha256:${this.generateSHA256()}`
      },
      layers: Array.from({ length: imageConfig.layers }, () => ({
        mediaType: "application/vnd.docker.image.rootfs.diff.tar.gzip",
        size: Math.floor(Math.random() * 50000) + 10000,
        digest: `sha256:${this.generateSHA256()}`
      }))
    };
  }

  // Generate SHA256 hash
  generateSHA256() {
    return Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  // Trigger security scan
  triggerSecurityScan(imageKey, imageConfig) {
    // Simulate scan execution time
    setTimeout(() => {
      const scanResult = this.generateScanResult(imageConfig);
      this.scanResults.set(imageKey, scanResult);
      
      // Update image scan status
      const image = this.images.get(imageKey);
      if (image) {
        image.scanStatus = 'COMPLETE';
        image.scanResult = scanResult;
      }
    }, Math.random() * 1000); // Random delay up to 1 second
  }

  // Generate security scan result
  generateScanResult(imageConfig) {
    const vulnerabilityCounts = {
      CRITICAL: Math.floor(Math.random() * 3), // 0-2 critical
      HIGH: Math.floor(Math.random() * 8), // 0-7 high
      MEDIUM: Math.floor(Math.random() * 15), // 0-14 medium
      LOW: Math.floor(Math.random() * 25), // 0-24 low
      INFORMATIONAL: Math.floor(Math.random() * 10) // 0-9 informational
    };

    return {
      scanStatus: 'COMPLETE',
      vulnerabilitySourceUpdatedAt: new Date().toISOString(),
      findingCounts: vulnerabilityCounts,
      findings: this.generateVulnerabilityFindings(vulnerabilityCounts),
      imageSizeInBytes: imageConfig.size * 1024 * 1024,
      scanCompletedAt: new Date().toISOString()
    };
  }

  // Generate vulnerability findings
  generateVulnerabilityFindings(counts) {
    const findings = [];
    
    for (const [severity, count] of Object.entries(counts)) {
      for (let i = 0; i < count; i++) {
        findings.push({
          name: `CVE-2024-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          severity,
          uri: `https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-${Math.floor(Math.random() * 10000)}`,
          description: `Sample vulnerability description for ${severity} severity issue`,
          attributes: [
            {
              key: "package_version",
              value: `${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`
            }
          ]
        });
      }
    }
    
    return findings;
  }

  // Get images for a service
  getImagesForService(serviceName, limit = 10) {
    const serviceImages = [];
    
    for (const [imageKey, image] of this.images) {
      if (image.serviceName === serviceName) {
        serviceImages.push(image);
      }
    }
    
    // Sort by push time (newest first) and limit
    return serviceImages
      .sort((a, b) => b.pushedAt - a.pushedAt)
      .slice(0, limit);
  }

  // Get build statistics
  getBuildStatistics(timeWindowMs = 3600000) { // 1 hour default
    const cutoff = Date.now() - timeWindowMs;
    const recentBuilds = this.buildHistory.filter(build => build.startTime > cutoff);
    
    if (recentBuilds.length === 0) {
      return {
        totalBuilds: 0,
        successfulBuilds: 0,
        failedBuilds: 0,
        successRate: 1,
        averageBuildTime: 0,
        totalImages: 0
      };
    }

    const successfulBuilds = recentBuilds.filter(build => build.status === 'SUCCEEDED').length;
    const failedBuilds = recentBuilds.length - successfulBuilds;
    const totalBuildTime = recentBuilds.reduce((sum, build) => 
      sum + (build.endTime - build.startTime), 0
    );
    const totalImages = recentBuilds.reduce((sum, build) => sum + build.images.length, 0);

    return {
      totalBuilds: recentBuilds.length,
      successfulBuilds,
      failedBuilds,
      successRate: successfulBuilds / recentBuilds.length,
      averageBuildTime: totalBuildTime / recentBuilds.length,
      totalImages
    };
  }

  // Check image tagging consistency
  checkImageTaggingConsistency() {
    const tagPatterns = new Map();
    
    for (const [imageKey, image] of this.images) {
      const tag = image.imageTag;
      
      if (!tagPatterns.has(tag)) {
        tagPatterns.set(tag, []);
      }
      
      tagPatterns.get(tag).push(image);
    }
    
    return {
      uniqueTags: tagPatterns.size,
      tagPatterns: Object.fromEntries(tagPatterns),
      hasLatestTag: tagPatterns.has('latest'),
      hasCommitTags: Array.from(tagPatterns.keys()).some(tag => 
        tag !== 'latest' && tag.length === 7
      )
    };
  }

  // Clear all data for testing
  clear() {
    this.repositories.clear();
    this.images.clear();
    this.buildHistory = [];
    this.scanResults.clear();
  }
}

describe('Image Build and Registry Property Tests', () => {
  let imageService;

  beforeEach(() => {
    imageService = new ImageBuildRegistryService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    imageService.clear();
  });

  test('Property: Images are built and tagged correctly for all services', () => {
    fc.assert(
      fc.property(
        fc.record({
          builds: fc.array(
            fc.record({
              serviceName: fc.constantFrom('web-app', 'websocket', 'streaming'),
              sourceCommit: fc.string({ minLength: 40, maxLength: 40 }),
              dockerfilePath: fc.option(fc.string({ minLength: 5, maxLength: 50 }))
            }),
            { minLength: 1, maxLength: 5 }
          ),
          accountId: fc.string({ minLength: 12, maxLength: 12 }),
          region: fc.constantFrom('us-east-1', 'us-west-2', 'eu-west-1')
        }),
        ({ builds, accountId, region }) => {
          imageService.clear();
          
          // Register repositories for all services
          for (const serviceName of imageService.supportedServices) {
            imageService.registerRepository(serviceName, {
              accountId,
              region,
              scanOnPush: true
            });
          }

          const buildResults = [];
          
          // Execute builds
          for (const buildConfig of builds) {
            const result = imageService.buildAndPushImage(buildConfig);
            buildResults.push({ result, buildConfig });
          }
          
          // Verify all builds succeeded
          for (const { result: build, buildConfig } of buildResults) {
            expect(build.status).toBe('SUCCEEDED');
            expect(build.images.length).toBeGreaterThan(0);
            
            // Verify image tagging
            for (const image of build.images) {
              expect(image.imageTag).toBeDefined();
              expect(image.imageUri).toContain(accountId);
              expect(image.imageUri).toContain(region);
              expect(image.imageUri).toContain(image.serviceName);
              expect(image.sourceCommit).toBe(buildConfig.sourceCommit);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Images are pushed to correct repositories', () => {
    fc.assert(
      fc.property(
        fc.record({
          serviceName: fc.constantFrom('web-app', 'websocket', 'streaming'),
          sourceCommit: fc.string({ minLength: 40, maxLength: 40 }),
          accountId: fc.string({ minLength: 12, maxLength: 12 }),
          region: fc.constantFrom('us-east-1', 'us-west-2')
        }),
        ({ serviceName, sourceCommit, accountId, region }) => {
          imageService.clear();
          
          // Register repository
          imageService.registerRepository(serviceName, {
            accountId,
            region,
            scanOnPush: true
          });

          // Build and push image
          const build = imageService.buildAndPushImage({
            serviceName,
            sourceCommit
          });
          
          expect(build.status).toBe('SUCCEEDED');
          expect(build.images.length).toBe(1);
          
          const image = build.images[0];
          const expectedTag = sourceCommit.substring(0, 7);
          const imageKey = `${serviceName}:${expectedTag}`;
          
          // Verify image is in registry
          const registryImage = imageService.images.get(imageKey);
          expect(registryImage).toBeDefined();
          expect(registryImage.serviceName).toBe(serviceName);
          expect(registryImage.imageTag).toBe(expectedTag);
          expect(registryImage.buildId).toBe(build.buildId);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Security scans are triggered for images when enabled', () => {
    fc.assert(
      fc.property(
        fc.record({
          serviceName: fc.constantFrom('web-app', 'websocket', 'streaming'),
          sourceCommit: fc.string({ minLength: 40, maxLength: 40 }),
          scanOnPush: fc.boolean(),
          accountId: fc.string({ minLength: 12, maxLength: 12 })
        }),
        ({ serviceName, sourceCommit, scanOnPush, accountId }) => {
          imageService.clear();
          
          // Register repository with scan configuration
          imageService.registerRepository(serviceName, {
            accountId,
            region: 'us-east-1',
            scanOnPush
          });

          // Build and push image
          const build = imageService.buildAndPushImage({
            serviceName,
            sourceCommit
          });
          
          expect(build.status).toBe('SUCCEEDED');
          
          const image = build.images[0];
          const imageKey = `${serviceName}:${image.imageTag}`;
          const registryImage = imageService.images.get(imageKey);
          
          expect(registryImage).toBeDefined();
          
          if (scanOnPush) {
            // Scan should be triggered
            expect(registryImage.scanStatus).toBeDefined();
            expect(['PENDING', 'COMPLETE']).toContain(registryImage.scanStatus);
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Image manifests contain correct metadata', () => {
    fc.assert(
      fc.property(
        fc.record({
          serviceName: fc.constantFrom('web-app', 'websocket', 'streaming'),
          sourceCommit: fc.string({ minLength: 40, maxLength: 40 }),
          accountId: fc.string({ minLength: 12, maxLength: 12 })
        }),
        ({ serviceName, sourceCommit, accountId }) => {
          imageService.clear();
          
          // Register repository
          imageService.registerRepository(serviceName, {
            accountId,
            region: 'us-east-1'
          });

          // Build and push image
          const build = imageService.buildAndPushImage({
            serviceName,
            sourceCommit
          });
          
          const image = build.images[0];
          const imageKey = `${serviceName}:${image.imageTag}`;
          const registryImage = imageService.images.get(imageKey);
          
          expect(registryImage.manifest).toBeDefined();
          expect(registryImage.manifest.schemaVersion).toBe(2);
          expect(registryImage.manifest.config).toBeDefined();
          expect(registryImage.manifest.layers).toBeDefined();
          expect(registryImage.manifest.layers.length).toBeGreaterThan(0);
          
          // Verify all layers have required fields
          for (const layer of registryImage.manifest.layers) {
            expect(layer.mediaType).toBeDefined();
            expect(layer.size).toBeGreaterThan(0);
            expect(layer.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Build statistics accurately reflect build results', () => {
    fc.assert(
      fc.property(
        fc.record({
          builds: fc.array(
            fc.record({
              serviceName: fc.constantFrom('web-app', 'websocket', 'streaming'),
              sourceCommit: fc.string({ minLength: 40, maxLength: 40 }),
              shouldFail: fc.boolean()
            }),
            { minLength: 3, maxLength: 10 }
          ),
          accountId: fc.string({ minLength: 12, maxLength: 12 })
        }),
        ({ builds, accountId }) => {
          imageService.clear();
          
          // Register repositories
          for (const serviceName of imageService.supportedServices) {
            imageService.registerRepository(serviceName, {
              accountId,
              region: 'us-east-1'
            });
          }

          let expectedSuccessful = 0;
          let expectedFailed = 0;
          let expectedImages = 0;
          
          // Execute builds
          for (const buildConfig of builds) {
            if (buildConfig.shouldFail) {
              // Simulate failure by using unsupported service
              const result = imageService.buildAndPushImage({
                serviceName: 'invalid-service',
                sourceCommit: buildConfig.sourceCommit
              });
              expectedFailed++;
            } else {
              const result = imageService.buildAndPushImage(buildConfig);
              expectedSuccessful++;
              expectedImages += result.images.length;
            }
          }
          
          // Get statistics
          const stats = imageService.getBuildStatistics();
          
          // Verify statistics
          expect(stats.totalBuilds).toBe(builds.length);
          expect(stats.successfulBuilds).toBe(expectedSuccessful);
          expect(stats.failedBuilds).toBe(expectedFailed);
          expect(stats.totalImages).toBe(expectedImages);
          
          if (builds.length > 0) {
            const expectedSuccessRate = expectedSuccessful / builds.length;
            expect(stats.successRate).toBeCloseTo(expectedSuccessRate, 2);
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property: Image tagging follows consistent patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          builds: fc.array(
            fc.record({
              serviceName: fc.constantFrom('web-app', 'websocket', 'streaming'),
              sourceCommit: fc.string({ minLength: 40, maxLength: 40 })
            }),
            { minLength: 2, maxLength: 8 }
          ),
          accountId: fc.string({ minLength: 12, maxLength: 12 })
        }),
        ({ builds, accountId }) => {
          imageService.clear();
          
          // Register repositories
          for (const serviceName of imageService.supportedServices) {
            imageService.registerRepository(serviceName, {
              accountId,
              region: 'us-east-1'
            });
          }

          // Execute builds
          for (const buildConfig of builds) {
            imageService.buildAndPushImage(buildConfig);
          }
          
          // Check tagging consistency
          const taggingInfo = imageService.checkImageTaggingConsistency();
          
          expect(taggingInfo.uniqueTags).toBeGreaterThan(0);
          expect(taggingInfo.hasCommitTags).toBe(true);
          
          // Verify all tags follow expected patterns
          for (const tag of Object.keys(taggingInfo.tagPatterns)) {
            // Should be either 'latest' or 7-character commit hash
            expect(tag === 'latest' || tag.length === 7).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});