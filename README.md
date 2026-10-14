# ⚓ Pirate Battle — 2D Naval Shooter Challenge

Pirate Battle is a browser-based naval shooter built for the Jungle Gaming technical challenge. The application combines a React interface with a PixiJS v8 canvas simulation rendered through WebGL. TanStack Query orchestrates ranking and match-history requests, while Mock Service Worker (MSW) intercepts those requests and persists match records in browser `localStorage`.

The game loop and entities live in PixiJS; React manages the menu, match lifecycle, results, ranking, and history screens. This keeps per-frame simulation updates out of React rendering.

## Key Features Implemented

- **Frame-rate-aware simulation:** Player, enemy, and projectile movement scale with PixiJS ticker `deltaTime`.
- **Simultaneous keyboard actions:** Independent key state allows movement, steering, and firing inputs to be held together.
- **Concurrent side batteries:** Port and starboard triple-cannon volleys use separate cooldowns, so either side can fire without blocking the other.
- **Browser-persistent mock data:** MSW intercepts API routes and stores match history in `localStorage`, retaining records across hard refreshes in the same browser profile.
- **Non-blocking match flow:** The result screen appears immediately when a match ends; saving runs asynchronously, and a new match can start while a previous save is pending.
- **React Query cache refresh:** A successful match save invalidates ranking and history queries so those screens can reload current data.

## Controls Guide

| Player action | Input |
| --- | --- |
| Move forward | `W` / `↑` |
| Steer left / right | `A` / `D` |
| Fire front cannon | `Spacebar` |
| Fire port triple cannons | `Q` |
| Fire starboard triple cannons | `E` |

## Getting Started & Setup

### Prerequisites

- **Node.js 20.19+ or 22.12+** (required by the Vite 8 toolchain)
- **npm**, included with Node.js

### Install and run

```bash
git clone https://github.com/BarucoMarco2091/game-developer-challenge.git
cd game-developer-challenge
npm install
npx msw init public --save
npm run dev
```

The MSW service worker file is already present at `public/mockServiceWorker.js`. Run the initialization command again when setting up a fresh checkout or regenerating the worker after an MSW upgrade.

Vite prints the local development URL in the terminal (normally `http://localhost:5173`). Keep the development server running while using the application or running the end-to-end tests.

## CLI Scripts & Available Commands

### Development Server

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

This runs the TypeScript project build (`tsc -b`) followed by the Vite production build.

### Preview Production Locally

```bash
npm run preview
```

### Code Linting

```bash
npm run lint
```

### TypeScript Type Checking

There is no standalone `typecheck` script in `package.json`. The equivalent TypeScript compilation check is included in the production build:

```bash
npm run build
```

### Playwright End-to-End Tests

Start the Vite development server in one terminal, then run the tests from another:

```bash
npx playwright test
```

The Playwright configuration targets Chromium, Firefox, and WebKit. Install their browser binaries if needed:

```bash
npx playwright install
```

### Playwright UI / Interactive Mode

```bash
npx playwright test --ui
```

The configured tests navigate directly to `http://localhost:5173`; the Playwright `webServer` setting is not enabled, so the application server must already be running.

## Gameplay Configuration & Balance Parameters

Gameplay tuning values are grouped in the `config` object inside the `GameCanvas` effect in [`src/components/GameCanvas.tsx`](src/components/GameCanvas.tsx). Adjust the values there to rebalance movement, weapon cadence, enemy waves, and enemy attacks.

