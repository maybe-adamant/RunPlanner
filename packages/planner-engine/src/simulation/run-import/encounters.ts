import {
  createBiomeAddress,
  createGorgonPhaseAddress,
  createOccurrenceAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type EncounterPhaseAddress,
  type ProjectCommand,
} from '../../authored-project';
import { customizationDecisionOnRoute } from '../../authored-project/room-state/encounter-customization';
import type { RunRecordEncounter } from '../../run-record/model';
import type { GeneratedEncounterSelection } from '../../catalog-schema';
import type { AuthoredGeneratedEncounterCustomization } from '../../authored-project/model';
import type { EncounterPhaseCandidateSupport } from '../encounters/preparation';
import { invertGeneratedEncounter, invertInfiniteRoster } from '../encounters/encounter-inverse';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  generatedEncounterSupportForProjectEvaluationAssembly,
  infiniteRosterSupportForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
} from '../evaluation/project-evaluation-assembly';
import type { RunImportContext } from './import';
import { recordedCageEncounter } from './fields';

/** The record encounter a phase played: the room's encounters in declared slot order. */
function recordedEncounter(
  context: RunImportContext,
  phase: EncounterPhaseAddress,
): { readonly encounter: RunRecordEncounter; readonly roomIndex: number } | undefined {
  const occurrence = context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === phase.biomeKey)
    ?.topology?.occurrences.find((entry) => entry.occurrenceId === phase.owner.occurrenceId);
  const room =
    occurrence === undefined ? undefined : context.catalog.rooms.byKey[occurrence.gameName];
  const slots =
    room?.encounterEnvelopeKey === undefined
      ? undefined
      : context.catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey]?.slots;
  if (/^Cage\d+$/.test(phase.phaseKey))
    return recordedCageEncounter(context, phase.owner.occurrenceId, phase.phaseKey);
  const position = slots?.findIndex((slot) => slot.key === phase.phaseKey) ?? -1;
  if (position < 0) return undefined;
  for (const roomIndex of context.occurrences.visitsOf(phase.owner.occurrenceId)) {
    const encounter = context.record.rooms[roomIndex]!.encounters[position];
    if (encounter !== undefined) return { encounter, roomIndex };
  }
  return undefined;
}

/** A ship plays as many encounters as the record lists for its room. */
function importShipEncounterCounts(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const [roomIndex, room] of context.record.rooms.entries()) {
    const used = `shipCount:${roomIndex}`;
    if (context.used.has(used)) continue;
    const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
    const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
    const state = project.route.biomes
      .find((biome) => biome.biomeKey === biomeKey)
      ?.topology?.occurrences.find((entry) => entry.occurrenceId === occurrenceId)?.state;
    if (state?.kind !== 'shipCombat') continue;
    context.used.add(used);
    const encounterCount = room.encounters.length;
    if (encounterCount === state.encounterCount) continue;
    const occurrence = createOccurrenceAddress(
      createBiomeAddress(project.route.routeKey, biomeKey),
      occurrenceId,
    );
    if (
      (encounterCount !== 2 && encounterCount !== 3) ||
      !context.apply({ kind: 'ReplaceShipEncounterCount', occurrence, encounterCount })
    )
      context.note({
        area: 'encounter',
        reason: 'refused',
        address: occurrence,
        record: { roomIndex, visit: 0 },
      });
  }
}

/**
 * Selects each reached phase's recorded encounter, then its generated
 * customization from the inverse, once per phase.
 */
