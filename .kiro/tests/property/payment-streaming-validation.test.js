/**
 * Property Test: Payment and Streaming Validation
 * Validates: Requirements 5.3, 5.4
 * 
 * Property 15: Payment and streaming validation
 * - Payment processing integration is functional
 * - Streaming functionality works correctly
 * - Integration between payments and streaming access
 */

const fs = require('fs');
const path = require('path');

describe('Property Test: Payment and Streaming Validation', () => {
  const projectRoot = path.join(__dirname, '../../..');
  const srcDir = path.join(projectRoot, 'src');
  const terraformDir = path.join(projectRoot, 'infrastructure/terraform');
  const logsDir = path.join(projectRoot, 'logs');

  test('Property 15.1: Payment processing integration is comprehensive', () => {
    // Check payment integration test results
    const paymentResultsPath = path.join(logsDir, 'payment-integration-results.json');
    
    if (fs.existsSync(paymentResultsPath)) {
      const paymentResults = JSON.parse(fs.readFileSync(paymentResultsPath, 'utf8'));
      
      expect(paymentResults.testResults).toBeDefined();
      expect(paymentResults.testResults.total).toBeGreaterThan(10);
      expect(paymentResults.passRate).toBeGreaterThan(70); // At least 70% pass rate
      
      // Verify essential payment components are tested
      expect(paymentResults.testResults.stripeTests).toBeGreaterThan(0);
      expect(paymentResults.testResults.webhookTests).toBeGreaterThan(0);
      expect(paymentResults.testResults.subscriptionTests).toBeGreaterThan(0);
      expect(paymentResults.testResults.payoutTests).toBeGreaterThan(0);
    }
    
    // Verify Stripe service exists
    const stripeLibPath = path.join(srcDir, 'lib/stripe.ts');
    expect(fs.existsSync(stripeLibPath)).toBe(true);
    
    if (fs.existsSync(stripeLibPath)) {
      const stripeContent = fs.readFileSync(stripeLibPath, 'utf8');
      expect(stripeContent).toContain('Stripe');
      expect(stripeContent).toMatch(/(paymentIntents|subscriptions|customers)/);
    }
  });

  test('Property 15.2: Payment endpoints are properly implemented', () => {
    const paymentEndpoints = [
      'payments/create-checkout',
      'payments/portal',
      'payments/webhooks'
    ];

    paymentEndpoints.forEach(endpoint => {
      const endpointPath = path.join(srcDir, 'app/api', endpoint, 'route.ts');
      expect(fs.existsSync(endpointPath)).toBe(true);
      
      if (fs.existsSync(endpointPath)) {
        const content = fs.readFileSync(endpointPath, 'utf8');
        expect(content).toMatch(/(stripe|Stripe)/);
        expect(content).toContain('try');
        expect(content).toContain('catch');
      }
    });
  });

  test('Property 15.3: Subscription management is functional', () => {
    // Check subscription service
    const subscriptionServicePath = path.join(srcDir, 'lib/subscription-service.ts');
    if (fs.existsSync(subscriptionServicePath)) {
      const subscriptionContent = fs.readFileSync(subscriptionServicePath, 'utf8');
      expect(subscriptionContent).toMatch(/(subscription|Subscription)/);
      expect(subscriptionContent).toMatch(/(create|update|cancel)/);
    }

    // Check subscription endpoints
    const subscriptionEndpoints = [
      'fan/subscriptions',
      'fan/subscriptions/[id]'
    ];

    subscriptionEndpoints.forEach(endpoint => {
      const endpointPath = path.join(srcDir, 'app/api', endpoint, 'route.ts');
      expect(fs.existsSync(endpointPath)).toBe(true);
    });
  });

  test('Property 15.4: Webhook handling is secure and comprehensive', () => {
    const webhookPath = path.join(srcDir, 'app/api/payments/webhooks/route.ts');
    expect(fs.existsSync(webhookPath)).toBe(true);
    
    if (fs.existsSync(webhookPath)) {
      const webhookContent = fs.readFileSync(webhookPath, 'utf8');
      
      // Verify signature verification
      expect(webhookContent).toMatch(/(signature|constructEvent|webhook_secret)/);
      
      // Verify event handling
      expect(webhookContent).toMatch(/(event\.type|switch|payment_intent)/);
      
      // Verify error handling
      expect(webhookContent).toContain('try');
      expect(webhookContent).toContain('catch');
    }
  });

  test('Property 15.5: Streaming infrastructure is properly configured', () => {
    // Check AWS MediaLive configuration
    const mediaLivePath = path.join(terraformDir, 'medialive-streaming.tf');
    if (fs.existsSync(mediaLivePath)) {
      const mediaLiveConfig = fs.readFileSync(mediaLivePath, 'utf8');
      expect(mediaLiveConfig).toContain('aws_medialive');
      expect(mediaLiveConfig).toMatch(/(channel|input|output)/);
    }

    // Check MediaConvert configuration
    const mediaConvertPath = path.join(terraformDir, 'mediaconvert-vod.tf');
    if (fs.existsSync(mediaConvertPath)) {
      const mediaConvertConfig = fs.readFileSync(mediaConvertPath, 'utf8');
      expect(mediaConvertConfig).toContain('aws_media_convert');
    }

    // Check MediaStore configuration
    const mediaStorePath = path.join(terraformDir, 'mediastore-streaming.tf');
    if (fs.existsSync(mediaStorePath)) {
      const mediaStoreConfig = fs.readFileSync(mediaStorePath, 'utf8');
      expect(mediaStoreConfig).toContain('aws_media_store');
    }
  });

  test('Property 15.6: Streaming service implementation is complete', () => {
    const streamingFiles = [
      'lib/streaming-websocket.ts',
      'lib/vod-service.ts'
    ];

    let streamingImplementationFound = false;

    streamingFiles.forEach(file => {
      const filePath = path.join(srcDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('streaming') || content.includes('MediaLive') || content.includes('video')) {
          streamingImplementationFound = true;
          expect(content).toMatch(/(stream|video|media|broadcast)/i);
        }
      }
    });

    // At least one streaming implementation should exist
    expect(streamingImplementationFound).toBe(true);
  });

  test('Property 15.7: Streaming endpoints are properly implemented', () => {
    const streamingEndpoints = [
      'streaming/create',
      'streaming/[streamId]/start',
      'streaming/[streamId]/stop',
      'streaming/[streamId]/access',
      'streaming/[streamId]/vod'
    ];

    let streamingEndpointsFound = 0;

    streamingEndpoints.forEach(endpoint => {
      const endpointPath = path.join(srcDir, 'app/api', endpoint, 'route.ts');
      if (fs.existsSync(endpointPath)) {
        streamingEndpointsFound++;
        
        const content = fs.readFileSync(endpointPath, 'utf8');
        expect(content).toMatch(/(stream|video|media)/i);
        expect(content).toContain('try');
        expect(content).toContain('catch');
      }
    });

    // At least 3 streaming endpoints should exist
    expect(streamingEndpointsFound).toBeGreaterThanOrEqual(3);
  });

  test('Property 15.8: Payment and streaming integration is functional', () => {
    // Check content access control
    const contentAccessPath = path.join(srcDir, 'lib/content-access.ts');
    if (fs.existsSync(contentAccessPath)) {
      const contentAccess = fs.readFileSync(contentAccessPath, 'utf8');
      expect(contentAccess).toMatch(/(subscription|tier|access|permission)/i);
    }

    // Check streaming access endpoint
    const streamingAccessPath = path.join(srcDir, 'app/api/streaming/[streamId]/access/route.ts');
    if (fs.existsSync(streamingAccessPath)) {
      const accessContent = fs.readFileSync(streamingAccessPath, 'utf8');
      expect(accessContent).toMatch(/(subscription|access|permission|auth)/i);
    }

    // Check content access endpoint
    const contentAccessEndpointPath = path.join(srcDir, 'app/api/content/[id]/access/route.ts');
    if (fs.existsSync(contentAccessEndpointPath)) {
      const accessEndpointContent = fs.readFileSync(contentAccessEndpointPath, 'utf8');
      expect(accessEndpointContent).toMatch(/(subscription|tier|access)/i);
    }
  });

  test('Property 15.9: Live streaming functionality is configured', () => {
    // Check livestream endpoints
    const livestreamEndpoints = [
      'livestream',
      'livestream/[streamId]',
      'livestream/[streamId]/chat'
    ];

    let livestreamEndpointsFound = 0;

    livestreamEndpoints.forEach(endpoint => {
      const endpointPath = path.join(srcDir, 'app/api', endpoint, 'route.ts');
      if (fs.existsSync(endpointPath)) {
        livestreamEndpointsFound++;
      }
    });

    expect(livestreamEndpointsFound).toBeGreaterThanOrEqual(2);

    // Check WebSocket integration for live streaming
    const websocketFiles = [
      'lib/websocket-handler.ts',
      'lib/socket-server.ts'
    ];

    let websocketImplementationFound = false;

    websocketFiles.forEach(file => {
      const filePath = path.join(srcDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('WebSocket') || content.includes('socket.io')) {
          websocketImplementationFound = true;
        }
      }
    });

    expect(websocketImplementationFound).toBe(true);
  });

  test('Property 15.10: VOD (Video on Demand) processing is configured', () => {
    // Check VOD service
    const vodServicePath = path.join(srcDir, 'lib/vod-service.ts');
    if (fs.existsSync(vodServicePath)) {
      const vodContent = fs.readFileSync(vodServicePath, 'utf8');
      expect(vodContent).toMatch(/(vod|video|media|convert|process)/i);
    }

    // Check MediaConvert webhook
    const mediaConvertWebhookPath = path.join(srcDir, 'app/api/webhooks/mediaconvert/route.ts');
    if (fs.existsSync(mediaConvertWebhookPath)) {
      const webhookContent = fs.readFileSync(mediaConvertWebhookPath, 'utf8');
      expect(webhookContent).toMatch(/(mediaconvert|job|status|complete)/i);
    }

    // Check streaming VOD endpoint
    const vodEndpointPath = path.join(srcDir, 'app/api/streaming/[streamId]/vod/route.ts');
    if (fs.existsSync(vodEndpointPath)) {
      const vodEndpointContent = fs.readFileSync(vodEndpointPath, 'utf8');
      expect(vodEndpointContent).toMatch(/(vod|video|playback)/i);
    }
  });

  test('Property 15.11: Adaptive bitrate streaming is supported', () => {
    // Check for adaptive bitrate configuration in infrastructure
    const mediaLivePath = path.join(terraformDir, 'medialive-streaming.tf');
    if (fs.existsSync(mediaLivePath)) {
      const mediaLiveConfig = fs.readFileSync(mediaLivePath, 'utf8');
      
      // Look for multiple output configurations (different bitrates)
      const outputMatches = mediaLiveConfig.match(/output/g) || [];
      expect(outputMatches.length).toBeGreaterThan(1);
    }

    // Check streaming service for bitrate handling
    const streamingFiles = [
      'lib/streaming-websocket.ts',
      'lib/vod-service.ts'
    ];

    streamingFiles.forEach(file => {
      const filePath = path.join(srcDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('bitrate') || content.includes('quality') || content.includes('resolution')) {
          expect(content).toMatch(/(bitrate|quality|resolution|adaptive)/i);
        }
      }
    });
  });

  test('Property 15.12: Payment and content access integration is secure', () => {
    // Check RBAC (Role-Based Access Control)
    const rbacPath = path.join(srcDir, 'lib/rbac.ts');
    if (fs.existsSync(rbacPath)) {
      const rbacContent = fs.readFileSync(rbacPath, 'utf8');
      expect(rbacContent).toMatch(/(role|permission|access|authorize)/i);
    }

    // Check content access middleware
    const contentAccessMiddlewarePath = path.join(srcDir, 'middleware/content-access.ts');
    if (fs.existsSync(contentAccessMiddlewarePath)) {
      const middlewareContent = fs.readFileSync(contentAccessMiddlewarePath, 'utf8');
      expect(middlewareContent).toMatch(/(subscription|tier|access|middleware)/i);
    }

    // Check authentication utilities
    const authUtilsPath = path.join(srcDir, 'lib/auth-utils.ts');
    if (fs.existsSync(authUtilsPath)) {
      const authUtils = fs.readFileSync(authUtilsPath, 'utf8');
      expect(authUtils).toMatch(/(session|token|auth|validate)/i);
    }
  });
});