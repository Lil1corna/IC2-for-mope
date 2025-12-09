import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        alias: {
            '@minecraft/server-ui': new URL('./src/__mocks__/@minecraft/server-ui.ts', import.meta.url).pathname,
        },
    },
});