export function importEncounters(context: RunImportContext): void {
  importShipEncounterCounts(context);
  for (const phase of reachedEncounterPhasesForProjectEvaluationAssembly(context.assembly())) {
    const key = semanticAddressKey(phase);
    if (context.used.has(`custom:${key}`)) continue;
    const recorded = recordedEncounter(context, phase);
    const record = recorded === undefined ? undefined : { roomIndex: recorded.roomIndex, visit: 0 };
    // A pooled slot selects its recorded identity once; a fixed slot has none to select.
    if (!context.used.has(`phase:${key}`)) {
      const support = encounterPhaseCandidateSupportForProjectEvaluationAssembly(
        context.assembly(),
        phase,
      );
      if (support !== undefined && recorded !== undefined) {
        context.used.add(`phase:${key}`);
        if (!selectRecordedEncounter(context, phase, recorded.encounter.name, support, record!)) {
          context.used.add(`custom:${key}`);
          continue;
        }
      }
    }
    if (recorded !== undefined) importGorgonAthena(context, phase, recorded.roomIndex);
    const customizable =
      generatedEncounterSupportForProjectEvaluationAssembly(context.assembly(), phase) !==
        undefined ||
      infiniteRosterSupportForProjectEvaluationAssembly(context.assembly(), phase) !== undefined;
    if (!customizable) continue;
    if (recorded === undefined) {
      if (context.occurrences.visitsOf(phase.owner.occurrenceId).length === 0) continue;
      context.used.add(`custom:${key}`);
      const location = context.occurrences.locationOf(phase);
      context.note({
        area: /^Cage/.test(phase.phaseKey) ? 'fields' : 'encounter',
        reason: 'notInRecord',
        address: phase,
        ...(location === undefined ? {} : { record: location }),
      });
      continue;
    }
    context.used.add(`custom:${key}`);
    customizeEncounter(context, phase, recorded.encounter, record!);
  }
}

/**
 * Gorgon Amulet's Athena: an Athena screen in a room whose own encounter gives
 * no Athena offer. The record does not say which phase she followed, so a
 * room with several Gorgon-eligible phases takes the first that the engine admits.
 */
function importGorgonAthena(
  context: RunImportContext,
  phase: EncounterPhaseAddress,
  roomIndex: number,
): void {
  const support = encounterPhaseGorgonSupportForProjectEvaluationAssembly(
    context.assembly(),
    phase,
  );
  if (support?.supported !== true) return;
  const effect = context.catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
  )?.effect;
  if (effect?.kind !== 'gorgonAmulet') return;
  const giver = context.catalog.traitGivers.byKey[effect.providerKey];
  const definition = resolvedDefinition(context, phase);
  if (
    giver === undefined ||
    (definition !== undefined &&
      context.catalog.encounterDefinitions.byKey[definition]?.traitOfferProducer?.giverKey ===
        giver.key)
  )
    return;
  const screens = context.record.rooms[roomIndex]!.traitScreens;
  for (const [position, screen] of screens.entries()) {
    const key = `screen:${roomIndex}:${position}`;
    const selected = screen.options.findIndex((option) => option.chosen);
    if (
      context.used.has(key) ||
      screen.options.length !== 3 ||
      selected < 0 ||
      !screen.options.every((option) => giver.traitKeys.includes(option.name))
    )
      continue;
    const applied = context.transaction(
      () =>
        context.apply({ kind: 'ReplaceGorgonDeathDefianceCondition', phase, value: true }) &&
        context.apply({
          kind: 'ReplaceGorgonAthenaOffer',
          trait: createTraitOfferAddress(createGorgonPhaseAddress(phase), 'gorgonAthena'),
          value: {
            traitKeys: screen.options.map((option) => option.name) as unknown as readonly [
              string,
              string,
              string,
            ],
            selectedOptionKey: (['option1', 'option2', 'option3'] as const)[selected]!,
          },
        }),
    );
    if (applied) context.used.add(key);
    return;
  }
}

const resolvedDefinition = (context: RunImportContext, phase: EncounterPhaseAddress) => {
  const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(
    context.assembly(),
    phase,
  );
  return status?.kind === 'active' ? status.encounterDefinitionKey : undefined;
};

/**
 * Selects the candidate that resolves to the recorded encounter: the authoring
 * profile whose declared definitions include it. A name the catalog does not
 * declare is a selection-weight duplicate authored as its primary encounter,
 * the longest candidate it extends, and is reported as an assumption. A
 * selection that does not resolve to the record is restored.
 */
