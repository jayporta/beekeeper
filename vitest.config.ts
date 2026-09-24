import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', '.claude/{hooks,review-gate}/**/*.test.mjs']
  }
})
