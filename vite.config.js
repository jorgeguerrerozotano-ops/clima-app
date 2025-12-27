import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Aumentamos el límite de aviso a 1000kb para que no sea tan pesado,
    // ya que hoy en día 500kb es aceptable.
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 1. Separar React (Core)
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // 2. Separar Mapas (Leaflet es pesado)
          if (id.includes('node_modules/leaflet')) {
            return 'vendor-maps';
          }
          // 3. Separar Gráficos (Recharts es MUY pesado)
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          // 4. Separar Iconos (Tienes muchos iconos de Lucide y Phosphor)
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/@phosphor-icons')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
})