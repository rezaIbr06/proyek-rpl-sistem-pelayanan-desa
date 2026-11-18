import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Derives a consistent 32-byte key from environment secret
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.AI_ENCRYPTION_SECRET || process.env.SESSION_SECRET || 'desa-ai-encryption-master-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts an API key or sensitive string using AES-256-GCM.
 * Output format: <iv-hex>:<authTag-hex>:<ciphertext-hex>
 */
export function encryptApiKey(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('API key to encrypt must be a non-empty string');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted API key formatted as <iv-hex>:<authTag-hex>:<ciphertext-hex>
 */
export function decryptApiKey(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted credential format');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Creates a masked representation of an API key for safe UI display.
 * E.g. "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"
 * becomes "nvapi-••••••••••••xygn"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') return '';
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }

  if (trimmed.startsWith('nvapi-')) {
    const prefix = 'nvapi-';
    const rest = trimmed.slice(6);
    if (rest.length <= 6) {
      return `${prefix}••••••••`;
    }
    const suffix = rest.slice(-4);
    return `${prefix}••••••••••••${suffix}`;
  }

  if (trimmed.startsWith('sk-')) {
    const prefix = 'sk-';
    const rest = trimmed.slice(3);
    const suffix = rest.slice(-4);
    return `${prefix}••••••••••••${suffix}`;
  }

  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}
