import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'
export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [react(), ...(mode === 'browser' ? [] : [electron({
    main: { entry: 'electron/main.ts', vite: { build: { rollupOptions: { external: ['node:sqlite'] } } } },
    preload: { input: path.join(__dirname, 'electron/preload.ts') },
  })])],
}))
