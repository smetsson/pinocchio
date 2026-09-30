import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative base + hash routing = works on any GitHub Pages repo name.
  base: './',
  plugins: [preact()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
