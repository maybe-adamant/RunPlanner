import type { Catalog, EncounterCustomizationDecision } from '../../catalog-schema';
import {
  createBiomeAddress,
  semanticAddressKey,
  createEncounterPhaseAddress,
  type AuthoredEncounterCustomization,
  type AuthoredGeneratedEncounterCustomization,
  type EncounterPhaseAddress,
  type OccurrenceId,
  type ProjectCommand,
} from '../../authored-project';
import { customizationDecisionOnRoute } from '../../authored-project/room-state/encounter-customization';
import type { GeneratedEncounterCandidateCapability } from '../encounters/generation-preparation';
import type { EncounterPhaseCandidateSupport } from '../encounters/preparation';
import type { InfiniteRosterCandidateCapability } from '../encounters/infinite-roster';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  generatedEncounterSupportForProjectEvaluationAssembly,
  infiniteRosterSupportForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
} from '../evaluation/project-evaluation-assembly';
import type { SemanticFinding } from '../model';
import type { FigLeafPhaseCandidateSupport, GorgonPhaseCandidateSupport } from '../rewards/model';
import type { DraftRng } from './rng';
import { settleDraftCommandWithoutNewFinding } from './settle';
import type { DraftSpec } from './spec';
import type { DraftSteering } from './steering';

/** Random generated values tried before the engine's deterministic initialisation. */
const GENERATED_ATTEMPTS = 4;

function pick<T>(rng: DraftRng, values: readonly T[]): T | undefined {
  return values.length === 0 ? undefined : values[Math.floor(rng() * values.length)];
}

