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
 * Encrypts a secret string (e.g. Access Token, App Secret, Verify Token) using AES-256-GCM.
 * Output format: <iv-hex>:<authTag-hex>:<ciphertext-hex>
 */
export function encryptSecret(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Secret to encrypt must be a non-empty string');
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
 * Decrypts an encrypted secret formatted as <iv-hex>:<authTag-hex>:<ciphertext-hex>
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted secret format');
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
 * Creates a masked representation of sensitive tokens (e.g. Access Token, App Secret)
 * Example: EAABw...9aB2 becomes EAAB••••••••••••9aB2
 */
export function maskSecret(secret: string): string {
  if (!secret || typeof secret !== 'string') return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }

  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Mask nomor telepon untuk log dan tampilan aman: +62812****5678
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '****';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return '****';
  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.slice(-4);
  return `+${prefix}${'*'.repeat(Math.max(4, cleaned.length - 8))}${suffix}`;
}

/**
 * Normalisasi nomor telepon ke format E.164 tanpa simbol '+' untuk WhatsApp Cloud API
 * Contoh input: "08123456789", "+62 812-3456-7890", "628123456789"
 * Output: "628123456789"
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }

  return cleaned;
}

/**
 * Validasi nomor telepon format Indonesia
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const normalized = normalizePhoneForWhatsApp(phone);
  return /^628[1-9][0-9]{7,11}$/.test(normalized);
}

