// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createNemesisRandomEventAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  loadSurfaceNBuriedTreasureCheckpoint,
  surfaceCheckpointArtifacts,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { underworldCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  createStaleSurfaceHermesDeliveryPlacement,
  loadSurfaceNEntryFrontierResolvedProject,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { simulateProject } from '@run-planner/engine/simulation';
import { cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWorkspace, workspaceProjection } from '@planner-test/support/biome-workbench';
import { ProjectFindings } from '@planner/ui/feedback/EvaluationFeedback';
import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import {
  artemisSourceAnomalyProject,
  cageBeforeAthenaProject,
  staleSeaStarProject,
} from '@planner-test/support/finding-states';

afterEach(cleanup);

/** Containers that carry their own mark; every other container is a navigation anchor. */
const approvedContainers = [
  // Dialog outcome sections, pending their own policy.
  'trait-selected-outcome-detail',
  'echo-last-run-choice',
  // A Hub requirement spread across the whole board or map has no single control.
  'hub-requirement-box',
] as const;
const controlTags = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
const controlRoles = new Set(['radio', 'radiogroup', 'checkbox', 'combobox']);

function isControlOrApproved(element: HTMLElement): boolean {
  return (
    controlTags.has(element.tagName) ||
    controlRoles.has(element.getAttribute('role') ?? '') ||
    approvedContainers.some((name) => element.classList.contains(name))
  );
}

function describeElement(element: HTMLElement): string {
  return `<${element.tagName.toLowerCase()} class="${element.className}" owner=${element.dataset.semanticOwner}>`;
}

const goldenFNemesisPhase = createEncounterPhaseAddress(
  goldenFBiome,
  { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
  'Encounter',
);
const surfaceN = createBiomeAddress('Surface', 'N');

const constructed: readonly (readonly [string, () => ProjectDocument])[] = [
  ['impossible Anomaly', artemisSourceAnomalyProject],
  ['Fields cage ordering issue', cageBeforeAthenaProject],
  ['stale Sea Star', staleSeaStarProject],
  ['stale Hermes delivery', () => createStaleSurfaceHermesDeliveryPlacement().project],
  [
    'Nemesis outcome',
    () =>
      applyProjectCommand(
        applyProjectCommand(createGoldenFGHIProject(), catalog, {
          kind: 'SelectEncounter',
          phase: goldenFNemesisPhase,
          encounterKey: 'NemesisRandomEvent',
        }),
        catalog,
        {
          kind: 'SelectNemesisRandomEventFamily',
          event: createNemesisRandomEventAddress(goldenFNemesisPhase),
          family: 'freeItem',
        },
      ),
  ],
  [
    'unpicked door',
    () =>
      applyProjectCommand(createCompleteFGProject(), catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(goldenFBiome, {
          kind: 'occurrence',
          occurrenceId: createOccurrenceId('golden-f-b1-e1'),
        }),
        value: { kind: 'unresolved' },
      }),
  ],
  [
    'incomplete Hub open set',
    () =>
      applyProjectCommand(loadSurfaceNEntryFrontierResolvedProject(), catalog, {
        kind: 'ReplaceWithHubDecision',
        decision: createExitDecisionAddress(surfaceN, {
          kind: 'occurrence',
          occurrenceId: nOccurrenceIds.preHub,
        }),
        hub: createHubDecisionAddress(surfaceN, 'hub'),
      }),
  ],
];

const witnesses = [
  ...Object.entries({ ...underworldCheckpointArtifacts, ...surfaceCheckpointArtifacts }).map(
    ([id, artifact]) => [id, () => artifact.load()] as const,
  ),
  ...constructed,
].flatMap(([name, load]) => {
  const project = load();
  const owner = simulateProject(catalog, project).route.issue?.owner;
  return owner === undefined ||
    !('biomeKey' in owner) ||
    !project.route.biomes.some((biome) => biome.biomeKey === owner.biomeKey)
    ? []
    : [[name, project, owner.routeKey, owner.biomeKey] as const];
});

describe('finding paint targets', () => {
  it('has finding witnesses to render', () => {
    expect(witnesses.length).toBeGreaterThan(8);
  });

  it.each(witnesses)(
    'paints only controls or approved dialog sections for %s',
    async (_name, project, routeKey, biomeKey) => {
      const view = renderWorkspace(project, routeKey, biomeKey);
      const workspace = workspaceProjection(view.application);
      const issue =
        view.application.store.getState().projectWorkspace.assembly!.evaluation.route.issue;
      const findings = render(
        <Provider store={view.application.store}>
          <ProjectFindings catalog={catalog} issue={issue} focusByOwner={workspace.focusByOwner} />
        </Provider>,
      );
      await view.user.click(findings.container.querySelector('button')!);
      const painted = [
        ...view.container.querySelectorAll<HTMLElement>('[data-has-findings="true"]'),
      ];
      expect(
        painted.filter((element) => !isControlOrApproved(element)).map(describeElement),
      ).toEqual([]);
    },
  );

  it('paints an invalid route trait on its launcher, not its row', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNBuriedTreasureCheckpoint()));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const painted = [
      ...view.container.querySelectorAll<HTMLElement>(
        '.route-traits-panel [data-has-findings="true"]',
      ),
    ];
    expect(painted.map((element) => element.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Edit Trait: Buried Treasure/),
    ]);
  });
});

const uiRoot = join(dirname(fileURLToPath(import.meta.url)), '../../src/ui');

function stylesheets(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

/** Top-level comma split that keeps `:is(...)` lists whole. */
function selectorList(selector: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of selector) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += character;
  }
  parts.push(current.trim());
  return parts;
}

const controlCompound =
  /^(?:button|input|select|textarea|\.encounter-composition-edit|\.contextual-picker-trigger|:is\([^)]*\))(?:[:[.]|$)/;
const approvedIsList = new Set([
  'button',
  'input',
  'select',
  'textarea',
  "[role='radiogroup']",
  '.contextual-picker-trigger',
  ...approvedContainers.map((name) => `.${name}`),
]);

describe('finding paint styles', () => {
  it('styles finding marks only on controls or approved dialog sections', () => {
    const violations: string[] = [];
    for (const path of stylesheets(uiRoot)) {
      const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const rule of source.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
        for (const selector of selectorList(rule[1]!)) {
          if (!/data-has-(?:findings|issues)|data-invalid/.test(selector)) continue;
          const subject = selector.split(/\s+(?![^(]*\))/).at(-1) ?? '';
          const isList = /^:is\(([^)]*)\)/.exec(subject)?.[1];
          const allowed =
            controlCompound.test(subject) &&
            (isList === undefined ||
              isList.split(',').every((entry) => approvedIsList.has(entry.trim())));
          if (!allowed) violations.push(`${relative(uiRoot, path)}: ${selector}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