function integerIn(rng: DraftRng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function normal(rng: DraftRng, mean: number, deviation: number): number {
  const radius = Math.sqrt(-2 * Math.log(1 - rng()));
  return mean + deviation * radius * Math.cos(2 * Math.PI * rng());
}

function binomial(rng: DraftRng, trials: number, chance: number): number {
  let count = 0;
  for (let trial = 0; trial < trials; trial += 1) if (rng() < chance) count += 1;
  return count;
}

/** Each eligible Menace source request converts independently at the rank's chance. */
function menaceChance(catalog: Catalog, rank: number): number {
  for (const vow of catalog.fearVows.values)
    if (vow.effect?.kind === 'substituteNextBiomeEnemy')
      return vow.effect.chanceByRank[rank - 1] ?? 0;
  return 0;
}

function sampleGenerated(
  catalog: Catalog,
  capability: GeneratedEncounterCandidateCapability,
  rng: DraftRng,
): AuthoredGeneratedEncounterCustomization | undefined {
  const assess = capability.assess;
  const initial = assess({ kind: 'generated' });
  const baseRoll = initial.budgetDomain?.baseRoll;
  const waveCount = integerIn(rng, capability.waveCount.min, capability.waveCount.max);
  let value: AuthoredGeneratedEncounterCustomization = {
    kind: 'generated',
    waveCount,
    ...(baseRoll === undefined ? {} : { baseRoll: integerIn(rng, baseRoll.min, baseRoll.max) }),
  };
  const highlighted = assess(value);
  if (highlighted.composition === 'missingHighlight') {
    const highlightKey = pick(rng, highlighted.eligibleHighlightKeys);
    if (highlightKey === undefined) return undefined;
    value = { ...value, highlightKey };
  }
  for (const { waveIndex, additionalTypeCount } of assess(value).waves) {
    const size = integerIn(rng, additionalTypeCount.min, additionalTypeCount.max);
    const typeKeys: string[] = [];
    const withWave = () => ({
      ...value,
      waves: [...(value.waves ?? []), { waveIndex, typeKeys: [...typeKeys] }],
    });
    while (typeKeys.length < size) {
      const wave = assess(withWave()).waves.find((entry) => entry.waveIndex === waveIndex);
      const key = pick(rng, wave?.eligibleKeysByPosition[typeKeys.length] ?? []);
      if (key === undefined) break;
      typeKeys.push(key);
    }
    value = withWave();
  }
  const composed = assess(value);
  value = {
    ...value,
    waves: (value.waves ?? []).map((wave) => {
      const domain = composed.waves.find((entry) => entry.waveIndex === wave.waveIndex);
      const means = domain?.equalAllocations;
      if (means === undefined || domain!.sampledBudgetKeys.length === 0) return wave;
      return {
        ...wave,
        allocations: Object.fromEntries(
          domain!.sampledBudgetKeys.map((key) => {
            const mean = means[key] ?? 0;
            const sample = Math.min(2 * mean, Math.max(0, normal(rng, mean, mean / 3)));
            return [key, Math.round(sample * 100) / 100];
          }),
        ),
      };
    }),
  };
  const fangs = assess(value).fangs;
  if (fangs?.active && fangs.next === 'type') {
    const typeKey = pick(rng, fangs.eligibleTypeKeys);
    if (typeKey === undefined) return undefined;
    value = { ...value, fangs: { typeKey, perkKeys: [] } };
    for (;;) {
      const next = assess(value).fangs;
      if (next === undefined || next.canFinish) break;
      const perk = pick(rng, next.eligiblePerkKeys);
      if (perk === undefined) break;
      value = { ...value, fangs: { typeKey, perkKeys: [...value.fangs!.perkKeys, perk] } };
    }
  }
  const counted = assess(value);
  const chance = menaceChance(catalog, counted.menace?.rank ?? 0);
  if (counted.menace?.active === true && !counted.menace.blocked && chance > 0) {
    const menace = counted.waves.flatMap((wave) => {
      const conversions = Object.fromEntries(
        (wave.menaceSources ?? []).flatMap((source) => {
          const count = binomial(rng, source.maximum, chance);
          if (count === 0) return [];
          const targetKey = source.targetNativeIds && pick(rng, source.targetNativeIds);
          return [[source.sourceKey, targetKey === undefined ? { count } : { count, targetKey }]];
        }),
      );
      return Object.keys(conversions).length === 0
        ? []
        : [{ waveIndex: wave.waveIndex, conversions }];
    });
    if (menace.length > 0) value = { ...value, menace };
  }
  const final = assess(value);
  return final.supported && final.operands !== undefined ? value : undefined;
}

function sampleRoster(
  capability: InfiniteRosterCandidateCapability,
  rng: DraftRng,
): readonly string[] | undefined {
  const { typeCount } = capability.assess([]);
  const size = integerIn(rng, typeCount.min, typeCount.max);
  const typeKeys: string[] = [];
  while (typeKeys.length < size) {
    const key = pick(
      rng,
      capability.assess(typeKeys).eligibleKeysByPosition[typeKeys.length] ?? [],
    );
    if (key === undefined) break;
    typeKeys.push(key);
  }
  return capability.assess(typeKeys).supported ? typeKeys : undefined;
}

/** A random declared value for a declaration-owned single, ordered-prefix or cocoon decision. */
function sampleDeclared(
  decision: EncounterCustomizationDecision,
  cocoonRewardPointIds: readonly number[],
  rng: DraftRng,
): AuthoredEncounterCustomization | undefined {
  const selection = decision.selection;
  switch (selection.kind) {
    case 'single': {
      const choice = pick(rng, selection.choices);
      return choice && { kind: 'single', choiceKey: choice.key };
    }
    case 'orderedPrefix': {
      const keys = selection.choices.map((choice) => choice.key);
      for (let index = keys.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(rng() * (index + 1));
        [keys[index], keys[swap]] = [keys[swap]!, keys[index]!];
      }
      const choiceKeys = keys.slice(0, selection.maximumLength);
      return choiceKeys.length === 0 ? undefined : { kind: 'orderedPrefix', choiceKeys };
    }
    case 'cocoonCount':
      return { kind: 'cocoonCount', count: integerIn(rng, selection.minimum, selection.maximum) };
    case 'cocoonRewardPoint': {
      const spawnPointId = pick(rng, cocoonRewardPointIds);
      return spawnPointId === undefined ? undefined : { kind: 'cocoonRewardPoint', spawnPointId };
    }
    default:
      return undefined;
  }
}

/**
 * Customizes every reached encounter phase of one biome in route order from the engine's
 * legal options, re-querying each after the previous one settles. A value that
 * adds a finding is dropped for the engine's initialisation, then native Default.
 */
export function draftEncounters(
  catalog: Catalog,
  start: ProjectEvaluationAssembly,
  biomeKey: string,
  rng: DraftRng,
): ProjectEvaluationAssembly {
  let assembly = start;
  const settle = (command: ProjectCommand): boolean => {
    const settled = settleDraftCommandWithoutNewFinding(catalog, assembly, command);
    if (settled !== undefined) assembly = settled;
    return settled !== undefined;
  };
  const customize = (
    phase: EncounterPhaseAddress,
    decisionKey: string,
    ...values: readonly (() => AuthoredEncounterCustomization | undefined)[]
  ): void => {
    for (const next of values) {
      const value = next();
      if (
        value !== undefined &&
        settle({ kind: 'ReplaceEncounterCustomization', phase, decisionKey, value })
      )
        return;
    }
  };
  const aetosWaves = (phase: EncounterPhaseAddress): readonly number[] => {
    const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase);
    return status?.kind === 'active' ? (status.aetos?.waves ?? []) : [];
  };
  const phases = reachedEncounterPhasesForProjectEvaluationAssembly(assembly).filter(
    (phase) => phase.biomeKey === biomeKey,
  );
  for (const [index, phase] of phases.entries()) {
    const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase);
    if (status?.kind !== 'active') continue;
    const generated = generatedEncounterSupportForProjectEvaluationAssembly(assembly, phase);
    if (generated !== undefined) {
      let sampled: AuthoredGeneratedEncounterCustomization | undefined;
      for (let attempt = 0; sampled === undefined && attempt < GENERATED_ATTEMPTS; attempt += 1)
        sampled = sampleGenerated(catalog, generated, rng);
      customize(phase, generated.decisionKey, () => sampled, generated.initialize);
    }
    const roster = infiniteRosterSupportForProjectEvaluationAssembly(assembly, phase);
    if (roster !== undefined) {
      const typeKeys = sampleRoster(roster, rng);
      customize(phase, roster.decisionKey, () => typeKeys && { kind: 'infiniteRoster', typeKeys });
    }
    const occurrence = assembly.project.route.biomes
      .find((biome) => biome.biomeKey === phase.biomeKey)
      ?.topology?.occurrences.find((entry) => entry.occurrenceId === phase.owner.occurrenceId);
    const cocoonRewardPointIds =
      catalog.rooms.byKey[occurrence?.gameName ?? '']?.cocoonRewardPointIds ?? [];
    const definition =
      status.encounterDefinitionKey === undefined
        ? undefined
        : catalog.encounterDefinitions.byKey[status.encounterDefinitionKey];
    for (const decision of definition?.customization ?? [])
      customize(phase, decision.key, () =>
        sampleDeclared(
          customizationDecisionOnRoute(decision, phase.routeKey),
          cocoonRewardPointIds,
          rng,
        ),
      );
    // Native Aetos has a ChanceToPlay, so a biome may have none; each remaining
    // eligible phase and none are equally likely.
    const waves = aetosWaves(phase);
    if (waves.length > 0) {
      const eligible = phases.slice(index).filter((later) => aetosWaves(later).length > 0);
      const wave = pick(rng, waves);
      if (rng() * (eligible.length + 1) < 1 && wave !== undefined)
        settle({ kind: 'ReplaceAetosWave', phase, value: wave });
    }
  }
  return assembly;
}

