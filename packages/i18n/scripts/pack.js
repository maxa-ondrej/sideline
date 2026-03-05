import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

const distPkg = {
  name: pkg.name,
  version: pkg.version,
  type: pkg.type,
  license: pkg.license,
  description: pkg.description,
  repository: pkg.repository,
  sideEffects: [],
  exports: {
    './messages': {
      types: './messages.d.ts',
      import: './messages.js',
    },
    './runtime': {
      types: './runtime.d.ts',
      import: './runtime.js',
    },
  },
};

writeFileSync('dist/package.json', `${JSON.stringify(distPkg, null, 2)}\n`);
console.log('Created dist/package.json');
