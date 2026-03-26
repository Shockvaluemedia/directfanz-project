import { AIOrchestrator } from './orchestrator';
import { EventBus } from './event-bus';
import { ConversationalAgent, ConversationalAgentConfig } from './agents/conversational-agent';
import { ContentModerationAgent, ContentModerationConfig } from './agents/content-moderation-agent';
import { RecommendationAgent, RecommendationAgentConfig } from './agents/recommendation-agent';
import { CommunityManagementAgent, CommunityManagementConfig } from './agents/community-management-agent';
import { AgentTask, AgentContext } from './base-agent';
import { Logger } from '@/lib/logger';

// Demo configuration - replace with actual values
const DEMO_CONFIG = {
  openaiApiKey: process.env.OPENAI_API_KEY || 'your-openai-key-here',
  openaiModerationApiKey: process.env.OPENAI_MODERATION_API_KEY || 'your-moderation-key-here',
};

// Demo function to show AI agents in action
export async function demoAIAgents(): Promise<void> {
  const logger = new Logger('AI-Demo');
  logger.info('Starting AI Agent System Demo...');

  try {
    // 1. Initialize Event Bus and Orchestrator
    logger.info('Initializing Event Bus and Orchestrator...');
    const eventBus = new EventBus();
    const orchestrator = new AIOrchestrator({
      logLevel: 'info',
      maxConcurrentTasks: 50,
      healthCheckInterval: 10000, // 10 seconds for demo
    }, eventBus);

    // 2. Create and register Conversational Agent
    logger.info('Creating Conversational Agent...');
    const conversationalConfig: ConversationalAgentConfig = {
      name: 'DirectFanZ Chat Assistant',
      version: '1.0.0',
      openaiApiKey: DEMO_CONFIG.openaiApiKey,
      model: 'gpt-3.5-turbo',
      maxTokens: 150,
      temperature: 0.7,
      responseTimeout: 30000,
      maxConversationLength: 20,
      autoEscalateAfter: 30,
      supportedLanguages: ['en', 'es', 'fr'],
      moderationEnabled: true,
      learningEnabled: true,
    };

    const conversationalAgent = new ConversationalAgent(
      'chat-assistant-001',
      conversationalConfig,
      logger
    );

    await orchestrator.registerAgent(conversationalAgent, conversationalConfig);
    logger.info('✅ Conversational Agent registered');

    // 3. Create and register Content Moderation Agent
    logger.info('Creating Content Moderation Agent...');
    const moderationConfig: ContentModerationConfig = {
      name: 'DirectFanZ Content Moderator',
      version: '1.0.0',
      openaiModerationApiKey: DEMO_CONFIG.openaiModerationApiKey,
      strictnessLevel: 'moderate',
      enableImageScanning: true,
      enableVideoScanning: true,
      enableTextScanning: true,
      enableAudioScanning: false,
      autoRejectThreshold: 0.8,
      humanReviewThreshold: 0.6,
      appealEnabled: true,
      maxProcessingTime: 30000,
      enableLearning: true,
      customPolicies: [
        {
          id: 'directfanz-community-standards',
          name: 'DirectFanZ Community Standards',
          description: 'Custom policies for DirectFanZ platform',
          rules: [
            {
              type: 'keyword',
              condition: 'spam|scam|fake',
              action: 'flag',
              weight: 0.7,
            },
          ],
          severity: 'medium',
          enabled: true,
        },
      ],
    };

    const moderationAgent = new ContentModerationAgent(
      'content-moderator-001',
      moderationConfig,
      logger
    );

    await orchestrator.registerAgent(moderationAgent, moderationConfig);
    logger.info('✅ Content Moderation Agent registered');

    // 4. Create and register Recommendation Agent
    logger.info('Creating Recommendation Agent...');
    const recommendationConfig: RecommendationAgentConfig = {
      name: 'DirectFanZ Recommendation Engine',
      version: '1.0.0',
      enablePersonalization: true,
      enableCollaborativeFiltering: true,
      enableContentBasedFiltering: true,
      enableTrendingBoost: true,
      enableSocialSignals: true,
      enableSerendipity: false,
      diversityWeight: 0.3,
      freshnessWeight: 0.2,
      qualityThreshold: 0.5,
      maxRecommendations: 10,
      minConfidenceScore: 0.3,
      enableCrossPromotion: true,
      enableRealTimeUpdates: true,
      cacheDuration: 3600000,
      fallbackStrategy: 'popular',
    };

    const recommendationAgent = new RecommendationAgent(
      'recommendation-engine-001',
      recommendationConfig,
      logger
    );

    await orchestrator.registerAgent(recommendationAgent, recommendationConfig);
    logger.info('✅ Recommendation Agent registered');

    // 5. Create and register Community Management Agent
    logger.info('Creating Community Management Agent...');
    const communityConfig: CommunityManagementConfig = {
      name: 'DirectFanZ Community Manager',
      version: '1.0.0',
      enableEventPlanning: true,
      enableChallenges: true,
      enableLoyaltyPrograms: true,
      enableSentimentMonitoring: true,
      enableAutoModeration: true,
      enableEngagementBoosts: true,
      maxEventsPerMonth: 5,
      maxActiveChallenges: 3,
      sentimentCheckInterval: 86400000,
      engagementThreshold: 0.1,
      autoResponseEnabled: true,
      communityGuidelines: [
        'Be respectful to all community members',
        'No spam or self-promotion',
        'Keep content appropriate and on-topic',
      ],
    };

    const communityAgent = new CommunityManagementAgent(
      'community-manager-001',
      communityConfig,
      logger
    );

    await orchestrator.registerAgent(communityAgent, communityConfig);
    logger.info('✅ Community Management Agent registered');

    // 6. Set up event listeners
    logger.info('Setting up event listeners...');
    setupEventListeners(orchestrator, eventBus, logger);

    // 7. Demo Conversational Agent
    await demoConversationalAgent(orchestrator, logger);

    // 8. Demo Content Moderation Agent
    await demoContentModerationAgent(orchestrator, logger);

    // 9. Demo Recommendation Agent
    await demoRecommendationAgent(orchestrator, logger);

    // 10. Demo Community Management Agent
    await demoCommunityManagementAgent(orchestrator, logger);

    // 11. Show system health
    await showSystemHealth(orchestrator, logger);

    // 12. Cleanup
    logger.info('Demo completed. Shutting down system...');
    await orchestrator.shutdown();
    await eventBus.shutdown();

    logger.info('🎉 AI Agent Demo completed successfully!');

  } catch (error) {
    logger.error('Demo failed:', error);
    throw error;
  }
}

