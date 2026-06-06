const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const vaultCrypto = require('./crypto');
const nodeCrypto = require('crypto');

const DATA_DIR = path.join(app.getPath('userData'), 'sentinel-vault');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const ATTACHMENT_DIR = path.join(DATA_DIR, 'attachments');
const ACTIVITY_PATH = path.join(DATA_DIR, 'activity.json');

function getVaultPath(username) { return path.join(DATA_DIR, `vault_${username || 'default'}.enc`); }

let cachedVaultKey = null;
let cachedMasterDerived = null;
let currentUsername = null;
let activityLog = [];
let masterAuthCache = { password: null, expiresAt: 0 };
const loginAttempts = {};
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function ensureDir() {
  [DATA_DIR, ATTACHMENT_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (!cfg.users && cfg.masterHash) {
        const username = cfg.username || 'default';
        const userEntry = {
          masterHash: cfg.masterHash,
          masterSalt: cfg.masterSalt,
          encryptedVaultKey: cfg.encryptedVaultKey || '',
          vault2FA: cfg.vault2FA || null,
          createdAt: cfg.createdAt || Date.now(),
          lastLogin: cfg.lastLogin || 0
        };
        const settings = {};
        for (const key of ['theme','autoLockTimeout','launchOnStartup','biometricEnabled','biometricKey','clipboardAutoClear','pinHash','hasPin','compactView','showSidebar','appVersion','rememberMe']) {
          if (cfg[key] !== undefined) settings[key] = cfg[key];
        }
        if (username !== 'default') settings.lastUsername = username;
        const newCfg = { users: { [username]: userEntry }, settings };
        const oldVault = path.join(DATA_DIR, 'vault.enc');
        const newVault = getVaultPath(username);
        if (fs.existsSync(oldVault) && !fs.existsSync(newVault)) {
          try { fs.renameSync(oldVault, newVault); } catch {}
        }
        saveConfig(newCfg);
        logActivity('system', 'Config migrated to multi-user format');
        return newCfg;
      }
      return cfg;
    }
  } catch {}
  return { users: {}, settings: {} };
}

