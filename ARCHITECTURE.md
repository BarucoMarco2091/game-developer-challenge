# Architecture

## Overview

Pirate Battle is a browser-based game built with React, TypeScript, PixiJS v8, Axios, TanStack Query, and Mock Service Worker (MSW). The application separates the menu, result, ranking, and history interfaces from the real-time game simulation. React owns screen state and data presentation; PixiJS owns the game canvas and its per-frame updates.

The current data flow is:

```text
React screens
    ├── useGameData ── Axios ── /api/* ── MSW handlers ── localStorage
    └── GameCanvas ── PixiJS Application / Ticker ── WebGL canvas
```

MSW is started before React is rendered in `src/main.tsx`. The root is rendered under `React.StrictMode` and `QueryClientProvider`.

## 1. React and PixiJS Integration & Lifecycle

### Responsibility boundary

React is responsible for the application-level experience: selecting the current screen, presenting the menu and match result, displaying the ranking and match history, and initiating persistence when a match ends. `App` mounts `GameCanvas` only while the `GAME` screen is active and receives the final score through its `onGameOver` callback.

PixiJS is responsible for the arena. It creates and draws the player, enemies, health bars, and projectiles on its own canvas, and updates their positions and state in the ticker. Those rapidly changing simulation values remain local to the canvas rather than being pushed through React state on every frame. This avoids making React reconciliation part of the real-time rendering path.

### Asynchronous initialization and teardown

`GameCanvas` creates its `Application` inside a `useEffect` and initializes it with the asynchronous PixiJS v8 `app.init(...)` API. The effect uses refs for the DOM container and an `isDestroyedRef` lifecycle guard:

```tsx
const isDestroyedRef = useRef(false);

useEffect(() => {
  isDestroyedRef.current = false;
  const app = new Application();

  app.init(options).then(() => {
    if (isDestroyedRef.current) {
      app.destroy(true, { children: true, texture: true });
      return;
    }

    containerRef.current?.appendChild(app.canvas);
    // Create game objects and register the ticker update.
  });

  return () => {
    isDestroyedRef.current = true;
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    app.destroy(true, { children: true, texture: true });
  };
}, []);
```

The guard addresses the race between asynchronous initialization and effect cleanup: if React has already cleaned up the effect, the late initialization callback does not append its canvas to the container and destroys that application instead. This is especially relevant to the setup/cleanup cycle used by React Strict Mode in development, where an effect can be exercised more than once. Cleanup also removes the global keyboard listeners and destroys the PixiJS application and its child display objects. Consequently, leaving the game screen releases the rendering resources rather than leaving an active canvas attached to the page.

## 2. Simulation Cycle & Time-Based Logic

The simulation is registered with PixiJS's native ticker via `app.ticker.add(update)`. It is not driven by a React timer or a separate `requestAnimationFrame` loop. On each ticker callback the update function reads `ticker.deltaTime` and scales movement and rotation by it:

```ts
const update = (ticker: Ticker) => {
  const dt = ticker.deltaTime;
  player.rotation += config.playerRotationSpeed * dt;
  player.x += Math.cos(player.rotation) * config.playerSpeed * dt;
  player.y += Math.sin(player.rotation) * config.playerSpeed * dt;
};
```

