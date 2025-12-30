import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  clean: true,
  minify: true,
  treeshake: true,
  splitting: false,
  sourcemap: false,
  esbuildOptions(options) {
    options.legalComments = 'none';
    options.drop = ['debugger'];
  },
  dts: {
    compilerOptions: {
      removeComments: true,
    },
  },
});
