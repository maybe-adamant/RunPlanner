import { describe, expect, it } from 'vitest';

import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import { simulateProject } from '@run-planner/engine/simulation';

import { semanticAddressKey } from '../../../src/authored-project/addresses';
import type { ProjectDocument, RoomOccurrence } from '../../../src/authored-project/model';
import { roomLifecycleProfileKey } from '../../../src/authored-project/room-actions/lifecycle-profile';
import { resolveEntryDeclaration } from '../../../src/authored-project/room-state/entry-resolution';
import { equivalenceCorpus } from '../../equivalence/corpus';

/**
 * Witness for the two lifecycle-profile selections: the catalog selector that
 * commands and defaults use, and the profile materialization hands the walk.
 * Every corpus room where they disagree is listed by cause, so a new
 * disagreement, or one that goes away, fails.
 */

type Source = 'hub' | 'entry-resolution' | 'template literal' | 'declaration key' | 'default';

interface Observation {
  readonly entry: string;
  readonly room: string;
  /** Template, role, state kind, derived Clockwork reward, both profiles and the walk's source. */
  readonly cause: string;
  readonly agrees: boolean;
}

interface FoundRoom {
  readonly room: Record<string, unknown>;
  readonly hubTarget: boolean;
}

/** Every materialized room in a canonical biome or prefix, marking Hub board targets. */
function materializedRooms(value: unknown, hubTarget: boolean, found: FoundRoom[]): void {
  if (Array.isArray(value)) {
    for (const item of value) materializedRooms(item, hubTarget, found);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (
    typeof record['lifecycleProfileKey'] === 'string' &&
    (record['kind'] === 'authored' || record['kind'] === 'hub')
  )
    found.push({ room: record, hubTarget });
  for (const [key, child] of Object.entries(record)) {
    if (key === 'origin' || key === 'incomingReward') continue;
    materializedRooms(child, key === 'room' && 'hubSlotKey' in record, found);
  }
}

const countedTemplates = new Set([
  'FixedOpening',
  'FixedPreHub',
  'Fountain',
  'Miniboss',
  'StandardCombat',
  'EphyraSideRoom',
]);

/** Which materialization step chose the walk's profile. */
function walkSource(declaration: RoomDeclaration, found: FoundRoom): Source {
  const { room } = found;
  if (room['kind'] === 'hub' || found.hubTarget || 'localVisit' in room) return 'hub';
  if (room['entry'] === true) return 'entry-resolution';
  const template = declaration.mode.kind === 'authored' ? declaration.mode.templateKey : '';
  const counted =
    countedTemplates.has(template) ||
    (template === 'ClockworkCombat' && room['clockworkReward'] !== 'goal');
  if (counted || template === 'Story')
    if (declaration.lifecycleProfileKey !== undefined) return 'declaration key';
  return counted ? 'default' : 'template literal';
}

function observe(name: string, catalog: Catalog, project: ProjectDocument): Observation[] {
  const result = simulateProject(catalog, project);
  const seen = new Set<string>();
  const observations: Observation[] = [];
  const { routeKey, itineraryBiomeKeys } = project.route;
  for (const evaluation of result.route.biomes) {
    const plan = project.route.biomes.find((biome) => biome.biomeKey === evaluation.biomeKey);
    const occurrences = new Map<string, RoomOccurrence>(
      (plan?.topology?.occurrences ?? []).map((occurrence) => [
        occurrence.occurrenceId,
        occurrence,
      ]),
    );
    const found: FoundRoom[] = [];
    for (const key of ['snapshot', 'materializedPrefix', 'assessmentPrefix'] as const)
      if (key in evaluation)
        materializedRooms((evaluation as unknown as Record<string, unknown>)[key], false, found);
    for (const room of found) {
      const identity = `${evaluation.biomeKey}\u0000${semanticAddressKey(room.room['origin'] as never)}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const gameName = room.room['gameName'] as string;
      const raw = catalog.rooms.byKey[gameName];
      if (raw === undefined) throw new Error(`${name}: unknown room ${gameName}`);
      const declaration = resolveEntryDeclaration(raw, {
        routeKey,
        isFirst: itineraryBiomeKeys.indexOf(evaluation.biomeKey) === 0,
      });
      const hub = room.room['kind'] === 'hub';
      const occurrence = hub ? undefined : occurrences.get(room.room['occurrenceId'] as string);
      if (!hub && occurrence === undefined)
        throw new Error(`${name}: ${gameName} has no authored occurrence`);
      const role = 'localVisit' in room.room ? 'localVisit' : 'ordinary';
      // A Hub board room has no occurrence; it declares one fixed lifecycle.
      const selector = hub
        ? declaration.lifecycleProfile.kind === 'fixed'
          ? declaration.lifecycleProfile.profileKey
          : `(${declaration.lifecycleProfile.kind} without an occurrence)`
        : roomLifecycleProfileKey(declaration, occurrence!, role);
      const walk = room.room['lifecycleProfileKey'] as string;
      const template =
        declaration.mode.kind === 'authored'
          ? declaration.mode.templateKey
          : `derived ${declaration.mode.classification}`;
      const clockwork = room.room['clockworkReward'] as string | undefined;
      observations.push({
        entry: name,
        room: `${evaluation.biomeKey}:${gameName}`,
        cause: [
          `${routeKey} ${template}`,
          hub ? 'board' : role,
          room.hubTarget ? 'Hub target' : room.room['entry'] === true ? 'entry' : 'room',
          `state ${occurrence?.state.kind ?? 'none'}`,
          ...(clockwork === undefined ? [] : [`Clockwork ${clockwork}`]),
          `selector ${selector}`,
          `walk ${walk} (${walkSource(declaration, room)})`,
        ].join(', '),
        agrees: selector === walk,
      });
    }
  }
  return observations;
}

const freshFileFrontier = Array.from(
  { length: 27 },
  (_, index) => `fresh-file/frontier/${String(index).padStart(2, '0')} F:F_Opening01`,
);

/** Every N hub entry: the board room and Miniboss target are selected differently. */
const hubEntries = [
  'execution/surface-n',
  'execution/surface-n-opening-composition',
  'execution/surface-nopq',
  'execution/surface-q-shop-correlation',
  'execution/dream-mixed-prefix',
  'execution/surface-scheduled-lifecycle',
  'execution/surface-generated-precombat',
  'execution/surface-n-phial-intermediate-fountain',
  'execution/surface-shrine-deliveries',
  'execution/surface-shrine-rushed-unranked',
  'execution/surface-travel-deal-refill-anvil',
  'execution/surface-no-rerolls',
  'execution/surface-trait-fences',
  'execution/surface-selene-hex-path',
  'execution/surface-start-q-opening',
  'execution/dream-start-n-opening',
  'execution/surface-n-partial-hub',
  'execution/surface-p-elite-switch',
  'checkpoint/dream-mixed-handoff',
  'checkpoint/surface-n',
  'checkpoint/surface-encounter-showcase',
  'checkpoint/surface-anvil',
  'checkpoint/surface-ordinary-hex-path',
  'checkpoint/surface-selene-hex-path',
  'checkpoint/surface-shrine-travel-deal',
  'checkpoint/surface-scheduled-lifecycle',
  'checkpoint/surface-n-phial-intermediate-fountain',
  'checkpoint/surface-n-natural-selection-frontier',
  'checkpoint/surface-n-natural-selection',
  'checkpoint/surface-n-queens-ransom',
  'checkpoint/surface-n-steady-growth-frontier',
  'checkpoint/surface-n-quick-buck',
  'checkpoint/surface-n-buried-treasure',
  'checkpoint/surface-n-resources',
  'checkpoint/surface-n-shrine-side-room-delivery',
  'checkpoint/surface-no',
  'checkpoint/surface-no-hermes-shrine-delivery',
  'checkpoint/surface-nop',
  'checkpoint/surface-p-steady-growth-shrine-frontier',
  'checkpoint/surface-nopq',
  'checkpoint/surface-n-complete-hub-frontier',
  'checkpoint/surface-n-partial-hub',
  'checkpoint/surface-n-story-board',
  'checkpoint/surface-n-ten-open-invalid',
  'surface/loadSurfaceNOPQProject',
  'surface/surfaceAnvilProject',
  'surface/createSurfaceNOHermesShrineDeliveryCheckpoint',
  'surface/surfaceShrineTravelDealProject',
  'surface/createSurfaceNShrineSideRoomDeliveryCheckpoint',
  'surface/createSurfaceNUnresolvedBossHermesDeliveryCheckpoint',
  'surface/surfaceEncounterShowcaseProject',
  'surface/createRepresentativeNOPQShopTraitProject',
  'surface/surfaceOrdinaryHexPathProject',
  'surface/surfaceSeleneHexPathProject',
  'surface/oShipWheelPickupBeforeDeferredEndEffects',
];

const expectedDisagreements: Readonly<Record<string, readonly string[]>> = {
  // An entry that binds no run-start reward: a fresh profile's first entry, or a later biome's entry.
  'FreshFile FixedOpening, ordinary, entry, state none, selector OpeningRewardRoom, walk RewardlessCombatRoom (entry-resolution)':
    [
      'execution/fresh-file-fghi F:F_Opening01',
      'execution/fresh-file-f-native F:F_Opening01',
      'fresh-file/createFreshFileRouteProject F:F_Opening01',
      'fresh-file/createFreshFileFProject F:F_Opening01',
      'fresh-file/createFreshFileFirstSequence F:F_Opening01',
      'fresh-file/createFreshFileGeneratedComposition F:F_Opening01',
      'fresh-file/withNewHFieldsRoom(min) F:F_Opening01',
      'fresh-file/withNewHFieldsRoom(max) F:F_Opening01',
      'fresh-file/withRetainedFreshFilePostboss(all) F:F_Opening01',
      'fresh-file/withRetainedFreshFilePostboss(emptyPool) F:F_Opening01',
      'fresh-file/withRetainedFreshFileIntroCustomization F:F_Opening01',
      'fresh-file/hFieldsIssues/00 F:F_Opening01',
      'fresh-file/hFieldsIssues/01 F:F_Opening01',
      'fresh-file/hFieldsIssues/02 F:F_Opening01',
      'fresh-file/hFieldsIssues/03 F:F_Opening01',
      ...freshFileFrontier,
    ],
  'Dream FixedOpening, ordinary, entry, state none, selector OpeningRewardRoom, walk RewardlessCombatRoom (entry-resolution)':
    [
      'execution/dream-mixed-prefix F:F_Opening02',
      'execution/dream-mixed-prefix N:N_Opening01',
      'execution/dream-start-n-opening F:F_Opening02',
      'execution/dream-start-n-opening N:N_Opening01',
      'checkpoint/dream-mixed-handoff F:F_Opening02',
      'checkpoint/dream-mixed-handoff N:N_Opening01',
    ],
  // The Dream's first entry binds the run-start reward in an Intro room.
  'Dream FixedIntro, ordinary, entry, state none, selector RewardlessRoom, walk OpeningRewardNoEncounterRoom (entry-resolution)':
    [
      'execution/dream-mixed-prefix Q:Q_Intro',
      'execution/dream-shrine-pending Q:Q_Intro',
      'execution/dream-o-skipped-ship O:O_Intro',
      'execution/dream-start-n-opening Q:Q_Intro',
      'checkpoint/dream-h-artificer-echo H:H_Intro',
      'checkpoint/dream-mixed-handoff Q:Q_Intro',
    ],
  'Surface derived hub, board, room, state none, selector RewardlessRoom, walk EphyraHubRoom (hub)':
    hubEntries.filter((entry) => !entry.includes('dream-')).map((entry) => `${entry} N:N_Hub`),
  'Dream derived hub, board, room, state none, selector RewardlessRoom, walk EphyraHubRoom (hub)':
    hubEntries.filter((entry) => entry.includes('dream-')).map((entry) => `${entry} N:N_Hub`),
  'Surface Miniboss, ordinary, Hub target, state counted, selector StandardRewardRoom, walk EphyraMainRoom (hub)':
    hubEntries
      .filter((entry) => !entry.includes('dream-'))
      .map((entry) => `${entry} N:N_MiniBoss01`),
  'Dream Miniboss, ordinary, Hub target, state counted, selector StandardRewardRoom, walk EphyraMainRoom (hub)':
    hubEntries
      .filter((entry) => entry.includes('dream-'))
      .map((entry) => `${entry} N:N_MiniBoss01`),
  'Surface Story, ordinary, Hub target, state fixed, selector StandardRewardRoom, walk EphyraMainRoom (hub)':
    [
      'checkpoint/surface-p-steady-growth-shrine-frontier N:N_Story01',
      'checkpoint/surface-n-story-board N:N_Story01',
    ],
};

const corpus = equivalenceCorpus();

describe('lifecycle-profile selection over the equivalence corpus', () => {
  it('disagrees only in the listed entry and Hub rooms', () => {
    const disagreements: Record<string, string[]> = {};
    for (const entry of corpus)
      for (const observation of observe(entry.name, entry.catalog, entry.project()))
        if (!observation.agrees)
          (disagreements[observation.cause] ??= []).push(`${entry.name} ${observation.room}`);
    const sorted = (groups: Readonly<Record<string, readonly string[]>>) =>
      Object.fromEntries(
        Object.entries(groups)
          .map(([cause, rooms]) => [cause, [...rooms].sort()] as const)
          .sort(([left], [right]) => (left < right ? -1 : 1)),
      );
    expect(sorted(disagreements)).toEqual(sorted(expectedDisagreements));
  });
});
