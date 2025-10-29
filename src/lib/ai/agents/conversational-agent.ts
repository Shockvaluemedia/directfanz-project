import { BaseAgent, AgentType, AgentTask, AgentResponse, AgentConfig, AgentContext } from '../base-agent';
import { Logger } from '@/lib/logger';
import type { Database } from '@/lib/database/types';

export interface ConversationContext {
  userId?: string;
  artistId?: string;
  conversationHistory: ConversationMessage[];
  userProfile?: UserProfile;
  artistPersonality?: ArtistPersonality;
  preferences?: UserPreferences;
  language?: string;
  timezone?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    sentiment?: 'positive' | 'neutral' | 'negative';
    intent?: string;
    confidence?: number;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  subscriptionTier?: string;
  joinDate: Date;
  interactionHistory: {
    totalMessages: number;
    lastActive: Date;
    commonTopics: string[];
    preferredResponseStyle: string;
  };
  preferences: {
    language: string;
    timezone: string;
    communicationStyle: 'formal' | 'casual' | 'friendly' | 'professional';
  };
}

export interface ArtistPersonality {
  id: string;
  name: string;
  communicationStyle: {
    tone: 'warm' | 'playful' | 'professional' | 'edgy' | 'mysterious';
    formality: 'casual' | 'semi-formal' | 'formal';
    humor: 'witty' | 'playful' | 'dry' | 'none';
    vocabulary: 'simple' | 'moderate' | 'advanced';
    emojiUsage: 'none' | 'minimal' | 'moderate' | 'frequent';
  };
  knowledgeBase: {
    biography: string;
    interests: string[];
    currentProjects: string[];
    FAQ: Array<{ question: string; answer: string; }>;
  };
  boundaries: {
    personalInfo: 'none' | 'limited' | 'open';
    financialDiscussion: boolean;
    controversialTopics: boolean;
    timeZoneRestrictions?: string[];
  };
}

export interface UserPreferences {
  responseLength: 'brief' | 'moderate' | 'detailed';
  notificationSettings: {
    instantReplies: boolean;
    summaryUpdates: boolean;
    specialOffers: boolean;
  };
  interests: string[];
  contentPreferences: string[];
}

export interface EscalationReason {
  type: 'complex_query' | 'technical_issue' | 'payment_problem' | 'inappropriate_behavior' | 'custom_request';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  userContext: any;
}

export interface ConversationalAgentConfig extends AgentConfig {
  openaiApiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  responseTimeout: number;
  maxConversationLength: number;
  autoEscalateAfter: number; // minutes of unresolved conversation
  supportedLanguages: string[];
  moderationEnabled: boolean;
  learningEnabled: boolean;
}

// Conversational AI Agent for 24/7 fan engagement
export class ConversationalAgent extends BaseAgent {
  private readonly config: ConversationalAgentConfig;
  private readonly activeConversations: Map<string, ConversationContext> = new Map();
  private readonly escalationQueue: Map<string, EscalationReason> = new Map();

  constructor(
    id: string,
    config: ConversationalAgentConfig,
    logger?: Logger,
    db?: Database
  ) {
    super(id, AgentType.CONVERSATIONAL, config, logger, db);
    this.config = config;
  }

  public getCapabilities(): string[] {
    return [
      'chat_support',
      'personality_matching',
      'context_awareness',
      'escalation_management',
      'sentiment_analysis',
      'multi_language',
      'conversation_history',
      'user_personalization',
    ];
  }

  public validateTask(task: AgentTask): boolean {
    const validTypes = [
      'respond_to_message',
      'generate_greeting',
      'handle_subscription_query',
      'escalate_conversation',
      'analyze_sentiment',
      'get_conversation_summary',
    ];

    return validTypes.includes(task.type);
  }

