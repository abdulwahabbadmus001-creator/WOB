# WOB: Tommy & Polly · 3D Co-op Endless Campaign

**WOB: Tommy & Polly** is a 100% offline-capable, standalone-installable 3D arcade space shooter built with React 19, TypeScript, Three.js (WebGL), Vite, Tailwind CSS, WebRTC / BroadcastChannel P2P Co-op, and a zero-dependency Procedural Web Audio API Synthesizer.

## Key Features

1. **Mobile PWA Standalone Installation & Zero-Data Offline Play:**
   - Configured with `manifest.webmanifest` (`display: "standalone"`, `start_url: "/?source=pwa"`, `orientation: "any"`, `background_color: "#070b14"`, `theme_color: "#00f5d4"`), valid `192x192` & `512x512` (`any` and `maskable`) PNG icons, `apple-touch-icon` (`180x180`), and `vercel.json` routing/cache headers.
   - Cache-First Service Worker (`public/sw.js`) for static assets/bundles and Network-First with offline fallback for navigation, plus `localStorage` + `IndexedDB` persistence and an automatic offline Leaderboard background sync queue.
2. **Three.js / WebGL 3D Visual Overhaul:**
   - 3D geometric starfighters for Tommy, Co-op Teammate, and Polly wingmen with emissive neon trim (*Neon Cyan*, *Ion Violet*, *Solar Gold*), smooth pitch/roll banking, 360-degree barrel-roll animations on **Dash**, a 3D geodesic dome on **Tactical Shield**, and a 3D expanding shockwave torus ring on **EMP**.
   - Multi-layered 3D parallax starfield, drifting volumetric nebula clouds, dynamic projectile point lights, object pooling, and an automatic 60 FPS quality scaler.
3. **2-Player Co-op Squadron & Joint Campaign Launch:**
   - Launch into the Campaign together via the **Co-op Squadron Lobby** using a shareable room code / invite link (`/?coop=WOB-XXXX`), serverless WebRTC DataChannel / local mesh, Same-Device Dual Control (`WASD` + `IJKL`), or an offline-ready AI Squadron Wingman (`NOVA-2`).
   - Features **Squadron Fusion (`[L]`)**: fly close for an **Energy Tether** that slices enemies, or dock into a **Twin-Core Heavy Gunship** with combined dual-weapon fire, plus emergency **Revival Beacons** and 1-tap tactical callouts (*"Focus Core!"*, *"Link Up!"*, *"Need Shield!"*).
4. **Epic Capital Starship Battles & Destructible Subsystems:**
   - Multi-phase Dreadnought bosses warp in flanked by interceptor squadrons and feature 4 targetable 3D subsystems (*Aegis Shield Generator*, *Broadside Laser Battery*, *Salvo Missile Pods*, *Apex Reactor Core*). Destroying subsystems visibly sparks and disables those attack systems.
   - Upgraded **Polly Wingman AI** strafes boss weak points, intercepts incoming enemy missiles, and pairs with a second drone via the **Twin Polly Drones** perk.
5. **Rogue-Lite Tactical Drafts, 3D Ship Hangar & Holographic Threat Radar:**
   - Pick 1 of 3 stackable mid-run Rogue-Lite perks between waves (*Chain-Lightning Projectiles*, *Vampiric Shield Recharge*, *Twin Polly Drones*, *Overcharged EMP Radius*, *Hyper-Graze Focus*, *Squadron Tether Overdrive*).
   - Spend earned Scrap in the **3D Ship Hangar** to permanently upgrade **Thruster Speed**, **Hull Integrity**, **Weapon Overclock**, and **Energy Regen**, visibly attaching 3D modular hardware parts to Tommy's starfighter.
   - Includes a corner **3D Holographic Threat Radar** and **Near-Miss Graze** slow-motion focus that recharges Dash and EMP energy.

## Setup & Verification

```sh
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Type-check with TypeScript
npm run lint

# 4. Build production bundle
npm run build

# 5. Preview production PWA build locally
npm run preview
```