function saveConfig(cfg) {
  try {
    ensureDir();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (e) { console.error('saveConfig error:', e); }
}

function loadActivity() {
  try {
    if (fs.existsSync(ACTIVITY_PATH)) {
      const data = JSON.parse(fs.readFileSync(ACTIVITY_PATH, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch {}
  return [];
}

function saveActivity() {
  try {
    ensureDir();
    fs.writeFileSync(ACTIVITY_PATH, JSON.stringify(activityLog.slice(0, 500), null, 2));
  } catch (e) { console.error('saveActivity error:', e.message); }
}

function loadVault() {
  if (!currentUsername) return null;
  const vpath = getVaultPath(currentUsername);
  try {
    if (fs.existsSync(vpath)) {
      const content = fs.readFileSync(vpath, 'utf8').trim();
      if (!content) return { entries: [], categories: {}, entryLocks: {}, categories_locks: {} };
      if (cachedVaultKey) {
        if (content.startsWith('{')) {
          const vault = JSON.parse(content);
          saveVault(vault);
          return vault;
        }
        const decrypted = vaultCrypto.decrypt(content, cachedVaultKey);
        return JSON.parse(decrypted);
      }
      if (content.startsWith('{')) return JSON.parse(content);
    }
  } catch (e) { console.error('loadVault error:', e.message); }
  return null;
}

function saveVault(vault) {
  if (!cachedVaultKey) { console.error('saveVault: no vault key — aborting write'); return; }
  if (!currentUsername) { console.error('saveVault: no current user'); return; }
  try {
    const data = JSON.stringify(vault, null, 2);
    const encrypted = vaultCrypto.encrypt(data, cachedVaultKey);
    ensureDir();
    fs.writeFileSync(getVaultPath(currentUsername), encrypted);
  } catch (e) { console.error('saveVault error:', e.message); }
}

/* Registration */
function isRegistered() {
  const cfg = loadConfig();
  return !!(cfg.users) && Object.keys(cfg.users).length > 0;
}

function getUserList() {
  return Object.keys(loadConfig().users || {});
}

function register(username, masterPassword) {
  if (!username) return { success: false, error: 'Username required' };
  if (getUserList().includes(username)) return { success: false, error: 'User already exists' };
  if (!masterPassword || masterPassword.length < 8) return { success: false, error: 'Password must be 8+ characters' };
  const salt = vaultCrypto.generateUUID().replace(/-/g, '').slice(0, 16);
  const hash = vaultCrypto.encrypt(masterPassword, masterPassword + salt);
  const vaultKey = vaultCrypto.generateUUID().replace(/-/g, '') + vaultCrypto.generateUUID().replace(/-/g, '');
  const encryptedVaultKey = vaultCrypto.encrypt(vaultKey, masterPassword + salt);
  const cfg = loadConfig();
  if (!cfg.users) cfg.users = {};
  cfg.users[username] = {
    masterHash: hash,
    masterSalt: salt,
    encryptedVaultKey,
    vault2FA: null,
    createdAt: Date.now(),
    lastLogin: 0
  };
  currentUsername = username;
  cachedVaultKey = vaultKey;
  cachedMasterDerived = masterPassword + salt;
  const vault = { entries: [], categoryPasswords: {}, entryLocks: {}, categories_locks: {} };
  saveVault(vault);
  saveConfig(cfg);
  logActivity('login', 'Vault created for ' + username);
  return { success: true, username };
}

function login(username, masterPassword, totpCode) {
  const cfg = loadConfig();
  const userData = cfg.users?.[username];
  if (!userData) return { success: false, error: 'User not found' };
  const now = Date.now();
  const attempt = loginAttempts[username];
  if (attempt && attempt.count >= MAX_LOGIN_ATTEMPTS && now - attempt.firstFailed < LOCKOUT_MINUTES * 60 * 1000) {
    const remaining = Math.ceil((LOCKOUT_MINUTES * 60 * 1000 - (now - attempt.firstFailed)) / 60000);
    return { success: false, error: `Too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.` };
  }
  try {
    const decrypted = vaultCrypto.decrypt(userData.masterHash, masterPassword + userData.masterSalt);
    if (!timingSafeEqual(decrypted, masterPassword)) {
      const att = loginAttempts[username] || { count: 0, firstFailed: now };
      att.count++; if (att.count === 1) att.firstFailed = now; loginAttempts[username] = att;
      return { success: false, error: 'Wrong password' };
    }
    const derivedKey = masterPassword + userData.masterSalt;
    if (userData.vault2FA && userData.vault2FA.enabled) {
      if (!totpCode) return { success: false, requires2fa: true };
      const plainSecret = vaultCrypto.decrypt(userData.vault2FA.secret, derivedKey);
      if (!verifyTOTP(totpCode, plainSecret)) {
        const att = loginAttempts[username] || { count: 0, firstFailed: now };
        att.count++; if (att.count === 1) att.firstFailed = now; loginAttempts[username] = att;
        return { success: false, error: 'Wrong authenticator code' };
      }
    }
    if (userData.encryptedVaultKey) {
      cachedVaultKey = vaultCrypto.decrypt(userData.encryptedVaultKey, derivedKey);
    } else {
      const vaultKey = vaultCrypto.generateUUID().replace(/-/g, '') + vaultCrypto.generateUUID().replace(/-/g, '');
      userData.encryptedVaultKey = vaultCrypto.encrypt(vaultKey, derivedKey);
      saveConfig(cfg);
      cachedVaultKey = vaultKey;
    }
    currentUsername = username;
    cachedMasterDerived = derivedKey;
    userData.lastLogin = Date.now();
    saveConfig(cfg);
    loginAttempts[username] = { count: 0, firstFailed: 0 };
    logActivity('login', 'Unlocked vault: ' + username);
    return { success: true, username };
  } catch {
    const att = loginAttempts[username] || { count: 0, firstFailed: now };
    att.count++; if (att.count === 1) att.firstFailed = now; loginAttempts[username] = att;
    return { success: false, error: 'Wrong password' };
  }
}

function verifyMaster(masterPassword, totpCode) {
  const cfg = loadConfig();
  const userData = currentUsername ? cfg.users?.[currentUsername] : null;
  if (!userData) return { success: false, error: 'No user logged in' };
  try {
    const decrypted = vaultCrypto.decrypt(userData.masterHash, masterPassword + userData.masterSalt);
    if (!timingSafeEqual(decrypted, masterPassword)) return { success: false, error: 'Wrong password' };
    const derivedKey = masterPassword + userData.masterSalt;
    if (userData.vault2FA && userData.vault2FA.enabled) {
      if (!totpCode) return { success: false, requires2fa: true };
      const plainSecret = vaultCrypto.decrypt(userData.vault2FA.secret, derivedKey);
      if (!verifyTOTP(totpCode, plainSecret)) return { success: false, error: 'Wrong authenticator code' };
    }
    if (userData.encryptedVaultKey) {
      cachedVaultKey = vaultCrypto.decrypt(userData.encryptedVaultKey, derivedKey);
    } else {
      const vaultKey = vaultCrypto.generateUUID().replace(/-/g, '') + vaultCrypto.generateUUID().replace(/-/g, '');
      userData.encryptedVaultKey = vaultCrypto.encrypt(vaultKey, derivedKey);
      saveConfig(cfg);
      cachedVaultKey = vaultKey;
    }
    cachedMasterDerived = derivedKey;
    logActivity('login', 'Unlocked vault');
    return { success: true };
  } catch { return { success: false, error: 'Wrong password' }; }
}

function getVaultKey() { return cachedVaultKey; }
function clearVaultKey() { cachedVaultKey = null; cachedMasterDerived = null; currentUsername = null; }
function getCurrentUsername() { return currentUsername; }

function deleteUser(username, masterPassword, totpCode) {
  const cfg = loadConfig();
  const userData = cfg.users?.[username];
  if (!userData) return { success: false, error: 'User not found' };
  try {
    const derived = masterPassword + userData.masterSalt;
    const decrypted = vaultCrypto.decrypt(userData.masterHash, derived);
    if (!timingSafeEqual(decrypted, masterPassword)) return { success: false, error: 'Wrong password' };
    if (userData.vault2FA && userData.vault2FA.enabled) {
      if (!totpCode) return { success: false, requires2fa: true };
      const plainSecret = vaultCrypto.decrypt(userData.vault2FA.secret, derived);
      if (!verifyTOTP(totpCode, plainSecret)) return { success: false, error: 'Wrong authenticator code' };
    }
    delete cfg.users[username];
    if (currentUsername === username) { currentUsername = null; cachedVaultKey = null; cachedMasterDerived = null; }
    saveConfig(cfg);
    const vpath = getVaultPath(username);
    try { if (fs.existsSync(vpath)) fs.unlinkSync(vpath); } catch {}
    logActivity('delete', 'Deleted user: ' + username);
    return { success: true };
  } catch { return { success: false, error: 'Wrong password' }; }
}

/* CRUD */
function fetchEntries() {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  return { success: true, data: vault.entries || [] };
}

function addEntry(entryData) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const now = Date.now();
  const entry = {
    id: vaultCrypto.generateUUID(),
    name: entryData.name || 'Untitled',
    type: entryData.type || 'password',
    category: entryData.category || 'Other',
    fields: entryData.fields || {},
    notes: entryData.notes || '',
    favorite: entryData.favorite || false,
    twofa: entryData.twofa || false,
    tags: entryData.tags || [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    color: entryData.color || null,
    customIcon: entryData.customIcon || null,
    entryPasswordHash: null,
  };
  /* Locks are set separately via setEntryPassword after the entry exists */
  vault.entries.push(entry);
  saveVault(vault);
  logActivity('add', `Added ${entry.name}`, entry.id);
  return { success: true, data: entry };
}

function updateEntry(id, updates) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const idx = vault.entries.findIndex((e) => e.id === id);
  if (idx === -1) return { success: false, error: 'Entry not found' };
  const entry = vault.entries[idx];
  if (updates.name !== undefined) entry.name = updates.name;
  if (updates.type !== undefined) entry.type = updates.type;
  if (updates.category !== undefined) entry.category = updates.category;
  if (updates.fields !== undefined) entry.fields = updates.fields;
  if (updates.notes !== undefined) entry.notes = updates.notes;
  if (updates.favorite !== undefined) entry.favorite = updates.favorite;
  if (updates.twofa !== undefined) entry.twofa = updates.twofa;
  if (updates.tags !== undefined) entry.tags = updates.tags;
  if (updates.color !== undefined) entry.color = updates.color;
  if (updates.customIcon !== undefined) entry.customIcon = updates.customIcon;
  /* Lock hash is set/removed via dedicated setEntryPassword/removeEntryPassword IPCs */
  entry.updatedAt = Date.now();
  saveVault(vault);
  logActivity('edit', `Updated ${entry.name}`, id);
  return { success: true, data: entry };
}

function deleteEntry(id) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const idx = vault.entries.findIndex((e) => e.id === id);
  if (idx === -1) return { success: false, error: 'Entry not found' };
  const entry = vault.entries[idx];
  if (entry.attachments) {
    for (const att of entry.attachments) {
      try { fs.unlinkSync(path.join(ATTACHMENT_DIR, att.id + '.enc')); } catch {}
    }
  }
  if (vault.entryLocks) delete vault.entryLocks[id];
  vault.entries.splice(idx, 1);
  saveVault(vault);
  logActivity('delete', `Deleted ${entry.name}`, id);
  return { success: true };
}

function touchEntry(id) {
  const vault = loadVault();
  if (!vault) return { success: false };
  const entry = vault.entries.find((e) => e.id === id);
  if (entry) { entry.lastUsedAt = Date.now(); saveVault(vault); }
  return { success: true };
}

/* Attachments */
function sanitizeId(id) { return id.replace(/[^a-zA-Z0-9_-]/g, ''); }

function addAttachment(entryId, name, mimeType, data) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const entry = vault.entries.find((e) => e.id === entryId);
  if (!entry) return { success: false, error: 'Entry not found' };
  if (!cachedVaultKey) return { success: false, error: 'Vault not initialized' };
  if (data.length > 50 * 1024 * 1024) return { success: false, error: 'Attachment exceeds 50MB limit' };
  const attId = vaultCrypto.generateUUID();
  const buffer = Buffer.from(data);
  const encrypted = vaultCrypto.encryptBuffer(buffer, cachedVaultKey);
  fs.writeFileSync(path.join(ATTACHMENT_DIR, sanitizeId(attId) + '.enc'), encrypted);
  const meta = { id: attId, name, mimeType, size: buffer.length, createdAt: Date.now() };
  if (!entry.attachments) entry.attachments = [];
  entry.attachments.push(meta);
  entry.updatedAt = Date.now();
  saveVault(vault);
  return { success: true, data: meta };
}

function getAttachment(entryId, attId) {
  if (!cachedVaultKey) return { success: false, error: 'Vault not initialized' };
  const attPath = path.join(ATTACHMENT_DIR, sanitizeId(attId) + '.enc');
  if (!fs.existsSync(attPath)) return { success: false, error: 'File not found' };
  const encrypted = fs.readFileSync(attPath);
  const decrypted = vaultCrypto.decryptToBuffer(encrypted, cachedVaultKey);
  return { success: true, data: Array.from(decrypted) };
}

function deleteAttachment(entryId, attId) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const entry = vault.entries.find((e) => e.id === entryId);
  if (!entry) return { success: false, error: 'Entry not found' };
  try { fs.unlinkSync(path.join(ATTACHMENT_DIR, sanitizeId(attId) + '.enc')); } catch {}
  if (entry.attachments) entry.attachments = entry.attachments.filter((a) => a.id !== attId);
  entry.updatedAt = Date.now();
  saveVault(vault);
  return { success: true };
}

/* PIN */
function setPin(pin) {
  if (!cachedVaultKey) return { success: false, error: 'Vault not initialized' };
  if (!currentUsername) return { success: false, error: 'No user logged in' };
  if (!pin || pin.length < 4 || !/^\d+$/.test(pin)) return { success: false, error: 'PIN must be 4+ digits' };
  const cfg = loadConfig();
  if (!cfg.settings) cfg.settings = {};
  cfg.settings.pinHash = vaultCrypto.encryptKey(cachedVaultKey, pin.toString());
  cfg.settings.pinUsername = currentUsername;
  cfg.settings.hasPin = true;
  saveConfig(cfg);
  return { success: true };
}

function removePin() {
  const cfg = loadConfig();
  if (!cfg.settings) cfg.settings = {};
  delete cfg.settings.pinHash;
  delete cfg.settings.pinUsername;
  cfg.settings.hasPin = false;
  saveConfig(cfg);
  return { success: true };
}

function hasPin() { const cfg = loadConfig(); return !!(cfg.settings && cfg.settings.hasPin); }

function unlockWithPin(pin) {
  const cfg = loadConfig();
  if (!cfg.settings || !cfg.settings.pinHash) return { success: false, error: 'No PIN set' };
  try {
    cachedVaultKey = vaultCrypto.decryptKey(cfg.settings.pinHash, pin.toString());
    if (cfg.settings.pinUsername) currentUsername = cfg.settings.pinUsername;
    logActivity('pin', 'Unlocked with PIN');
    return { success: true };
  } catch { return { success: false, error: 'Wrong PIN' }; }
}

/* Biometric */
function isBiometricAvailable() {
  try { return safeStorage.isEncryptionAvailable(); }
  catch { return false; }
}

function isBiometricEnabled() { const cfg = loadConfig(); return !!(cfg.settings && cfg.settings.biometricEnabled); }

function setBiometricEnabled(enabled) {
  const cfg = loadConfig();
  if (!cfg.settings) cfg.settings = {};
  if (enabled) {
    if (!safeStorage.isEncryptionAvailable()) return { success: false, error: 'Biometric not available on this system' };
    if (!cachedVaultKey) return { success: false, error: 'Unlock the vault first' };
    if (!currentUsername) return { success: false, error: 'No user logged in' };
    cfg.settings.biometricKey = safeStorage.encryptString(cachedVaultKey).toString('base64');
    cfg.settings.biometricUsername = currentUsername;
    cfg.settings.biometricEnabled = true;
  } else {
    delete cfg.settings.biometricKey;
    delete cfg.settings.biometricUsername;
    cfg.settings.biometricEnabled = false;
  }
  saveConfig(cfg);
  return { success: true };
}

function unlockWithBiometric() {
  const cfg = loadConfig();
  const s = cfg.settings || {};
  if (!s.biometricKey || !s.biometricEnabled) return { success: false, error: 'Biometric not enabled' };
  if (!safeStorage.isEncryptionAvailable()) return { success: false, error: 'Biometric not available' };
  try {
    cachedVaultKey = safeStorage.decryptString(Buffer.from(s.biometricKey, 'base64'));
    if (s.biometricUsername) currentUsername = s.biometricUsername;
    logActivity('biometric', 'Unlocked with biometric');
    return { success: true };
  } catch { return { success: false, error: 'Biometric unlock failed' }; }
}

/* Category passwords */
function setCategoryPassword(category, password) {
  if (!cachedVaultKey) return { success: false, error: 'Vault not initialized' };
  if (!category || !password) return { success: false, error: 'Category and password required' };
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  if (!vault.categoryPasswords) vault.categoryPasswords = {};
  if (!vault.categories_locks) vault.categories_locks = {};
  vault.categoryPasswords[category] = vaultCrypto.encrypt(password, cachedVaultKey);
  vault.categories_locks[category] = true;
  saveVault(vault);
  return { success: true };
}

function removeCategoryPassword(category) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  if (vault.categoryPasswords) delete vault.categoryPasswords[category];
  if (vault.categories_locks) delete vault.categories_locks[category];
  saveVault(vault);
  return { success: true };
}

