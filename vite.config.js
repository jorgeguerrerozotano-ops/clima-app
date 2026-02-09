/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.spec.js'],
  },
  build: {
    // Simplemente subimos el límite del aviso para que no te moleste visualmente.
    // 1600kb es razonable para una app moderna con mapas y gráficos.
    chunkSizeWarningLimit: 1600, 
  },
})