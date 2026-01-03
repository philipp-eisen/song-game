import { z } from 'zod/v4'

/**
 * Environment variable schema - central place for all env validation
 * Similar to Pydantic Settings in Python
 */
const envSchema = z.object({
  // Core
  SITE_URL: z.url(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Spotify API
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),

  // Apple Music API
  APPLE_TEAM_ID: z.string().min(1),
  APPLE_KEY_ID: z.string().min(1),
  APPLE_PRIVATE_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

/**
 * Parse and validate environment variables
 * Throws a detailed error if any required variables are missing or invalid
 */
function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = z.prettifyError(result.error)
    throw new Error(`Environment validation failed:\n${formatted}`)
  }

  return result.data
}

/**
 * Validated environment variables
 * Access these instead of process.env directly
 */
export const env = parseEnv()
