'use strict';

const fs = require('node:fs');
const path = require('node:path');

const marker = 'Brace nesting depth exceeds max';
const maxDepth = 100;

const findBracesPackage = () => {
  let directory = process.cwd();

  while (true) {
    const packageDirectory = path.join(directory, 'node_modules', 'braces');
    if (fs.existsSync(path.join(packageDirectory, 'lib', 'parse.js'))) {
      return packageDirectory;
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
};

const packageDirectory = findBracesPackage();

if (!packageDirectory) {
  throw new Error('Could not find braces/lib/parse.js to apply the security patch');
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'),
);

if (packageJson.version !== '3.0.3') {
  throw new Error(
    `Expected braces@3.0.3, found braces@${packageJson.version}; review the security patch before updating`,
  );
}

const parsePath = path.join(packageDirectory, 'lib', 'parse.js');
let source = fs.readFileSync(parsePath, 'utf8');

if (!source.includes(marker)) {
  const depthDeclaration = '  let depth = 0;\n  let value;';
  const guardedDeclaration = [
    '  let depth = 0;',
    '  const MAX_DEPTH = 100;',
    '  const maxDepth = typeof opts.maxDepth === \'number\' && Number.isFinite(opts.maxDepth)',
    '    ? Math.max(0, Math.min(MAX_DEPTH, Math.floor(opts.maxDepth)))',
    '    : MAX_DEPTH;',
    '  let value;',
  ].join('\n');

  const openBrace = '    if (value === CHAR_LEFT_CURLY_BRACE) {\n      depth++;';
  const guardedOpenBrace = [
    '    if (value === CHAR_LEFT_CURLY_BRACE) {',
    '      if (depth >= maxDepth) {',
    '        throw new SyntaxError(`Brace nesting depth exceeds max (${maxDepth})`);',
    '      }',
    '      depth++;',
  ].join('\n');

  if (!source.includes(depthDeclaration) || !source.includes(openBrace)) {
    throw new Error('braces@3.0.3 parser source did not match the expected patch context');
  }

  source = source
    .replace(depthDeclaration, guardedDeclaration)
    .replace(openBrace, guardedOpenBrace);
  fs.writeFileSync(parsePath, source);
}

const braces = require(packageDirectory);
const expanded = braces('file-{a,b}.txt', { expand: true });

if (expanded.join(',') !== 'file-a.txt,file-b.txt') {
  throw new Error('braces security patch changed ordinary brace expansion behavior');
}

const deeplyNestedPattern = '{'.repeat(maxDepth + 1) + 'x' + '}'.repeat(maxDepth + 1);

for (const options of [{}, { expand: true }]) {
  try {
    braces(deeplyNestedPattern, options);
    throw new Error('braces accepted a pattern deeper than the configured security limit');
  } catch (error) {
    if (
      !(error instanceof SyntaxError) ||
      !error.message.includes(marker)
    ) {
      throw error;
    }
  }
}
