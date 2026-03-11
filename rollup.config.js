import { readFileSync } from 'node:fs';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

const version = JSON.parse(
  readFileSync('./node_modules/react/package.json', 'utf8')
).version;

function react(mode) {
  const prod = mode === 'production';
  const suffix = prod ? '.production.min' : '.development';

  return {
    input: 'src/react-entry.js',
    output: {
      file: `dist/react${suffix}.js`,
      format: 'umd',
      name: 'React',
      exports: 'default',
      banner: `/*! react${suffix}.js v${version} */`,
    },
    plugins: [
      replace({ 'process.env.NODE_ENV': JSON.stringify(mode), preventAssignment: true }),
      resolve(),
      commonjs(),
      prod && terser({ compress: { dead_code: true, passes: 2, unused: true }, format: { comments: false, ascii_only: true } }),
    ],
  };
}

function reactDOM(mode) {
  const prod = mode === 'production';
  const suffix = prod ? '.production.min' : '.development';

  return {
    input: 'src/react-dom-entry.js',
    external: ['react'],
    output: {
      file: `dist/react-dom${suffix}.js`,
      format: 'umd',
      name: 'ReactDOM',
      exports: 'default',
      globals: { react: 'React' },
      banner: `/*! react-dom${suffix}.js v${version} */`,
    },
    plugins: [
      replace({ 'process.env.NODE_ENV': JSON.stringify(mode), preventAssignment: true }),
      resolve(),
      commonjs(),
      prod && terser({ compress: { dead_code: true, passes: 2, unused: true }, format: { comments: false, ascii_only: true } }),
    ],
  };
}

export default [
  react('development'),
  react('production'),
  reactDOM('development'),
  reactDOM('production'),
];