function isCategoryLocked(category) {
  const vault = loadVault();
  if (!vault) return false;
  if (!vault.categoryPasswords || !vault.categoryPasswords[category]) return false;
  if (!vault.categories_locks) return true;
  return vault.categories_locks[category] === true;
}

function unlockCategory(category, password) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  if (!vault.categoryPasswords || !vault.categoryPasswords[category]) return { success: false, error: 'No password set for this category' };
  try {
    const decrypted = vaultCrypto.decrypt(vault.categoryPasswords[category], cachedVaultKey);
    if (timingSafeEqual(decrypted, password)) {
      if (!vault.categories_locks) vault.categories_locks = {};
      vault.categories_locks[category] = false;
      saveVault(vault);
      return { success: true };
    }
    return { success: false, error: 'Wrong password' };
  } catch { return { success: false, error: 'Wrong password' }; }
}

function getLockedCategories() {
  const vault = loadVault();
  if (!vault) return { success: true, data: [] };
  const out = [];
  if (vault.categoryPasswords) {
    for (const cat of Object.keys(vault.categoryPasswords)) {
      if (vault.categories_locks && vault.categories_locks[cat] === true) out.push(cat);
    }
  }
  return { success: true, data: out };
}

/* Per-entry password (the user-requested feature) */
function setEntryPassword(entryId, password) {
  if (!cachedVaultKey) return { success: false, error: 'Vault not initialized' };
  if (!password) return { success: false, error: 'Password required' };
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  if (!vault.entryLocks) vault.entryLocks = {};
  vault.entryLocks[entryId] = { hash: vaultCrypto.encrypt(password, cachedVaultKey), locked: true };
  const entry = vault.entries.find((e) => e.id === entryId);
  if (entry) entry.entryPasswordHash = 'set';
  saveVault(vault);
  return { success: true };
}

