import crypto from 'crypto';
import { env } from '../config/env.js';

// AES-256-GCM for refund data. Key from env (base64, 32 bytes).
class EncryptionService {
  private key: Buffer;
  private algorithm = 'aes-256-gcm';
  private ivLength = 12; // 96-bit IV
  private authTagLength = 16; // 128-bit auth tag

  constructor() {
    const keyBase64 = env.refundEncryptionKey;
    if (!keyBase64) throw new Error('REFUND_ENCRYPTION_KEY env var required');
    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) throw new Error('REFUND_ENCRYPTION_KEY must be 32-byte base64');
  }

  // Encrypt plaintext -> base64(IV + ciphertext + authTag)
  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = (cipher as any).getAuthTag();
    const combined = Buffer.concat([iv, ciphertext, authTag]);
    return combined.toString('base64');
  }

  // Decrypt base64(IV + ciphertext + authTag) -> plaintext
  decrypt(encryptedBase64: string): string {
    if (!encryptedBase64) return '';
    try {
      const combined = Buffer.from(encryptedBase64, 'base64');
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(combined.length - this.authTagLength);
      const ciphertext = combined.subarray(this.ivLength, combined.length - this.authTagLength);
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      (decipher as any).setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf8');
    } catch (error) {
      console.error('[encryption] Decryption failed:', error);
      throw new Error('Failed to decrypt refund data');
    }
  }

  // Encrypt object fields (non-empty strings only)
  encryptFields(fields: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value && typeof value === 'string') result[key] = this.encrypt(value);
      else result[key] = value ?? '';
    }
    return result;
  }

  // Decrypt object fields
  decryptFields(fields: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value && typeof value === 'string') {
        try { result[key] = this.decrypt(value); } catch { result[key] = ''; }
      } else { result[key] = value ?? ''; }
    }
    return result;
  }
}

// Singleton
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) encryptionServiceInstance = new EncryptionService();
  return encryptionServiceInstance;
}

// Export for testing
export { EncryptionService };