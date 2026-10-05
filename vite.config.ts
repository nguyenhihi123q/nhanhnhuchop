import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Nhanh như chớp – Vòng tinh hoa
// SPA tĩnh, triển khai lên Vercel với output `dist`.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});


