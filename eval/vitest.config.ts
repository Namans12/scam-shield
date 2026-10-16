import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts', 'src/**/*.test.ts', 'test/**/*.test.ts'],
    passWithNoTests: true,
  },
});
