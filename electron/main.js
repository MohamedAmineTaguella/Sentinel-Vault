const { app, BrowserWindow, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const store = require('./store');

let mainWindow = null;
let autoLockTimer = null;
let blurLockTimer = null;

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1280, sw),
    height: Math.min(820, sh - 40),
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#050510',
    show: false,
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => { mainWindow.show(); });

  mainWindow.on('blur', () => {
    if (blurLockTimer) clearTimeout(blurLockTimer);
    const result = store.getAutoLockTimeout();
    const timeout = result.success ? result.data : 300;
    if (timeout <= 0) return;
    blurLockTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isFocused()) {
        store.clearVaultKey();
        mainWindow.webContents.send('auto-lock');
      }
    }, timeout * 1000);
  });

  mainWindow.on('focus', () => {
    if (blurLockTimer) { clearTimeout(blurLockTimer); blurLockTimer = null; }
  });

  mainWindow.on('maximize', () => { mainWindow.webContents.send('window-state', 'maximized'); });
  mainWindow.on('unmaximize', () => { mainWindow.webContents.send('window-state', 'normal'); });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function resetAutoLock() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  const result = store.getAutoLockTimeout();
  const timeout = result.success ? result.data : 300;
  if (timeout <= 0) return;
  autoLockTimer = setTimeout(() => {
    if (mainWindow) {
      store.clearVaultKey();
      store.logActivity('autolock', 'Vault auto-locked');
      mainWindow.webContents.send('auto-lock');
    }
  }, timeout * 1000);
}

