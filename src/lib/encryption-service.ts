/**
 * Application-Level Encryption Service
 * Implements comprehensive encryption for sensitive data
 * Requirements: 6.4 - Application-level encryption for sensitive data
 */

import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms';
import { createCipher, createDecipher, randomBytes, pbkdf2Sync } from 'crypto';

interface EncryptionConfig {
  kmsKeyId: string;
  region: string;
  algorithm: string;
  keyDerivationIterations: number;
}

interface EncryptedData {
  encryptedData: string;
  encryptedKey: string;
  iv: string;
  algorithm: string;
  keyId: string;
}

export class EncryptionService {
  private kmsClient: KMSClient;
  private config: EncryptionConfig;

  constructor(config: EncryptionConfig) {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyDerivationIterations: 100000,
      ...config
    };
    
    this.kmsClient = new KMSClient({ 
      region: this.config.region,
      maxAttempts: 3,
      retryMode: 'adaptive'
    });
  }

  /**
   * Encrypt sensitive data using envelope encryption
   * Uses KMS to encrypt a data key, then uses the data key to encrypt the actual data
   */
  async encryptData(plaintext: string | Buffer): Promise<EncryptedData> {
    try {
      // Generate a data key using KMS
      const dataKeyCommand = new GenerateDataKeyCommand({
        KeyId: this.config.kmsKeyId,
        KeySpec: 'AES_256'
      });

      const dataKeyResponse = await this.kmsClient.send(dataKeyCommand);
      
      if (!dataKeyResponse.Plaintext || !dataKeyResponse.CiphertextBlob) {
        throw new Error('Failed to generate data key');
      }

      // Convert plaintext to buffer if it's a string
      const plaintextBuffer = typeof plaintext === 'string' 
        ? Buffer.from(plaintext, 'utf8') 
        : plaintext;

      // Generate random IV
      const iv = randomBytes(16);

      // Encrypt the data using the plaintext data key
      const cipher = createCipher(this.config.algorithm, dataKeyResponse.Plaintext);
      cipher.setAutoPadding(true);
      
      let encryptedData = cipher.update(plaintextBuffer);
      encryptedData = Buffer.concat([encryptedData, cipher.final()]);

      // Get the authentication tag for GCM mode
      const authTag = (cipher as any).getAuthTag ? (cipher as any).getAuthTag() : Buffer.alloc(0);
      const finalEncryptedData = Buffer.concat([encryptedData, authTag]);

      return {
        encryptedData: finalEncryptedData.toString('base64'),
        encryptedKey: Buffer.from(dataKeyResponse.CiphertextBlob).toString('base64'),
        iv: iv.toString('base64'),
        algorithm: this.config.algorithm,
        keyId: this.config.kmsKeyId
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data using envelope encryption
   */
  async decryptData(encryptedData: EncryptedData): Promise<Buffer> {
    try {
      // Decrypt the data key using KMS
      const decryptKeyCommand = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedData.encryptedKey, 'base64'),
        KeyId: encryptedData.keyId
      });

      const keyResponse = await this.kmsClient.send(decryptKeyCommand);
      
      if (!keyResponse.Plaintext) {
        throw new Error('Failed to decrypt data key');
      }

      // Decrypt the actual data
      const encryptedBuffer = Buffer.from(encryptedData.encryptedData, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');

      // For GCM mode, extract auth tag from the end
      const authTagLength = 16; // GCM auth tag is 16 bytes
      const ciphertext = encryptedBuffer.slice(0, -authTagLength);
      const authTag = encryptedBuffer.slice(-authTagLength);

      const decipher = createDecipher(encryptedData.algorithm, keyResponse.Plaintext);
      
      if ((decipher as any).setAuthTag) {
        (decipher as any).setAuthTag(authTag);
      }

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt sensitive user data (PII)
   */
  async encryptPII(data: {
    email?: string;
    phone?: string;
    address?: string;
    paymentInfo?: string;
  }): Promise<{ [key: string]: EncryptedData }> {
    const encrypted: { [key: string]: EncryptedData } = {};

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'string') {
        encrypted[key] = await this.encryptData(value);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt sensitive user data (PII)
   */
  async decryptPII(encryptedData: { [key: string]: EncryptedData }): Promise<{ [key: string]: string }> {
    const decrypted: { [key: string]: string } = {};

    for (const [key, value] of Object.entries(encryptedData)) {
      if (value) {
        const decryptedBuffer = await this.decryptData(value);
        decrypted[key] = decryptedBuffer.toString('utf8');
      }
    }

    return decrypted;
  }

  /**
   * Hash sensitive data for searching (one-way)
   */
  hashForSearch(data: string, salt?: string): string {
    const actualSalt = salt || randomBytes(32).toString('hex');
    const hash = pbkdf2Sync(data, actualSalt, this.config.keyDerivationIterations, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hashedData: string): boolean {
    try {
      const [salt, hash] = hashedData.split(':');
      const computedHash = pbkdf2Sync(data, salt, this.config.keyDerivationIterations, 64, 'sha512');
      return computedHash.toString('hex') === hash;
    } catch (error) {
      console.error('Hash verification failed:', error);
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Encrypt API keys and secrets
   */
  async encryptSecret(secret: string): Promise<EncryptedData> {
    return this.encryptData(secret);
  }

  /**
   * Decrypt API keys and secrets
   */
  async decryptSecret(encryptedSecret: EncryptedData): Promise<string> {
    const decrypted = await this.decryptData(encryptedSecret);
    return decrypted.toString('utf8');
  }
}

// Singleton instance for application use
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    const config: EncryptionConfig = {
      kmsKeyId: process.env.AWS_KMS_APP_KEY_ID || '',
      region: process.env.AWS_REGION || 'us-east-1',
      algorithm: 'aes-256-gcm',
      keyDerivationIterations: 100000
    };

    if (!config.kmsKeyId) {
      throw new Error('AWS_KMS_APP_KEY_ID environment variable is required');
    }

    encryptionServiceInstance = new EncryptionService(config);
  }

  return encryptionServiceInstance;
}

// Export types for use in other modules
export type { EncryptedData, EncryptionConfig };