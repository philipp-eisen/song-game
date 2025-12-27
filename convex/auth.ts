import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { anonymous } from 'better-auth/plugins'
import { components } from './_generated/api'
import { query } from './_generated/server'
import authConfig from './auth.config'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

const siteUrl = process.env.SITE_URL
if (!siteUrl) {
  throw new Error('Missing required environment variable: SITE_URL')
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // Email/password only enabled in local development
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID as string,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
        // Request streaming scopes for Web Playback SDK
        scope: [
          'user-read-email',
          'user-read-private',
          'streaming',
          'user-modify-playback-state',
          'user-read-playback-state',
        ],
      },
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
      // Anonymous plugin for guest sign-in (sidecar players joining without Spotify)
      anonymous({
        emailDomainName: 'guest.songgame.local',
      }),
    ],
  })
}

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx)
  },
})
