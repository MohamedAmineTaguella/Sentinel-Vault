/* TOTP (RFC 6238) — pure browser implementation */

function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const c of cleaned) {
    const idx = alphabet.indexOf(c);
    if (idx < 0) continue;
    buffer = (buffer << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(buffer >> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 0x1f];
  return output;
}

export async function generateTOTP(secret: string, digits = 6, period = 30, timestamp = Date.now()): Promise<{ code: string; remaining: number }> {
  try {
    const key = base32Decode(secret);
    if (key.length === 0) return { code: '------', remaining: 0 };
    const counter = Math.floor(timestamp / 1000 / period);
    const counterBuf = new ArrayBuffer(8);
    const view = new DataView(counterBuf);
    view.setUint32(0, Math.floor(counter / 0x100000000), false);
    view.setUint32(4, counter & 0xffffffff, false);
    const cryptoKey = await window.crypto.subtle.importKey('raw', key.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuf);
    const hash = new Uint8Array(sig);
    const offset = hash[hash.length - 1] & 0xf;
    const binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
    const code = String(binary % Math.pow(10, digits)).padStart(digits, '0');
    const remaining = period - Math.floor((timestamp / 1000) % period);
    return { code, remaining };
  } catch {
    return { code: '------', remaining: 0 };
  }
}

export function generateSecret(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base32Encode(buf);
}

export function buildOtpAuthUrl(secret: string, account: string, issuer = 'Sentinel Vault'): string {
  const encodedAccount = encodeURIComponent(account || 'user');
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}


