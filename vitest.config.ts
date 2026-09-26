import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The migration tests boot Postgres (PGlite) once per file.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
