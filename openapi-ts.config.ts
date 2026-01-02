import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: 'https://applemusicapi.obrhoff.de/openapi.yaml',
  output: {
    path: 'src/generated/apple-music',
    format: 'prettier',
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: 'zod',
    },
  ],
})
