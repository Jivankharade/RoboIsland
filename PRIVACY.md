# Privacy Policy for RoboIsland

**Effective Date:** November 14, 2026

RoboIsland ("we", "our", or "the application") respects your privacy. This policy outlines how information is handled within RoboIsland across Windows 10 and Windows 11.

---

### 1. Zero Telemetry & Local Operation
RoboIsland is designed from the ground up as an offline-first desktop application.
- We do not operate tracking servers, telemetry services, or advertising analytics.
- We do not collect, transmit, share, or sell your personal information, browsing history, clipboard data, or files.
- Everything runs directly and locally on your Windows PC.

---

### 2. Local File Staging & Phone Drop (LAN Transfer)
- When using the File Tray and Phone Drop feature, files are transferred directly between your PC and your mobile device over your local private Wi-Fi network (LAN) on port 48912.
- No files are ever routed through or uploaded to external cloud storage servers.
- The transfer server operates only on your private local subnet.

---

### 3. Credential Encryption & API Keys
- If you choose to configure external AI services (Anthropic Claude, OpenAI), your API keys are stored locally on your machine and encrypted at rest using the Microsoft Windows Data Protection API (DPAPI via Electron safeStorage).
- API keys are never transmitted to any third-party server other than the direct API endpoint of the provider you configured.
- Local AI models run entirely on your own hardware via Ollama without requiring any internet connection.

---

### 4. Third-Party Integrations
- **LRCLIB**: Used solely for querying synchronized lyrics for active media playback. Only track metadata (title, artist, album) is queried.
- **Spotify**: When connecting Spotify, the official RFC 7636 PKCE authentication flow is used. Authentication tokens remain local to your computer.

---

### 5. Windows Permissions & Native Hardware
- **System Media Transport Controls (SMTC)**: Used to display current track title and transport controls.
- **Global Shortcuts**: Used exclusively for user-defined actions (e.g., Ctrl+Alt+S for Speedometer HUD).
- **Notifications**: Displayed locally through Windows and Dynamic Island canvas overlays.

---

### 6. Contact & Open Source Verification
RoboIsland is transparent and auditable. If you have questions about privacy or security, please open an issue in the official GitHub repository.
