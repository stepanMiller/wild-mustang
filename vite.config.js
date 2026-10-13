import { defineConfig } from 'vite';

export default defineConfig({
  base: '/wild-mustang/',
  build: { target: 'safari15', sourcemap: true, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
  define: { __TEST_MODE__: JSON.stringify(process.env.VITE_TEST_MODE === 'true') },
});
