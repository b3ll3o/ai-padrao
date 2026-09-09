// Root eslint config: applies per-package rules based on file location.
// `pnpm lint` (turbo) fans out to each package's own lint script and
// reads its local eslint.config.mjs, so this file is what runs when
// ESLint is invoked from the repo root (CI, editors).

import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// API forbidden imports for domain + application layers.
// Domain code may not depend on frameworks or infrastructure.
// Application code may depend on domain only — ports live in domain.
const apiForbiddenPatterns = [
  '@nestjs/*',
  '@prisma/*',
  'nestjs-zod',
  'argon2',
  'passport',
  'passport-jwt',
  'rxjs',
  'reflect-metadata',
];

// Web forbidden imports for domain + application layers.
// Domain code may not depend on React, Next.js, browser APIs, or transport.
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
];

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**'],
  },
  // API: per-package base rules.
  {
    files: [
      'apps/api/**/*.ts',
      'apps/api/**/*.tsx',
      'apps/api/**/*.js',
      'apps/api/**/*.jsx',
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', project: false },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // API: hexagonal domain layer — no frameworks, no infrastructure.
  {
    files: ['apps/api/src/contexts/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: apiForbiddenPatterns.map((p) => ({ group: [p], message: `Domain code must not import ${p}.` })),
        },
      ],
    },
  },
  // API: hexagonal application layer — domain only via ports.
  {
    files: ['apps/api/src/contexts/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: apiForbiddenPatterns.map((p) => ({
            group: [p],
            message: `Application code must not import ${p}; depend on ports instead.`,
          })),
        },
      ],
    },
  },
  // Web: per-package base rules.
  {
    files: [
      'apps/web/**/*.ts',
      'apps/web/**/*.tsx',
      'apps/web/**/*.js',
      'apps/web/**/*.jsx',
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', project: false },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Web: hexagonal domain + application — no React, Next, browser, transport.
  {
    files: ['apps/web/src/features/**/{domain,application}/**/*.ts'],
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
  prettier,
];