/** What encounter selection during the walk borrows from it. */
export interface DraftEncounterChoiceContext {
  readonly catalog: Catalog;
  readonly spec: DraftSpec;
  readonly steering: DraftSteering;
  /** Keys of choices already made in this walk. */
  readonly hooked: Set<string>;
  readonly assembly: () => ProjectEvaluationAssembly;
  readonly apply: (command: ProjectCommand) => boolean;
  readonly shuffle: <T>(values: readonly T[]) => T[];
  readonly random: () => number;
  /** Re-authors an entered room's reward to a type outside `excluded`; false when none settles. */
  readonly reauthorReward: (
    biomeKey: string,
    occurrenceId: OccurrenceId,
    excluded: ReadonlySet<string>,
  ) => boolean;
}

/** Reward types that alone keep a phase from hosting this encounter, per the engine's evidence. */
function rewardOnlyExclusion(
  exclusions: EncounterPhaseCandidateSupport['exclusions'],
  encounterKey: string,
): ReadonlySet<string> | undefined {
  for (const exclusion of exclusions) {
    if (exclusion.encounterKey !== encounterKey || exclusion.kind !== 'requirements') continue;
    for (const { evaluation } of exclusion.definitions) {
      const failing =
        evaluation.kind === 'all'
          ? evaluation.children.filter((child) => !child.satisfied)
          : [evaluation];
      if (
        failing.length > 0 &&
        failing.every((child) => child.kind === 'currentRoomRewardExcludes')
      )
        return new Set(
          failing.flatMap((child) =>
            child.kind === 'currentRoomRewardExcludes' ? child.rewardTypes : [],
          ),
        );
    }
  }
  return undefined;
}

