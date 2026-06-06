<div align="center">
  <br/>
  <h1>🔐 Sentinel Vault</h1>
  <p><strong>Premium Password Manager</strong> — AES-256-GCM encrypted desktop vault</p>
  <br/>
  <p>
    <img src="https://img.shields.io/badge/electron-28.x-blue?logo=electron" alt="Electron"/>
    <img src="https://img.shields.io/badge/react-18.x-61DAFB?logo=react" alt="React"/>
    <img src="https://img.shields.io/badge/typescript-5.x-3178C6?logo=typescript" alt="TypeScript"/>
    <img src="https://img.shields.io/badge/tailwind_css-3.x-06B6D4?logo=tailwindcss" alt="Tailwind CSS"/>
    <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  </p>
  <br/>
</div>

---

## Overview

**Sentinel Vault** is a feature-rich, offline-first password manager built with Electron and React. All sensitive data is encrypted at rest using **AES-256-GCM** with key derivation via **PBKDF2-HMAC-SHA256**. The application runs entirely locally — no cloud, no telemetry, no accounts required.

---

## Features

### Core
- **Master password vault** — single master password unlocks your entire encrypted vault
- **Entry type support** — passwords, credit cards, notes, API keys, identities, software licenses, SSH keys, crypto wallets, database credentials
- **Custom fields** — add arbitrary key/value pairs to any entry
- **Categories & tagging** — organize entries with categories and tags, filter and search
- **Favorites** — mark frequently used entries
- **Drag-and-drop attachments** — attach files to entries (images, documents, etc.)
- **Per-entry passwords** — lock sensitive entries behind an additional password
- **Category-wide passwords** — password-protect entire categories
- **Secure copy** — one-click copy with auto-clear from clipboard
- **Password generator** — configurable length, character sets, and passphrase mode
- **Import/Export** — CSV import/export and full vault JSON export/import
- **Security report** — scan for weak, reused, or breached passwords
- **Activity log** — track access and changes to your vault

### Security
- **AES-256-GCM** encryption for all vault data
- **PBKDF2-HMAC-SHA256** key derivation with unique salts
- **TOTP-based two-factor authentication** for vault unlock
- **PIN unlock** — convenience unlock without master password
- **Windows Hello biometric unlock**
- **Auto-lock** — configurable timeout locks vault on inactivity or window blur
- **Anti-tamper** — brute-force lockout after failed login attempts

### Interface
- **Custom frameless title bar** with minimize / maximize-restore / close controls
- **Dark theme** with multiple accent color palettes
- **Compact mode** — list-style entry grid
- **Context menus** — right-click to copy fields, edit, duplicate, delete
- **2FA code display** — built-in TOTP generator for entries with secrets

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Shell** | Electron 28 |
| **UI Framework** | React 18 with TypeScript |
| **Styling** | Tailwind CSS 3 |
| **Build Tool** | Vite 5 |
| **Encryption** | Node.js `crypto` (AES-256-GCM, PBKDF2, SHA-256) |
| **Packaging** | electron-builder (NSIS for Windows) |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) >= 18
- npm or yarn

### Install

```bash
git clone https://github.com/MohamedAmineTaguella/sentinel-vault.git
cd sentinel-vault
npm install
```

### Development

Run the app with hot-reload:

```bash
npm run dev
```

This starts the Vite dev server on `http://localhost:5173` and launches the Electron window pointing to it.

### Production Build

```bash
# TypeScript check
npm run typecheck

# Build frontend + run electron
npm run start

# Package into installer
npm run dist
```

The installer will be output to the `release/` directory.

---

## Usage

1. **First launch** — register a master password (minimum 8 characters)
2. **Add entries** — click the + button to create password entries, cards, notes, etc.
3. **Organize** — assign categories, tags, and colors to entries
4. **Secure** — set per-entry or per-category passwords, enable 2FA in settings
5. **Access** — click entries to view, copy fields, or manage attachments

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Focus search bar |
| `Esc` | Close panel / modal |

---

## Project Structure

```
sentinel-vault/
├── electron/
│   ├── main.js          # Electron main process (window, IPC, auto-lock)
│   ├── preload.js       # Context bridge API
│   ├── store.js         # Data persistence, encryption, business logic
│   └── crypto.js        # Cryptographic primitives
├── src/
│   ├── components/
│   │   ├── AuthScreen.tsx        # Login, register, PIN, biometric
│   │   ├── VaultDashboard.tsx    # Main vault UI, entry grid, settings
│   │   ├── EntryDetailPanel.tsx  # Entry view, edit, attachments
│   │   ├── AddEntryModal.tsx     # Create/edit entry form
│   │   ├── PasswordGenerator.tsx # Password/passphrase generator
│   │   ├── TitleBar.tsx          # Frameless window controls
│   │   └── Modal.tsx             # Confirm/prompt/alert dialogs
│   ├── lib/
│   │   ├── api.ts                # IPC API wrapper
│   │   ├── strength.ts           # Password strength estimation
│   │   └── totp.ts               # TOTP code generation
│   ├── types.ts                  # Shared TypeScript types
│   └── App.tsx                   # Root component
├── dist/                         # Vite build output
├── release/                      # Electron-builder output
├── package.json
└── README.md
```

---

## Security Model

- **Encryption at rest:** every vault is encrypted with a unique 256-bit key derived from your master password via PBKDF2 (100,000 iterations, SHA-256, random 32-byte salt).
- **Cipher:** AES-256-GCM provides authenticated encryption (confidentiality + integrity).
- **Master hash:** stored as an encrypted blob — the stored data can only be decrypted with the correct master password.
- **Session key:** after unlock, the vault key is held in memory (not disk) and discarded on lock, timeout, or app close.
- **2FA:** optional TOTP (Time-based One-Time Password) using SHA-1 with a 30-second window, verified on vault unlock.
- **Brute-force protection:** 5 failed login attempts trigger a 15-minute lockout.

> **Note:** Sentinel Vault is self-contained and offline. There is no cloud sync, remote access, or telemetry. Backup your vault via the export feature.

---

## Building from Source

```bash
# Install dependencies
npm install

# Type-check
npm run typecheck

# Build frontend assets
npm run build

# Package installer
npm run dist
```

The packaged installer will be in `release/Sentinel Vault Setup 2.0.0.exe`.

---

## License

MIT
