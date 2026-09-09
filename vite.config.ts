import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Mantém o editor no mesmo origin para preservar LocalStorage/IndexedDB entre reinícios.
// Se a porta estiver ocupada, o Vite falha em vez de mudar silenciosamente para outra origem.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
