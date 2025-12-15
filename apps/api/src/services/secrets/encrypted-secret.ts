import * as crypto from 'crypto';
import type { SecretManager } from './secret-manager.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;

export class EncryptedSecret implements SecretManager {
  private getEncryptionKey(salt: Buffer): Buffer {
    const key = process.env.SECRET_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('SECRET_ENCRYPTION_KEY environment variable is not set');
    }

    return crypto.scryptSync(key, salt, 32);
  }

  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = this.getEncryptionKey(salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${salt.toString('hex')}:${tag.toString(
      'hex'
    )}:${encrypted}`;
  }

  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');

    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, saltHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const salt = Buffer.from(saltHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const key = this.getEncryptionKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async storeSecret(secretId: string, plaintext: string): Promise<string> {
    return this.encrypt(plaintext);
  }

  async retrieveSecret(secretId: string): Promise<string> {
    if (!secretId) {
      throw new Error('Secret ID is required');
    }

    return this.decrypt(secretId);
  }

  async deleteSecret(secretId: string): Promise<void> {
    // For local encryption, we just need to ensure the secret is removed from the database
    // The encrypted value itself doesn't need special deletion
  }
}
