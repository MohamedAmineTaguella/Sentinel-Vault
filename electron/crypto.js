const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const ITERATIONS = 600000;
const DIGEST = 'sha512';
const SALT_SIZE = 32;
const IV_SIZE = 16;
const TAG_SIZE = 16;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);
}

function encrypt(text, password) {
  const salt = crypto.randomBytes(SALT_SIZE);
  const iv = crypto.randomBytes(IV_SIZE);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decrypt(data, password) {
  const parts = data.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted data format');
  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptBuffer(buffer, password) {
  const salt = crypto.randomBytes(SALT_SIZE);
  const iv = crypto.randomBytes(IV_SIZE);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decryptToBuffer(data, password) {
  const salt = data.slice(0, SALT_SIZE);
  const iv = data.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
  const tag = data.slice(SALT_SIZE + IV_SIZE, SALT_SIZE + IV_SIZE + TAG_SIZE);
  const encrypted = data.slice(SALT_SIZE + IV_SIZE + TAG_SIZE);
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function generatePassword(length = 24, options = { uppercase: true, lowercase: true, numbers: true, symbols: true, excludeAmbiguous: true }) {
  let chars = '';
  if (options.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (options.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (options.numbers) chars += '0123456789';
  if (options.symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (options.excludeAmbiguous) chars = chars.replace(/[il1Lo0O]/g, '');
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const max = Math.floor(256 / chars.length) * chars.length;
  let result = '';
  const buf = crypto.randomBytes(length * 2);
  let j = 0;
  while (result.length < length && j < buf.length) {
    if (buf[j] < max) { result += chars[buf[j] % chars.length]; }
    j++;
  }
  if (result.length < length) {
    const extra = crypto.randomBytes(length * 2);
    for (let k = 0; k < extra.length && result.length < length; k++) {
      if (extra[k] < max) result += chars[extra[k] % chars.length];
    }
  }
  return result;
}

function checkStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 15;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  if (password.length >= 20) score += 15;
  score = Math.min(score, 100);
  const label = score >= 80 ? 'Very Strong' : score >= 60 ? 'Strong' : score >= 40 ? 'Fair' : score >= 20 ? 'Weak' : 'Very Weak';
  return { score, label };
}

function encryptKey(key, pin) {
  const salt = crypto.randomBytes(SALT_SIZE);
  const iv = crypto.randomBytes(IV_SIZE);
  const encKey = deriveKey(pin, salt);
  const cipher = crypto.createCipheriv(ALGO, encKey, iv);
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decryptKey(data, pin) {
  const parts = data.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted key format');
  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];
  const key = deriveKey(pin, salt);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function generateUUID() {
  return crypto.randomUUID();
}

module.exports = { encrypt, decrypt, encryptBuffer, decryptToBuffer, generatePassword, checkStrength, encryptKey, decryptKey, generateUUID };