function removeEntryPassword(entryId) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  if (vault.entryLocks) delete vault.entryLocks[entryId];
  const entry = vault.entries.find((e) => e.id === entryId);
  if (entry) entry.entryPasswordHash = null;
  saveVault(vault);
  return { success: true };
}

function isEntryLocked(entryId) {
  const vault = loadVault();
  if (!vault) return false;
  if (!vault.entryLocks || !vault.entryLocks[entryId]) return false;
  return vault.entryLocks[entryId].locked === true;
}

function unlockEntry(entryId, password) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  if (!vault.entryLocks || !vault.entryLocks[entryId]) return { success: false, error: 'No password set' };
  try {
    const decrypted = vaultCrypto.decrypt(vault.entryLocks[entryId].hash, cachedVaultKey);
    if (timingSafeEqual(decrypted, password)) {
      vault.entryLocks[entryId].locked = false;
      saveVault(vault);
      logActivity('view', `Unlocked entry`, entryId);
      return { success: true };
    }
    return { success: false, error: 'Wrong password' };
  } catch { return { success: false, error: 'Wrong password' }; }
}

/* Vault 2FA */
function base32Decode(s) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const c = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const b = []; let buf = 0, bits = 0;
  for (const ch of c) { const i = a.indexOf(ch); if (i < 0) continue; buf = (buf << 5) | i; bits += 5; if (bits >= 8) { b.push((buf >> (bits - 8)) & 0xff); bits -= 8; } }
  return Buffer.from(b);
}

