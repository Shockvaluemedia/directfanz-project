import Stripe from 'stripe';
import { put } from '@vercel/blob';
import sgMail from '@sendgrid/mail';

interface ServiceHealthStatus {
  healthy: boolean;
  latency?: number;
  error?: string;
  lastChecked: Date;
}

export class ProductionServiceManager {
  private stripe!: Stripe;
  private sendGridConfigured = false;
  private healthStatus: {
    stripe: ServiceHealthStatus;
    blob: ServiceHealthStatus;
    sendgrid: ServiceHealthStatus;
  };

  constructor() {
    this.healthStatus = {
      stripe: { healthy: false, lastChecked: new Date() },
      blob: { healthy: false, lastChecked: new Date() },
      sendgrid: { healthy: false, lastChecked: new Date() },
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    this.initializeStripe();
    this.initializeSendGrid();
  }

  private initializeStripe(): void {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    if (process.env.NODE_ENV === 'production' && !stripeSecretKey.startsWith('sk_live_')) {
      console.warn('Warning: Using test Stripe key in production environment');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      timeout: 10000,
      maxNetworkRetries: 3,
      telemetry: false,
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
        automatic_payment_methods: { enabled: true },
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
      const customer = await this.stripe.customers.create({ email, name });
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
      await this.stripe.customers.list({ limit: 1 });
      this.updateHealthStatus('stripe', true, Date.now() - start);
      return this.healthStatus.stripe;
    } catch (error) {
      this.updateHealthStatus('stripe', false, undefined, error as Error);
      return this.healthStatus.stripe;
    }
  }

  // Blob storage methods
  async uploadFile(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<string> {
    try {
      const start = Date.now();
      const blob = await put(key, body as any, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      });
      this.updateHealthStatus('blob', true, Date.now() - start);
      return blob.url;
    } catch (error) {
      this.updateHealthStatus('blob', false, undefined, error as Error);
      throw error;
    }
  }

  async checkBlobHealth(): Promise<ServiceHealthStatus> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      this.updateHealthStatus('blob', false, undefined, new Error('BLOB_READ_WRITE_TOKEN not configured'));
      return this.healthStatus.blob;
    }

    try {
      const start = Date.now();
      // Simple health check — upload a tiny test blob
      await put('_health-check', 'ok', {
        access: 'public',
        addRandomSuffix: false,
      });
      this.updateHealthStatus('blob', true, Date.now() - start);
      return this.healthStatus.blob;
    } catch (error) {
      this.updateHealthStatus('blob', false, undefined, error as Error);
      return this.healthStatus.blob;
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
      await sgMail.send({ to, from: fromEmail, subject, text: text || subject, html });
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
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: { 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}` },
      });

      if (response.ok) {
        this.updateHealthStatus('sendgrid', true, Date.now() - start);
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
      this.checkBlobHealth(),
      this.checkSendGridHealth(),
    ]);
    return this.healthStatus;
  }

  getHealthStatus(): typeof this.healthStatus {
    return { ...this.healthStatus };
  }

  get stripeClient(): Stripe {
    return this.stripe;
  }
}

let serviceManagerInstance: ProductionServiceManager | null = null;

export function getServiceManager(): ProductionServiceManager {
  if (!serviceManagerInstance) {
    serviceManagerInstance = new ProductionServiceManager();
  }
  return serviceManagerInstance;
}

export async function checkServicesHealth() {
  try {
    const manager = getServiceManager();
    const services = await manager.checkAllServicesHealth();
    const healthyCount = Object.values(services).filter(s => s.healthy).length;
    const totalCount = Object.keys(services).length;

    return {
      healthy: healthyCount === totalCount,
      services,
      summary: { total: totalCount, healthy: healthyCount, unhealthy: totalCount - healthyCount },
    };
  } catch (error: any) {
    return {
      healthy: false,
      services: {
        stripe: { healthy: false, lastChecked: new Date(), error: error.message },
        blob: { healthy: false, lastChecked: new Date(), error: error.message },
        sendgrid: { healthy: false, lastChecked: new Date(), error: error.message },
      },
      summary: { total: 3, healthy: 0, unhealthy: 3 },
    };
  }
}

export default ProductionServiceManager;