| Setting | Current value | Purpose |
| --- | ---: | --- |
| `playerSpeed` | `4` | Player forward movement |
| `playerRotationSpeed` | `0.05` | Player steering speed |
| `bulletSpeed` | `8` | Player projectile speed |
| `shootCooldown` | `300 ms` | Front cannon firing interval |
| `sideShootCooldown` | `600 ms` | Port and starboard firing interval |
| `enemySpawnInterval` | `2,000 ms` | Enemy wave spawn interval |
| `chaserSpeed` | `2.3` | Chaser movement speed |
| `chaserDamage` | `25` | Chaser contact damage |
| `chaserMaxHealth` | `1` | Chaser starting health |
| `shooterSpeed` | `1.6` | Shooter movement speed |
| `shooterMaxHealth` | `2` | Shooter starting health |
| `shooterAttackRange` | `220` | Range at which a Shooter stops approaching and fires |
| `shooterShootCooldown` | `1,400 ms` | Shooter firing interval |
| `enemyBulletSpeed` | `5.5` | Enemy projectile speed |
| `enemyBulletDamage` | `15` | Enemy projectile damage |

**Configuration scope:** The object is currently a component-local JavaScript object with TypeScript-inferred property types; it is not an exported configuration type or shared module. Each mounted `GameCanvas` instance captures its own settings when the match is created. A source-code change applies to newly created match instances and does not hot-update a match already in progress.

**Session duration:** The current game ends when player health reaches zero; there is no configurable session timer or time-expired game-over path. `App` records `duration: 60` as a fixed match-history value. It is metadata, not a live countdown. Health, arena dimensions, and some collision thresholds are also currently defined separately from the `config` object.

## Network Conditions & MSW Simulation

### Intercepted endpoints and persistence

The MSW worker is started before React is rendered in `src/main.tsx`. [`src/mocks/handlers.ts`](src/mocks/handlers.ts) handles these same-origin routes:

| Method and endpoint | Behavior |
| --- | --- |
| `GET /api/match-history` | Reads `pirate_match_history` from browser `localStorage` and returns records newest first. |
| `POST /api/match-history` | Waits 400 ms, then stores the submitted match in `localStorage`. |
| `GET /api/ranking` | Combines saved player records with three sample captains and sorts by score descending, then duration ascending. |

[`src/hooks/useGameData.ts`](src/hooks/useGameData.ts) uses Axios for these requests and TanStack Query for reads and mutations. A successful save invalidates both the history and ranking queries. Since MSW writes to browser storage rather than an in-memory-only array, saved history survives hard refreshes in the same browser profile. This is a local mock API, not a connection to a remote database.

### Idempotency strategy

When a match ends, [`src/App.tsx`](src/App.tsx) creates a record ID with `crypto.randomUUID()`. Before appending a record, the MSW storage helper checks whether that ID is already present. Replaying the same payload therefore does not create a duplicate history row.

This protects against duplicate delivery of **the same identified match**. A separate match submission receives a new UUID and is intentionally treated as a different record.

### Simulating latency and network faults

To test a slow save, change the 400 ms `setTimeout` in the `POST /api/match-history` handler to a longer delay (for example, 5,000 ms). The result screen should remain usable during the delay: the save is triggered without awaiting it, and **Play Again** can mount a new game while the mutation is pending.

To simulate a server error, temporarily return a non-success response from that handler, for example:

```ts
return HttpResponse.json(
  { message: 'Simulated match-history failure' },
  { status: 500 },
);
```

Place the response before the normal persistence call so the simulated failure does not write the record. Restore the regular response after testing. The React screen transition is independent of the save request, so a failed or pending save does not prevent starting another match.

**Failure-state limitation:** The current UI shows “Saving record...” while the mutation is pending, but does not render a dedicated mutation error state. Once the request fails, it falls back to “Saved to Ledger,” so that label does not confirm persistence. Match-save mutations also have no retry or offline queue; the two retries configured in `src/main.tsx` apply to queries, not mutations.

## Project Structure

```text
src/
├── App.tsx                 # Screens and match lifecycle
├── components/
│   └── GameCanvas.tsx      # PixiJS simulation, input, and gameplay balance
├── hooks/
│   └── useGameData.ts      # TanStack Query and Axios data orchestration
└── mocks/
    ├── browser.ts         # MSW browser worker
    └── handlers.ts        # Mock API routes and localStorage persistence
tests/
└── pirate-battle.spec.ts  # Playwright end-to-end and visual regression tests
```