PixiJS `deltaTime` is a normalized frame delta (approximately `1` at the ticker's 60 FPS reference rate), not a duration expressed in seconds. Multiplying displacement and rotation by this value makes those operations scale with elapsed ticker frames: a higher refresh rate does not, by itself, multiply movement speed by the ratio of display refresh rates. The same scaling is used for enemy and projectile movement.

Not all timing uses the ticker delta. Enemy spawning and firing cooldowns use `Date.now()` timestamps and configured millisecond intervals. This keeps those events from being defined as a fixed number of rendered frames. The current implementation does not use a fixed-step accumulator or explicit simulation substeps, so very long frame stalls are not subdivided into smaller physics updates.

The player is clamped to the arena bounds after movement. The ticker checks health at the beginning of an update; when health is depleted, it removes the update callback and notifies React through `onGameOver`.

## 3. Collision Detection and Entity AI

### Collision model

Collision checks use Euclidean distance between the centers of the relevant graphics:

```ts
const dx = a.x - b.x;
const dy = a.y - b.y;
const distance = Math.sqrt(dx * dx + dy * dy);

if (distance < collisionThreshold) {
  // Apply damage or remove the projectile.
}
```

The code uses fixed thresholds rather than calculating each graphic's bounds or summing explicit collision radii. This is a lightweight radial/point-distance approximation suited to the small prototype arena. It is not a true AABB (axis-aligned bounding box) test, and it does not account for sprite or polygon extents. Current thresholds include `18` units for enemy projectiles against the player, `16` units for player projectiles against enemies, and `20` units for a Chaser reaching the player.

### Chaser

Each enemy update computes the vector from the enemy to the player:

```ts
const dx = player.x - enemy.graphic.x;
const dy = player.y - enemy.graphic.y;
const angle = Math.atan2(dy, dx);
enemy.graphic.rotation = angle;
```

The Chaser turns toward that vector and advances along the resulting angle using `cos(angle)` and `sin(angle)`, multiplied by `chaserSpeed` and the ticker delta. This is continuous direct pursuit rather than pathfinding; it does not navigate around obstacles. When the player is within the configured contact threshold, the Chaser applies `chaserDamage`, is removed from the stage, and is destroyed. The single-hit Chaser therefore behaves as a kamikaze attacker.

### Shooter

The Shooter also faces the player using the same `Math.atan2` calculation. If it is farther away than `shooterRange`, it moves toward the player; at or inside that range, it stops advancing. It does not retreat when the player gets closer, so this is a one-sided approach/hold-distance rule rather than full distance-maintaining or evasive AI.

The Shooter fires when it is within `shooterRange + 50`. Each enemy stores `lastShotTime`, and `Date.now()` is compared with `shooterCooldown` before creating another projectile. A fired projectile travels in the current facing direction at `shooterBulletSpeed`; when it hits the player it removes `15` health. The initial enemy health is `2` for a Shooter and `1` for a Chaser.

## 4. Resource Management

Game entities are represented by PixiJS `Graphics` objects. They are created when needed and added to the stage; this prototype does not load or retain a runtime texture/spritesheet atlas for gameplay entities.

Projectile updates iterate backward through the bullet array. A projectile is removed from both the stage and the array and its `Graphics` instance is destroyed when it hits a target or leaves the `800 × 600` arena. Destroyed enemies are likewise removed from the stage and enemy collection, along with their health-bar graphics. Backward iteration allows entries to be spliced without skipping the next item.

The application teardown destroys the PixiJS application with its children, covering remaining stage objects when the game screen unmounts. Keyboard listeners are attached to `window` while the effect is active and explicitly removed in its cleanup. These lifecycle measures prevent stale input handlers and detached gameplay resources from accumulating across repeated matches.

## 5. Local Persistence & Network Resilience

### Request and query architecture

`useGameData` creates an Axios client with `/` as its base URL. It exposes two TanStack Query reads:

| Resource | Request | Query key |
| --- | --- | --- |
| Match history | `GET /api/match-history` | `['matchHistory']` |
| Ranking | `GET /api/ranking` | `['ranking']` |

Match completion invokes the `saveMatch` mutation, which sends `POST /api/match-history`. In `src/main.tsx`, the shared `QueryClient` configures queries to retry twice and disables refetch-on-window-focus. A successful save invalidates both query keys with `invalidateQueries`, so subsequent reads refresh both the history and the derived ranking.

### Persistence through MSW

MSW intercepts the API routes in `src/mocks/handlers.ts`. The match-history handler reads and writes the `pirate_match_history` key in browser `localStorage`; this simulates a small local database and retains records across page reloads in the same browser storage context. The POST handler adds a 400 ms delay before persisting the submitted match. This is a latency simulation, not an injected failure; the current handlers do not simulate failed requests. The ranking handler combines stored player matches with three in-memory fictional fixtures, sorts by score descending and then duration ascending, and returns the resulting list.

### Data contracts and current typing boundary

The write payload is defined by `MatchPayload` in `src/hooks/useGameData.ts`:

```ts
interface MatchPayload {
  id: string;
  playerName: string;
  score: number;
  duration: number;
  date: string;
  reason: 'health_depleted' | 'time_expired';
}
```

The MSW handler has a matching local `MatchRecord` interface. A ranking entry has the same fields because the ranking is assembled from `MatchRecord` entries and fixtures. However, the Axios GET response bodies are currently returned without explicit TypeScript response generics, and there is no exported, dedicated typed contract for the ranking or history response collections. The POST handler also casts parsed JSON to `MatchRecord`; this is a compile-time assertion, not runtime payload validation. The API shapes are therefore clear from the implementation, but response typing and runtime validation are not complete.

### Idempotency

`App` assigns `crypto.randomUUID()` to each submitted match. The MSW storage helper checks whether a record with that ID already exists before appending it. Repeated delivery of the same match payload is therefore idempotent at the mock persistence layer: it will not create multiple history entries with the same ID. This protects against duplicate submission of one identified match; generating a fresh UUID for a distinct submission still represents a distinct record.

### Non-blocking gameplay and failure boundary

When the game ends, `App` changes the screen to `GAME_OVER` and then fires the mutation without awaiting it. Persistence is asynchronous and separate from the PixiJS simulation, so a pending request does not keep the canvas mounted or prevent the player from selecting **Play Again**. A new game can start while a previous save is still pending.

The configured query retry policy applies to queries, not to this mutation. The current mutation has no retry or offline queue, and the application does not retain failed writes for later replay or expose a dedicated mutation-error state. The result screen displays a saving label while the mutation is pending and otherwise displays “Saved to Ledger”; because it does not check mutation failure, that label is not proof of durable persistence. Thus, UI/gameplay remain non-blocking during a failed or delayed request, but reliable recovery of failed writes is not implemented yet.

## 6. Game Balancing Decisions & Limitations

Gameplay tuning values are grouped in a local `config` object in `GameCanvas`, keeping frequently adjusted parameters in one place rather than scattering numeric values throughout movement and spawn logic. TypeScript infers the object's types from its values; there is no separate named configuration interface:

| Parameter | Current value | Purpose |
| --- | ---: | --- |
| `playerSpeed` | `3.5` | Player forward movement per normalized ticker frame |
| `playerRotationSpeed` | `0.04` | Player rotation per normalized ticker frame |
| `bulletSpeed` | `9` | Player projectile movement |
| `shootCooldown` | `250 ms` | Front weapon firing interval |
| `sideShootCooldown` | `500 ms` | Side weapon firing interval |
| `enemySpawnInterval` | `2500 ms` | Enemy spawn interval |
| `chaserSpeed` | `2.0` | Chaser pursuit speed |
| `chaserDamage` | `20` | Chaser contact damage |
| `shooterSpeed` | `1.5` | Shooter approach speed |
| `shooterRange` | `250` | Shooter approach stop distance |
| `shooterCooldown` | `1800 ms` | Shooter firing interval |
| `shooterBulletSpeed` | `5` | Shooter projectile movement |

Centralizing these parameters isolates balance adjustments from the structure of the ticker loop and makes the relationship between movement, cooldown, and spawn tuning easier to inspect. Some behavior values remain literal in the implementation rather than being part of `config` (for example, player health, projectile damage, collision thresholds, and arena dimensions), so centralization is not yet comprehensive.

Current scope and limitations:

- Gameplay entities are drawn with vector `Graphics` primitives instead of animated spritesheets. This kept the implementation compact for the challenge's 48-hour delivery window, but does not use the ship/effect assets already present in the repository.
- Collision detection uses simple center-distance thresholds, with no bounding-volume geometry, spatial partitioning, or continuous collision detection.
- Enemy AI is direct steering only: there is no pathfinding, obstacle avoidance, retreat behavior, or difficulty progression.
- The simulation uses ticker-scaled updates rather than a fixed time-step physics model; long frame stalls are not subdivided.
- Game settings and state are local to the canvas, and the match result currently records a fixed `duration` of `60` seconds and a fixed player name in `App`.
- Match persistence is a browser-local MSW mock rather than a remote backend. Failed mutations are not queued for recovery, and ranking fixtures are static mock data.
