import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    // UMD 格式（用于直接在浏览器中通过 <script> 标签加载）
    {
      format: 'umd',
      syntax: ['chrome >= 53', 'firefox >= 40', 'safari >= 11'],
      umdName: 'vastASR',
      output: {
        distPath: {
          root: './dist/umd',
        },
      },
    },
    // ESM 格式（用于现代打包工具和浏览器）
    {
      format: 'esm',
      syntax: ['chrome >= 53', 'firefox >= 40', 'safari >= 11'],
      output: {
        distPath: {
          root: './dist/esm',
        },
      },
      dts: true, // 生成类型定义文件
    },
  ],
  output: {
    target: 'web',
    minify: true,
    sourceMap: true,
  },
  // 添加 polyfill 配置
  source: {
    preEntry: './src/polyfills.ts',
  },
});