function verifyTOTP(code, secret, window = 1) {
  try {
    const key = base32Decode(secret);
    if (key.length === 0) return false;
    const now = Math.floor(Date.now() / 1000);
    for (let w = -window; w <= window; w++) {
      const counter = Math.floor((now + w * 30) / 30);
      const buf = Buffer.alloc(8);
      buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
      buf.writeUInt32BE(counter & 0xffffffff, 4);
      const hmac = nodeCrypto.createHmac('sha1', key).update(buf).digest();
      const off = hmac[hmac.length - 1] & 0xf;
      const bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16) | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
      const totp = String(bin % 1000000).padStart(6, '0');
      if (timingSafeEqual(totp, code)) return true;
    }
    return false;
  } catch { return false; }
}

function getUser2FA() {
  if (!currentUsername) return null;
  const cfg = loadConfig();
  const userData = cfg.users?.[currentUsername];
  if (!userData) return null;
  if (!userData.vault2FA) userData.vault2FA = {};
  return { cfg, userData, vault2FA: userData.vault2FA };
}

function setupVault2FA() {
  if (!cachedMasterDerived) return { success: false, error: 'Unlock the vault first' };
  const u = getUser2FA();
  if (!u) return { success: false, error: 'No user logged in' };
  const raw = nodeCrypto.randomBytes(20);
  const secret = Buffer.from(raw).toString('base64').replace(/[+/=]/g, '').slice(0, 32).toUpperCase();
  const account = currentUsername || 'user';
  const issuer = 'Sentinel Vault';
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  u.vault2FA.pendingSecret = vaultCrypto.encrypt(secret, cachedMasterDerived);
  saveConfig(u.cfg);
  return { success: true, data: { secret, otpauthUrl, qrPayload: secret } };
}

function confirmVault2FA(code) {
  if (!cachedMasterDerived) return { success: false, error: 'Unlock the vault first' };
  const u = getUser2FA();
  if (!u) return { success: false, error: 'No user logged in' };
  if (!u.vault2FA.pendingSecret) return { success: false, error: 'No setup in progress' };
  const secret = vaultCrypto.decrypt(u.vault2FA.pendingSecret, cachedMasterDerived);
  if (!verifyTOTP(code, secret)) return { success: false, error: 'Invalid code — try again' };
  u.vault2FA.enabled = true;
  u.vault2FA.secret = vaultCrypto.encrypt(secret, cachedMasterDerived);
  delete u.vault2FA.pendingSecret;
  saveConfig(u.cfg);
  logActivity('2fa', 'Vault 2FA enabled');
  return { success: true };
}

function disableVault2FA(code) {
  const u = getUser2FA();
  if (!u) return { success: false, error: 'No user logged in' };
  if (!u.vault2FA.enabled) return { success: false, error: '2FA is not enabled' };
  const secret = vaultCrypto.decrypt(u.vault2FA.secret, cachedMasterDerived);
  if (!verifyTOTP(code, secret)) return { success: false, error: 'Invalid code' };
  u.userData.vault2FA = null;
  saveConfig(u.cfg);
  logActivity('2fa', 'Vault 2FA disabled');
  return { success: true };
}

