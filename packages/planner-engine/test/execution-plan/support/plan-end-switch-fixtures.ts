import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createRouteAddress,
  roomActionKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  challengeSwitchEncounterSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { loadSurfaceNOPQCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';

const press = Object.freeze({ kind: 'interactChallengeSwitch' as const });

/** The project ending after one settled room. */
export function endAt(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePlanEnd',
    route: createRouteAddress(project.route.routeKey),
    planEnd: { biomeKey, occurrenceId: createOccurrenceId(occurrenceId) },
  });
}

function occurrenceOf(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const occurrence = project.route.biomes
    .find((plan) => plan.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error(`${occurrenceId} is not authored`);
  return occurrence;
}

/** Observes a switch, presses it last in its room and settles the press's outcome. */
function pressedSwitch(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
  variantKey: string,
  outcome?: Partial<Extract<ProjectCommand, { kind: 'ReplaceChallengeSwitchOutcome' }>>,
): ProjectDocument {
  const biome = createBiomeAddress(project.route.routeKey, biomeKey);
  const id = createOccurrenceId(occurrenceId);
  const occurrence = createOccurrenceAddress(biome, id);
  let next = applyProjectCommand(project, catalog, {
    kind: 'ReplaceChallengeSwitch',
    occurrence,
    variantKey,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(biome, id, roomActionKey(press)),
    reference: press,
    index: occurrenceOf(next, biomeKey, occurrenceId).roomActions.order.length,
  });
  if (outcome === undefined) return next;
  const current = occurrenceOf(next, biomeKey, occurrenceId).challengeSwitch!;
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceChallengeSwitchOutcome',
    occurrence,
    outcome: current.outcome,
    nectarDropped: false,
    ...(current.gold === undefined || outcome.outcome === 'left' ? {} : { gold: current.gold }),
    ...outcome,
  } as ProjectCommand);
}

/** The switch's generated composition, initialized from the engine's entry capability. */
function composedSwitch(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const occurrence = createOccurrenceAddress(
    createBiomeAddress(project.route.routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
  );
  const capability = challengeSwitchEncounterSupportForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, project),
    occurrence,
  );
  if (capability === undefined) throw new Error(`${occurrenceId} has no composable switch`);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceChallengeSwitchCustomization',
    occurrence,
    decisionKey: capability.decisionKey,
    value: capability.initialize() as never,
  });
}

/** F ending mid-biome, after its fifth room. */
export function underworldFCutEndProject(): ProjectDocument {
  return endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e1');
}

/** N ending inside its Hub stay, after the first visit and its side rooms. */
export function surfaceNPartialHubProject(): ProjectDocument {
  return endAt(loadSurfaceNProject(), 'N', 'surface-n-combat05');
}

/** A hitless Perfect Clear with its bonus Nectar, then a composed Time switch finished for gold. */
export function underworldFSwitchesProject(): ProjectDocument {
  const perfect = pressedSwitch(
    createCompleteFGProject(),
    'F',
    'golden-f-b5-e1',
    'PerfectClearChallengeSwitch_MaxHealth',
    { outcome: 'hitless', nectarDropped: true },
  );
  const time = pressedSwitch(perfect, 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
    outcome: 'finished',
    gold: 35,
  });
  return endAt(composedSwitch(time, 'F', 'golden-f-b8-e1'), 'F', 'golden-f-b9-e1');
}

/** A Perfect Clear taken with a hit for the Onion, then a Time fight left unfinished. */
export function underworldFSwitchesFailedLeftProject(): ProjectDocument {
  const perfect = pressedSwitch(
    createCompleteFGProject(),
    'F',
    'golden-f-b5-e1',
    'PerfectClearChallengeSwitch_MaxHealth',
    { outcome: 'failed' },
  );
  const time = pressedSwitch(perfect, 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
    outcome: 'left',
  });
  return endAt(time, 'F', 'golden-f-b9-e1');
}

/** A finished Elite switch with its pinned elite and forced attributes, the plan ending after P's next room. */
export function surfacePEliteSwitchProject(): ProjectDocument {
  const host = createOccurrenceAddress(
    createBiomeAddress('Surface', 'P'),
    createOccurrenceId('surface-p-6-1-p_combat10'),
  );
  const pressed = pressedSwitch(
    loadSurfaceNOPQCheckpoint(),
    'P',
    'surface-p-6-1-p_combat10',
    'EliteChallengeSwitch_MaxMana',
    { outcome: 'finished' },
  );
  const pinned = applyProjectCommand(pressed, catalog, {
    kind: 'ReplaceChallengeSwitchElite',
    occurrence: host,
    elite: { enemyKey: 'Dragon_Elite', attributeKeys: ['Frenzy', 'Blink'] },
  });
  return endAt(pinned, 'P', 'surface-p-7-1-p_story01');
}
