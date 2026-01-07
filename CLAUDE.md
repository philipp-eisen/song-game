# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Song Game (Songeras) is a collaborative music-based timeline game where players arrange songs chronologically. Built with Convex backend, TanStack Start frontend, and shadcn/ui components.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start Convex backend + Vite dev servers |
| `pnpm dev:web` | Start Vite dev server only |
| `pnpm dev:db` | Start Convex backend only |
| `pnpm build` | Build with Vite + type check |
| `pnpm test` | Run Vitest unit tests |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm check` | Format + lint with auto-fixes |
| `pnpm deploy` | Deploy to Convex production |

## Architecture

### Frontend (`/src`)
- **TanStack Start** with file-based routing in `/src/routes/`
- **React Query** for server state + caching via `@convex-dev/react-query`
- **shadcn/ui** components in `/src/components/ui/` (40+ pre-built)
- Feature components organized by domain: `/src/components/play/`, `/src/components/playlists/`

### Backend (`/convex`)
- **Convex** for database, real-time subscriptions, and API
- **Better Auth** with Google OAuth + anonymous guest accounts
- Key files: `games.ts` (game engine), `turns.ts` (turn management), `playlists.ts`, `spotify.ts`, `appleMusic.ts`

### Database Schema
- **playlists/playlistTracks**: Music library with Spotify/Apple Music integration
- **games/gamePlayers/gameCards**: Game sessions with player seats and card states
- **timelineEntries**: Ordered cards in player timelines

### Game State Machine
`lobby` → `awaitingPlacement` → `awaitingReveal` → `revealed` → `finished`

### Authentication
- Server-side auth via `/src/lib/auth-server.ts`
- Client-side auth via `/src/lib/auth-client.ts`
- SSR-aware token management in root layout

## Code Conventions

- **Always run `tsc` and lint** after making changes
- **Create small components** in `/components/`, not everything in routes
- **Environment variables**: Declare in `/convex/env.ts` using Zod validation
- **Icons**: Use Phosphor icons with "Icon" suffix (e.g., `SpotifyLogoIcon`) and `weight="duotone"`
- **Prettier**: No semicolons, single quotes, trailing commas
- **Path alias**: `@/*` maps to `./src/*`

## Convex Best Practices

### Function Syntax
Always use the new function syntax with argument and return validators:
```typescript
import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const myQuery = query({
  args: { id: v.id("users") },
  returns: v.object({ name: v.string() }),
  handler: async (ctx, args) => {
    // ...
  },
})
```

### Public vs Internal Functions
- Use `query`, `mutation`, `action` for public API endpoints
- Use `internalQuery`, `internalMutation`, `internalAction` for private functions
- Access via `api.filename.functionName` (public) or `internal.filename.functionName` (private)

### Database Queries
- **Never use `.filter()`** - always use indexes with `.withIndex()`
- Index names should include all fields: `by_field1_and_field2`
- Use `.unique()` for single document queries
- Use `.order('desc')` or `.order('asc')` for ordering

### Type Safety
- Use `Id<'tableName'>` for document IDs, not `string`
- Use `Doc<'tableName'>` to get the full document type
- Always include return validators, use `returns: v.null()` if returning nothing

### Actions (External API Calls)
- Add `"use node";` at top of files using Node.js modules
- Actions cannot access `ctx.db` - call queries/mutations via `ctx.runQuery`/`ctx.runMutation`
- Minimize query/mutation calls from actions to avoid race conditions

### Scheduling
```typescript
// Schedule immediate background work
await ctx.scheduler.runAfter(0, internal.myFile.myFunction, { arg: value })

// Schedule delayed work
await ctx.scheduler.runAfter(5000, internal.myFile.myFunction, { arg: value })
```

## Key Patterns

### Convex Queries with React Query
```typescript
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../convex/_generated/api"

const { data } = useQuery(convexQuery(api.games.get, { gameId }))
```

### File-Based Routes
Routes use TanStack Router conventions:
- `routes/index.tsx` → `/`
- `routes/games.tsx` → `/games`
- `routes/play.$joinCode.tsx` → `/play/:joinCode`
- `routes/playlists_.$playlistId.tsx` → `/playlists/:playlistId`

## External Documentation

When using libraries, check the most recent docs using the context7 MCP tools.
