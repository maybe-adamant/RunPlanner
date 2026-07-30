import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const platformImports = ['react', 'react-dom', 'react-redux', '@reduxjs/*', '@tauri-apps/*'];
const engineBoundaryImports = [
  ...platformImports,
  '@run-planner/hades2-catalog',
  '@run-planner/planner',
];
const catalogSchemaImportPatterns = [
  '../catalog-schema',
  '../catalog-schema/**',
  '**/catalog-schema',
  '**/catalog-schema/**',
  '@run-planner/engine/catalog-schema',
  '@run-planner/engine/catalog-schema/**',
];
const rewardKernelImportPatterns = [
  '../reward-kernel',
  '../reward-kernel/**',
  '**/reward-kernel',
  '**/reward-kernel/**',
  '@run-planner/engine/reward-kernel',
  '@run-planner/engine/reward-kernel/**',
];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  {
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/planner/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    files: ['apps/planner/src/ui/**/*.{ts,tsx}'],
    ignores: ['apps/planner/src/ui/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@run-planner/engine/simulation',
              importNames: ['createPreparedProjectCandidateSession', 'simulateProject'],
              message:
                'React consumes published evaluation and workspace interactions; it does not run simulation.',
            },
          ],
          patterns: [
            {
              group: ['**/projections/candidateProjection'],
              importNames: ['createCandidateSessionFactory'],
              message: 'Candidate-session construction belongs to application composition.',
            },
            {
              group: ['**/projections/contextualOptions'],
              importNames: ['createContextualOptionResolver'],
              message: 'Contextual projection authority belongs behind the structured workspace.',
            },
            {
              group: ['**/projections/contextualPicker'],
              importNames: ['createContextualPickerProjection'],
              message: 'Contextual projection authority belongs behind the structured workspace.',
            },
            {
              group: ['**/projections/rewardPicker'],
              importNames: ['createRewardPickerProjection'],
              message: 'Reward projection authority belongs behind the structured workspace.',
            },
            {
              group: ['**/projections/structuredWorkspace'],
              importNames: ['createStructuredWorkspaceProjection'],
              message: 'Structured-workspace construction belongs to application composition.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/planner-engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: engineBoundaryImports,
        },
      ],
    },
  },
  {
    files: ['packages/planner-engine/src/normalized/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: engineBoundaryImports },
            {
              group: [...catalogSchemaImportPatterns, ...rewardKernelImportPatterns],
              message:
                'Normalized collection primitives remain below catalog-schema and reward-kernel.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/planner-engine/src/reward-kernel/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: engineBoundaryImports },
            {
              group: catalogSchemaImportPatterns,
              message:
                'Reward-kernel imports normalized collection primitives directly, not catalog-schema.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/hades2-catalog/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [...platformImports, '@run-planner/planner'],
        },
      ],
    },
  },
);
