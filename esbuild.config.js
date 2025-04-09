const esbuild = require('esbuild');
const { argv } = require('process');

const config = {
  entryPoints: ['src/index.jsx'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outdir: 'dist',
  loader: {
    '.js': 'jsx',
    '.png': 'file',
    '.svg': 'file',
    '.jpg': 'file',
    '.gif': 'file'
  },
  define: {
    'process.env.NODE_ENV': argv.includes('--serve') ? '"development"' : '"production"'
  },
  plugins: []
};

if (argv.includes('--serve')) {
  esbuild.context(config).then(context => {
    context.serve({
      servedir: 'dist',
      port: 3000
    }).then(() => {
      console.log('Server started on http://localhost:3000');
    });
  });
} else {
  esbuild.build(config).then(() => {
    console.log('Build complete');
  });
}
