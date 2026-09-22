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
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      reporter: ['text', 'lcov'],
      exclude: ['src/views/**', 'src/main.js'],
    },
  },
});
