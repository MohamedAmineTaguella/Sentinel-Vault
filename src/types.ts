import type { ReactNode } from 'react';

export type EntryType = 'password' | 'card' | 'note' | 'api' | 'identity' | 'license' | 'ssh' | 'wallet' | 'database';

export interface AttachmentMeta {
  id: string; name: string; mimeType: string; size: number; createdAt: number;
}

export interface VaultEntry {
  id: string; name: string; type: EntryType; category: string;
  fields: Record<string, string>; notes: string;
  favorite: boolean; twofa: boolean; tags: string[];
  attachments: AttachmentMeta[];
  createdAt: number; updatedAt: number;
  lastUsedAt?: number;
  color?: string | null;
  customIcon?: string | null;
  entryPasswordHash?: string | null;
  /* Transient fields (NOT stored in vault) — used when saving to set/change/remove lock */
  entryLockPassword?: string | null;
  removeEntryLock?: boolean;
}

export interface SecurityReport {
  totalEntries: number; weakPasswords: number; strongPasswords: number;
  duplicatePasswords: number; weakPasswordList: string[]; expiredEntries: string[];
  breachedPasswords: number; breachedList: string[];
}

export interface StrengthResult { score: number; label: string; }

export type ThemeAccent = 'indigo' | 'violet' | 'rose' | 'emerald' | 'amber' | 'cyan' | 'pink';

export interface AppSettings {
  autoLockTimeout: number; launchOnStartup: boolean;
  biometricEnabled: boolean; biometricAvailable: boolean;
  hasPin: boolean; username: string; rememberMe: boolean;
  vault2FAEnabled: boolean; theme: ThemeAccent; compactView: boolean;
  clipboardAutoClearSeconds: number; showSidebar: boolean;
}

export interface ActivityEntry {
  id: string; type: 'login' | 'lock' | 'add' | 'edit' | 'delete' | 'view' | 'copy' | 'autolock' | 'pin' | 'biometric' | 'export' | 'import' | '2fa';
  detail: string; timestamp: number; entryId?: string;
}

export interface PasswordOptions {
  length: number; uppercase: boolean; lowercase: boolean;
  numbers: boolean; symbols: boolean; excludeAmbiguous: boolean;
  passphraseMode?: boolean; passphraseWords?: number;
}

