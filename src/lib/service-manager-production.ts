import Stripe from 'stripe';
import { S3Client, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sgMail from '@sendgrid/mail';

interface ServiceHealthStatus {
  healthy: boolean;
  latency?: number;
  error?: string;
  lastChecked: Date;
}

export class ProductionServiceManager {
  private stripe: Stripe;
  private s3Client: S3Client;
  private sendGridConfigured = false;
  private healthStatus: {
    stripe: ServiceHealthStatus;
    s3: ServiceHealthStatus;
    sendgrid: ServiceHealthStatus;
  };

  constructor() {
    this.healthStatus = {
      stripe: { healthy: false, lastChecked: new Date() },
      s3: { healthy: false, lastChecked: new Date() },
      sendgrid: { healthy: false, lastChecked: new Date() },
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    this.initializeStripe();
    this.initializeS3();
    this.initializeSendGrid();
  }

  private initializeStripe(): void {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    // Validate key format for production
    if (process.env.NODE_ENV === 'production' && !stripeSecretKey.startsWith('sk_live_')) {
      console.warn('Warning: Using test Stripe key in production environment');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      timeout: 10000, // 10 second timeout
      maxNetworkRetries: 3,
      telemetry: false, // Disable telemetry for production
    });
  }

  private initializeS3(): void {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials are required');
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestHandler: {
        requestTimeout: 10000, // 10 second timeout
        connectionTimeout: 5000, // 5 second connection timeout
      },
      maxAttempts: 3,
    });
  }

  private initializeSendGrid(): void {
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendGridApiKey) {
      throw new Error('SENDGRID_API_KEY environment variable is required');
    }

    sgMail.setApiKey(sendGridApiKey);
    this.sendGridConfigured = true;
  }

  // Stripe service methods
  async createPaymentIntent(amount: number, currency = 'usd', metadata?: any): Promise<Stripe.PaymentIntent> {
    try {
      const start = Date.now();
      
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.updateHealthStatus('stripe', true, Date.now() - start);
      return paymentIntent;
    } catch (error) {
      this.updateHealthStatus('stripe', false, undefined, error as Error);
      throw error;
    }
  }

  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    try {
      const start = Date.now();
      
      const customer = await this.stripe.customers.create({
        email,
        name,
      });

      this.updateHealthStatus('stripe', true, Date.now() - start);
      return customer;
    } catch (error) {
      this.updateHealthStatus('stripe', false, undefined, error as Error);
      throw error;
    }
  }

  async createSubscription(customerId: string, priceId: string): Promise<Stripe.Subscription> {
    try {
      const start = Date.now();
      
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      this.updateHealthStatus('stripe', true, Date.now() - start);
      return subscription;
    } catch (error) {
      this.updateHealthStatus('stripe', false, undefined, error as Error);
      throw error;
    }
  }

  async checkStripeHealth(): Promise<ServiceHealthStatus> {
    try {
      const start = Date.now();
      
      // Simple health check - list first customer
      await this.stripe.customers.list({ limit: 1 });
      
      const latency = Date.now() - start;
      this.updateHealthStatus('stripe', true, latency);
      
      return this.healthStatus.stripe;
    } catch (error) {
      this.updateHealthStatus('stripe', false, undefined, error as Error);
      return this.healthStatus.stripe;
    }
  }

  // S3 service methods
  async uploadFile(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<string> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
    }

    try {
      const start = Date.now();
      
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      });

      await this.s3Client.send(command);
      
      this.updateHealthStatus('s3', true, Date.now() - start);
      
      return `https://${bucketName}.s3.amazonaws.com/${key}`;
    } catch (error) {
      this.updateHealthStatus('s3', false, undefined, error as Error);
      throw error;
    }
  }

  async checkS3Health(): Promise<ServiceHealthStatus> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      this.updateHealthStatus('s3', false, undefined, new Error('AWS_S3_BUCKET_NAME not configured'));
      return this.healthStatus.s3;
    }

    try {
      const start = Date.now();
      
      const command = new HeadBucketCommand({ Bucket: bucketName });
      await this.s3Client.send(command);
      
      const latency = Date.now() - start;
      this.updateHealthStatus('s3', true, latency);
      
      return this.healthStatus.s3;
    } catch (error) {
      this.updateHealthStatus('s3', false, undefined, error as Error);
      return this.healthStatus.s3;
    }
  }

  // SendGrid service methods
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.sendGridConfigured) {
      throw new Error('SendGrid is not configured');
    }

    const fromEmail = process.env.FROM_EMAIL;
    if (!fromEmail) {
      throw new Error('FROM_EMAIL environment variable is required');
    }

    try {
      const start = Date.now();
      
      const msg = {
        to,
        from: fromEmail,
        subject,
        text: text || subject,
        html,
      };

      await sgMail.send(msg);
      
      this.updateHealthStatus('sendgrid', true, Date.now() - start);
      return true;
    } catch (error) {
      this.updateHealthStatus('sendgrid', false, undefined, error as Error);
      throw error;
    }
  }

  async sendBulkEmail(emails: Array<{
    to: string;
    subject: string;
    html: string;
    text?: string;
  }>): Promise<boolean> {
    if (!this.sendGridConfigured) {
      throw new Error('SendGrid is not configured');
    }

    const fromEmail = process.env.FROM_EMAIL;
    if (!fromEmail) {
      throw new Error('FROM_EMAIL environment variable is required');
    }

    try {
      const start = Date.now();
      
      const messages = emails.map(email => ({
        to: email.to,
        from: fromEmail,
        subject: email.subject,
        text: email.text || email.subject,
        html: email.html,
      }));

      await sgMail.send(messages);
      
      this.updateHealthStatus('sendgrid', true, Date.now() - start);
      return true;
    } catch (error) {
      this.updateHealthStatus('sendgrid', false, undefined, error as Error);
      throw error;
    }
  }

  async checkSendGridHealth(): Promise<ServiceHealthStatus> {
    if (!this.sendGridConfigured) {
      this.updateHealthStatus('sendgrid', false, undefined, new Error('SendGrid not configured'));
      return this.healthStatus.sendgrid;
    }

    try {
      const start = Date.now();
      
      // Simple health check - validate API key by making a request
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        },
      });

      if (response.ok) {
        const latency = Date.now() - start;
        this.updateHealthStatus('sendgrid', true, latency);
      } else {
        this.updateHealthStatus('sendgrid', false, undefined, new Error(`SendGrid API returned ${response.status}`));
      }
      
      return this.healthStatus.sendgrid;
    } catch (error) {
      this.updateHealthStatus('sendgrid', false, undefined, error as Error);
      return this.healthStatus.sendgrid;
    }
  }

  // Health monitoring
  private updateHealthStatus(
    service: keyof typeof this.healthStatus,
    healthy: boolean,
    latency?: number,
    error?: Error
  ): void {
    this.healthStatus[service] = {
      healthy,
      latency,
      error: error?.message,
      lastChecked: new Date(),
    };
  }

  async checkAllServicesHealth(): Promise<typeof this.healthStatus> {
    await Promise.all([
      this.checkStripeHealth(),
      this.checkS3Health(),
      this.checkSendGridHealth(),
    ]);

    return this.healthStatus;
  }

  getHealthStatus(): typeof this.healthStatus {
    return { ...this.healthStatus };
  }

  // Get service instances for direct access
  get stripeClient(): Stripe {
    return this.stripe;
  }

  get s3(): S3Client {
    return this.s3Client;
  }
}

// Singleton instance for production use
let serviceManagerInstance: ProductionServiceManager | null = null;

export function getServiceManager(): ProductionServiceManager {
  if (!serviceManagerInstance) {
    serviceManagerInstance = new ProductionServiceManager();
  }
  return serviceManagerInstance;
}

// Health check endpoint helper
export async function checkServicesHealth(): Promise<{
  healthy: boolean;
  services: typeof serviceManagerInstance.healthStatus;
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
}> {
  try {
    const manager = getServiceManager();
    const services = await manager.checkAllServicesHealth();
    
    const healthyCount = Object.values(services).filter(s => s.healthy).length;
    const totalCount = Object.keys(services).length;
    
    return {
      healthy: healthyCount === totalCount,
      services,
      summary: {
        total: totalCount,
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      services: {
        stripe: { healthy: false, lastChecked: new Date(), error: error.message },
        s3: { healthy: false, lastChecked: new Date(), error: error.message },
        sendgrid: { healthy: false, lastChecked: new Date(), error: error.message },
      },
      summary: {
        total: 3,
        healthy: 0,
        unhealthy: 3,
      },
    };
  }
}

export default ProductionServiceManager;