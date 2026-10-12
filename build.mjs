import { build, context } from 'esbuild';
const opts = { entryPoints: ['src/main.js'], bundle: true, outfile: 'dist/game.js', format: 'iife', minify: false, sourcemap: false, logLevel: 'info' };
if (process.argv.includes('--watch')) { const c = await context(opts); await c.watch(); }
else if (process.argv.includes('--icons')) { await build({ entryPoints: ['src/iconpage.js'], bundle: true, outfile: 'tools/iconpage.js', format: 'iife', logLevel: 'warning' }); }
else await build(opts);