export interface ElectronAPI {
  checkRegistered: () => Promise<{ success: boolean }>;
  getUserList: () => Promise<{ success: boolean; data: string[] }>;
  getCurrentUsername: () => Promise<{ success: boolean; data: string | null }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string; username?: string }>;
  login: (username: string, password: string, totpCode?: string) => Promise<{ success: boolean; requires2fa?: boolean; error?: string; username?: string }>;
  deleteUser: (username: string, password: string, totpCode?: string) => Promise<{ success: boolean; error?: string; requires2fa?: boolean }>;
  verifyMaster: (password: string, totpCode?: string) => Promise<{ success: boolean; requires2fa?: boolean; error?: string }>;
  getVaultKey: () => Promise<{ success: boolean; data?: string }>;
  clearVaultKey: () => Promise<{ success: boolean }>;

  fetchEntries: () => Promise<{ success: boolean; data?: VaultEntry[]; error?: string }>;
  addEntry: (data: Partial<VaultEntry>) => Promise<{ success: boolean; data?: VaultEntry; error?: string }>;
  updateEntry: (id: string, data: Partial<VaultEntry>) => Promise<{ success: boolean; data?: VaultEntry; error?: string }>;
  deleteEntry: (id: string) => Promise<{ success: boolean; error?: string }>;
  touchEntry: (id: string) => Promise<{ success: boolean }>;

  addAttachment: (entryId: string, name: string, mimeType: string, data: Uint8Array) => Promise<{ success: boolean; data?: AttachmentMeta; error?: string }>;
  getAttachment: (entryId: string, attId: string) => Promise<{ success: boolean; data?: number[]; error?: string }>;
  deleteAttachment: (entryId: string, attId: string) => Promise<{ success: boolean; error?: string }>;

  hasPin: () => Promise<{ success: boolean; data: boolean }>;
  setPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  removePin: () => Promise<{ success: boolean; error?: string }>;
  unlockWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;

  isBiometricAvailable: () => Promise<{ success: boolean; data: boolean }>;
  isBiometricEnabled: () => Promise<{ success: boolean; data: boolean }>;
  setBiometricEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  unlockWithBiometric: () => Promise<{ success: boolean; error?: string }>;

  setCategoryPassword: (category: string, password: string) => Promise<{ success: boolean; error?: string }>;
  removeCategoryPassword: (category: string) => Promise<{ success: boolean; error?: string }>;
  isCategoryLocked: (category: string) => Promise<{ success: boolean; data: boolean }>;
  unlockCategory: (category: string, password: string) => Promise<{ success: boolean; error?: string }>;
  getLockedCategories: () => Promise<{ success: boolean; data: string[] }>;

  setEntryPassword: (entryId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  removeEntryPassword: (entryId: string) => Promise<{ success: boolean; error?: string }>;
  unlockEntry: (entryId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isEntryLocked: (entryId: string) => Promise<{ success: boolean; data: boolean }>;

  setupVault2FA: () => Promise<{ success: boolean; data?: { secret: string; otpauthUrl: string; qrPayload: string }; error?: string }>;
  confirmVault2FA: (code: string) => Promise<{ success: boolean; error?: string }>;
  disableVault2FA: (code: string) => Promise<{ success: boolean; error?: string }>;
  isVault2FAEnabled: () => Promise<{ success: boolean; data: boolean }>;

  changeMasterPassword: (oldPassword: string, newPassword: string, totpCode?: string) => Promise<{ success: boolean; error?: string; requires2fa?: boolean }>;
  generateSecurityReport: () => Promise<{ success: boolean; data?: SecurityReport; error?: string }>;
  getActivityLog: () => Promise<{ success: boolean; data?: ActivityEntry[]; error?: string }>;
  logActivity: (type: string, detail: string, entryId?: string) => Promise<{ success: boolean }>;
  clearActivityLog: () => Promise<{ success: boolean }>;

  exportCsv: () => Promise<{ success: boolean; data?: string; error?: string }>;
  importCsv: (data: string) => Promise<{ success: boolean; data?: number; error?: string }>;
  exportVault: () => Promise<{ success: boolean; data?: string; error?: string }>;
  importVault: (data: string) => Promise<{ success: boolean; data?: number; error?: string }>;

  getAutoLockTimeout: () => Promise<{ success: boolean; data: number }>;
  setAutoLockTimeout: (seconds: number) => Promise<{ success: boolean }>;
  getLaunchOnStartup: () => Promise<{ success: boolean; data: boolean }>;
  setLaunchOnStartup: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  getUsername: () => Promise<{ success: boolean; data: string }>;
  setUsername: (name: string) => Promise<{ success: boolean }>;
  getRememberMe: () => Promise<{ success: boolean; data: boolean }>;
  setRememberMe: (enabled: boolean) => Promise<{ success: boolean }>;
  getTheme: () => Promise<{ success: boolean; data: ThemeAccent }>;
  setTheme: (theme: ThemeAccent) => Promise<{ success: boolean }>;
  getClipboardAutoClear: () => Promise<{ success: boolean; data: number }>;
  setClipboardAutoClear: (seconds: number) => Promise<{ success: boolean }>;
  setCompactView: (v: boolean) => Promise<{ success: boolean }>;
  setShowSidebar: (v: boolean) => Promise<{ success: boolean }>;
  getSettings: () => Promise<{ success: boolean; data?: AppSettings }>;
  migrateEntry: (id: string) => Promise<{ success: boolean; error?: string }>;
  wipeAllData: () => Promise<{ success: boolean; error?: string }>;

  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  onAutoLock: (callback: () => void) => (() => void);
  onWindowState: (callback: (state: string) => void) => (() => void);
  userActivity: () => Promise<void>;
}

/* Field definitions per entry type */
export const ENTRY_TYPE_FIELDS: Record<EntryType, { key: string; label: string; type?: 'text' | 'password' | 'url' | 'number' | 'date'; placeholder?: string }[]> = {
  password: [
    { key: 'username', label: 'Username / Email' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'url', label: 'Website URL', type: 'url', placeholder: 'https://...' },
  ],
  card: [
    { key: 'cardNumber', label: 'Card Number' },
    { key: 'cardholderName', label: 'Cardholder Name' },
    { key: 'expiry', label: 'Expiry (MM/YY)' },
    { key: 'cvv', label: 'CVV', type: 'password' },
    { key: 'pin', label: 'PIN', type: 'password' },
    { key: 'billingAddress', label: 'Billing Address' },
  ],
  note: [
    { key: 'title', label: 'Title' },
  ],
  api: [
    { key: 'apiKey', label: 'API Key / Secret', type: 'password' },
    { key: 'endpointUrl', label: 'Endpoint URL', type: 'url' },
    { key: 'environment', label: 'Environment' },
  ],
  identity: [
    { key: 'fullName', label: 'Full Name' },
    { key: 'documentNumber', label: 'Document / ID Number', type: 'password' },
    { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
    { key: 'address', label: 'Address' },
    { key: 'nationality', label: 'Nationality' },
  ],
  license: [
    { key: 'productKey', label: 'Product / License Key', type: 'password' },
    { key: 'version', label: 'Version' },
    { key: 'vendor', label: 'Vendor / Publisher' },
    { key: 'purchaseDate', label: 'Purchase Date', type: 'date' },
    { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  ],
  ssh: [
    { key: 'privateKey', label: 'Private Key', type: 'password' },
    { key: 'publicKey', label: 'Public Key' },
    { key: 'passphrase', label: 'Passphrase', type: 'password' },
    { key: 'fingerprint', label: 'Fingerprint' },
  ],
  wallet: [
    { key: 'address', label: 'Wallet Address' },
    { key: 'seedPhrase', label: 'Seed / Recovery Phrase', type: 'password' },
    { key: 'privateKey', label: 'Private Key', type: 'password' },
    { key: 'network', label: 'Network / Chain' },
  ],
  database: [
    { key: 'host', label: 'Host' },
    { key: 'port', label: 'Port', type: 'number' },
    { key: 'database', label: 'Database Name' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', type: 'password' },
  ],
};

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  password: 'Password', card: 'Credit Card', note: 'Secure Note', api: 'API Key',
  identity: 'Identity', license: 'Software License', ssh: 'SSH Key',
  wallet: 'Crypto Wallet', database: 'Database',
};

export const ENTRY_TYPE_ICONS: Record<EntryType, string> = {
  password: '🔑', card: '💳', note: '📝', api: '🔌',
  identity: '🪪', license: '🎫', ssh: '🖥️', wallet: '₿', database: '🗄️',
};

export const ENTRY_TYPE_GROUPS: { label: string; types: EntryType[] }[] = [
  { label: 'Common', types: ['password', 'card', 'note', 'api', 'identity'] },
  { label: 'Advanced', types: ['license', 'ssh', 'wallet', 'database'] },
];

export interface FieldDef {
  key: string; label: string; type: 'text' | 'password' | 'url' | 'number';
  placeholder?: string;
}

export interface EntryTemplate {
  name: string; type: EntryType; icon?: string;
  fields: { key: string; value: string }[];
  category?: string;
  description?: string;
}

export const ENTRY_TEMPLATES: EntryTemplate[] = [
  { name: 'Web Login', type: 'password', fields: [{ key: 'username', value: '' }, { key: 'password', value: '' }, { key: 'url', value: '' }], category: 'Personal' },
  { name: 'Email Account', type: 'password', fields: [{ key: 'username', value: '' }, { key: 'password', value: '' }, { key: 'url', value: 'https://mail.google.com' }], category: 'Personal' },
  { name: 'Social Media', type: 'password', fields: [{ key: 'username', value: '' }, { key: 'password', value: '' }, { key: 'url', value: '' }], category: 'Social' },
  { name: 'Credit / Debit Card', type: 'card', fields: [{ key: 'cardNumber', value: '' }, { key: 'cardholderName', value: '' }, { key: 'expiry', value: '' }, { key: 'cvv', value: '' }, { key: 'pin', value: '' }], category: 'Finance' },
  { name: 'API Key', type: 'api', fields: [{ key: 'apiKey', value: '' }, { key: 'endpointUrl', value: '' }, { key: 'environment', value: 'production' }], category: 'Work' },
  { name: 'Passport', type: 'identity', fields: [{ key: 'fullName', value: '' }, { key: 'documentNumber', value: '' }, { key: 'dateOfBirth', value: '' }], category: 'Personal' },
  { name: 'SSN / Tax ID', type: 'identity', fields: [{ key: 'fullName', value: '' }, { key: 'documentNumber', value: '' }], category: 'Personal' },
  { name: 'Secure Note', type: 'note', fields: [{ key: 'title', value: '' }], category: 'Personal' },
  { name: 'WiFi Password', type: 'password', fields: [{ key: 'username', value: '' }, { key: 'password', value: '' }, { key: 'url', value: '' }], category: 'Personal' },
  { name: 'Bank Account', type: 'card', fields: [{ key: 'cardNumber', value: '' }, { key: 'cardholderName', value: '' }, { key: 'expiry', value: '' }], category: 'Finance' },
  { name: 'Software License', type: 'license', fields: [{ key: 'productKey', value: '' }, { key: 'version', value: '' }, { key: 'vendor', value: '' }], category: 'Work' },
  { name: 'SSH Key', type: 'ssh', fields: [{ key: 'privateKey', value: '' }, { key: 'publicKey', value: '' }, { key: 'fingerprint', value: '' }], category: 'Work' },
  { name: 'Crypto Wallet', type: 'wallet', fields: [{ key: 'address', value: '' }, { key: 'seedPhrase', value: '' }, { key: 'network', value: '' }], category: 'Finance' },
  { name: 'Database', type: 'database', fields: [{ key: 'host', value: '' }, { key: 'port', value: '5432' }, { key: 'database', value: '' }, { key: 'username', value: '' }, { key: 'password', value: '' }], category: 'Work' },
];

export const CATEGORIES = ['Personal', 'Work', 'Finance', 'Social', 'Shopping', 'Entertainment', 'Education', 'Health', 'Travel', 'Other'];

export const ENTRY_COLORS = [
  { name: 'Indigo', value: 'indigo', gradient: 'from-indigo-500/20 to-purple-500/20', text: 'text-indigo-300' },
  { name: 'Rose', value: 'rose', gradient: 'from-rose-500/20 to-pink-500/20', text: 'text-rose-300' },
  { name: 'Emerald', value: 'emerald', gradient: 'from-emerald-500/20 to-teal-500/20', text: 'text-emerald-300' },
  { name: 'Amber', value: 'amber', gradient: 'from-amber-500/20 to-orange-500/20', text: 'text-amber-300' },
  { name: 'Cyan', value: 'cyan', gradient: 'from-cyan-500/20 to-sky-500/20', text: 'text-cyan-300' },
  { name: 'Violet', value: 'violet', gradient: 'from-violet-500/20 to-fuchsia-500/20', text: 'text-violet-300' },
];

export const THEME_PALETTES: Record<ThemeAccent, { primary: string; secondary: string; ring: string; gradient: string; glow: string; shadow: string; bgAccent: string; text: string }> = {
  indigo: { primary: '#6366f1', secondary: '#8b5cf6', ring: 'rgba(99,102,241,0.4)', gradient: 'from-indigo-500 to-violet-500', glow: 'rgba(99,102,241,0.12)', shadow: 'shadow-indigo-500/20', bgAccent: 'bg-indigo-500', text: 'text-indigo-400' },
  violet: { primary: '#8b5cf6', secondary: '#a855f7', ring: 'rgba(139,92,246,0.4)', gradient: 'from-violet-500 to-fuchsia-500', glow: 'rgba(139,92,246,0.12)', shadow: 'shadow-violet-500/20', bgAccent: 'bg-violet-500', text: 'text-violet-400' },
  rose: { primary: '#f43f5e', secondary: '#ec4899', ring: 'rgba(244,63,94,0.4)', gradient: 'from-rose-500 to-pink-500', glow: 'rgba(244,63,94,0.12)', shadow: 'shadow-rose-500/20', bgAccent: 'bg-rose-500', text: 'text-rose-400' },
  emerald: { primary: '#10b981', secondary: '#14b8a6', ring: 'rgba(16,185,129,0.4)', gradient: 'from-emerald-500 to-teal-500', glow: 'rgba(16,185,129,0.12)', shadow: 'shadow-emerald-500/20', bgAccent: 'bg-emerald-500', text: 'text-emerald-400' },
  amber: { primary: '#f59e0b', secondary: '#f97316', ring: 'rgba(245,158,11,0.4)', gradient: 'from-amber-500 to-orange-500', glow: 'rgba(245,158,11,0.12)', shadow: 'shadow-amber-500/20', bgAccent: 'bg-amber-500', text: 'text-amber-400' },
  cyan: { primary: '#06b6d4', secondary: '#3b82f6', ring: 'rgba(6,182,212,0.4)', gradient: 'from-cyan-500 to-blue-500', glow: 'rgba(6,182,212,0.12)', shadow: 'shadow-cyan-500/20', bgAccent: 'bg-cyan-500', text: 'text-cyan-400' },
  pink: { primary: '#ec4899', secondary: '#f43f5e', ring: 'rgba(236,72,153,0.4)', gradient: 'from-pink-500 to-rose-500', glow: 'rgba(236,72,153,0.12)', shadow: 'shadow-pink-500/20', bgAccent: 'bg-pink-500', text: 'text-pink-400' },
};
