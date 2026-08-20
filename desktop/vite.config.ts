import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  // 端口钉死 + strictPort:被占直接报错,绝不换端口——
  // tauri.conf.json 的 devUrl 指向这里,换端口 = 壳加载到别的页面,数据全走内存(静默丢)。
  server: {
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