  public async executeTask(task: AgentTask): Promise<AgentResponse> {
    switch (task.type) {
      case 'respond_to_message':
        return this.respondToMessage(task.payload.message, task.payload.context);
      
      case 'generate_greeting':
        return this.generatePersonalizedGreeting(task.payload.user);
      
      case 'handle_subscription_query':
        return this.handleSubscriptionQuery(task.payload.query, task.payload.context);
      
      case 'escalate_conversation':
        return this.escalateToHuman(task.payload.reason, task.payload.context);
      
      case 'analyze_sentiment':
        return this.analyzeSentiment(task.payload.message);
      
      case 'get_conversation_summary':
        return this.getConversationSummary(task.payload.conversationId);
      
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // Respond to user message with context awareness
  public async respondToMessage(
    message: string,
    context: ConversationContext
  ): Promise<AgentResponse<{ response: string; metadata: any }>> {
    const startTime = Date.now();

    try {
      // Analyze the incoming message
      const messageAnalysis = await this.analyzeMessage(message);
      
      // Get or create conversation context
      const conversationId = context.userId || 'anonymous';
      const activeContext = this.getOrCreateConversationContext(conversationId, context);
      
      // Add user message to history
      activeContext.conversationHistory.push({
        id: this.generateMessageId(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        metadata: messageAnalysis,
      });

      // Generate response based on context and personality
      const response = await this.generateContextualResponse(message, activeContext, messageAnalysis);
      
      // Add assistant response to history
      activeContext.conversationHistory.push({
        id: this.generateMessageId(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      // Check for escalation conditions
      await this.checkEscalationConditions(activeContext);

      // Update conversation context
      this.activeConversations.set(conversationId, activeContext);

      return {
        success: true,
        data: {
          response,
          metadata: {
            sentiment: messageAnalysis.sentiment,
            intent: messageAnalysis.intent,
            confidence: messageAnalysis.confidence,
            shouldEscalate: this.escalationQueue.has(conversationId),
          },
        },
        metrics: {
          processingTime: Date.now() - startTime,
          tokensUsed: this.estimateTokenUsage(message + response),
          model: this.config.model,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MESSAGE_RESPONSE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
        metrics: {
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  // Generate personalized greeting
  public async generatePersonalizedGreeting(user: UserProfile): Promise<AgentResponse<{ greeting: string }>> {
    try {
      const artistPersonality = await this.getArtistPersonality(user.id);
      const timeOfDay = this.getTimeOfDay(user.preferences.timezone);
      const subscriptionStatus = user.subscriptionTier || 'fan';

      const greetingPrompt = this.buildPersonalizedGreetingPrompt(user, artistPersonality, timeOfDay, subscriptionStatus);
      
      const greeting = await this.generateResponse(greetingPrompt, {
        maxTokens: 100,
        temperature: 0.8,
      });

      return {
        success: true,
        data: { greeting },
        metrics: {
          processingTime: 0,
          tokensUsed: this.estimateTokenUsage(greeting),
          model: this.config.model,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GREETING_GENERATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: { processingTime: 0 },
      };
    }
  }

  // Handle subscription-related queries
  public async handleSubscriptionQuery(
    query: string,
    context: ConversationContext
  ): Promise<AgentResponse<{ response: string; suggestedActions?: string[] }>> {
    try {
      // Analyze the subscription query
      const queryAnalysis = await this.analyzeSubscriptionQuery(query);
      
      // Generate appropriate response
      const response = await this.generateSubscriptionResponse(query, queryAnalysis, context);
      
      // Suggest relevant actions
      const suggestedActions = this.getSuggestedActions(queryAnalysis.intent, context);

      return {
        success: true,
        data: {
          response,
          suggestedActions,
        },
        metrics: {
          processingTime: 0,
          tokensUsed: this.estimateTokenUsage(query + response),
          model: this.config.model,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SUBSCRIPTION_QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: { processingTime: 0 },
      };
    }
  }

  // Escalate conversation to human agent
  public async escalateToHuman(
    reason: EscalationReason,
    context: ConversationContext
  ): Promise<AgentResponse<{ escalated: boolean; ticketId?: string }>> {
    try {
      const conversationId = context.userId || 'anonymous';
      
      // Add to escalation queue
      this.escalationQueue.set(conversationId, reason);
      
      // Create support ticket (if database is available)
      let ticketId: string | undefined;
      if (this.db) {
        ticketId = await this.createSupportTicket(reason, context);
      }

      // Notify support team
      await this.notifySupportTeam(reason, context, ticketId);

      // Generate escalation message for user
      const escalationMessage = this.generateEscalationMessage(reason);
      
      // Add to conversation history
      if (this.activeConversations.has(conversationId)) {
        const conversation = this.activeConversations.get(conversationId)!;
        conversation.conversationHistory.push({
          id: this.generateMessageId(),
          role: 'system',
          content: escalationMessage,
          timestamp: new Date(),
        });
      }

      return {
        success: true,
        data: {
          escalated: true,
          ticketId,
        },
        metrics: {
          processingTime: 0,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ESCALATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: { processingTime: 0 },
      };
    }
  }

  // Analyze message sentiment and intent
  private async analyzeMessage(message: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    intent: string;
    confidence: number;
  }> {
    // Simple keyword-based analysis (replace with ML model in production)
    const positiveWords = ['love', 'great', 'amazing', 'awesome', 'thanks', 'thank you'];
    const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'problem', 'issue', 'cancel'];
    
    const lowerMessage = message.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
    
    let sentiment: 'positive' | 'neutral' | 'negative';
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    // Determine intent based on keywords
    let intent = 'general_chat';
    if (lowerMessage.includes('subscribe') || lowerMessage.includes('subscription')) {
      intent = 'subscription_inquiry';
    } else if (lowerMessage.includes('cancel') || lowerMessage.includes('unsubscribe')) {
      intent = 'cancellation_request';
    } else if (lowerMessage.includes('payment') || lowerMessage.includes('billing')) {
      intent = 'payment_inquiry';
    } else if (lowerMessage.includes('content') || lowerMessage.includes('video') || lowerMessage.includes('photo')) {
      intent = 'content_inquiry';
    }

    return {
      sentiment,
      intent,
      confidence: 0.7, // Placeholder confidence score
    };
  }

  // Generate contextual response using AI
  private async generateContextualResponse(
    message: string,
    context: ConversationContext,
    messageAnalysis: any
  ): Promise<string> {
    const prompt = this.buildContextualPrompt(message, context, messageAnalysis);
    
    return this.generateResponse(prompt, {
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });
  }

  // Build contextual prompt for AI response generation
  private buildContextualPrompt(
    message: string,
    context: ConversationContext,
    messageAnalysis: any
  ): string {
    let prompt = '';

    // Add artist personality context
    if (context.artistPersonality) {
      const personality = context.artistPersonality;
      prompt += `You are responding as ${personality.name}, with the following personality traits:
- Tone: ${personality.communicationStyle.tone}
- Formality: ${personality.communicationStyle.formality}
- Humor: ${personality.communicationStyle.humor}
- Emoji usage: ${personality.communicationStyle.emojiUsage}

`;
    }

    // Add user context
    if (context.userProfile) {
      prompt += `User context:
- Name: ${context.userProfile.name}
- Subscription: ${context.userProfile.subscriptionTier || 'free'}
- Communication style preference: ${context.userProfile.preferences.communicationStyle}
- Language: ${context.userProfile.preferences.language}

`;
    }

    // Add conversation history (last 5 messages)
    const recentHistory = context.conversationHistory.slice(-5);
    if (recentHistory.length > 0) {
      prompt += `Recent conversation:\n`;
      recentHistory.forEach(msg => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    // Add current message analysis
    prompt += `The user just said: "${message}"
Message sentiment: ${messageAnalysis.sentiment}
Detected intent: ${messageAnalysis.intent}

Please respond appropriately, staying in character and being helpful. Keep your response concise but engaging.

Response:`;

    return prompt;
  }

  // Generate AI response using OpenAI API
  private async generateResponse(prompt: string, options: {
    maxTokens?: number;
    temperature?: number;
  } = {}): Promise<string> {
    const response = await this.makeApiCall<any>(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
        },
        timeout: this.config.responseTimeout,
      }
    );

    return response.choices[0]?.message?.content || 'I apologize, but I\'m having trouble responding right now. Please try again.';
  }

  // Get or create conversation context
  private getOrCreateConversationContext(conversationId: string, context: ConversationContext): ConversationContext {
    if (this.activeConversations.has(conversationId)) {
      return this.activeConversations.get(conversationId)!;
    }

    const newContext: ConversationContext = {
      ...context,
      conversationHistory: context.conversationHistory || [],
    };

    this.activeConversations.set(conversationId, newContext);
    return newContext;
  }

  // Check if conversation should be escalated
  private async checkEscalationConditions(context: ConversationContext): Promise<void> {
    const conversationId = context.userId || 'anonymous';
    const history = context.conversationHistory;
    
    // Escalate if conversation is too long
    if (history.length > this.config.maxConversationLength) {
      await this.escalateToHuman({
        type: 'complex_query',
        priority: 'medium',
        description: 'Conversation exceeded maximum length',
        userContext: context,
      }, context);
    }

    // Escalate if user seems frustrated (multiple negative messages)
    const recentMessages = history.slice(-3).filter(msg => msg.role === 'user');
    const negativeMessages = recentMessages.filter(msg => 
      msg.metadata?.sentiment === 'negative'
    );
    
    if (negativeMessages.length >= 2) {
      await this.escalateToHuman({
        type: 'inappropriate_behavior',
        priority: 'high',
        description: 'User showing signs of frustration',
        userContext: context,
      }, context);
    }
  }

  // Additional helper methods...
  private async analyzeSubscriptionQuery(query: string): Promise<any> {
    // Placeholder implementation
    return { intent: 'general_subscription', confidence: 0.8 };
  }

  private async generateSubscriptionResponse(query: string, analysis: any, context: ConversationContext): Promise<string> {
    // Placeholder implementation
    return "I'd be happy to help you with your subscription question. What specific information would you like to know?";
  }

  private getSuggestedActions(intent: string, context: ConversationContext): string[] {
    // Placeholder implementation
    return ['View subscription plans', 'Contact support', 'Check billing history'];
  }

  private async getArtistPersonality(userId: string): Promise<ArtistPersonality | null> {
    // Placeholder - would fetch from database
    return null;
  }

  private getTimeOfDay(timezone: string): string {
    // Placeholder implementation
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  private buildPersonalizedGreetingPrompt(
    user: UserProfile,
    personality: ArtistPersonality | null,
    timeOfDay: string,
    subscriptionStatus: string
  ): string {
    return `Generate a warm, personalized greeting for ${user.name} (${subscriptionStatus} subscriber) for the ${timeOfDay}.`;
  }

  private async createSupportTicket(reason: EscalationReason, context: ConversationContext): Promise<string> {
    // Placeholder - would create ticket in database
    return `TICKET_${Date.now()}`;
  }

  private async notifySupportTeam(reason: EscalationReason, context: ConversationContext, ticketId?: string): Promise<void> {
    // Placeholder - would send notification to support team
    this.logger.info(`Support team notified for escalation: ${reason.type} - ${ticketId}`);
  }

  private generateEscalationMessage(reason: EscalationReason): string {
    return `I've connected you with our support team to better assist you with your ${reason.type.replace('_', ' ')}. Someone will be with you shortly!`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateTokenUsage(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  // Sentiment analysis for individual messages
  private async analyzeSentiment(message: string): Promise<AgentResponse<any>> {
    const analysis = await this.analyzeMessage(message);
    return {
      success: true,
      data: analysis,
      metrics: { processingTime: 0 },
    };
  }

  // Get conversation summary
  private async getConversationSummary(conversationId: string): Promise<AgentResponse<any>> {
    const context = this.activeConversations.get(conversationId);
    if (!context) {
      return {
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' },
        metrics: { processingTime: 0 },
      };
    }

    return {
      success: true,
      data: {
        messageCount: context.conversationHistory.length,
        duration: this.calculateConversationDuration(context.conversationHistory),
        topics: this.extractConversationTopics(context.conversationHistory),
        sentiment: this.calculateOverallSentiment(context.conversationHistory),
      },
      metrics: { processingTime: 0 },
    };
  }

  private calculateConversationDuration(history: ConversationMessage[]): number {
    if (history.length < 2) return 0;
    const start = history[0].timestamp.getTime();
    const end = history[history.length - 1].timestamp.getTime();
    return end - start;
  }

  private extractConversationTopics(history: ConversationMessage[]): string[] {
    // Placeholder implementation
    return ['subscription', 'content', 'general'];
  }

  private calculateOverallSentiment(history: ConversationMessage[]): string {
    const userMessages = history.filter(msg => msg.role === 'user' && msg.metadata?.sentiment);
    if (userMessages.length === 0) return 'neutral';

    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    userMessages.forEach(msg => {
      if (msg.metadata?.sentiment) {
        sentimentCounts[msg.metadata.sentiment]++;
      }
    });

    // Return the most common sentiment
    return Object.entries(sentimentCounts).reduce((a, b) => 
      sentimentCounts[a[0] as keyof typeof sentimentCounts] > sentimentCounts[b[0] as keyof typeof sentimentCounts] ? a : b
    )[0];
  }
}