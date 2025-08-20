import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default [
  // UMD build
  {
    input: 'src/index.js',
    output: {
      name: 'DataExplorerLib',
      file: 'dist/data-explorer-lib.js',
      format: 'umd',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  },
  // ES module build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/data-explorer-lib.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  },
  // Minified UMD build
  {
    input: 'src/index.js',
    output: {
      name: 'DataExplorerLib',
      file: 'dist/data-explorer-lib.min.js',
      format: 'umd',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs(),
      terser()
    ]
  }
];
