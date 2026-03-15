# CueList

CueList is a private, mobile-first web app for managing a playable song catalog,
building setlists, and using those setlists live from an iPad.

The MVP is local-first today, with Dexie/IndexedDB persistence behind repository
interfaces so the data layer can be swapped to Supabase later without coupling
feature UI directly to storage.

## Current Product State

CueList currently includes:

- a mobile-first Songs catalog with contextual search, filtering, and quick add
- a song screen that opens as a viewer-first song sheet with inline ChordPro editing
- performance-specific comfort tracking through song performance profiles
- a Setlists list with direct open vs. Perform actions
- a viewer-first setlist screen with layered edit mode, song picker modal, and reorder support
- a dedicated Perform mode for stage use with large navigation and lyrics/chords display
- a Performance Types management screen with modal add/edit flows
- light mode and dark mode
- Supabase auth with Account page magic-link login/logout
- manual local-first sync controls for signed-in users

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Dexie / IndexedDB

## Local Development

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

## Main Routes

- `/songs`
- `/songs/new`
- `/songs/:id`
- `/setlists`
- `/setlists/new`
- `/setlists/:id`
- `/setlists/:id/perform`
- `/performance-types`
- `/account`

## UX Direction

The app is intentionally moving away from admin-style forms and toward
artifact-first screens:

- Songs open as a readable song sheet first, with editing layered in second
- Setlists open as a readable running order first, with editing layered in second
- Perform mode is a specialized extension of the same setlist/song workflow
- list pages are optimized for quick scanning and touch use on iPad and phone

## Architecture

### Domain

`src/domain/models.ts`
defines the core types:

- `Song`
- `SongPerformanceProfile`
- `PerformanceType`
- `Setlist`
- `SetlistSongEntry`

`src/domain/repositories.ts`
defines repository interfaces for:

- songs
- setlists
- performance types

### Data Layer

Dexie is used as the active local-first persistence layer:

- `src/data/db/cuelist-db.ts`
- `src/data/repositories/dexie-song-repository.ts`dexie-song-repository.ts)
- `src/data/repositories/dexie-setlist-repository.ts`dexie-setlist-repository.ts)
- `src/data/repositories/dexie-performance-type-repository.ts`

Development-only seed utilities live in:

- `src/data/seeds/mock-data.ts`
- `src/data/seeds/seed-database.ts`

### App Wiring

Repository bootstrapping happens in:

- `src/app/bootstrap.ts`
- `src/app/repository-context.tsx`
- `src/app/router.tsx`
This keeps feature code storage-agnostic and makes a future Supabase
implementation much easier to plug in.

## Feature Areas

- Songs: `src/features/songs`
- Setlists: `src/features/setlists`
- Performance Types: `src/features/performance-types`
- Account: `src/features/account`

## Notes For Future Work

- Supabase auth is now wired for magic-link login/logout via the Account page,
  while IndexedDB remains the active local-first data store
- Supabase sync is now in an early manual push/pull phase, with Dexie still
  acting as the primary local store
- the repository boundary is already in place for that migration
- perform mode and song-sheet rendering can continue converging on a shared renderer
- there is currently no automated test suite yet; validation is build + lint + manual UI testing
