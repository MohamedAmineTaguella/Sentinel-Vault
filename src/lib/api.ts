import type { ElectronAPI, VaultEntry, ThemeAccent } from '../types';

const ipc = (window as any).electronAPI as ElectronAPI;

export const checkRegistered = () => ipc.checkRegistered();
export const getUserList = () => ipc.getUserList();
export const getCurrentUsername = () => ipc.getCurrentUsername();
export const register = (username: string, password: string) => ipc.register(username, password);
export const login = (username: string, password: string, totpCode?: string) => ipc.login(username, password, totpCode);
export const deleteUser = (username: string, password: string, totpCode?: string) => ipc.deleteUser(username, password, totpCode);
export const verifyMaster = (password: string, totpCode?: string) => ipc.verifyMaster(password, totpCode);
export const getVaultKey = () => ipc.getVaultKey();
export const clearVaultKey = () => ipc.clearVaultKey();

export const fetchEntries = () => ipc.fetchEntries();
export const addEntry = (data: Partial<VaultEntry>) => ipc.addEntry(data);
export const updateEntry = (id: string, data: Partial<VaultEntry>) => ipc.updateEntry(id, data);
export const deleteEntry = (id: string) => ipc.deleteEntry(id);
export const touchEntry = (id: string) => ipc.touchEntry(id);

export const addAttachment = (entryId: string, name: string, mimeType: string, data: Uint8Array) => ipc.addAttachment(entryId, name, mimeType, data);
export const getAttachment = (entryId: string, attId: string) => ipc.getAttachment(entryId, attId);
export const deleteAttachment = (entryId: string, attId: string) => ipc.deleteAttachment(entryId, attId);

export const hasPin = () => ipc.hasPin();
export const setPin = (pin: string) => ipc.setPin(pin);
export const removePin = () => ipc.removePin();
export const unlockWithPin = (pin: string) => ipc.unlockWithPin(pin);

export const isBiometricAvailable = () => ipc.isBiometricAvailable();
export const isBiometricEnabled = () => ipc.isBiometricEnabled();
export const setBiometricEnabled = (enabled: boolean) => ipc.setBiometricEnabled(enabled);
export const unlockWithBiometric = () => ipc.unlockWithBiometric();

export const setCategoryPassword = (category: string, password: string) => ipc.setCategoryPassword(category, password);
export const removeCategoryPassword = (category: string) => ipc.removeCategoryPassword(category);
export const isCategoryLocked = (category: string) => ipc.isCategoryLocked(category);
export const unlockCategory = (category: string, password: string) => ipc.unlockCategory(category, password);
export const getLockedCategories = () => ipc.getLockedCategories();

export const setEntryPassword = (entryId: string, password: string) => ipc.setEntryPassword(entryId, password);
export const removeEntryPassword = (entryId: string) => ipc.removeEntryPassword(entryId);
export const unlockEntry = (entryId: string, password: string) => ipc.unlockEntry(entryId, password);
export const isEntryLocked = (entryId: string) => ipc.isEntryLocked(entryId);

export const setupVault2FA = () => ipc.setupVault2FA();
export const confirmVault2FA = (code: string) => ipc.confirmVault2FA(code);
export const disableVault2FA = (code: string) => ipc.disableVault2FA(code);
export const isVault2FAEnabled = () => ipc.isVault2FAEnabled();

export const changeMasterPassword = (oldPassword: string, newPassword: string, totpCode?: string) => ipc.changeMasterPassword(oldPassword, newPassword, totpCode);
export const generateSecurityReport = () => ipc.generateSecurityReport();
export const getActivityLog = () => ipc.getActivityLog();
export const logActivity = (type: string, detail: string, entryId?: string) => ipc.logActivity(type, detail, entryId);
export const clearActivityLog = () => ipc.clearActivityLog();

export const exportCsv = () => ipc.exportCsv();
export const importCsv = (data: string) => ipc.importCsv(data);
export const exportVault = () => ipc.exportVault();
export const importVault = (data: string) => ipc.importVault(data);

export const getAutoLockTimeout = () => ipc.getAutoLockTimeout();
export const setAutoLockTimeout = (seconds: number) => ipc.setAutoLockTimeout(seconds);
export const getLaunchOnStartup = () => ipc.getLaunchOnStartup();
export const setLaunchOnStartup = (enabled: boolean) => ipc.setLaunchOnStartup(enabled);
export const getUsername = () => ipc.getUsername();
export const setUsername = (name: string) => ipc.setUsername(name);
export const getRememberMe = () => ipc.getRememberMe();
export const setRememberMe = (enabled: boolean) => ipc.setRememberMe(enabled);
export const getTheme = () => ipc.getTheme();
export const setTheme = (theme: ThemeAccent) => ipc.setTheme(theme);
export const getClipboardAutoClear = () => ipc.getClipboardAutoClear();
export const setClipboardAutoClear = (seconds: number) => ipc.setClipboardAutoClear(seconds);
export const setCompactView = (v: boolean) => ipc.setCompactView(v);
export const setShowSidebar = (v: boolean) => ipc.setShowSidebar(v);
export const getSettings = () => ipc.getSettings();
export const migrateEntry = (id: string) => ipc.migrateEntry(id);
export const wipeAllData = () => ipc.wipeAllData();

export const minimizeWindow = () => ipc.minimizeWindow();
export const maximizeWindow = () => ipc.maximizeWindow();
export const closeWindow = () => ipc.closeWindow();

export const onAutoLock = (callback: () => void) => ipc.onAutoLock(callback);
export const onWindowState = (callback: (state: string) => void) => ipc.onWindowState(callback);
export const userActivity = () => ipc.userActivity();

export const logUI = (type: string, detail: string, entryId?: string) => {
  logActivity(type, detail, entryId).catch(() => {});
};