function selectRecordedEncounter(
  context: RunImportContext,
  phase: EncounterPhaseAddress,
  name: string,
  support: EncounterPhaseCandidateSupport,
  record: { readonly roomIndex: number; readonly visit: number },
): boolean {
  if (resolvedDefinition(context, phase) === name) return true;
  const declared = context.catalog.encounterDefinitions.byKey[name] !== undefined;
  const ordered = declared
    ? support.candidateEncounterKeys.filter((key) =>
        context.catalog.encounterSets.values.some((set) =>
          set.authoringProfiles.some(
            (profile) => profile.key === key && profile.encounterDefinitionKeys.includes(name),
          ),
        ),
      )
    : support.candidateEncounterKeys
        .filter((key) => name.startsWith(key))
        .sort((left, right) => right.length - left.length);
  for (const key of ordered) {
    const command: ProjectCommand = { kind: 'SelectEncounter', phase, encounterKey: key };
    if (key !== support.selectedEncounterKey && !context.apply(command)) continue;
    if (!declared) {
      context.note({
        area: 'encounter',
        reason: 'assumption',
        address: phase,
        applied: command,
        record,
      });
      return true;
    }
    if (resolvedDefinition(context, phase) === name) return true;
    if (key !== support.selectedEncounterKey)
      context.apply({ kind: 'SelectEncounter', phase, encounterKey: support.selectedEncounterKey });
  }
  context.note({ area: 'encounter', reason: 'refused', address: phase, record });
  return false;
}

function customizeEncounter(
  context: RunImportContext,
  phase: EncounterPhaseAddress,
  observed: RunRecordEncounter,
  record: { readonly roomIndex: number; readonly visit: number },
): void {
  const definitionKey = resolvedDefinition(context, phase);
  const definition =
    definitionKey === undefined
      ? undefined
      : context.catalog.encounterDefinitions.byKey[definitionKey];
  const decisionOf = (key: string) => {
    const decision = definition?.customization?.find((entry) => entry.key === key);
    return decision === undefined
      ? undefined
      : customizationDecisionOnRoute(decision, phase.routeKey);
  };
  const generated = generatedEncounterSupportForProjectEvaluationAssembly(
    context.assembly(),
    phase,
  );
  const policy = generated === undefined ? undefined : decisionOf(generated.decisionKey)?.selection;
  if (generated !== undefined && policy?.kind === 'generated') {
    const result = invertGeneratedEncounter(policy, generated.assess, observed);
    if (
      result.kind === 'noMatch' ||
      !context.apply({
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey: generated.decisionKey,
        value: result.customization,
      })
    ) {
      context.note({ area: 'encounter', reason: 'inverseMismatch', address: phase, record });
      return;
    }
    importMenace(context, phase, policy, record, result.customization);
    return;
  }
  const roster = infiniteRosterSupportForProjectEvaluationAssembly(context.assembly(), phase);
  const selection = roster === undefined ? undefined : decisionOf(roster.decisionKey)?.selection;
  if (roster !== undefined && selection?.kind === 'infiniteRoster') {
    const result = invertInfiniteRoster(selection, roster.assess, observed);
    if (
      result.kind === 'noMatch' ||
      !context.apply({
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey: roster.decisionKey,
        value: result.customization,
      })
    )
      context.note({ area: 'encounter', reason: 'inverseMismatch', address: phase, record });
  }
}

/** Next-biome kills not yet claimed by a Menace conversion, per record room. */
const unclaimedKills = new WeakMap<RunImportContext, Map<number, Map<string, number>>>();

/**
 * Vow of Menace swaps spawn requests without rewriting the saved waves, so a
 * conversion shows as a rolled type killed fewer times than rolled, matched by
 * kills of its next-biome replacement that no wave rolled. Kills are per room:
 * a conversion is authored only on the one wave of the room that rolled its
 * source, its replacement kills are claimed once across the room's phases,
 * and it is kept only when the replay converts exactly what the kills show.
 * Every conversion is inferred, so each is reported.
 */