/** Encounter choice for the finding's room, once its phases are reached. */
export function draftEncounterChoice(
  context: DraftEncounterChoiceContext,
  reason: SemanticFinding,
): boolean {
  const origin = reason.origin;
  if (!('biomeKey' in origin)) return false;
  const occurrenceId =
    'occurrenceId' in origin
      ? origin.occurrenceId
      : 'source' in origin && origin.source.kind === 'occurrence'
        ? origin.source.occurrenceId
        : 'owner' in origin && typeof origin.owner === 'object' && 'occurrenceId' in origin.owner
          ? origin.owner.occurrenceId
          : undefined;
  if (typeof occurrenceId !== 'string') return false;
  return draftOccurrenceEncounterChoice(context, origin.biomeKey, occurrenceId as OccurrenceId);
}

/** Encounter choice for one room once its phases are reached, made once per walk. */
export function draftOccurrenceEncounterChoice(
  context: DraftEncounterChoiceContext,
  biomeKey: string,
  occurrenceId: OccurrenceId,
): boolean {
  const key = `encounters:${biomeKey}:${occurrenceId}`;
  if (context.hooked.has(key)) return false;
  const outcome = chooseEncounters(context, biomeKey, occurrenceId);
  if (outcome.reached) context.hooked.add(key);
  return outcome.changed;
}

