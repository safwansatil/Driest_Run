import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
<<<<<<< HEAD
=======
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
  },
>>>>>>> 705dc6ca0440e41e6b0557e9582601daa775e537
})
