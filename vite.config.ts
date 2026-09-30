import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { port: 5173, strictPort: true, watch: { ignored: ['**/.test-data/**', '**/release/**', '**/.impeccable/**'] } }, build: { chunkSizeWarningLimit: 650 } });
