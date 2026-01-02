import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './apple-music-openapi.yaml',
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
