import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  // 显式纳入预打包:编辑器(Tiptap 系)依赖图较大,靠扫描发现会在首启首开时
  // 现场优化 + 整页重载,实测冷缓存下简历页首开卡到 ~5s(dev 专属问题,打包产物不受影响)。
  optimizeDeps: {
    include: [
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-link',
      '@tiptap/extension-placeholder',
      'tiptap-markdown',
      'marked',
    ],
  },
  // 端口钉死 + strictPort:被占直接报错,绝不换端口——
  // tauri.conf.json 的 devUrl 指向这里,换端口 = 壳加载到别的页面,数据全走内存(静默丢)。
  server: {
    port: 5174,
    strictPort: true,
    // 启动即预热转换全部源码模块:dev 首启否则要现场转换整图(实测冷缓存 ~4s),
    // tauri dev 下 Rust 编译期间预热早已完成,壳打开时页面即时就绪。
    warmup: {
      clientFiles: ['./src/main.tsx', './src/app/**', './src/pages/**', './src/components/**', './src/lib/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