// Set up event listeners for monitoring
function setupEventListeners(
  orchestrator: AIOrchestrator,
  eventBus: EventBus,
  logger: Logger
): void {
  // Orchestrator events
  orchestrator.on('task-completed', (event) => {
    logger.info(`✅ Task completed: ${event.taskId} by agent ${event.agentId}`);
  });

  orchestrator.on('task-failed', (event) => {
    logger.error(`❌ Task failed: ${event.taskId} by agent ${event.agentId} - ${event.error?.message}`);
  });

  orchestrator.on('agent-registered', (event) => {
    logger.info(`🤖 Agent registered: ${event.agentId} (${event.type})`);
  });

  // Event bus events
  eventBus.on('event-published', (event) => {
    logger.debug(`📨 Event published: ${event.type} from ${event.source}`);
  });

  // Health check monitoring
  orchestrator.on('health-check-completed', (health) => {
    const healthyAgents = health.agents.filter(a => a.healthy).length;
    logger.info(`💚 Health check: ${healthyAgents}/${health.agents.length} agents healthy`);
  });
}

// Demo the conversational agent
async function demoConversationalAgent(orchestrator: AIOrchestrator, logger: Logger): Promise<void> {
  logger.info('\n🗣️  Demonstrating Conversational Agent...');

  const context: AgentContext = {
    requestId: `demo-${Date.now()}`,
    timestamp: new Date(),
    userId: 'demo-user-123',
    metadata: {
      demo: true,
    },
  };

  // Test various conversation scenarios
  const testMessages = [
    'Hello! I\'m new to DirectFanZ',
    'How do I subscribe to my favorite artist?',
    'I\'m having trouble with my payment',
    'This is an amazing platform!',
    'I want to cancel my subscription',
  ];

  for (const message of testMessages) {
    try {
      const task: AgentTask = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'respond_to_message',
        priority: 'medium',
        payload: {
          message,
          context: {
            userId: 'demo-user-123',
            conversationHistory: [],
          },
        },
        context,
        createdAt: new Date(),
      };

      logger.info(`👤 User: "${message}"`);
      const response = await orchestrator.distributeTask(task);

      if (response.success && response.data) {
        logger.info(`🤖 Bot: "${response.data.response}"`);
        logger.info(`   Sentiment: ${response.data.metadata.sentiment} | Intent: ${response.data.metadata.intent}`);
      } else {
        logger.error(`❌ Failed to get response: ${response.error?.message}`);
      }

      // Small delay to make demo more readable
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.error(`Error processing message "${message}":`, error);
    }
  }
}