function importMenace(
  context: RunImportContext,
  phase: EncounterPhaseAddress,
  policy: GeneratedEncounterSelection,
  record: { readonly roomIndex: number; readonly visit: number },
  customization: AuthoredGeneratedEncounterCustomization,
): void {
  const generated = generatedEncounterSupportForProjectEvaluationAssembly(
    context.assembly(),
    phase,
  );
  const room = context.record.rooms[record.roomIndex]!;
  const kills = room.kills ?? {};
  const assessed = generated?.assess(customization);
  if (generated === undefined || assessed === undefined) return;
  const sources = assessed.waves.flatMap((wave) =>
    (wave.menaceSources ?? []).map((source) => ({ waveIndex: wave.waveIndex, ...source })),
  );
  if (sources.length === 0) return;
  // Every wave the room saved, across its phases and cages, by native enemy.
  const roomWaves = [
    ...room.encounters,
    ...(room.fields?.cages.map((cage) => cage.encounter) ?? []),
  ].flatMap((encounter) => encounter.waves ?? []);
  const rolled = new Map<string, number>();
  const wavesRolling = new Map<string, number>();
  for (const wave of roomWaves)
    for (const spawn of wave.spawns) {
      rolled.set(spawn.enemy, (rolled.get(spawn.enemy) ?? 0) + (spawn.count ?? 0));
      wavesRolling.set(spawn.enemy, (wavesRolling.get(spawn.enemy) ?? 0) + 1);
    }
  const choices = new Map(
    [...policy.choices, ...policy.fixedEnemies].map((choice) => [choice.key, choice]),
  );
  const byRoom = unclaimedKills.get(context) ?? new Map<number, Map<string, number>>();
  unclaimedKills.set(context, byRoom);
  const unclaimed = byRoom.get(record.roomIndex) ?? new Map<string, number>();
  byRoom.set(record.roomIndex, unclaimed);
  // Only next-biome kills no wave rolled can be replacements; summons and props never qualify.
  const surplusOf = (target: string) =>
    unclaimed.get(target) ?? Math.max(0, (kills[target] ?? 0) - (rolled.get(target) ?? 0));
  const menace = new Map<number, Record<string, { count: number; targetKey?: string }>>();
  const expected: { sourceKey: string; count: number; target: string }[] = [];
  for (const source of sources) {
    const choice = choices.get(source.sourceKey);
    if (choice === undefined) continue;
    const group = choice.unitGroupSize ?? 1;
    const shortfall = Math.floor(
      Math.max(0, (rolled.get(choice.nativeId) ?? 0) * group - (kills[choice.nativeId] ?? 0)) /
        group,
    );
    const targets =
      'targetNativeId' in source && source.targetNativeId !== undefined
        ? [source.targetNativeId]
        : ('targetNativeIds' in source ? (source.targetNativeIds ?? []) : []).filter(
            (target) => surplusOf(target) > 0,
          );
    const target = targets[0];
    if (shortfall === 0 || target === undefined || surplusOf(target) === 0) continue;
    const inferred = Math.min(shortfall, surplusOf(target));
    // Kills are per room; a source rolled by several waves cannot be placed.
    if ((wavesRolling.get(choice.nativeId) ?? 0) !== 1 || targets.length > 1) {
      context.note({ area: 'menace', reason: 'notInRecord', address: phase, record });
      continue;
    }
    const count = Math.min(inferred, source.maximum);
    // The kills show more conversions than the wave's requests allow.
    if (count < inferred)
      context.note({ area: 'menace', reason: 'refused', address: phase, record });
    unclaimed.set(target, surplusOf(target) - count);
    const conversions = menace.get(source.waveIndex) ?? {};
    conversions[source.sourceKey] = {
      count,
      ...('targetNativeIds' in source && source.targetNativeIds !== undefined
        ? { targetKey: target }
        : {}),
    };
    menace.set(source.waveIndex, conversions);
    expected.push({ sourceKey: source.sourceKey, count, target });
  }
  if (expected.length === 0) return;
  const value: AuthoredGeneratedEncounterCustomization = {
    ...customization,
    menace: [...menace].map(([waveIndex, conversions]) => ({ waveIndex, conversions })),
  };
  const replay = generated.assess(value);
  // The replay must convert exactly the inferred requests, onto the killed replacements.
  const replayed = replay.operands?.menace.flatMap((wave) => wave.conversions) ?? [];
  const agrees =
    replay.supported &&
    expected.every(({ sourceKey, count, target }) =>
      replayed.some(
        (conversion) =>
          conversion.sourceKey === sourceKey &&
          conversion.count === count &&
          conversion.targetNativeId === target,
      ),
    ) &&
    replayed.every((conversion) =>
      expected.some((entry) => entry.sourceKey === conversion.sourceKey),
    );
  const command: ProjectCommand = {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: generated.decisionKey,
    value,
  };
  if (!agrees) {
    context.note({ area: 'menace', reason: 'notInRecord', address: phase, record });
    return;
  }
  if (!context.apply(command)) {
    context.note({ area: 'menace', reason: 'refused', address: phase, record });
    return;
  }
  for (let count = 0; count < expected.length; count++)
    context.note({
      area: 'menace',
      reason: 'assumption',
      address: phase,
      applied: command,
      record,
    });
}
