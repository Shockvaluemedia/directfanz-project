import { getServiceManager } from './service-manager-production';

interface PaymentRetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export class PaymentReliabilityManager {
  private serviceManager = getServiceManager();
  private retryConfig: PaymentRetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  };

  async processPaymentWithRetry(
    amount: number,
    paymentMethodId: string,
    customerId: string
  ): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const paymentIntent = await this.serviceManager.stripeClient.paymentIntents.create({
          amount,
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          confirm: true,
          error_on_requires_action: true,
        });

        return {
          success: true,
          paymentIntentId: paymentIntent.id,
        };
      } catch (error) {
        lastError = error as Error;
        
        if (!this.isRetryableError(error)) {
          break;
        }

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
            this.retryConfig.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Payment processing failed',
    };
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      'rate_limit_error',
      'api_connection_error',
      'api_error',
    ];
    
    return retryableCodes.includes(error.type);
  }

  async calculateCreatorPayout(
    totalAmount: number,
    platformFeePercent: number = 10
  ): Promise<{ creatorAmount: number; platformFee: number; processingFee: number }> {
    const processingFee = Math.round(totalAmount * 0.029 + 30); // Stripe fees
    const platformFee = Math.round((totalAmount - processingFee) * (platformFeePercent / 100));
    const creatorAmount = totalAmount - processingFee - platformFee;

    return {
      creatorAmount: Math.max(0, creatorAmount),
      platformFee,
      processingFee,
    };
  }

  async handlePaymentFailure(
    paymentIntentId: string,
    customerId: string,
    error: string
  ): Promise<void> {
    // Log payment failure
    console.error(`Payment failed: ${paymentIntentId}`, { customerId, error });
    
    // Send notification to customer
    // In production, integrate with email service
  }
}

export const paymentReliability = new PaymentReliabilityManager();