// Demo the content moderation agent
async function demoContentModerationAgent(orchestrator: AIOrchestrator, logger: Logger): Promise<void> {
  logger.info('\n🛡️  Demonstrating Content Moderation Agent...');

  const context: AgentContext = {
    requestId: `demo-mod-${Date.now()}`,
    timestamp: new Date(),
    metadata: {
      demo: true,
    },
  };

  // Test various content types
  const testContents = [
    {
      id: 'content-1',
      type: 'text' as const,
      data: 'Welcome to DirectFanZ! Excited to share my content with you all.',
      description: 'Clean welcome message',
    },
    {
      id: 'content-2',
      type: 'text' as const,
      data: 'Limited time offer! Act now to get free money!',
      description: 'Potential spam content',
    },
    {
      id: 'content-3',
      type: 'text' as const,
      data: 'Check out my new photos and videos on my profile!',
      description: 'Standard content promotion',
    },
    {
      id: 'content-4',
      type: 'text' as const,
      data: 'I hate this platform and everyone on it!',
      description: 'Negative sentiment content',
    },
  ];

  for (const content of testContents) {
    try {
      const task: AgentTask = {
        id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'scan_content',
        priority: 'high',
        payload: {
          content,
        },
        context,
        createdAt: new Date(),
      };

      logger.info(`📝 Testing: "${content.description}"`);
      logger.info(`   Content: "${content.data}"`);

      const response = await orchestrator.distributeTask(task);

      if (response.success && response.data) {
        const result = response.data;
        logger.info(`   Status: ${result.status.toUpperCase()}`);
        logger.info(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        
        if (result.violations.length > 0) {
          logger.info(`   Violations: ${result.violations.length}`);
          result.violations.forEach(violation => {
            logger.info(`   - ${violation.type}: ${violation.description} (${violation.severity})`);
          });
        }

        if (result.suggestedActions.length > 0) {
          logger.info(`   Suggested Actions:`);
          result.suggestedActions.forEach(action => {
            logger.info(`   - ${action.type}: ${action.reason}`);
          });
        }

      } else {
        logger.error(`❌ Failed to moderate content: ${response.error?.message}`);
      }

      // Small delay to make demo more readable
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.error(`Error moderating content:`, error);
    }
  }
}

// Show system health status
async function showSystemHealth(orchestrator: AIOrchestrator, logger: Logger): Promise<void> {
  logger.info('\n❤️  System Health Report...');

  try {
    const health = orchestrator.getSystemHealth();
    const metrics = orchestrator.getMetrics();

    logger.info(`System Status: ${health.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
    logger.info(`Active Agents: ${health.agents.length}`);
    
    health.agents.forEach(agent => {
      const status = agent.healthy ? '✅' : '❌';
      logger.info(`  ${status} ${agent.id} (${agent.type}) - ${agent.status}`);
    });

    logger.info(`\nSystem Metrics:`);
    logger.info(`  Total Tasks: ${metrics.totalTasks}`);
    logger.info(`  Completed: ${metrics.completedTasks}`);
    logger.info(`  Failed: ${metrics.failedTasks}`);
    logger.info(`  Success Rate: ${metrics.totalTasks > 0 ? ((metrics.completedTasks / metrics.totalTasks) * 100).toFixed(1) : '0'}%`);
    logger.info(`  Average Task Time: ${metrics.averageTaskTime.toFixed(0)}ms`);
    logger.info(`  System Load: ${metrics.systemLoad.toFixed(1)}%`);

  } catch (error) {
    logger.error('Failed to get system health:', error);
  }
}

// Demo the recommendation agent
async function demoRecommendationAgent(orchestrator: AIOrchestrator, logger: Logger): Promise<void> {
  logger.info('\n🎯 Demonstrating Recommendation Agent...');

  const context = {
    requestId: `demo-rec-${Date.now()}`,
    timestamp: new Date(),
    metadata: { demo: true },
  };

  // Test recommendation scenarios
  const testScenarios = [
    {
      type: 'get_recommendations',
      payload: {
        context: {
          userId: 'demo-user-123',
          userProfile: {
            id: 'demo-user-123',
            demographics: { language: 'en' },
            subscriptions: { current: [], past: [], preferences: [] },
            contentHistory: { viewed: [], liked: [], shared: [], purchased: [], ratings: [] },
            behaviorPatterns: { activeHours: [], sessionDuration: 0, contentTypes: ['video', 'photo'], engagementStyle: 'browser' },
            socialGraph: { following: [], followers: [], interactions: [] },
          },
        },
      },
      description: 'Get personalized recommendations for new user',
    },
    {
      type: 'get_trending_content',
      payload: { category: 'music', limit: 5 },
      description: 'Get trending music content',
    },
    {
      type: 'suggest_artists',
      payload: {
        context: {
          userId: 'demo-user-456',
          userProfile: {
            id: 'demo-user-456',
            demographics: { language: 'en' },
            subscriptions: { current: [{ artistId: 'artist-1', artistName: 'Demo Artist', tier: 'premium', startDate: new Date(), status: 'active' }], past: [], preferences: [] },
            contentHistory: { viewed: [], liked: [], shared: [], purchased: [], ratings: [] },
            behaviorPatterns: { activeHours: [], sessionDuration: 0, contentTypes: ['video'], engagementStyle: 'focused' },
            socialGraph: { following: [], followers: [], interactions: [] },
          },
        },
      },
      description: 'Suggest similar artists based on subscriptions',
    },
  ];

  for (const scenario of testScenarios) {
    try {
      const task = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: scenario.type,
        priority: 'medium' as const,
        payload: scenario.payload,
        context,
        createdAt: new Date(),
      };

      logger.info(`🎯 Testing: ${scenario.description}`);
      const response = await orchestrator.distributeTask(task);

      if (response.success && response.data) {
        if (scenario.type === 'get_recommendations') {
          const result = response.data;
          logger.info(`   Strategy: ${result.reasoning.strategy}`);
          logger.info(`   Confidence: ${(result.reasoning.confidence * 100).toFixed(1)}%`);
          logger.info(`   Recommendations: ${result.recommendations.length}`);
        } else if (scenario.type === 'get_trending_content') {
          logger.info(`   Trending items: ${response.data.length}`);
        } else if (scenario.type === 'suggest_artists') {
          logger.info(`   Suggested artists: ${response.data.length}`);
        }
      } else {
        logger.error(`❌ Failed: ${response.error?.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.error(`Error in recommendation demo:`, error);
    }
  }
}

// Demo the community management agent
async function demoCommunityManagementAgent(orchestrator: AIOrchestrator, logger: Logger): Promise<void> {
  logger.info('\n🏟️  Demonstrating Community Management Agent...');

  const context = {
    requestId: `demo-comm-${Date.now()}`,
    timestamp: new Date(),
    metadata: { demo: true },
  };

  // Test community management scenarios
  const testScenarios = [
    {
      type: 'create_event',
      payload: {
        eventData: {
          artistId: 'demo-artist-123',
          type: 'live_stream',
          title: 'Demo Live Q&A Session',
          description: 'Join us for an interactive Q&A!',
          scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        },
      },
      description: 'Create community live stream event',
    },
    {
      type: 'create_challenge',
      payload: {
        challengeData: {
          artistId: 'demo-artist-123',
          title: 'Photo Challenge: Show Your Style',
          type: 'creative',
          description: 'Share a photo that represents your unique style!',
        },
      },
      description: 'Create fan photo challenge',
    },
    {
      type: 'analyze_sentiment',
      payload: {
        artistId: 'demo-artist-123',
        period: '7d',
      },
      description: 'Analyze community sentiment over past week',
    },
    {
      type: 'boost_engagement',
      payload: {
        artistId: 'demo-artist-123',
        strategy: 'challenge_launch',
      },
      description: 'Boost engagement with challenge launch',
    },
    {
      type: 'manage_loyalty_program',
      payload: {
        artistId: 'demo-artist-123',
        action: 'create',
        data: {
          name: 'VIP Fan Club',
          description: 'Exclusive rewards for loyal fans',
        },
      },
      description: 'Create loyalty program',
    },
  ];

  for (const scenario of testScenarios) {
    try {
      const task = {
        id: `comm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: scenario.type,
        priority: 'medium' as const,
        payload: scenario.payload,
        context,
        createdAt: new Date(),
      };

      logger.info(`🏟️ Testing: ${scenario.description}`);
      const response = await orchestrator.distributeTask(task);

      if (response.success && response.data) {
        if (scenario.type === 'create_event') {
          const event = response.data;
          logger.info(`   Event created: ${event.title}`);
          logger.info(`   Scheduled: ${event.scheduledStart.toLocaleString()}`);
          logger.info(`   Estimated attendance: ${event.metadata.estimatedAttendance}`);
        } else if (scenario.type === 'create_challenge') {
          const challenge = response.data;
          logger.info(`   Challenge created: ${challenge.title}`);
          logger.info(`   Type: ${challenge.type}`);
          logger.info(`   Rules: ${challenge.rules.length}`);
        } else if (scenario.type === 'analyze_sentiment') {
          const sentiment = response.data;
          logger.info(`   Overall sentiment: ${sentiment.overall}`);
          logger.info(`   Score: ${sentiment.score.toFixed(2)}`);
          logger.info(`   Confidence: ${(sentiment.confidence * 100).toFixed(1)}%`);
        } else if (scenario.type === 'boost_engagement') {
          const boost = response.data;
          logger.info(`   Strategy: ${boost.strategy}`);
          logger.info(`   Actions: ${boost.actions.length}`);
          logger.info(`   Estimated impact: +${boost.estimatedImpact}%`);
        } else if (scenario.type === 'manage_loyalty_program') {
          const program = response.data;
          logger.info(`   Program created: ${program.name}`);
          logger.info(`   Tiers: ${program.tiers?.length || 0}`);
          logger.info(`   Status: ${program.status}`);
        }
      } else {
        logger.error(`❌ Failed: ${response.error?.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.error(`Error in community management demo:`, error);
    }
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demoAIAgents().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}
