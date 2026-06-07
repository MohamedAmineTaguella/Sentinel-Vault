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
<img width="1279" height="793" alt="image" src="https://github.com/user-attachments/assets/e5369f12-8fc2-4925-a0be-d1ab262bb4c9" />

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

## How to Download and Run

Follow these steps exactly in order.

### Step 1: Install Prerequisites

Install **Node.js** (version 18 or later):

- Download from [https://nodejs.org/](https://nodejs.org/)
- Run the installer (all default options are fine)
- **Restart your computer** after installing

To verify it worked, open **Command Prompt** (or PowerShell) and run:

```bash
node --version
npm --version
```

Both should show version numbers (e.g., `v18.x.x` and `10.x.x`). If you see errors, restart your computer and try again.

Optionally, install **Git** from [https://git-scm.com/](https://git-scm.com/) if you want to clone the repo.

### Step 2: Download the Project

**Option A — Download ZIP (easier):**

1. Go to [https://github.com/MohamedAmineTaguella/Sentinel-Vault](https://github.com/MohamedAmineTaguella/Sentinel-Vault)
2. Click the green **Code** button
3. Click **Download ZIP**
4. Extract the ZIP to a folder (e.g., `C:\Users\YourName\Desktop\Sentinel-Vault`)

**Option B — Clone with Git (if you installed Git):**

```bash
git clone https://github.com/MohamedAmineTaguella/Sentinel-Vault.git
cd Sentinel-Vault
```

### Step 3: Install Dependencies

Open **Command Prompt** (or PowerShell) inside the project folder and run:

```bash
npm install
```

This will download all required packages. It may take 1–2 minutes. Wait for it to finish — you'll see the prompt return with no errors.

If you see warnings about vulnerabilities, that's normal. Ignore them.

> **Note:** The `node_modules/` folder (created here) and `dist/` / `release/` folders do NOT exist on GitHub. They are generated when you run the commands below. This keeps the download small.

### Step 4: Run the App (Development Mode)

```bash
npm run dev
```

A Vite dev server will start, then an **Electron window** will open automatically showing Sentinel Vault.

- Use `Ctrl+C` in the terminal to stop the app
- Changes you make to the code will auto-reload the window

### Step 5: Build a Production Installer (Optional)

If you want to generate an `.exe` installer:

```bash
# Step 5a: Check for TypeScript errors
npm run typecheck

# Step 5b: Build the frontend
npm run build

# Step 5c: Package into installer
npm run dist
```

This creates `Sentinel Vault Setup 2.0.0.exe` inside the `release/` folder. Run that file to install Sentinel Vault like a normal Windows program.

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
├── dist/                         # Created by npm run build
├── release/                      # Created by npm run dist
├── node_modules/                 # Created by npm install
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

## License

MIT