function isVault2FAEnabled() {
  if (!currentUsername) return false;
  const cfg = loadConfig();
  const u = cfg.users?.[currentUsername];
  return !!(u && u.vault2FA && u.vault2FA.enabled);
}

/* Change master password */
function changeMasterPassword(oldPassword, newPassword, totpCode) {
  if (!currentUsername) return { success: false, error: 'No user logged in' };
  const cfg = loadConfig();
  const userData = cfg.users?.[currentUsername];
  if (!userData) return { success: false, error: 'User not found' };
  if (userData.vault2FA && userData.vault2FA.enabled && !totpCode) return { success: false, requires2fa: true };
  const verifyResult = verifyMaster(oldPassword, totpCode);
  if (!verifyResult.success) return { success: false, error: verifyResult.error || 'Wrong current password' };
  if (!newPassword || newPassword.length < 8) return { success: false, error: 'New password must be 8+ chars' };
  const salt = vaultCrypto.generateUUID().replace(/-/g, '').slice(0, 16);
  const hash = vaultCrypto.encrypt(newPassword, newPassword + salt);
  userData.masterHash = hash;
  userData.masterSalt = salt;
  if (cachedVaultKey) userData.encryptedVaultKey = vaultCrypto.encrypt(cachedVaultKey, newPassword + salt);
  if (userData.vault2FA && userData.vault2FA.secret && cachedMasterDerived) {
    const plain = vaultCrypto.decrypt(userData.vault2FA.secret, cachedMasterDerived);
    userData.vault2FA.secret = vaultCrypto.encrypt(plain, newPassword + salt);
  }
  if (userData.vault2FA && userData.vault2FA.pendingSecret && cachedMasterDerived) {
    const plain = vaultCrypto.decrypt(userData.vault2FA.pendingSecret, cachedMasterDerived);
    userData.vault2FA.pendingSecret = vaultCrypto.encrypt(plain, newPassword + salt);
  }
  cachedMasterDerived = newPassword + salt;
  saveConfig(cfg);
  return { success: true };
}

/* Security report */
const BREACHED_SET = new Set(['123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111', '1234567', 'dragon', '123123', 'baseball', 'abc123', 'football', 'monkey', 'letmein', 'shadow', 'master', '666666', 'qwertyuiop', '123321', 'mustang', '1234567890', 'michael', '654321', 'superman', '1qaz2wsx', '7777777', '121212', '000000', 'qazwsx', '123qwe', 'killer', 'trustno1', 'jordan', 'jennifer', 'zxcvbnm', 'asdfgh', 'hunter', 'buster', 'soccer', 'harley', 'batman', 'andrew', 'tigger', 'sunshine', 'iloveyou', '2000', 'charlie', 'robert', 'thomas', 'hockey', 'ranger', 'daniel', 'starwars', 'klaster', '112233', 'george', 'computer', 'michelle', 'jessica', 'pepper', '1111', 'zxcvbn', '555555', '11111111', '131313', 'freedom', '777777', 'pass', 'maggie', '159753', 'aaaaaa', 'ginger', 'princess', 'joshua', 'cheese', 'amanda', 'summer', 'love', 'ashley', 'nicole', 'chelsea', 'biteme', 'matthew', 'access', 'yankees', '987654321', 'dallas', 'austin', 'thunder', 'taylor', 'matrix']);

function generateSecurityReport() {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const entries = vault.entries || [];
  const weakPasswords = [];
  const strongPasswords = [];
  const breached = [];
  const passwordSet = new Map();
  let duplicatePasswords = 0;
  const expiredEntries = [];
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

  for (const entry of entries) {
    const pw = entry.fields?.password || entry.fields?.apiKey || '';
    if (pw) {
      const result = vaultCrypto.checkStrength(pw);
      if (result.score < 40) weakPasswords.push(entry.name);
      else strongPasswords.push(entry.name);
      if (BREACHED_SET.has(pw.toLowerCase())) breached.push(entry.name);
      if (passwordSet.has(pw)) {
        passwordSet.set(pw, passwordSet.get(pw) + 1);
        duplicatePasswords++;
      } else {
        passwordSet.set(pw, 1);
      }
    }
    if (now - (entry.updatedAt || entry.createdAt) > NINETY_DAYS) expiredEntries.push(entry.name);
  }

  return {
    success: true,
    data: {
      totalEntries: entries.length,
      weakPasswords: weakPasswords.length,
      strongPasswords: strongPasswords.length,
      duplicatePasswords,
      weakPasswordList: weakPasswords,
      expiredEntries,
      breachedPasswords: breached.length,
      breachedList: breached,
    },
  };
}

/* Activity log */
function logActivity(type, detail, entryId) {
  try {
    if (!activityLog || activityLog.length === 0) activityLog = loadActivity();
    const entry = { id: vaultCrypto.generateUUID(), type, detail, timestamp: Date.now(), entryId };
    activityLog.unshift(entry);
    if (activityLog.length > 500) activityLog = activityLog.slice(0, 500);
    saveActivity();
  } catch (e) { /* ignore */ }
}

function getActivityLog() {
  if (!activityLog || activityLog.length === 0) activityLog = loadActivity();
  return { success: true, data: activityLog.slice(0, 200) };
}

function clearActivityLogFn() {
  activityLog = [];
  try { if (fs.existsSync(ACTIVITY_PATH)) fs.unlinkSync(ACTIVITY_PATH); } catch {}
  return { success: true };
}

