import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8787',
      '^/s/[A-Za-z0-9_-]{16}$': 'http://localhost:8787',
    },
  },
})