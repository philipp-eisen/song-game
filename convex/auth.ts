import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { anonymous } from 'better-auth/plugins'
import { components } from './_generated/api'
import { query } from './_generated/server'
import authConfig from './auth.config'
import { env } from './env'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: env.SITE_URL,
    database: authComponent.adapter(ctx),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },
    // Email/password only enabled in local development
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
      // Anonymous plugin for guest sign-in (players joining without a full account)
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