/* Import / Export */
function exportCsv() {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const entries = vault.entries || [];
  let csv = 'name,type,category,username,password,url,notes\n';
  for (const entry of entries) {
    const fields = entry.fields || {};
    const esc = (v) => '"' + (v || '').replace(/"/g, '""') + '"';
    csv += [esc(entry.name), esc(entry.type), esc(entry.category), esc(fields.username || ''), esc(fields.password || ''), esc(fields.url || ''), esc(entry.notes)].join(',') + '\n';
  }
  return { success: true, data: csv };
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

function importCsv(data) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const lines = data.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { success: false, error: 'No data rows' };
  const header = parseCsvLine(lines[0].toLowerCase()).map((h) => h.replace(/"/g, '').trim());
  const expected = ['name', 'type', 'category', 'username', 'password', 'url', 'notes'];
  const colMap = expected.map((e) => header.indexOf(e));
  if (colMap.every((c) => c === -1)) return { success: false, error: 'Unrecognized CSV format' };
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    try {
      const vals = parseCsvLine(lines[i]).map((v) => {
        if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') { return v.slice(1, -1).replace(/""/g, '"'); }
        return v;
      });
      const get = (idx) => (idx >= 0 && idx < vals.length ? vals[idx] : '');
      const t = get(colMap[1]) || 'password';
      const validTypes = ['password', 'card', 'note', 'api', 'identity', 'license', 'ssh', 'wallet', 'database'];
      const entry = {
        id: vaultCrypto.generateUUID(),
        name: get(colMap[0]) || 'Imported',
        type: validTypes.includes(t) ? t : 'password',
        category: get(colMap[2]) || 'Other',
        fields: {}, notes: get(colMap[6]) || '',
        favorite: false, twofa: false, tags: [],
        attachments: [], createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now(),
      };
      if (get(colMap[3])) entry.fields.username = get(colMap[3]);
      if (get(colMap[4])) entry.fields.password = get(colMap[4]);
      if (get(colMap[5])) entry.fields.url = get(colMap[5]);
      vault.entries.push(entry);
      count++;
    } catch {}
  }
  saveVault(vault);
  return { success: true, data: count };
}

function exportVault() {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const exportData = {
    version: 3,
    exportedAt: Date.now(),
    entries: (vault.entries || []).map((e) => ({
      id: e.id, name: e.name, type: e.type, category: e.category,
      fields: e.fields, notes: e.notes, favorite: e.favorite,
      twofa: e.twofa, tags: e.tags || [],
      attachments: e.attachments || [],
      createdAt: e.createdAt, updatedAt: e.updatedAt, lastUsedAt: e.lastUsedAt,
      color: e.color, customIcon: e.customIcon,
      entryPasswordHash: e.entryPasswordHash || null,
    })),
    categories: {},
    entryLocks: {},
  };
  if (vault.categoryPasswords) {
    for (const key of Object.keys(vault.categoryPasswords)) {
      exportData.categories[key] = { locked: vault.categories_locks && vault.categories_locks[key] !== false };
    }
  }
  if (vault.entryLocks) {
    for (const [id, lock] of Object.entries(vault.entryLocks)) {
      exportData.entryLocks[id] = { locked: lock.locked === true };
    }
  }
  return { success: true, data: JSON.stringify(exportData, null, 2) };
}

function importVault(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.entries || !Array.isArray(data.entries)) return { success: false, error: 'Invalid format' };
    const vault = loadVault();
    if (!vault) return { success: false, error: 'Vault locked' };
    if (!vault.entryLocks) vault.entryLocks = {};
    for (const entry of data.entries) {
      const newId = vaultCrypto.generateUUID();
      vault.entries.push({
        id: newId,
        name: entry.name || 'Imported',
        type: entry.type || 'password',
        category: entry.category || 'Other',
        fields: entry.fields || {},
        notes: entry.notes || '',
        favorite: entry.favorite || false,
        twofa: entry.twofa || false,
        tags: entry.tags || [],
        attachments: [],
        createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now(),
        color: entry.color || null,
        customIcon: entry.customIcon || null,
        entryPasswordHash: entry.entryPasswordHash || null,
      });
      if (data.entryLocks && data.entryLocks[entry.id] && data.entryLocks[entry.id].locked) {
        vault.entryLocks[newId] = { hash: null, locked: true };
      }
    }
    if (data.categories) {
      if (!vault.categories_locks) vault.categories_locks = {};
      for (const [cat, val] of Object.entries(data.categories)) {
        if (val && val.locked) vault.categories_locks[cat] = true;
      }
    }
    saveVault(vault);
    return { success: true, data: data.entries.length };
  } catch { return { success: false, error: 'Invalid JSON format' }; }
}

/* Auto-lock & Launch-on-startup */
function getAutoLockTimeout() { const s = loadConfig().settings || {}; return { success: true, data: s.autoLockTimeout !== undefined ? s.autoLockTimeout : 300 }; }
function setAutoLockTimeout(seconds) { const cfg = loadConfig(); if (!cfg.settings) cfg.settings = {}; cfg.settings.autoLockTimeout = seconds; saveConfig(cfg); return { success: true }; }

