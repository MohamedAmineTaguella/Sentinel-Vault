import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { VaultEntry, AttachmentMeta, SecurityReport, ActivityEntry, ThemeAccent } from '../types';
import { ENTRY_TYPE_LABELS, ENTRY_TYPE_FIELDS, CATEGORIES, ENTRY_TYPE_ICONS, ENTRY_COLORS, THEME_PALETTES, type EntryType } from '../types';
import * as api from '../lib/api';
import { useToast } from './Toast';
import { useModal, useTheme } from './Modal';
import SearchBar from './SearchBar';
import PasswordGenerator from './PasswordGenerator';
import CommandPalette from './CommandPalette';
import AddEntryModal from './AddEntryModal';
import EntryDetailPanel from './EntryDetailPanel';
import TitleBar from './TitleBar';
import { checkStrength, strengthColor, strengthLabel, isBreached } from '../lib/strength';
import { generateTOTP } from '../lib/totp';
import QRCode from 'qrcode';

interface Props { onLock: () => void; username: string; }

const categories = ['All', ...CATEGORIES];

export default function VaultDashboard({ onLock, username }: Props) {
  const { toast } = useToast();
  const { confirm, prompt, alert } = useModal();
  const { theme, setTheme } = useTheme();
  const palette = THEME_PALETTES[theme];

  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
const [compactView, setCompactViewState] = useState(false);
const [showSidebar, setShowSidebarState] = useState(true);
const handleSetCompactView = useCallback((v: boolean) => { setCompactViewState(v); api.setCompactView(v).catch(() => {}); }, []);
const handleSetShowSidebar = useCallback((v: boolean) => { setShowSidebarState(v); api.setShowSidebar(v).catch(() => {}); }, []);
  const [sortBy, setSortBy] = useState<string>('updatedAt');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: VaultEntry } | null>(null);
  const [importText, setImportText] = useState('');
  const [importType, setImportType] = useState<'vault' | 'csv'>('vault');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [vault2FA, setVault2FA] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unlockedCategories = useRef<Set<string>>(new Set());
  const unlockedEntries = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const clipboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Settings modal state */
  const [settingsTab, setSettingsTab] = useState<'general' | 'security' | 'appearance' | 'categories' | 'about'>('general');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [autoLockTimeout, setAutoLockTimeout] = useState(300);
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [categoryPasswordInput, setCategoryPasswordInput] = useState('');
  const [selectedCategoryForPassword, setSelectedCategoryForPassword] = useState('');
  const [pinSet, setPinSet] = useState(false);
  const [clipboardAutoClear, setClipboardAutoClear] = useState(30);

  const selectedEntry = useMemo(() => entries.find((e) => e.id === selectedId) || null, [entries, selectedId]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const result = await api.fetchEntries();
    if (result.success) setEntries(result.data || []);
    else toast('Failed to load entries', 'error');
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    api.hasPin().then((r) => { if (r.success) setPinSet(r.data); }).catch(() => {});
    api.getAutoLockTimeout().then((r) => { if (r.success) setAutoLockTimeout(r.data); }).catch(() => {});
    api.getLaunchOnStartup().then((r) => { if (r.success) setLaunchOnStartup(r.data); }).catch(() => {});
    api.isBiometricEnabled().then((r) => { if (r.success) setBiometricEnabled(r.data); }).catch(() => {});
    api.isVault2FAEnabled().then((r) => { if (r.success) setVault2FA(r.data); }).catch(() => {});
    api.getClipboardAutoClear().then((r) => { if (r.success) setClipboardAutoClear(r.data); }).catch(() => {});
    /* Onboarding check */
    const seen = localStorage.getItem('sv-onboarded');
    if (!seen) { setShowOnboarding(true); localStorage.setItem('sv-onboarded', '1'); }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const report = () => { clearTimeout(timer); timer = setTimeout(() => api.userActivity(), 800); };
    window.addEventListener('mousemove', report);
    window.addEventListener('keydown', report);
    window.addEventListener('click', report);
    window.addEventListener('scroll', report);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', report);
      window.removeEventListener('keydown', report);
      window.removeEventListener('click', report);
      window.removeEventListener('scroll', report);
    };
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [showDropdown]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const isInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setShowAddModal(true); return; }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); onLock(); return; }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); setShowPalette(true); return; }
      if (e.ctrlKey && e.key === 'g') { e.preventDefault(); setShowGenerator(true); return; }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShowShortcuts((v) => !v); return; }
      if (e.key === 'Escape') {
        if (ctxMenu) { setCtxMenu(null); return; }
        if (selectedId) { setSelectedId(null); return; }
        if (showPalette) { setShowPalette(false); return; }
        if (showAddModal || editingEntry) { setShowAddModal(false); setEditingEntry(null); return; }
        if (showSettings) { setShowSettings(false); return; }
        if (showReport) { setShowReport(false); return; }
        if (showActivity) { setShowActivity(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (show2FASetup) { setShow2FASetup(false); return; }
        if (showImport) { setShowImport(false); return; }
        if (showOnboarding) { setShowOnboarding(false); return; }
      }
      if (e.key === 'Delete' && selectedId && !isInput) {
        const entry = entries.find((en) => en.id === selectedId);
        if (entry) handleDelete(entry);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, ctxMenu, showPalette, showAddModal, editingEntry, showSettings, showReport, entries, onLock, showActivity, showShortcuts, show2FASetup, showImport, showOnboarding]);

  useEffect(() => { if (!ctxMenu) return; const h = () => setCtxMenu(null); window.addEventListener('click', h); return () => window.removeEventListener('click', h); }, [ctxMenu]);

  /* Cleanup clipboard timer on unmount */
  useEffect(() => () => { if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current); }, []);

  /* Clipboard auto-clear */
  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copied ${label}`, 'success', 2000);
      api.logUI('copy', `Copied ${label}`);
      if (clipboardAutoClear > 0) {
        if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
        clipboardTimerRef.current = setTimeout(async () => {
          try { const current = await navigator.clipboard.readText(); if (current === text) { await navigator.clipboard.writeText(''); toast('Clipboard cleared for security', 'info', 2000); } } catch {}
        }, clipboardAutoClear * 1000);
      }
    } catch { toast('Failed to copy', 'error'); }
  }, [toast, clipboardAutoClear]);

  const handleSaveEntry = useCallback(async (entryData: Partial<VaultEntry>) => {
    /* Pull out transient lock fields — never store these in the entry */
    const newLockPwd = entryData.entryLockPassword;
    const removeLock = entryData.removeEntryLock;
    const cleanData: Partial<VaultEntry> = { ...entryData };
    delete cleanData.entryLockPassword;
    delete cleanData.removeEntryLock;
    delete cleanData.entryPasswordHash;

    if (editingEntry) {
      const result = await api.updateEntry(editingEntry.id, cleanData);
      if (result.success) {
        if (newLockPwd) {
          const lockResult = await api.setEntryPassword(editingEntry.id, newLockPwd);
          if (!lockResult.success) { toast(lockResult.error || 'Failed to set entry lock', 'error'); return; }
        } else if (removeLock) {
          await api.removeEntryPassword(editingEntry.id);
        }
        toast('Entry updated', 'success'); setEditingEntry(null); fetchEntries();
      } else toast(result.error || 'Failed to update', 'error');
    } else {
      const result = await api.addEntry(cleanData);
      if (result.success) {
        const newId = result.data!.id;
        if (newLockPwd) {
          const lockResult = await api.setEntryPassword(newId, newLockPwd);
          if (!lockResult.success) { toast(lockResult.error || 'Failed to set entry lock', 'error'); return; }
        }
        toast('Entry added', 'success'); setShowAddModal(false); fetchEntries();
      } else toast(result.error || 'Failed to add entry', 'error');
    }
  }, [editingEntry, fetchEntries, toast]);

  const handleDelete = useCallback(async (entry: VaultEntry) => {
    const ok = await confirm({ title: 'Delete entry', message: `Delete "${entry.name}"? This cannot be undone.`, confirmText: 'Delete', danger: true, icon: 'trash' });
    if (!ok) return;
    const result = await api.deleteEntry(entry.id);
    if (result.success) { toast('Entry deleted', 'info'); if (selectedId === entry.id) setSelectedId(null); fetchEntries(); }
    else toast(result.error || 'Failed to delete', 'error');
  }, [selectedId, fetchEntries, toast, confirm]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const result = await api.updateEntry(id, { favorite: !entry.favorite });
    if (result.success) { fetchEntries(); toast(entry.favorite ? 'Removed from favorites' : 'Added to favorites', 'info', 1500); }
    else toast(result.error || 'Failed to update', 'error');
  }, [entries, fetchEntries, toast]);

  const handleDuplicate = useCallback(async (entry: VaultEntry) => {
    const result = await api.addEntry({ ...entry, id: undefined, name: `${entry.name} (copy)`, createdAt: undefined, updatedAt: undefined });
    if (result.success) { toast('Entry duplicated', 'success'); fetchEntries(); }
    else toast(result.error || 'Failed to duplicate', 'error');
  }, [fetchEntries, toast]);

  const handleAttach = useCallback(async (entryId: string, files?: FileList) => {
    const processFiles = async (fl: FileList) => {
      for (const file of Array.from(fl)) {
        if (file.size > 50 * 1024 * 1024) { toast(`${file.name} exceeds 50MB limit`, 'error'); continue; }
        const buf = await file.arrayBuffer();
        const r = await api.addAttachment(entryId, file.name, file.type, new Uint8Array(buf));
        if (!r.success) toast(r.error || 'Failed to attach', 'error');
      }
      toast('Files attached', 'success'); fetchEntries();
    };
    if (!files || files.length === 0) {
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = true;
      input.onchange = () => { if (input.files) processFiles(input.files); };
      input.click();
    } else {
      processFiles(files);
    }
  }, [fetchEntries, toast]);

  const handleDownload = useCallback(async (entryId: string, att: AttachmentMeta) => {
    const r = await api.getAttachment(entryId, att.id);
    if (!r.success || !r.data) { toast('Failed to download', 'error'); return; }
    const blob = new Blob([new Uint8Array(r.data)], { type: att.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = att.name; a.click();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${att.name}`, 'success', 1500);
  }, [toast]);

  const handleDeleteAttachment = useCallback(async (entryId: string, attId: string) => {
    const ok = await confirm({ title: 'Delete attachment', message: 'Delete this attachment permanently?', confirmText: 'Delete', danger: true, icon: 'trash' });
    if (!ok) return;
    const r = await api.deleteAttachment(entryId, attId);
    if (r.success) { toast('Attachment deleted', 'info'); fetchEntries(); }
    else toast(r.error || 'Failed to delete', 'error');
  }, [fetchEntries, toast, confirm]);

  const handleContextMenu = (e: React.MouseEvent, entry: VaultEntry) => {
    e.preventDefault();
    const menuW = 200, menuH = 400;
    setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - menuW), y: Math.min(e.clientY, window.innerHeight - menuH), entry });
  };

  const handleGenerateReport = useCallback(async () => {
    setReportLoading(true);
    const r = await api.generateSecurityReport();
    if (r.success && r.data) { setSecurityReport(r.data); setShowReport(true); }
    else toast(r.error || 'Failed to generate report', 'error');
    setReportLoading(false);
  }, [toast]);

  const handleLoadActivity = useCallback(async () => {
    const r = await api.getActivityLog();
    if (r.success && r.data) { setActivityLog(r.data); setShowActivity(true); }
  }, []);

  const handleClearActivity = useCallback(async () => {
    const ok = await confirm({ title: 'Clear activity log', message: 'Erase all activity history?', confirmText: 'Clear', danger: true });
    if (!ok) return;
    await api.clearActivityLog();
    setActivityLog([]);
    toast('Activity log cleared', 'info');
  }, [confirm, toast]);

  const loadSettings = useCallback(async () => {
    const s = await api.getSettings();
    if (s.success && s.data) {
      setAutoLockTimeout(s.data.autoLockTimeout);
      setLaunchOnStartup(s.data.launchOnStartup);
      setBiometricEnabled(s.data.biometricEnabled);
      setClipboardAutoClear(s.data.clipboardAutoClearSeconds);
      if (s.data.compactView !== undefined) setCompactViewState(s.data.compactView);
      if (s.data.showSidebar !== undefined) setShowSidebarState(s.data.showSidebar);
    }
  }, []);
  useEffect(() => { if (showSettings) loadSettings(); }, [showSettings, loadSettings]);

  const handleChangePassword = useCallback(async (totpCode?: string) => {
    if (!oldPassword || !newPassword) { toast('Fill in all fields', 'error'); return; }
    if (newPassword.length < 8) { toast('New password must be 8+ chars', 'error'); return; }
    const r = await api.changeMasterPassword(oldPassword, newPassword, totpCode);
    if (r.success) { toast('Master password changed', 'success'); setOldPassword(''); setNewPassword(''); }
    else if (r.requires2fa) {
      const code = await prompt({ title: 'Authenticator required', message: 'Enter the 6-digit code from your authenticator app', placeholder: '000 000', validate: (v) => v.length < 6 ? 'Enter 6 digits' : null });
      if (code) handleChangePassword(code);
    }
    else toast(r.error || 'Failed', 'error');
  }, [oldPassword, newPassword, toast, prompt]);

  const handleSetPin = useCallback(async () => {
    if (!newPin || newPin !== confirmPin) { toast('PINs do not match', 'error'); return; }
    if (newPin.length < 4) { toast('PIN must be 4+ digits', 'error'); return; }
    const r = await api.setPin(newPin);
    if (r.success) { toast('PIN set', 'success'); setNewPin(''); setConfirmPin(''); setPinSet(true); }
    else toast(r.error || 'Failed', 'error');
  }, [newPin, confirmPin, toast]);

  const handleRemovePin = useCallback(async () => {
    const ok = await confirm({ title: 'Remove PIN', message: 'You will no longer be able to use PIN unlock.', confirmText: 'Remove', danger: true });
    if (!ok) return;
    const r = await api.removePin();
    if (r.success) { toast('PIN removed', 'success'); setPinSet(false); }
    else toast(r.error || 'Failed', 'error');
  }, [confirm, toast]);

  const handleAutoLockChange = useCallback(async (seconds: number) => {
    setAutoLockTimeout(seconds);
    await api.setAutoLockTimeout(seconds);
    toast(`Auto-lock set to ${seconds === 0 ? 'never' : seconds / 60 + ' min'}`, 'info', 1500);
  }, [toast]);

  const handleStartupToggle = useCallback(async () => {
    const nv = !launchOnStartup; setLaunchOnStartup(nv);
    const r = await api.setLaunchOnStartup(nv);
    if (!r.success) { setLaunchOnStartup(!nv); toast(r.error || 'Failed', 'error'); }
  }, [launchOnStartup, toast]);

  const handleBiometricToggle = useCallback(async () => {
    const nv = !biometricEnabled; setBiometricEnabled(nv);
    const r = await api.setBiometricEnabled(nv);
    if (!r.success) { setBiometricEnabled(!nv); toast(r.error || 'Failed', 'error'); }
    else { nv ? toast('Biometric enabled', 'success') : toast('Biometric disabled', 'info'); }
  }, [biometricEnabled, toast]);

  const handleSetCategoryPassword = useCallback(async () => {
    if (!selectedCategoryForPassword || !categoryPasswordInput) { toast('Select category and enter password', 'error'); return; }
    const r = await api.setCategoryPassword(selectedCategoryForPassword, categoryPasswordInput);
    if (r.success) { toast(`Password set for ${selectedCategoryForPassword}`, 'success'); setCategoryPasswordInput(''); setTick(t => t + 1); }
    else toast(r.error || 'Failed', 'error');
  }, [selectedCategoryForPassword, categoryPasswordInput, toast]);

  const handleRemoveCategoryPassword = useCallback(async (cat: string) => {
    const ok = await confirm({ title: 'Remove category password', message: `Remove password protection from "${cat}"?`, confirmText: 'Remove', danger: true });
    if (!ok) return;
    const r = await api.removeCategoryPassword(cat);
    if (r.success) { toast('Category unlocked permanently', 'success'); setTick(t => t + 1); }
    else toast(r.error || 'Failed', 'error');
  }, [confirm, toast]);

  const handleUnlockCategory = useCallback(async (cat: string, password: string) => {
    const r = await api.unlockCategory(cat, password);
    if (r.success) { unlockedCategories.current.add(cat); toast(`${cat} unlocked`, 'success', 1500); setTick(t => t + 1); fetchEntries(); }
    else toast(r.error || 'Wrong password', 'error');
  }, [fetchEntries, toast]);

  const handleUnlockCategoryPrompt = async (cat: string) => {
    const pw = await prompt({ title: `Unlock ${cat}`, placeholder: 'Category password', password: true });
    if (pw) handleUnlockCategory(cat, pw);
  };

  const handleSetEntryLock = useCallback(async (entryId: string, password: string) => {
    if (!password || password.length < 4) { toast('Password must be 4+ characters', 'error'); return; }
    const r = await api.setEntryPassword(entryId, password);
    if (r.success) { toast('Entry locked', 'success'); fetchEntries(); }
    else toast(r.error || 'Failed', 'error');
  }, [fetchEntries, toast]);

  const handleRemoveEntryLock = useCallback(async (entryId: string) => {
    const ok = await confirm({ title: 'Remove entry lock', message: 'Anyone with the vault unlocked will be able to view this entry.', confirmText: 'Remove', danger: true });
    if (!ok) return;
    const r = await api.removeEntryPassword(entryId);
    if (r.success) { toast('Entry unlocked', 'info'); fetchEntries(); }
    else toast(r.error || 'Failed', 'error');
  }, [confirm, toast, fetchEntries]);

  const handleThemeChange = useCallback(async (t: ThemeAccent) => {
    setTheme(t);
    await api.setTheme(t);
  }, [setTheme]);

  const handleClipboardAutoClear = useCallback(async (seconds: number) => {
    setClipboardAutoClear(seconds);
    await api.setClipboardAutoClear(seconds);
  }, []);

  const handleExport = useCallback(async () => {
    const r = await api.exportVault();
    if (r.success && r.data) {
      const blob = new Blob([r.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `sentinel-vault-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      toast('Vault exported', 'success');
      api.logUI('export', 'Exported vault');
    } else toast(r.error || 'Failed', 'error');
  }, [toast]);

  const handleExportCsv = useCallback(async () => {
    const r = await api.exportCsv();
    if (r.success && r.data) {
      const blob = new Blob([r.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `sentinel-vault-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast('CSV exported', 'success');
    } else toast(r.error || 'Failed', 'error');
  }, [toast]);

  const handleImport = useCallback(async () => {
    if (!importText) { toast('Paste data first', 'error'); return; }
    const r = importType === 'vault' ? await api.importVault(importText) : await api.importCsv(importText);
    if (r.success) { toast(`Imported ${r.data} entries`, 'success'); setShowImport(false); setImportText(''); fetchEntries(); }
    else toast(r.error || 'Import failed', 'error');
  }, [importText, importType, fetchEntries, toast]);

  const handleWipe = useCallback(async () => {
    const phrase = await prompt({ title: 'Wipe all vault data', message: 'This will permanently delete ALL entries, attachments, and the master password. Type "DELETE" to confirm.', placeholder: 'Type DELETE', validate: (v) => v !== 'DELETE' ? 'Type DELETE exactly' : null });
    if (phrase !== 'DELETE') return;
    const r = await api.wipeAllData();
    if (r.success) { toast('All data wiped — restarting...', 'info'); setTimeout(() => window.location.reload(), 1500); }
  }, [prompt, toast]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (showFavorites) list = list.filter((e) => e.favorite);
    if (showLocked) list = list.filter((e) => !!e.entryPasswordHash && !unlockedEntries.current.has(e.id));
    if (categoryFilter !== 'All') list = list.filter((e) => (e.category || 'Other') === categoryFilter);
    if (typeFilter !== 'all') list = list.filter((e) => (e.type || 'password') === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q) || Object.values(e.fields || {}).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)) || (e.tags || []).some((t) => t.toLowerCase().includes(q)));
    }
    list = [...list];
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'category') list.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    else if (sortBy === 'created') list.sort((a, b) => b.createdAt - a.createdAt);
    else list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [entries, search, categoryFilter, typeFilter, showFavorites, showLocked, sortBy]);

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = { All: entries.length };
    entries.forEach((e) => { const c = e.category || 'Other'; m[c] = (m[c] || 0) + 1; });
    return m;
  }, [entries]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = { all: entries.length };
    entries.forEach((e) => { const t = e.type || 'password'; m[t] = (m[t] || 0) + 1; });
    return m;
  }, [entries]);

  const recentEntries = useMemo(() => {
    return [...entries].filter((e) => e.lastUsedAt).sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0)).slice(0, 5);
  }, [entries]);

  const favoriteEntries = useMemo(() => entries.filter((e) => e.favorite).slice(0, 5), [entries]);

  const totals = useMemo(() => {
    return {
      total: entries.length,
      favorites: entries.filter((e) => e.favorite).length,
      withAttachments: entries.filter((e) => e.attachments && e.attachments.length > 0).length,
      with2FA: entries.filter((e) => e.twofa).length,
    };
  }, [entries]);

  return (
    <div className="h-screen w-screen flex flex-col select-none" style={{ background: '#050510' }}>
      <TitleBar />
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 0% 0%, ${palette.glow} 0%, transparent 50%)` }} />
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      {/* Sidebar */}
      {showSidebar && (
        <div className="w-60 shrink-0 border-r border-white/5 flex flex-col bg-[#0a0a14]/40 backdrop-blur-xl relative z-10">
          <div className="p-4 border-b border-white/5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }}>
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white tracking-tight">Sentinel</div>
              <div className="text-[10px] text-white/30 truncate">Welcome, {username}</div>
            </div>
            <button onClick={() => handleSetShowSidebar(false)} className="btn-ghost p-1" title="Hide sidebar">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            <div>
              <div className="text-[9px] text-white/25 uppercase tracking-wider px-2 mb-1.5">Quick</div>
              <div className="space-y-0.5">
                <div className={`nav-item ${!showFavorites && !showLocked && categoryFilter === 'All' && typeFilter === 'all' ? 'active' : ''}`} onClick={() => { setCategoryFilter('All'); setTypeFilter('all'); setShowFavorites(false); setShowLocked(false); }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                  All Items
                  <span className="ml-auto text-[10px] text-white/30 mono">{totals.total}</span>
                </div>
                <div className={`nav-item ${showFavorites ? 'active' : ''}`} onClick={() => setShowFavorites(!showFavorites)}>
                  <svg className="w-3.5 h-3.5" fill={showFavorites ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                  Favorites
                  <span className="ml-auto text-[10px] text-white/30 mono">{totals.favorites}</span>
                </div>
                <div className={`nav-item ${showLocked ? 'active' : ''}`} onClick={() => setShowLocked(!showLocked)}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Locked Entries
                </div>
              </div>
            </div>

            <div>
              <div className="text-[9px] text-white/25 uppercase tracking-wider px-2 mb-1.5">Categories</div>
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {CATEGORIES.map((c) => (
                  <div key={c} className={`nav-item ${categoryFilter === c ? 'active' : ''}`} onClick={() => setCategoryFilter(categoryFilter === c ? 'All' : c)}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: ENTRY_COLORS[CATEGORIES.indexOf(c) % ENTRY_COLORS.length].gradient.replace('from-', '').replace(' to-', ',').split(' ')[0] }} />
                    {c}
                    <span className="ml-auto text-[10px] text-white/30 mono">{categoryCounts[c] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {recentEntries.length > 0 && (
              <div>
                <div className="text-[9px] text-white/25 uppercase tracking-wider px-2 mb-1.5">Recent</div>
                <div className="space-y-0.5">
                  {recentEntries.map((e) => (
                    <div key={e.id} className="nav-item" onClick={() => setSelectedId(e.id)}>
                      <span className="text-xs">{ENTRY_TYPE_ICONS[e.type || 'password']}</span>
                      <span className="truncate">{e.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {favoriteEntries.length > 0 && (
              <div>
                <div className="text-[9px] text-white/25 uppercase tracking-wider px-2 mb-1.5">Favorites</div>
                <div className="space-y-0.5">
                  {favoriteEntries.map((e) => (
                    <div key={e.id} className="nav-item" onClick={() => setSelectedId(e.id)}>
                      <span className="text-xs">{ENTRY_TYPE_ICONS[e.type || 'password']}</span>
                      <span className="truncate">{e.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-white/5">
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="p-1.5 rounded-lg bg-white/[0.02]"><div className="text-sm font-semibold text-white stat-number">{totals.total}</div><div className="text-[8px] text-white/30">Total</div></div>
              <div className="p-1.5 rounded-lg bg-white/[0.02]"><div className="text-sm font-semibold text-amber-400 stat-number">{totals.favorites}</div><div className="text-[8px] text-white/30">Fav</div></div>
              <div className="p-1.5 rounded-lg bg-white/[0.02]"><div className="text-sm font-semibold text-emerald-400 stat-number">{totals.with2FA}</div><div className="text-[8px] text-white/30">2FA</div></div>
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0 bg-[#0a0a14]/60 backdrop-blur-xl">
          {!showSidebar && (
            <button onClick={() => handleSetShowSidebar(true)} className="btn-ghost p-1.5" title="Show sidebar">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" /></svg>
            </button>
          )}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }}>
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          </div>

          <SearchBar
            ref={searchRef}
            value={search}
            onChange={setSearch}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            categories={categories}
            categoryCounts={categoryCounts}
            showFavorites={showFavorites}
            onToggleFavorites={() => setShowFavorites((p) => !p)}
            onAdd={() => setShowAddModal(true)}
          />

          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setShowActivity(true)} onMouseEnter={handleLoadActivity} className="btn-ghost p-2 rounded-lg text-white/30 hover:text-white/60" title="Activity log">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button onClick={handleGenerateReport} className={`btn-ghost p-2 rounded-lg ${reportLoading ? 'text-amber-400' : 'text-white/30'} hover:text-amber-400`} title="Security report">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            </button>
            <button onClick={() => setShowGenerator(true)} className="btn-ghost p-2 rounded-lg text-white/30 hover:text-white/60" title="Password generator (Ctrl+G)">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
            </button>
            <button onClick={() => setShowSettings(true)} className="btn-ghost p-2 rounded-lg text-white/30 hover:text-white/60" title="Settings">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <div className="w-px h-6 bg-white/5 mx-1" />
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setShowDropdown(!showDropdown)} className="btn-ghost p-1 rounded-lg text-white/40 hover:text-white/70 flex items-center gap-1.5" title="Account">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }}>
                  {username.charAt(0).toUpperCase()}
                </div>
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 p-1.5 rounded-xl glass-premium border border-white/10 shadow-2xl animate-scale-in z-50">
                  <div className="px-3 py-2.5 text-xs text-white/60 border-b border-white/5 mb-1 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }}>{username.charAt(0).toUpperCase()}</div>
                    <div className="truncate">{username}</div>
                  </div>
                  <button onClick={() => { setShowActivity(true); setShowDropdown(false); }} className="w-full px-3 py-2 text-xs text-left text-white/60 hover:text-white/90 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Activity Log
                  </button>
                  <button onClick={() => { setShow2FASetup(true); setShowDropdown(false); }} className="w-full px-3 py-2 text-xs text-left text-white/60 hover:text-white/90 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
                    {vault2FA ? 'Manage 2FA' : 'Enable Authenticator'}
                    {vault2FA && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </button>
                  <button onClick={() => { setShowSettings(true); setShowDropdown(false); }} className="w-full px-3 py-2 text-xs text-left text-white/60 hover:text-white/90 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Settings
                  </button>
                  <div className="h-px bg-white/5 my-1" />
                  <button onClick={() => { setShowDropdown(false); api.clearVaultKey().then(() => window.location.reload()).catch(() => window.location.reload()); }} className="w-full px-3 py-2 text-xs text-left text-white/60 hover:text-white/90 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                    Switch user
                  </button>
                  <button onClick={onLock} className="w-full px-3 py-2 text-xs text-left text-rose-400/70 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                    Lock Vault
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Type filter chips */}
        {entries.length > 0 && (
          <div className="px-5 py-2 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto bg-[#0a0a14]/30">
            <button onClick={() => setTypeFilter('all')} className={`tab-pill ${typeFilter === 'all' ? 'active' : ''}`}>
              All <span className="ml-1 text-[9px] text-white/30 mono">{typeCounts.all}</span>
            </button>
            {(['password', 'card', 'note', 'api', 'identity', 'license', 'ssh', 'wallet', 'database'] as EntryType[]).map((t) => {
              if (!typeCounts[t]) return null;
              return (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)} className={`tab-pill ${typeFilter === t ? 'active' : ''}`}>
                  <span className="mr-1">{ENTRY_TYPE_ICONS[t]}</span>{ENTRY_TYPE_LABELS[t]}<span className="ml-1 text-[9px] text-white/30 mono">{typeCounts[t]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-white/5 glass-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg skeleton" />
                      <div><div className="w-24 h-3 rounded skeleton mb-1.5" /><div className="w-16 h-2 rounded skeleton" /></div>
                    </div>
                  </div>
                  <div className="w-full h-1 rounded skeleton mb-2" />
                  <div className="w-12 h-2 rounded skeleton" />
                </div>
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full animate-pulse-glow" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`, opacity: 0.2 }} />
                <div className="relative w-24 h-24 rounded-full flex items-center justify-center border border-white/10 bg-white/[0.02]">
                  <svg className="w-12 h-12 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
              </div>
              <p className="text-base font-medium text-white/50">{entries.length === 0 ? 'Your vault is empty' : 'No matching entries'}</p>
              <p className="text-xs mt-1.5 text-white/25">{entries.length === 0 ? 'Create your first secure entry to get started' : 'Try a different search or filter'}</p>
              {entries.length === 0 && (
                <button onClick={() => setShowAddModal(true)} className="btn-primary mt-6 h-10 px-5 text-sm font-semibold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add First Entry
                </button>
              )}
            </div>
          ) : compactView ? (
            <div className="space-y-0.5">
              {filteredEntries.map((entry) => {
                const isStale = entry.updatedAt && Date.now() - entry.updatedAt > 90 * 24 * 60 * 60 * 1000;
                return (
                <div key={entry.id} onClick={() => setSelectedId(entry.id === selectedId ? null : entry.id)} onContextMenu={(e) => handleContextMenu(e, entry)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all group ${entry.id === selectedId ? 'border' : 'border border-transparent hover:border-white/5 hover:bg-white/[0.02]'}`}
                  style={entry.id === selectedId ? { background: `${palette.glow}`, borderColor: palette.ring } : {}}>
                  <span className="text-sm">{entry.entryPasswordHash && !unlockedEntries.current.has(entry.id) ? '🔒' : ENTRY_TYPE_ICONS[entry.type || 'password']}</span>
                  <span className="text-sm text-white/80 flex-1 truncate">{entry.name}</span>
                  {isStale && <span className="text-[9px] text-amber-400/60 flex items-center gap-0.5"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> stale</span>}
                  {entry.color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ENTRY_COLORS.find((c) => c.value === entry.color)?.gradient.includes('indigo') ? '#6366f1' : entry.color === 'rose' ? '#f43f5e' : entry.color === 'emerald' ? '#10b981' : entry.color === 'amber' ? '#f59e0b' : entry.color === 'cyan' ? '#06b6d4' : entry.color === 'violet' ? '#8b5cf6' : '#ec4899' }} />}
                  <span className="text-[10px] text-white/30">{entry.category}</span>
                  {entry.favorite && <span className="text-amber-400 text-xs">★</span>}
                  <span className="text-[10px] text-white/25 mono" title={entry.lastUsedAt ? `Last used: ${new Date(entry.lastUsedAt).toLocaleDateString()}` : ''}>{new Date(entry.updatedAt).toLocaleDateString()}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {(entry.fields?.password || entry.fields?.apiKey) && (
                      <button onClick={(e) => { e.stopPropagation(); handleCopy(entry.fields?.password || entry.fields?.apiKey || '', 'password'); }} className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 hover:bg-white/10 text-white/40 hover:text-white-70 transition-all">Copy</button>
                    )}
                  </div>
                </div>
              );})}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredEntries.map((entry) => {
                const pwField = entry.fields?.password || entry.fields?.apiKey || entry.fields?.cardNumber || entry.fields?.productKey || entry.fields?.seedPhrase || '';
                const s = pwField ? checkStrength(pwField).score : 0;
                const breached = pwField ? isBreached(pwField) : false;
                const isLocked = entry.category && !unlockedCategories.current.has(entry.category);
                const isEntryLockActive = !!entry.entryPasswordHash && !unlockedEntries.current.has(entry.id);
                const colorVal = entry.color ? ENTRY_COLORS.find((c) => c.value === entry.color) : null;
                return (
                  <div key={entry.id} onClick={() => { if (isLocked) handleUnlockCategoryPrompt(entry.category || ''); else setSelectedId(entry.id === selectedId ? null : entry.id); }} onContextMenu={(e) => handleContextMenu(e, entry)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 group entry-card ${entry.id === selectedId ? 'shadow-lg' : 'glass-card hover:-translate-y-0.5'}`}
                    style={entry.id === selectedId ? { background: `${palette.glow}`, borderColor: palette.ring } : {}}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${colorVal ? `bg-gradient-to-br ${colorVal.gradient} border border-white/5` : 'bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-white/5'}`}>
                          {isEntryLockActive ? '🔒' : isLocked ? '🔒' : ENTRY_TYPE_ICONS[entry.type || 'password']}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium leading-tight truncate max-w-[140px]">{entry.name}</div>
                          <div className="text-[10px] text-white/30 mt-0.5">{ENTRY_TYPE_LABELS[entry.type || 'password']}{entry.lastUsedAt ? <span className="text-white/15 ml-1.5">· last used {Math.floor((Date.now() - entry.lastUsedAt) / (24 * 60 * 60 * 1000))}d ago</span> : ''}</div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(entry.id); }} className={`p-1 rounded transition-all ${entry.favorite ? 'text-amber-400 opacity-100' : 'text-white/15 opacity-0 group-hover:opacity-100'}`}>
                        <svg className="w-4 h-4" fill={entry.favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </button>
                    </div>
                    {!isLocked && !isEntryLockActive && pwField && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className={`h-full rounded-full ${strengthColor(s)} transition-all`} style={{ width: `${s}%` }} />
                        </div>
                        <span className="text-[9px] text-white/30 mono w-12 text-right">{strengthLabel(s)}</span>
                      </div>
                    )}
                    {!isLocked && !isEntryLockActive && breached && (
                      <p className="text-[9px] text-rose-400 mb-2 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-rose-400" /> Breached
                      </p>
                    )}
                    {!isLocked && !isEntryLockActive && entry.updatedAt && Date.now() - entry.updatedAt > 90 * 24 * 60 * 60 * 1000 && (
                      <p className="text-[9px] text-amber-400/70 mb-1 flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Stale · {Math.floor((Date.now() - entry.updatedAt) / (24 * 60 * 60 * 1000))}d ago
                      </p>
                    )}
                    {!isLocked && !isEntryLockActive && pwField && (
                      <div className="flex gap-1 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleCopy(entry.fields?.password || entry.fields?.apiKey || '', 'password'); }} className="px-2 py-0.5 rounded text-[9px] bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-all" title="Copy password">
                          Copy password
                        </button>
                        {entry.fields?.username && (
                          <button onClick={(e) => { e.stopPropagation(); handleCopy(entry.fields?.username || '', 'username'); }} className="px-2 py-0.5 rounded text-[9px] bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-all" title="Copy username">
                            Copy username
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-white/25">{entry.category || 'Other'}</span>
                      <div className="flex items-center gap-1.5">
                        {entry.twofa && <span className="text-emerald-400/80" title="2FA configured"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>}
                        {entry.entryPasswordHash && <span className="text-amber-400/80" title="Entry locked"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg></span>}
                        {entry.tags && entry.tags.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            {entry.tags.slice(0, 2).map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-full text-[8px] bg-white/5 text-white/30">{t}</span>
                            ))}
                            {entry.tags.length > 2 && <span className="text-[8px] text-white/20">+{entry.tags.length - 2}</span>}
                          </span>
                        )}
                        {entry.attachments && entry.attachments.length > 0 && (
                          <span className="text-[10px] text-white/25 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                            {entry.attachments.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedEntry && (
        <EntryDetailPanel
          entry={selectedEntry}
          onClose={() => setSelectedId(null)}
          onEdit={(entry) => { setEditingEntry(entry); }}
          onCopy={handleCopy}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onAttach={handleAttach}
          onDownload={handleDownload}
          onDeleteAttachment={handleDeleteAttachment}
          onSetEntryLock={handleSetEntryLock}
          onRemoveEntryLock={handleRemoveEntryLock}
          onUnlock={(id) => { unlockedEntries.current.add(id); setTick((t) => t + 1); }}
        />
      )}

      {ctxMenu && (
        <div className="fixed z-[300] glass border border-white/10 rounded-xl py-1.5 shadow-2xl min-w-[200px] animate-scale-in" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          {['password', 'apiKey', 'cardNumber', 'seedPhrase', 'productKey', 'passphrase'].map((k) => ctxMenu.entry.fields?.[k] ? (
            <button key={k} onClick={() => { handleCopy(ctxMenu.entry.fields![k]!, k); setCtxMenu(null); }} className="w-full px-4 py-2 text-xs text-left text-white/70 hover:bg-white/5 transition-colors flex items-center gap-2.5">
              <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
              Copy {k === 'password' ? 'Password' : k === 'apiKey' ? 'API Key' : k === 'cardNumber' ? 'Card Number' : k === 'seedPhrase' ? 'Seed Phrase' : k === 'productKey' ? 'Product Key' : 'Passphrase'}
            </button>
          ) : null)}
          <div className="h-px bg-white/5 my-1" />
          <button onClick={() => { setEditingEntry(ctxMenu.entry); setCtxMenu(null); }} className="w-full px-4 py-2 text-xs text-left text-white/70 hover:bg-white/5 transition-colors flex items-center gap-2.5">
            <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
            Edit
          </button>
          <button onClick={() => { handleDuplicate(ctxMenu.entry); setCtxMenu(null); }} className="w-full px-4 py-2 text-xs text-left text-white/70 hover:bg-white/5 transition-colors flex items-center gap-2.5">
            <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
            Duplicate
          </button>
          <button onClick={() => { handleToggleFavorite(ctxMenu.entry.id); setCtxMenu(null); }} className="w-full px-4 py-2 text-xs text-left text-white/70 hover:bg-white/5 transition-colors flex items-center gap-2.5">
            <svg className="w-3.5 h-3.5 text-white/40" fill={ctxMenu.entry.favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
            {ctxMenu.entry.favorite ? 'Remove Favorite' : 'Add to Favorites'}
          </button>
          <div className="h-px bg-white/5 my-1" />
          <button onClick={() => { handleDelete(ctxMenu.entry); setCtxMenu(null); }} className="w-full px-4 py-2 text-xs text-left text-rose-400/70 hover:bg-rose-500/5 hover:text-rose-400 transition-colors flex items-center gap-2.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            Delete
          </button>
        </div>
      )}

      {(showAddModal || editingEntry) && (
        <AddEntryModal
          entry={editingEntry || undefined}
          onClose={() => { setShowAddModal(false); setEditingEntry(null); }}
          onSave={handleSaveEntry}
        />
      )}

      {showGenerator && <PasswordGenerator onClose={() => setShowGenerator(false)} />}

      {showPalette && (
        <CommandPalette entries={entries} onSelect={(entry) => { setSelectedId(entry.id); setShowPalette(false); }} onCopy={handleCopy} onClose={() => setShowPalette(false)} />
      )}

      {show2FASetup && <Vault2FASetup onClose={() => setShow2FASetup(false)} enabled={vault2FA} onChange={(v) => { setVault2FA(v); setShow2FASetup(false); }} />}

      {/* SECURITY REPORT */}
      {showReport && securityReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowReport(false)}>
          <div className="w-[560px] max-h-[85vh] overflow-y-auto p-7 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                  </span>
                  Security Report
                </h2>
                <p className="text-[11px] text-white/30 mt-1">Analysis of your vault's security</p>
              </div>
              <button onClick={() => setShowReport(false)} className="btn-ghost p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {(() => {
              const total = securityReport.totalEntries || 1;
              const weakPct = (securityReport.weakPasswords / total) * 100;
              const dupPct = (securityReport.duplicatePasswords / total) * 100;
              const staleCount = securityReport.expiredEntries?.length || 0;
              const breachedPct = (securityReport.breachedPasswords / total) * 100;
              const health = Math.max(0, Math.min(100, Math.round(100 - weakPct * 1.5 - dupPct * 0.5 - (staleCount / total) * 50 - breachedPct * 2)));
              const healthColor = health >= 80 ? 'text-emerald-400' : health >= 50 ? 'text-amber-400' : 'text-rose-400';
              const ringColor = health >= 80 ? '#34d399' : health >= 50 ? '#fbbf24' : '#f87171';
              const circumference = 2 * Math.PI * 36;
              return (
                <div className="flex items-center gap-5 mb-5 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="health-ring shrink-0">
                    <svg width="88" height="88" viewBox="0 0 88 88">
                      <circle className="bg" cx="44" cy="44" r="36" strokeWidth="6" />
                      <circle className="progress" cx="44" cy="44" r="36" strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * health) / 100} style={{ stroke: ringColor }} />
                    </svg>
                    <span className={`absolute text-xl font-bold mono ${healthColor}`}>{health}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white text-sm font-semibold">Password Health Score</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{health >= 80 ? 'Excellent — your vault is secure' : health >= 50 ? 'Good — some improvements needed' : 'Poor — take action immediately'}</div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/15">
                <div className="text-2xl font-bold text-rose-400 stat-number">{securityReport.weakPasswords}</div>
                <div className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">Weak Passwords</div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <div className="text-2xl font-bold text-emerald-400 stat-number">{securityReport.strongPasswords}</div>
                <div className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">Strong</div>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15">
                <div className="text-2xl font-bold text-indigo-400 stat-number">{securityReport.totalEntries}</div>
                <div className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">Total Entries</div>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <div className="text-2xl font-bold text-amber-400 stat-number">{securityReport.duplicatePasswords}</div>
                <div className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">Duplicates</div>
              </div>
            </div>

            {(securityReport as any).breachedPasswords > 0 && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold mb-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  {(securityReport as any).breachedPasswords} password{(securityReport as any).breachedPasswords !== 1 ? 's' : ''} found in known data breaches
                </div>
                <div className="text-[10px] text-rose-200/60">These appear on commonly-leaked password lists. Change them immediately.</div>
              </div>
            )}

            {securityReport.weakPasswordList?.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-2">Weak Passwords</div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {securityReport.weakPasswordList.map((name: string) => (
                    <div key={name} className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-white/60 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {securityReport.expiredEntries?.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-2">Stale (90+ days)</div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {securityReport.expiredEntries.map((name: string) => (
                    <div key={name} className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-white/60 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {securityReport.weakPasswords === 0 && securityReport.duplicatePasswords === 0 && (securityReport as any).breachedPasswords === 0 && securityReport.expiredEntries?.length === 0 && (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-emerald-500/15 border border-emerald-500/20">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-sm text-emerald-400 font-semibold">Your vault is in great shape!</p>
                <p className="text-[11px] text-white/30 mt-1">No weak, breached, duplicate, or stale entries found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowSettings(false)}>
          <div className="w-[560px] max-h-[88vh] overflow-y-auto p-6 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold tracking-tight">Settings</h2>
                <p className="text-[11px] text-white/30 mt-0.5">Customize your vault experience</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="btn-ghost p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex gap-1 mb-5 p-1 rounded-lg bg-white/[0.03] border border-white/5 overflow-x-auto">
              {(['general', 'security', 'appearance', 'categories', 'about'] as const).map((tab) => (
                <button key={tab} onClick={() => setSettingsTab(tab)} className={`flex-1 py-2 text-xs rounded-md transition-colors capitalize whitespace-nowrap ${settingsTab === tab ? 'text-white' : 'text-white/40 hover:text-white/60'}`} style={settingsTab === tab ? { background: `${palette.glow}` } : {}}>
                  {tab}
                </button>
              ))}
            </div>

            {settingsTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium block mb-2">Auto-lock timeout</label>
                  <select value={autoLockTimeout} onChange={(e) => handleAutoLockChange(Number(e.target.value))} className="input-glass w-full text-sm h-10">
                    <option value={60}>1 minute</option>
                    <option value={180}>3 minutes</option>
                    <option value={300}>5 minutes</option>
                    <option value={600}>10 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                    <option value={0}>Never</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium block mb-2">Clipboard auto-clear</label>
                  <select value={clipboardAutoClear} onChange={(e) => handleClipboardAutoClear(Number(e.target.value))} className="input-glass w-full text-sm h-10">
                    <option value={0}>Never</option>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                  </select>
                  <p className="text-[10px] text-white/25 mt-1">Auto-clear copied secrets after this duration</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80">Launch on startup</div>
                    <div className="text-[10px] text-white/30">Auto-open vault at Windows login</div>
                  </div>
                  <div className={`toggle ${launchOnStartup ? 'on' : ''}`} onClick={handleStartupToggle} />
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80">Windows Hello / Biometric</div>
                    <div className="text-[10px] text-white/30">Unlock with fingerprint or face</div>
                  </div>
                  <div className={`toggle ${biometricEnabled ? 'on' : ''}`} onClick={handleBiometricToggle} />
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80">Compact view</div>
                    <div className="text-[10px] text-white/30">List-style entry display</div>
                  </div>
                  <div className={`toggle ${compactView ? 'on' : ''}`} onClick={() => handleSetCompactView(!compactView)} />
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80">Show sidebar</div>
                    <div className="text-[10px] text-white/30">Navigation panel</div>
                  </div>
                  <div className={`toggle ${showSidebar ? 'on' : ''}`} onClick={() => handleSetShowSidebar(!showSidebar)} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleExport} className="btn-secondary flex-1 h-10 text-xs">Export Vault</button>
                  <button onClick={handleExportCsv} className="btn-secondary flex-1 h-10 text-xs">Export CSV</button>
                  <button onClick={() => { setShowImport(true); setShowSettings(false); }} className="btn-secondary flex-1 h-10 text-xs">Import</button>
                </div>
              </div>
            )}

            {settingsTab === 'security' && (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium block mb-2">Change Master Password</label>
                  <div className="space-y-2">
                    <input type="password" placeholder="Current password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="input-glass w-full text-sm h-10" />
                    <input type="password" placeholder="New password (8+ chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-glass w-full text-sm h-10" />
                    <button onClick={() => handleChangePassword()} className="btn-primary w-full h-10 text-xs">Change Password</button>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium block mb-2">PIN Quick Unlock</label>
                  <div className="space-y-2">
                    <input type="password" placeholder="New PIN (4+ digits)" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))} className="input-glass w-full text-sm h-10" />
                    <input type="password" placeholder="Confirm PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))} className="input-glass w-full text-sm h-10" />
                    <button onClick={handleSetPin} className="btn-primary w-full h-10 text-xs">{pinSet ? 'Update PIN' : 'Set PIN'}</button>
                    {pinSet && <button onClick={handleRemovePin} className="btn-secondary w-full h-10 text-xs text-rose-400 hover:text-rose-300">Remove PIN</button>}
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium block mb-2">Vault 2-Factor Authenticator</label>
                  <p className="text-[11px] text-white/40 mb-3">Add a 6-digit TOTP code required after your master password.</p>
                  <button onClick={() => { setShow2FASetup(true); setShowSettings(false); }} className="btn-primary w-full h-10 text-xs">{vault2FA ? 'Manage 2FA' : 'Setup Authenticator'}</button>
                </div>
              </div>
            )}

            {settingsTab === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium block mb-3">Accent Color</label>
                  <div className="grid grid-cols-7 gap-2">
                    {(['indigo', 'violet', 'rose', 'emerald', 'amber', 'cyan', 'pink'] as ThemeAccent[]).map((t) => (
                      <button key={t} onClick={() => handleThemeChange(t)} className={`aspect-square rounded-xl border-2 transition-all ${theme === t ? 'scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`} style={{ background: `linear-gradient(135deg, ${THEME_PALETTES[t].primary}, ${THEME_PALETTES[t].secondary})`, borderColor: theme === t ? '#fff' : 'transparent' }} title={t} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium block mb-2">Theme</label>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-3.5 rounded-xl border-2 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 cursor-pointer" style={{ borderColor: palette.primary }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white font-medium">Dark (Midnight)</div>
                          <div className="text-[10px] text-white/40">Elegant dark theme with deep blues</div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === 'categories' && (
              <div className="space-y-3">
                <p className="text-xs text-white/30">Set passwords to lock individual categories. Locked categories require a password to view.</p>
                <div className="flex gap-2">
                  <select value={selectedCategoryForPassword} onChange={(e) => setSelectedCategoryForPassword(e.target.value)} className="input-glass flex-1 text-sm h-10">
                    <option value="">Select category...</option>
                    {categories.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input type="password" placeholder="Password" value={categoryPasswordInput} onChange={(e) => setCategoryPasswordInput(e.target.value)} className="input-glass w-32 text-sm h-10" />
                  <button onClick={handleSetCategoryPassword} className="btn-primary text-xs px-4 h-10">Set</button>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto" key={tick}>
                  {categories.filter((c) => c !== 'All').map((cat) => {
                    const isUnlocked = unlockedCategories.current.has(cat);
                    return (
                      <div key={cat} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                        <span className="text-sm text-white/70">{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] ${isUnlocked ? 'text-emerald-400' : 'text-white/25'}`}>{isUnlocked ? 'Unlocked' : 'Locked'}</span>
                          {isUnlocked ? (
                            <>
                              <button onClick={() => { unlockedCategories.current.delete(cat); setTick(t => t + 1); fetchEntries(); }} className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors">Lock</button>
                              <button onClick={() => handleRemoveCategoryPassword(cat)} className="text-[10px] text-white/30 hover:text-rose-400 transition-colors">Remove password</button>
                            </>
                          ) : (
                            <button onClick={() => handleUnlockCategoryPrompt(cat)} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">Unlock</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {settingsTab === 'about' && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 shadow-2xl" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }}>
                    <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3-1.248-6.1-1.248-8.25-3.285z" /></svg>
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">Sentinel Vault</div>
                  <div className="text-[10px] text-white/30 mt-1 mono">v{__APP_VERSION__} · Premium Password Manager</div>
                </div>
                <div className="space-y-2 text-[11px] text-white/50 leading-relaxed">
                  <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> AES-256-GCM encryption</div>
                  <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> PBKDF2-SHA512 (600,000 iterations)</div>
                  <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 100% offline · zero telemetry</div>
                  <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Open cryptographic primitives</div>
                </div>
                <div className="pt-3 border-t border-white/5">
                  <button onClick={handleWipe} className="w-full text-xs text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    Wipe all vault data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Log */}
      {showActivity && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowActivity(false)}>
          <div className="w-[480px] max-h-[80vh] flex flex-col p-6 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold tracking-tight">Activity Log</h2>
                <p className="text-[11px] text-white/30 mt-0.5">{activityLog.length} events</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleClearActivity} className="text-[10px] text-white/30 hover:text-rose-400 px-2 py-1 rounded transition-colors">Clear</button>
                <button onClick={() => setShowActivity(false)} className="btn-ghost p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-0.5">
              {activityLog.length === 0 ? (
                <div className="text-center text-white/20 py-12 text-sm">No activity yet</div>
              ) : activityLog.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.type === 'delete' ? 'bg-rose-400' : a.type === 'add' ? 'bg-emerald-400' : a.type === 'edit' ? 'bg-amber-400' : a.type === 'autolock' || a.type === 'lock' ? 'bg-orange-400' : 'bg-indigo-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/70 truncate">{a.detail}</div>
                    <div className="text-[10px] text-white/25 mono">{new Date(a.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowShortcuts(false)}>
          <div className="w-[440px] p-6 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-sm">Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="btn-ghost p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="space-y-1.5">
              {[
                ['Ctrl + N', 'New entry'],
                ['Ctrl + F', 'Focus search'],
                ['Ctrl + G', 'Password generator'],
                ['Ctrl + P', 'Command palette'],
                ['Ctrl + L', 'Lock vault'],
                ['Ctrl + /', 'This cheat sheet'],
                ['Delete', 'Delete selected entry'],
                ['Escape', 'Close modal / deselect'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-xs text-white/60">{desc}</span>
                  <kbd className="px-2 py-1 rounded bg-white/5 text-[10px] text-white/50 mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowImport(false)}>
          <div className="w-[480px] p-6 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-sm">Import Data</h2>
              <button onClick={() => setShowImport(false)} className="btn-ghost p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setImportType('vault')} className={`flex-1 py-2 text-xs rounded-lg transition-colors ${importType === 'vault' ? 'text-white' : 'bg-white/[0.03] text-white/40 hover:text-white/60'}`} style={importType === 'vault' ? { background: `${palette.glow}`, border: `1px solid ${palette.ring}` } : { border: '1px solid rgba(255,255,255,0.05)' }}>Vault JSON</button>
              <button onClick={() => setImportType('csv')} className={`flex-1 py-2 text-xs rounded-lg transition-colors ${importType === 'csv' ? 'text-white' : 'bg-white/[0.03] text-white/40 hover:text-white/60'}`} style={importType === 'csv' ? { background: `${palette.glow}`, border: `1px solid ${palette.ring}` } : { border: '1px solid rgba(255,255,255,0.05)' }}>CSV</button>
            </div>
            <textarea placeholder={`Paste ${importType === 'vault' ? 'vault JSON' : 'CSV'} data...`} value={importText} onChange={(e) => setImportText(e.target.value)} className="input-glass w-full h-36 text-xs mb-4 resize-none mono" />
            <button onClick={handleImport} className="btn-primary w-full h-10 text-xs font-semibold">Import</button>
          </div>
        </div>
      )}

      {showOnboarding && (
        <Onboarding onClose={() => setShowOnboarding(false)} onAddEntry={() => { setShowOnboarding(false); setShowAddModal(true); }} />
      )}

      {/* Bottom sort & count */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-lg glass-premium border border-white/10">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-[10px] text-white/40 outline-none cursor-pointer">
          <option value="updatedAt">Latest</option>
          <option value="created">Created</option>
          <option value="name">Name</option>
          <option value="category">Category</option>
        </select>
        <span className="text-[10px] text-white/20 mono">{filteredEntries.length}/{entries.length}</span>
      </div>
      </div>
    </div>
  );
}

/* Vault 2FA setup modal */
function Vault2FASetup({ onClose, enabled, onChange }: { onClose: () => void; enabled: boolean; onChange: (v: boolean) => void }) {
  const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'disable'>(enabled ? 'disable' : 'intro');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const { alert } = useModal();
  const { toast } = useToast();

  useEffect(() => {
    if (step === 'verify' && secret) {
      const update = async () => {
        const r = await generateTOTP(secret);
        setCurrentCode(r.code);
      };
      update();
      const t = setInterval(update, 1000);
      return () => clearInterval(t);
    }
  }, [step, secret]);

  const startSetup = async () => {
    setLoading(true);
    const r = await api.setupVault2FA();
    if (r.success && r.data) {
      setSecret(r.data.secret);
      setOtpauthUrl(r.data.otpauthUrl);
      setStep('scan');
    } else { setError(r.error || 'Failed'); }
    setLoading(false);
  };

  const confirmCode = async () => {
    if (code.length < 6) { setError('Enter 6 digits'); return; }
    setLoading(true);
    const r = await api.confirmVault2FA(code);
    if (r.success) { onChange(true); toast('Authenticator enabled', 'success'); }
    else { setError(r.error || 'Invalid code'); setCode(''); }
    setLoading(false);
  };

  const disable2FA = async () => {
    if (code.length < 6) { setError('Enter 6 digits'); return; }
    setLoading(true);
    const r = await api.disableVault2FA(code);
    if (r.success) { onChange(false); toast('Authenticator disabled', 'info'); }
    else { setError(r.error || 'Invalid code'); setCode(''); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-[440px] p-7 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
        {step === 'intro' && (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20">
              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
            </div>
            <h2 className="text-white font-semibold text-center text-base">Enable Authenticator 2FA</h2>
            <p className="text-xs text-white/40 text-center mt-2 leading-relaxed">Add an extra layer of security. After setup, you'll need a 6-digit code from your authenticator app to unlock your vault.</p>
            <div className="mt-5 space-y-2 text-[11px] text-white/50">
              <div className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">✓</span><span>Works with Google Authenticator, Authy, 1Password, Bitwarden, etc.</span></div>
              <div className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">✓</span><span>TOTP standard (RFC 6238, 30-second window)</span></div>
              <div className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">✓</span><span>Encrypted and stored locally</span></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="btn-secondary flex-1 h-10 text-xs">Cancel</button>
              <button onClick={startSetup} disabled={loading} className="btn-primary flex-1 h-10 text-xs font-semibold">{loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Begin Setup'}</button>
            </div>
          </>
        )}
        {step === 'scan' && (
          <>
            <h2 className="text-white font-semibold text-center text-base">Scan QR Code</h2>
            <p className="text-xs text-white/40 text-center mt-1.5">Open your authenticator app and scan this code</p>
            <div className="mt-5 mx-auto w-fit p-4 bg-white rounded-2xl shadow-2xl">
              <QrMatrix url={otpauthUrl} />
            </div>
            <div className="mt-4 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Or enter manually</div>
              <div className="text-sm text-white/80 mono break-all select-all">{secret}</div>
            </div>
            <button onClick={() => setStep('verify')} className="btn-primary w-full h-10 text-xs mt-5 font-semibold">I've added it — Next</button>
            <button onClick={onClose} className="btn-ghost w-full text-xs text-white/30 mt-2">Cancel</button>
          </>
        )}
        {step === 'verify' && (
          <>
            <h2 className="text-white font-semibold text-center text-base">Verify Code</h2>
            <p className="text-xs text-white/40 text-center mt-1.5">Enter the 6-digit code from your app</p>
            <div className="mt-5 space-y-3">
              <div className="text-center">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Current code</div>
                <div className="text-2xl font-bold text-emerald-400 mono tracking-[0.3em]">{currentCode}</div>
              </div>
              <input type="text" inputMode="numeric" placeholder="000 000" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="input-glass w-full text-center text-2xl tracking-[0.4em] h-14 mono" maxLength={6} autoFocus />
              {error && <p className="text-[11px] text-rose-400 text-center">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setStep('scan')} className="btn-secondary flex-1 h-10 text-xs">Back</button>
              <button onClick={confirmCode} disabled={loading || code.length < 6} className="btn-primary flex-1 h-10 text-xs font-semibold">{loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Verify & Enable'}</button>
            </div>
          </>
        )}
        {step === 'disable' && (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center border border-rose-500/20">
              <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            </div>
            <h2 className="text-white font-semibold text-center text-base">Disable Authenticator 2FA</h2>
            <p className="text-xs text-white/40 text-center mt-1.5">Enter a current code to confirm</p>
            <div className="mt-5 space-y-3">
              <input type="text" inputMode="numeric" placeholder="000 000" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="input-glass w-full text-center text-2xl tracking-[0.4em] h-14 mono" maxLength={6} autoFocus />
              {error && <p className="text-[11px] text-rose-400 text-center">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="btn-secondary flex-1 h-10 text-xs">Cancel</button>
              <button onClick={disable2FA} disabled={loading || code.length < 6} className="btn-primary flex-1 h-10 text-xs font-semibold" style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}>{loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Disable 2FA'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* QR code display using the qrcode library */
function QrMatrix({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(url, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' } }).then(setDataUrl).catch(() => {});
  }, [url]);
  if (!dataUrl) return <div className="w-[200px] h-[200px] bg-white rounded-lg animate-pulse" />;
  return <img src={dataUrl} alt="QR Code" className="rounded-lg w-[200px] h-[200px]" />;
}

/* Onboarding modal */
function Onboarding({ onClose, onAddEntry }: { onClose: () => void; onAddEntry: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: 'Welcome to Sentinel Vault', desc: 'Your premium, offline-first password manager. Let\'s take a quick tour.', icon: '👋' },
    { title: 'Military-grade encryption', desc: 'Every entry is encrypted with AES-256-GCM and a 600,000-iteration PBKDF2-derived key. Zero data leaves your device.', icon: '🛡️' },
    { title: 'Smart organization', desc: 'Use categories, tags, color tags, and 9 entry types to keep your vault tidy.', icon: '🗂️' },
    { title: 'Per-entry locks', desc: 'Lock sensitive entries with their own password — perfect for crypto wallets, passports, or anything extra sensitive.', icon: '🔐' },
    { title: 'Authenticator built-in', desc: 'Add an extra layer with TOTP-based 2FA for vault unlock, plus TOTP codes for your accounts.', icon: '🔑' },
    { title: 'You\'re all set!', desc: 'Add your first entry to get started. You can always access help with Ctrl+/ or from the user menu.', icon: '✨' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-[480px] p-8 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="text-5xl mb-3 animate-bounce-soft">{steps[step].icon}</div>
          <h2 className="text-white font-semibold text-lg tracking-tight">{steps[step].title}</h2>
          <p className="text-xs text-white/40 mt-2 leading-relaxed max-w-sm mx-auto">{steps[step].desc}</p>
        </div>
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-indigo-400' : 'w-1 bg-white/10'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 h-10 text-xs">Skip tour</button>
          {step === steps.length - 1 ? (
            <button onClick={onAddEntry} className="btn-primary flex-1 h-10 text-xs font-semibold">Add First Entry</button>
          ) : (
            <button onClick={() => setStep(step + 1)} className="btn-primary flex-1 h-10 text-xs font-semibold">Continue</button>
          )}
        </div>
      </div>
    </div>
  );
}
