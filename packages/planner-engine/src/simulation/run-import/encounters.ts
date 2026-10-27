import {
  createBiomeAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type EncounterPhaseAddress,
  type ProjectCommand,
} from '../../authored-project';
import { customizationDecisionOnRoute } from '../../authored-project/room-state/encounter-customization';
import type { RunRecordEncounter } from '../../run-record/model';
import type { EncounterPhaseCandidateSupport } from '../encounters/preparation';
import { invertGeneratedEncounter, invertInfiniteRoster } from '../encounters/encounter-inverse';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  generatedEncounterSupportForProjectEvaluationAssembly,
  infiniteRosterSupportForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
} from '../evaluation/project-evaluation-assembly';
import type { RunImportContext } from './import';

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
    const customizable =
      generatedEncounterSupportForProjectEvaluationAssembly(context.assembly(), phase) !==
        undefined ||
      infiniteRosterSupportForProjectEvaluationAssembly(context.assembly(), phase) !== undefined;
    if (!customizable) continue;
    if (recorded === undefined) {
      if (context.occurrences.visitsOf(phase.owner.occurrenceId).length === 0) continue;
      context.used.add(`custom:${key}`);
      // A Fields cage's encounter is recorded with its cage, which the import does not read yet.
      const cage = /^Cage/.test(phase.phaseKey);
      const location = context.occurrences.locationOf(phase);
      context.note({
        area: cage ? 'fields' : 'encounter',
        reason: cage ? 'unsupportedArea' : 'notInRecord',
        address: phase,
        ...(location === undefined ? {} : { record: location }),
      });
      continue;
    }
    context.used.add(`custom:${key}`);
    customizeEncounter(context, phase, recorded.encounter, record!);
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
    )
      context.note({ area: 'encounter', reason: 'inverseMismatch', address: phase, record });
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
