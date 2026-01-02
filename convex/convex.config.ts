import { defineApp } from 'convex/server'
import betterAuth from '@convex-dev/better-auth/convex.config'
import actionCache from '@convex-dev/action-cache/convex.config'

const app = defineApp()
app.use(betterAuth)
app.use(actionCache)

export default app
