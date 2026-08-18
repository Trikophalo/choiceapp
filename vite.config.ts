import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The GitHub Pages project path (https://<user>.github.io/<repo>/) becomes the
// asset base. Override with VITE_BASE=/ when deploying to a custom domain.
const base = process.env.VITE_BASE ?? '/choiceapp/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
