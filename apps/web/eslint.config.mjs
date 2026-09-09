import next from '@ai-padrao/config-eslint/next.js';

// Hexagonal dependency direction for the web feature contexts.
//
// The root eslint.config.mjs declares a similar boundary for the web
// package, but `pnpm lint` (turbo) fans out to each package's own lint
// script and reads this file directly. The rule is repeated here so
// `pnpm --filter @ai-padrao/web lint` enforces the boundary as well,
// with the additional `**/infrastructure/**` and `**/adapters/**`
// patterns that the root config does not declare.
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
