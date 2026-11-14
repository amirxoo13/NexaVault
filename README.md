# NexaVault — Sovereign Multi-Chain Crypto Vault (Research Project)

Self-custody multi-chain vault UI featuring live spot prices, perpetual futures, and real-time multi-device cloud state synchronization.

## Architecture & Capabilities
- **Sovereign Vault Interface:** Spot holdings, Send (address validation + network gas + multi-step confirmation), Receive (QR + copy), Swap (live market rate + 0% same-chain stablecoin routing), Fiat Card On-Ramp, and Perpetuals (up to max market leverage).
- **Control Studio (`/studio`):** Real-time live session telemetry, full brand/copy/image CMS, client identity profile management, balance adjustments, T20 / F20 / K20 compliance notice popups, and Web Push notifications.
- **Dual-Target Build:**
  - `npm run dev` / `npm run build`: Full SSR + database-backed sync across browsers and mobile devices.
  - `npm run build:pages`: Standalone static SPA build for GitHub Pages (`dist-pages`).
