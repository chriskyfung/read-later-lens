import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const SRC = `${import.meta.dirname}/src`;

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: { src: SRC },
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      // Required for the lazy `import('compromise')` in src/analytics/keywords.js
      // to become its own chunk. Without it the bundler inlines the dynamic
      // import back into the entry chunk, defeating the lazy load (verified in
      // the adoption spike: identical 531 kB entry chunk with and without).
      output: {
        codeSplitting: true,
        manualChunks(id) {
          if (id.includes('node_modules/compromise')) return 'compromise';
          if (id.includes('node_modules/d3')) return 'd3';
        },
      },
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/views/**', 'src/app/main.js'],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
