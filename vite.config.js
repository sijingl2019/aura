import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';
export default defineConfig({
    plugins: [
        react(),
        electron({
            main: {
                entry: 'electron/main.ts',
                vite: {
                    resolve: {
                        alias: {
                            '@shared': path.resolve(__dirname, 'shared'),
                        },
                    },
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: ['better-sqlite3', 'electron'],
                        },
                    },
                },
            },
            preload: {
                input: 'electron/preload.ts',
                vite: {
                    resolve: {
                        alias: {
                            '@shared': path.resolve(__dirname, 'shared'),
                        },
                    },
                    build: {
                        outDir: 'dist-electron',
                    },
                },
            },
            renderer: {},
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@shared': path.resolve(__dirname, 'shared'),
        },
    },
    clearScreen: false,
});
