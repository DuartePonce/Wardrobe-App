import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Wardrobe-App/', // <-- THIS IS THE FIX
  plugins: [react()],
})