/** Selects wanted field NPC encounters, else a random combat encounter; never Nemesis events. */
function chooseEncounters(
  context: DraftEncounterChoiceContext,
  biomeKey: string,
  occurrenceId: OccurrenceId,
): { readonly reached: boolean; readonly changed: boolean } {
  const { catalog, steering } = context;
  const occurrence = context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) return { reached: false, changed: false };
  const wanted = context.spec.world.fieldNpcsByBiome[biomeKey] ?? [];
  const phaseOf = (phaseKey: string) =>
    createEncounterPhaseAddress(
      createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
      { kind: 'occurrence', occurrenceId },
      phaseKey,
    );
  let changed = false;
  let reached = false;
  for (const phaseKey of Object.keys(occurrence.encounters.encounterKeyByPhase)) {
    const phase = phaseOf(phaseKey);
    let support = encounterPhaseCandidateSupportForProjectEvaluationAssembly(
      context.assembly(),
      phase,
    );
    if (support === undefined) continue;
    reached = true;
    if (!support.activationSatisfied) continue;
    // A field NPC whose wanted trait is not ready yet waits for a likely later room.
    const waits = (key: string) =>
      steering.npcWaiting(
        catalog.encounterDefinitions.byKey[key]?.traitOfferProducer?.giverKey,
        steering.progress(),
      ) && steering.laterRoomLikely(biomeKey);
    const npcFor = (key: string) => catalog.encounterDefinitions.byKey[key]?.npcPresentationKey;
    const wantedNpc = (key: string) => {
      const npc = npcFor(key);
      return npc !== undefined && wanted.includes(npc) && !metFieldNpc(context, biomeKey, npc);
    };
    // A wanted NPC barred only by this room's reward is met here, with an accepted reward instead.
    if (!support.candidateEncounterKeys.some(wantedNpc))
      for (const exclusion of support.exclusions) {
        if (!wantedNpc(exclusion.encounterKey) || waits(exclusion.encounterKey)) continue;
        const excluded = rewardOnlyExclusion(support.exclusions, exclusion.encounterKey);
        if (excluded === undefined || !context.reauthorReward(biomeKey, occurrenceId, excluded))
          continue;
        changed = true;
        support =
          encounterPhaseCandidateSupportForProjectEvaluationAssembly(context.assembly(), phase) ??
          support;
        break;
      }
    const candidates = support.candidateEncounterKeys.filter(
      (key) => catalog.encounterDefinitions.byKey[key]?.kind !== 'nonCombat',
    );
    const field = candidates.find((key) => wantedNpc(key) && !waits(key));
    const ordinary = candidates.filter((key) => npcFor(key) === undefined);
    const choice = field ?? (ordinary.length > 0 ? context.shuffle(ordinary)[0] : undefined);
    if (choice === undefined || choice === support.selectedEncounterKey) continue;
    changed = context.apply({ kind: 'SelectEncounter', phase, encounterKey: choice }) || changed;
  }
  // Keepsake encounter effects follow the selected encounters, phase by phase.
  for (const phaseKey of Object.keys(occurrence.encounters.figLeafSkipByPhase))
    changed = draftEncounterKeepsakes(context, phaseOf(phaseKey)) || changed;
  return { reached, changed };
}

/** Fig Leaf's native skip chance; the draft ignores luck. */
export const DRAFT_FIG_LEAF_SKIP_CHANCE = 0.37;

/**
 * One phase's keepsake edits in preference order: where the engine offers the Fig Leaf
 * skip it fires at its native chance; otherwise, where the engine offers Gorgon's
 * Athena trigger, it is met.
 */
export function draftEncounterKeepsakeCommands(
  phase: EncounterPhaseAddress,
  figLeaf: Pick<FigLeafPhaseCandidateSupport, 'supported'> | undefined,
  gorgon: Pick<GorgonPhaseCandidateSupport, 'supported'> | undefined,
  random: () => number,
): readonly ProjectCommand[] {
  return [
    ...(figLeaf?.supported === true && random() < DRAFT_FIG_LEAF_SKIP_CHANCE
      ? [{ kind: 'ReplaceFigLeafSkip', phase, value: true } as const]
      : []),
    ...(gorgon?.supported === true
      ? [{ kind: 'ReplaceGorgonDeathDefianceCondition', phase, value: true } as const]
      : []),
  ];
}

/** Settles the first of a reached phase's keepsake edits that applies; each phase decides once. */
function draftEncounterKeepsakes(
  context: DraftEncounterChoiceContext,
  phase: EncounterPhaseAddress,
): boolean {
  const key = `keepsakes:${semanticAddressKey(phase)}`;
  if (context.hooked.has(key)) return false;
  const figLeaf = encounterPhaseFigLeafSupportForProjectEvaluationAssembly(
    context.assembly(),
    phase,
  );
  const gorgon = encounterPhaseGorgonSupportForProjectEvaluationAssembly(context.assembly(), phase);
  if (figLeaf === undefined && gorgon === undefined) return false;
  context.hooked.add(key);
  return draftEncounterKeepsakeCommands(phase, figLeaf, gorgon, context.random).some((command) =>
    context.apply(command),
  );
}

function metFieldNpc(context: DraftEncounterChoiceContext, biomeKey: string, npc: string): boolean {
  return (
    context
      .assembly()
      .project.route.biomes.find((biome) => biome.biomeKey === biomeKey)
      ?.topology?.occurrences.some((occurrence) =>
        Object.values(occurrence.encounters.encounterKeyByPhase).some(
          (key) => context.catalog.encounterDefinitions.byKey[key]?.npcPresentationKey === npc,
        ),
      ) === true
  );
}
