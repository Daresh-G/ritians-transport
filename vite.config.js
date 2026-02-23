import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
    },
    server: {
        port: 5173, // Default Vite port to avoid conflict with backend
        open: true,
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
});
