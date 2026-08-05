import next from '@ai-padrao/config-eslint/next.js';

// Hexagonal dependency direction for the web feature contexts.
//
// The root eslint.config.mjs declares the same boundary, but it only applies
// when eslint runs from the repo root (lint-staged). `pnpm lint` fans out to
// each package's own lint script, so the rule is repeated here to make
// `pnpm --filter @ai-padrao/web lint` enforce the boundary as well.
const webForbiddenPatterns = [
  'react',
  'react-dom',
  'next/*',
  'next/navigation',
  'next/headers',
  'next/server',
  '@tanstack/react-query',
  '@hookform/resolvers',
  'react-hook-form',
  'ky',
  'server-only',
  '**/infrastructure/**',
  '**/adapters/**',
];

export default [
  ...next,
  {
    files: ['src/features/**/domain/**/*.ts', 'src/features/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: webForbiddenPatterns.map((p) => ({
            group: [p],
            message: `Domain/application code must not import ${p}.`,
          })),
        },
      ],
    },
  },
];
