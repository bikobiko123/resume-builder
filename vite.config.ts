import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages 部署配置：将 'resume-builder' 替换为你的仓库名
  // 如果不使用 GitHub Pages，可以删除这行或设置为 '/'
  base: '/resume-builder/',
  server: {
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
  },
});
