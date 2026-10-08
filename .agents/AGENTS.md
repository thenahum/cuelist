# AGENTS.md — CueList

## Overview

CueList is a **local-first, mobile-focused setlist/songbook app** for musicians.

It is designed as a **personal tool**, not a collaborative platform.

Core principles:
- Instant, local-first interaction (IndexedDB is the source of truth)
- Clean, minimal UI with strong focus on readability
- Mobile-first UX (touch interactions are primary)
- Background sync with Supabase (not real-time, not collaborative)

---

## Security
- Always adhere to .codexignore for files you should not read or access since they contain either sensitive info or unnecessary information that could fill up your context window

---

## Product Philosophy

### Local-first
- All writes happen locally first
- UI must feel instant and offline-capable
- Supabase is used for **backup and cross-device sync**, not as the primary data source

### Personal, not collaborative
- No multi-user editing
- No real-time merge complexity
- Simplicity and reliability > advanced sync features

### Mobile-first UX
- Design for iPhone first
- Avoid desktop-heavy interaction patterns
- Optimize for:
  - thumb reach
  - readability
  - low cognitive load

### Content-first UI
- Prioritize song titles, lyrics, and setlist order
- Controls should never dominate the screen
- Hide or defer controls when not actively needed

---

## Architecture

### Data
- Local DB: IndexedDB (primary working state)
- Cloud: Supabase (sync layer)
- Sync model:
  - push on save (debounced)
  - pull on app open / resume
  - do NOT overwrite dirty local data

### Frontend
- React (Vite)
- Component-driven structure
- Avoid unnecessary global state

### Key Concepts
- Songs
- Setlists
- Performance Profiles
- Setlist Entries (ordered list of songs with overrides)

---

## UX Rules

### General
- Prefer **less UI, not more**
- Avoid clutter, especially on mobile
- Actions should be:
  - obvious
  - intentional
  - hard to trigger accidentally if destructive

### Editing vs Viewing
- Viewer mode = clean, readable
- Edit mode = controls visible
- Do NOT mix both heavily in the same layout

---

## Sensitive UI Areas

### Setlist editing drag-and-drop
This interaction is mobile-first and easy to regress.

Requirements:
- drag starts from the handle only
- the whole card becomes the drag preview
- use a compact drag-mode layout during reorder
- placeholder and preview must stay visually consistent
- do not duplicate card visuals during drag
- prioritize touch friendliness over desktop-style behavior

---

## Perform Mode

Goal: immersive, low-friction reading experience

### Top area
- Minimal:
  - exit
  - song index
  - title
  - artist

### Content area
- Lyrics / chords
- Open Tabs lives **above content**

### Bottom area
- Navigation (prev / next)
- Setlist context (title / venue)
- Entry point to controls (bottom sheet)

### Controls
- Font size, theme, etc. live in a **bottom sheet**
- Do NOT clutter the main screen with controls

---

## Sync Rules

### Push
- Triggered automatically after local save
- Debounced
- Marks records as synced when successful

### Pull
- Happens on app open / resume
- May be manually triggered

### Safety
- NEVER overwrite dirty local data during pull
- Prefer local data if conflict exists (for now)

### Mental Model
User should NOT think about:
- push vs pull
- where latest data lives

---

## Coding Guidelines

### Make small, surgical changes
- Do NOT rewrite large components unless explicitly asked
- Preserve existing behavior whenever possible

### Avoid over-engineering
- No unnecessary abstractions
- No premature architecture layers

### Prefer clarity over cleverness
- Code should be readable and predictable

### Respect existing patterns
- Follow current component and styling patterns
- Do not introduce new paradigms casually

---

## Common Pitfalls to Avoid

- Breaking mobile layout while fixing desktop
- Adding controls that crowd the UI
- Making drag-and-drop visually inconsistent
- Letting placeholder and preview diverge
- Overwriting local unsynced data
- Introducing unnecessary global state
- Changing too many things in one pass

---

## How to Approach Changes

When implementing a feature:

1. Understand the intent (UX + product)
2. Identify the smallest change that solves it
3. Avoid touching unrelated areas
4. Preserve working behavior
5. Prefer incremental improvements over rewrites

---

## When in Doubt

Default to:
- simpler UI
- fewer controls
- safer data behavior
- minimal changes

CueList should feel:
- fast
- calm
- reliable