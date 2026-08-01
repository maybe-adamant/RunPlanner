import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const platformImports = [
  'react',
  'react-dom',
  'react-redux',
  '@radix-ui/*',
  '@reduxjs/*',
  '@tauri-apps/*',
];
const plannerApplicationImportPatterns = [
  '@run-planner/planner',
  '@run-planner/planner/**',
  '@planner',
  '@planner/**',
];
const engineBoundaryImports = [
  ...platformImports,
  '@run-planner/hades2-catalog',
  ...plannerApplicationImportPatterns,
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
const structuredWorkspaceBoundaryImportPatterns = [
  {
    group: ['**/projections/structuredWorkspace'],
    message: 'The structured workspace moved to the structured-workspace public entry point.',
  },
  {
    group: ['**/projections/structured-workspace/*'],
    message:
      'Structured-workspace contract and construction modules are private; import the public entry point.',
  },
];
const workspacePrivateFamilyImports = {
  assembly: [
    '**/occurrence-assembly',
    '**/decision-assembly',
    '**/hub-assembly',
    '**/topology-interaction-assembly',
  ],
  inspector: ['**/inspector-defaults', '**/inspector-destinations'],
  markers: ['**/marker-builder', '**/marker-ownership'],
};
const testSupportSyntaxRestrictions = [
  {
    selector:
      ":matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression):matches([source.value=/^@planner-test/], [source.value='@run-planner/test-fixtures'])",
    message: 'Production source must not consume test fixtures or test support.',
  },
];
const purePackageDynamicImportSyntaxRestrictions = [
  {
    selector: 'ImportExpression',
    message: 'Pure package source uses static imports so package boundaries remain enforceable.',
  },
];
const plannerDeepRelativeImportSyntaxRestrictions = [
  {
    selector:
      ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression)[source.value=/^\\.\\.\\/\\.\\.\\//]',
    message:
      'Planner modules may climb one local level; cross-root imports use @planner or @planner-test.',
  },
];
const uiRestrictedImportOptions = {
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
      group: ['**/projections/structured-workspace'],
      importNames: ['createStructuredWorkspaceProjection'],
      message: 'Structured-workspace construction belongs to application composition.',
    },
    ...structuredWorkspaceBoundaryImportPatterns,
  ],
};
const structuredEditorRestrictedImportOptions = {
  paths: uiRestrictedImportOptions.paths,
  patterns: [
    ...uiRestrictedImportOptions.patterns,
    {
      group: ['**/workspace/occurrenceIds'],
      importNames: ['allocateOccurrenceId'],
      message: 'Structured-editor React receives activation-scoped identities from interactions.',
    },
  ],
};
const intentBoundEditorRestrictedImportOptions = {
  paths: [
    ...structuredEditorRestrictedImportOptions.paths,
    {
      name: '@planner/state/projectWorkspaceSlice',
      importNames: ['authoredProjectCommandDispatched'],
      message: 'This migrated editor feature executes complete bound command intents.',
    },
  ],
  patterns: structuredEditorRestrictedImportOptions.patterns,
};

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
    files: ['packages/*/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...testSupportSyntaxRestrictions,
        ...purePackageDynamicImportSyntaxRestrictions,
      ],
    },
  },
  {
    files: ['apps/planner/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...testSupportSyntaxRestrictions,
        ...plannerDeepRelativeImportSyntaxRestrictions,
      ],
    },
  },
  {
    files: ['apps/planner/src/**/*.{ts,tsx}', 'apps/planner/test/**/*.{ts,tsx}'],
    ignores: ['apps/planner/src/projections/structured-workspace/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: structuredWorkspaceBoundaryImportPatterns,
        },
      ],
    },
  },
  {
    files: [
      'apps/planner/src/**/*.test.{ts,tsx}',
      'apps/planner/src/**/*.spec.{ts,tsx}',
      'apps/planner/test/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...plannerDeepRelativeImportSyntaxRestrictions],
    },
  },
  {
    files: ['apps/planner/test/support/structured-workspace/expected-*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...structuredWorkspaceBoundaryImportPatterns,
            {
              group: [
                '**/apps/planner/src/**',
                '**/src/**',
                '@run-planner/planner',
                '@run-planner/planner/**',
              ],
              message:
                'Expected workspace manifests derive only from persisted state, catalog declarations, and direct pure-core authority.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/planner/test/support/structured-workspace/observed-workspace.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...structuredWorkspaceBoundaryImportPatterns,
            {
              allowTypeImports: true,
              group: ['**/src/projections/structured-workspace'],
              message:
                'Workspace observation may know public contract types but may not invoke the workspace producer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/planner/src/projections/structured-workspace/presentation/biome-presentation.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/source-index',
                '**/audit/**',
                '**/interaction-binding',
                ...workspacePrivateFamilyImports.assembly,
                '**/marker-builder',
              ],
              message:
                'Final workspace presentation consumes assembled products, not producer families.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/planner/src/projections/structured-workspace/assembly/biome-semantic-assembly.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/audit/**',
                '**/biome-presentation',
                '**/interaction-binding',
                ...workspacePrivateFamilyImports.inspector,
              ],
              message:
                'Semantic assembly remains upstream of presentation, binding, and navigation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/planner/src/projections/structured-workspace/interactions/interaction-binding.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/biome-presentation', ...workspacePrivateFamilyImports.inspector],
              message: 'Interaction binding does not depend on final presentation or navigation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/planner/src/projections/structured-workspace/navigation/marker-ownership.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/source-index',
                ...workspacePrivateFamilyImports.assembly,
                '**/biome-semantic-assembly',
                '**/biome-presentation',
                '**/marker-builder',
                '**/audit/**',
                '**/interaction-binding',
                ...workspacePrivateFamilyImports.inspector,
              ],
              message: 'Marker ownership depends only on the public workspace contract.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/planner/src/projections/structured-workspace/projector.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...workspacePrivateFamilyImports.assembly,
                ...workspacePrivateFamilyImports.markers,
                ...workspacePrivateFamilyImports.inspector,
              ],
              message: 'The workspace facade composes stage products, not private family builders.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/planner/src/ui/**/*.{ts,tsx}'],
    ignores: ['apps/planner/src/ui/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', uiRestrictedImportOptions],
    },
  },
  {
    files: ['apps/planner/src/ui/editor/**/*.{ts,tsx}'],
    ignores: ['apps/planner/src/ui/editor/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', structuredEditorRestrictedImportOptions],
    },
  },
  {
    files: [
      'apps/planner/src/ui/editor/rewards/**/*.{ts,tsx}',
      'apps/planner/src/ui/editor/biome/HubDecisionWorkbench.tsx',
    ],
    ignores: ['apps/planner/src/ui/editor/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', intentBoundEditorRestrictedImportOptions],
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
          patterns: [...platformImports, ...plannerApplicationImportPatterns],
        },
      ],
    },
  },
);