/* IPC Handlers */
function registerIpc() {
  ipcMain.handle('check-registered', () => store.isRegistered() ? { success: true } : { success: false });
  ipcMain.handle('get-user-list', () => ({ success: true, data: store.getUserList() }));
  ipcMain.handle('get-current-username', () => ({ success: true, data: store.getCurrentUsername() }));
  ipcMain.handle('register', (_, username, password) => store.register(username || '', password));
  ipcMain.handle('login', (_, username, password, totpCode) => store.login(username, password, totpCode));
  ipcMain.handle('delete-user', (_, username, password, totpCode) => store.deleteUser(username, password, totpCode));
  ipcMain.handle('verify-master', (_, password, totpCode) => store.verifyMaster(password, totpCode));
  ipcMain.handle('get-vault-key', () => ({ success: true, data: store.getVaultKey() }));
  ipcMain.handle('clear-vault-key', () => { store.clearVaultKey(); return { success: true }; });

  ipcMain.handle('fetch-entries', () => store.fetchEntries());
  ipcMain.handle('add-entry', (_, data) => store.addEntry(data));
  ipcMain.handle('update-entry', (_, id, data) => store.updateEntry(id, data));
  ipcMain.handle('delete-entry', (_, id) => store.deleteEntry(id));
  ipcMain.handle('touch-entry', (_, id) => store.touchEntry(id));

  ipcMain.handle('add-attachment', (_, entryId, name, mimeType, data) => store.addAttachment(entryId, name, mimeType, data));
  ipcMain.handle('get-attachment', (_, entryId, attId) => store.getAttachment(entryId, attId));
  ipcMain.handle('delete-attachment', (_, entryId, attId) => store.deleteAttachment(entryId, attId));

  ipcMain.handle('has-pin', () => ({ success: true, data: store.hasPin() }));
  ipcMain.handle('set-pin', (_, pin) => store.setPin(pin));
  ipcMain.handle('remove-pin', () => store.removePin());
  ipcMain.handle('unlock-with-pin', (_, pin) => store.unlockWithPin(pin));

  ipcMain.handle('is-biometric-available', () => ({ success: true, data: store.isBiometricAvailable() }));
  ipcMain.handle('is-biometric-enabled', () => ({ success: true, data: store.isBiometricEnabled() }));
  ipcMain.handle('set-biometric-enabled', (_, enabled) => store.setBiometricEnabled(enabled));
  ipcMain.handle('unlock-with-biometric', () => store.unlockWithBiometric());

  ipcMain.handle('set-category-password', (_, category, password) => store.setCategoryPassword(category, password));
  ipcMain.handle('remove-category-password', (_, category) => store.removeCategoryPassword(category));
  ipcMain.handle('is-category-locked', (_, category) => ({ success: true, data: store.isCategoryLocked(category) }));
  ipcMain.handle('unlock-category', (_, category, password) => store.unlockCategory(category, password));
  ipcMain.handle('get-locked-categories', () => store.getLockedCategories());

  ipcMain.handle('set-entry-password', (_, entryId, password) => store.setEntryPassword(entryId, password));
  ipcMain.handle('remove-entry-password', (_, entryId) => store.removeEntryPassword(entryId));
  ipcMain.handle('unlock-entry', (_, entryId, password) => store.unlockEntry(entryId, password));
  ipcMain.handle('is-entry-locked', (_, entryId) => ({ success: true, data: store.isEntryLocked(entryId) }));

  ipcMain.handle('setup-vault-2fa', () => store.setupVault2FA());
  ipcMain.handle('confirm-vault-2fa', (_, code) => store.confirmVault2FA(code));
  ipcMain.handle('disable-vault-2fa', (_, code) => store.disableVault2FA(code));
  ipcMain.handle('is-vault-2fa-enabled', () => ({ success: true, data: store.isVault2FAEnabled() }));

  ipcMain.handle('change-master-password', (_, oldPw, newPw, totpCode) => store.changeMasterPassword(oldPw, newPw, totpCode));
  ipcMain.handle('generate-security-report', () => store.generateSecurityReport());
  ipcMain.handle('get-activity-log', () => store.getActivityLog());
  ipcMain.handle('log-activity', (_, type, detail, entryId) => store.logActivity(type, detail, entryId));
  ipcMain.handle('clear-activity-log', () => store.clearActivityLog());

  ipcMain.handle('export-csv', () => store.exportCsv());
  ipcMain.handle('import-csv', (_, data) => store.importCsv(data));
  ipcMain.handle('export-vault', () => store.exportVault());
  ipcMain.handle('import-vault', (_, data) => store.importVault(data));

  ipcMain.handle('get-auto-lock-timeout', () => store.getAutoLockTimeout());
  ipcMain.handle('set-auto-lock-timeout', (_, seconds) => { store.setAutoLockTimeout(seconds); return { success: true }; });
  ipcMain.handle('get-launch-on-startup', () => store.getLaunchOnStartup());
  ipcMain.handle('set-launch-on-startup', (_, enabled) => store.setLaunchOnStartup(enabled));
  ipcMain.handle('get-username', () => store.getUsername());
  ipcMain.handle('set-username', (_, name) => store.setUsername(name));
  ipcMain.handle('get-remember-me', () => store.getRememberMe());
  ipcMain.handle('set-remember-me', (_, enabled) => store.setRememberMe(enabled));
  ipcMain.handle('get-theme', () => store.getTheme());
  ipcMain.handle('set-theme', (_, theme) => { store.setTheme(theme); return { success: true }; });
  ipcMain.handle('set-compact-view', (_, v) => store.setCompactView(v));
  ipcMain.handle('set-show-sidebar', (_, v) => store.setShowSidebar(v));
  ipcMain.handle('get-clipboard-auto-clear', () => store.getClipboardAutoClear());
  ipcMain.handle('set-clipboard-auto-clear', (_, seconds) => { store.setClipboardAutoClear(seconds); return { success: true }; });
  ipcMain.handle('get-settings', () => store.getSettings());
  ipcMain.handle('migrate-entry', (_, id) => store.migrateEntry(id));
  ipcMain.handle('wipe-all-data', () => store.wipeAllData());

  ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
    }
  });
  ipcMain.handle('close-window', () => { if (mainWindow) mainWindow.close(); });

  ipcMain.handle('user-activity', () => { resetAutoLock(); });
}

app.whenReady().then(() => {
  store.ensureDir();
  registerIpc();
  createWindow();
  resetAutoLock();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
