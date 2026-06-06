const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /* Auth */
  checkRegistered: () => ipcRenderer.invoke('check-registered'),
  getUserList: () => ipcRenderer.invoke('get-user-list'),
  getCurrentUsername: () => ipcRenderer.invoke('get-current-username'),
  register: (username, password) => ipcRenderer.invoke('register', username, password),
  login: (username, password, totpCode) => ipcRenderer.invoke('login', username, password, totpCode),
  deleteUser: (username, password, totpCode) => ipcRenderer.invoke('delete-user', username, password, totpCode),
  verifyMaster: (password, totpCode) => ipcRenderer.invoke('verify-master', password, totpCode),
  getVaultKey: () => ipcRenderer.invoke('get-vault-key'),
  clearVaultKey: () => ipcRenderer.invoke('clear-vault-key'),

  /* CRUD */
  fetchEntries: () => ipcRenderer.invoke('fetch-entries'),
  addEntry: (data) => ipcRenderer.invoke('add-entry', data),
  updateEntry: (id, data) => ipcRenderer.invoke('update-entry', id, data),
  deleteEntry: (id) => ipcRenderer.invoke('delete-entry', id),
  touchEntry: (id) => ipcRenderer.invoke('touch-entry', id),

  /* Attachments */
  addAttachment: (entryId, name, mimeType, data) => ipcRenderer.invoke('add-attachment', entryId, name, mimeType, data),
  getAttachment: (entryId, attId) => ipcRenderer.invoke('get-attachment', entryId, attId),
  deleteAttachment: (entryId, attId) => ipcRenderer.invoke('delete-attachment', entryId, attId),

  /* PIN */
  hasPin: () => ipcRenderer.invoke('has-pin'),
  setPin: (pin) => ipcRenderer.invoke('set-pin', pin),
  removePin: () => ipcRenderer.invoke('remove-pin'),
  unlockWithPin: (pin) => ipcRenderer.invoke('unlock-with-pin', pin),

  /* Biometric */
  isBiometricAvailable: () => ipcRenderer.invoke('is-biometric-available'),
  isBiometricEnabled: () => ipcRenderer.invoke('is-biometric-enabled'),
  setBiometricEnabled: (enabled) => ipcRenderer.invoke('set-biometric-enabled', enabled),
  unlockWithBiometric: () => ipcRenderer.invoke('unlock-with-biometric'),

  /* Category passwords */
  setCategoryPassword: (category, password) => ipcRenderer.invoke('set-category-password', category, password),
  removeCategoryPassword: (category) => ipcRenderer.invoke('remove-category-password', category),
  isCategoryLocked: (category) => ipcRenderer.invoke('is-category-locked', category),
  unlockCategory: (category, password) => ipcRenderer.invoke('unlock-category', category, password),
  getLockedCategories: () => ipcRenderer.invoke('get-locked-categories'),

  /* Per-entry passwords */
  setEntryPassword: (entryId, password) => ipcRenderer.invoke('set-entry-password', entryId, password),
  removeEntryPassword: (entryId) => ipcRenderer.invoke('remove-entry-password', entryId),
  unlockEntry: (entryId, password) => ipcRenderer.invoke('unlock-entry', entryId, password),
  isEntryLocked: (entryId) => ipcRenderer.invoke('is-entry-locked', entryId),

  /* Vault 2FA */
  setupVault2FA: () => ipcRenderer.invoke('setup-vault-2fa'),
  confirmVault2FA: (code) => ipcRenderer.invoke('confirm-vault-2fa', code),
  disableVault2FA: (code) => ipcRenderer.invoke('disable-vault-2fa', code),
  isVault2FAEnabled: () => ipcRenderer.invoke('is-vault-2fa-enabled'),

  /* Security */
  changeMasterPassword: (oldPassword, newPassword, totpCode) => ipcRenderer.invoke('change-master-password', oldPassword, newPassword, totpCode),
  generateSecurityReport: () => ipcRenderer.invoke('generate-security-report'),
  getActivityLog: () => ipcRenderer.invoke('get-activity-log'),
  logActivity: (type, detail, entryId) => ipcRenderer.invoke('log-activity', type, detail, entryId),
  clearActivityLog: () => ipcRenderer.invoke('clear-activity-log'),

  /* Import/Export */
  exportCsv: () => ipcRenderer.invoke('export-csv'),
  importCsv: (data) => ipcRenderer.invoke('import-csv', data),
  exportVault: () => ipcRenderer.invoke('export-vault'),
  importVault: (data) => ipcRenderer.invoke('import-vault', data),

  /* Settings */
  getAutoLockTimeout: () => ipcRenderer.invoke('get-auto-lock-timeout'),
  setAutoLockTimeout: (seconds) => ipcRenderer.invoke('set-auto-lock-timeout', seconds),
  getLaunchOnStartup: () => ipcRenderer.invoke('get-launch-on-startup'),
  setLaunchOnStartup: (enabled) => ipcRenderer.invoke('set-launch-on-startup', enabled),
  getUsername: () => ipcRenderer.invoke('get-username'),
  setUsername: (name) => ipcRenderer.invoke('set-username', name),
  getRememberMe: () => ipcRenderer.invoke('get-remember-me'),
  setRememberMe: (enabled) => ipcRenderer.invoke('set-remember-me', enabled),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  setCompactView: (v) => ipcRenderer.invoke('set-compact-view', v),
  setShowSidebar: (v) => ipcRenderer.invoke('set-show-sidebar', v),
  getClipboardAutoClear: () => ipcRenderer.invoke('get-clipboard-auto-clear'),
  setClipboardAutoClear: (seconds) => ipcRenderer.invoke('set-clipboard-auto-clear', seconds),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  migrateEntry: (id) => ipcRenderer.invoke('migrate-entry', id),
  wipeAllData: () => ipcRenderer.invoke('wipe-all-data'),

  /* Window controls */
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  /* Events */
  onAutoLock: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('auto-lock', handler);
    return () => ipcRenderer.removeListener('auto-lock', handler);
  },
  onWindowState: (callback) => {
    const handler = (_e, state) => callback(state);
    ipcRenderer.on('window-state', handler);
    return () => ipcRenderer.removeListener('window-state', handler);
  },

  /* Activity tracking */
  userActivity: () => ipcRenderer.invoke('user-activity'),
});