function getLaunchOnStartup() { const s = loadConfig().settings || {}; return { success: true, data: s.launchOnStartup || false }; }
function setLaunchOnStartup(enabled) {
  const cfg = loadConfig(); if (!cfg.settings) cfg.settings = {}; cfg.settings.launchOnStartup = enabled; saveConfig(cfg);
  try { app.setLoginItemSettings({ openAtLogin: enabled }); } catch {}
  return { success: true };
}

/* Generic setting helpers */
function getSetting(key, def) {
  const cfg = loadConfig();
  if (!cfg.settings) cfg.settings = {};
  return cfg.settings[key] !== undefined ? cfg.settings[key] : def;
}
function setSetting(key, value) {
  const cfg = loadConfig();
  if (!cfg.settings) cfg.settings = {};
  cfg.settings[key] = value;
  saveConfig(cfg);
  return { success: true };
}

/* Username & Remember Me */
function getUsername() { return { success: true, data: getSetting('lastUsername', '') }; }
function setUsername(name) { return setSetting('lastUsername', name); }
function getRememberMe() { return { success: true, data: getSetting('rememberMe', false) }; }
function setRememberMe(enabled) { return setSetting('rememberMe', enabled); }

/* Theme */
function getTheme() { return { success: true, data: getSetting('theme', 'indigo') }; }
function setTheme(theme) { return setSetting('theme', theme); }

/* Compact view & Sidebar */
function setCompactView(v) { return setSetting('compactView', !!v); }
function setShowSidebar(v) { return setSetting('showSidebar', v !== false); }

/* Clipboard auto-clear (in seconds, 0 = disabled) */
function getClipboardAutoClear() { return { success: true, data: getSetting('clipboardAutoClear', 30) }; }
function setClipboardAutoClear(seconds) { return setSetting('clipboardAutoClear', seconds); }

function getSettings() {
  const cfg = loadConfig();
  const s = cfg.settings || {};
  return {
    success: true, data: {
      autoLockTimeout: s.autoLockTimeout != null ? s.autoLockTimeout : 300,
      launchOnStartup: s.launchOnStartup || false,
      biometricEnabled: s.biometricEnabled || false,
      biometricAvailable: isBiometricAvailable(),
      hasPin: !!s.hasPin,
      username: currentUsername || '',
      rememberMe: !!s.rememberMe,
      vault2FAEnabled: isVault2FAEnabled(),
      theme: s.theme || 'indigo',
      compactView: s.compactView !== undefined ? !!s.compactView : false,
      clipboardAutoClearSeconds: s.clipboardAutoClear != null ? s.clipboardAutoClear : 30,
      showSidebar: s.showSidebar !== false,
    },
  };
}

function migrateEntry(entryId) {
  const vault = loadVault();
  if (!vault) return { success: false, error: 'Vault locked' };
  const entry = vault.entries.find((e) => e.id === entryId);
  if (!entry) return { success: false, error: 'Entry not found' };
  if (!entry.type) entry.type = 'password';
  if (!entry.tags) entry.tags = [];
  if (!entry.attachments) entry.attachments = [];
  if (!entry.twofa) entry.twofa = false;
  if (!entry.color) entry.color = null;
  if (!entry.lastUsedAt) entry.lastUsedAt = entry.updatedAt || entry.createdAt;
  saveVault(vault);
  return { success: true };
}

function wipeAllData() {
  try {
    cachedVaultKey = null;
    cachedMasterDerived = null;
    activityLog = [];
    const users = getUserList();
    for (const u of users) {
      const vpath = getVaultPath(u);
      if (fs.existsSync(vpath)) fs.unlinkSync(vpath);
    }
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
    if (fs.existsSync(ACTIVITY_PATH)) fs.unlinkSync(ACTIVITY_PATH);
    if (fs.existsSync(ATTACHMENT_DIR)) {
      for (const f of fs.readdirSync(ATTACHMENT_DIR)) {
        try { fs.unlinkSync(path.join(ATTACHMENT_DIR, f)); } catch {}
      }
    }
    return { success: true };
  } catch { return { success: false, error: 'Wipe failed' }; }
}

/* Initialize activity log on require */
activityLog = loadActivity();

module.exports = {
  ensureDir, isRegistered, getUserList, register, login, verifyMaster, getVaultKey, clearVaultKey,
  getCurrentUsername, deleteUser,
  fetchEntries, addEntry, updateEntry, deleteEntry, touchEntry,
  addAttachment, getAttachment, deleteAttachment,
  setPin, removePin, hasPin, unlockWithPin,
  isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, unlockWithBiometric,
  setCategoryPassword, removeCategoryPassword, isCategoryLocked, unlockCategory, getLockedCategories,
  setEntryPassword, removeEntryPassword, isEntryLocked, unlockEntry,
  setupVault2FA, confirmVault2FA, disableVault2FA, isVault2FAEnabled,
  changeMasterPassword, generateSecurityReport,
  getActivityLog, logActivity, clearActivityLog: clearActivityLogFn,
  exportCsv, importCsv, exportVault, importVault,
  getAutoLockTimeout, setAutoLockTimeout,
  getLaunchOnStartup, setLaunchOnStartup,
  getUsername, setUsername, getRememberMe, setRememberMe,
  getTheme, setTheme, setCompactView, setShowSidebar, getClipboardAutoClear, setClipboardAutoClear,
  getSettings, migrateEntry, wipeAllData,
};
