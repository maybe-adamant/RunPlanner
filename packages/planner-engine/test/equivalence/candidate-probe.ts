import {
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createFieldsSpatialAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createStartingRewardAddress,
  createTargetAddress,
  discoverAuthoredTraitCarrierChildren,
  semanticAddressKey,
  TRAIT_OPTION_KEYS,
  type AcquisitionRoleAddress,
  type AuthoredRewardState,
  type AuthoredTraitOffer,
  type FigurineArcanaAddress,
  type FountainRarityOutcomeAddress,
  type JudgmentArcanaAddress,
  type KeepsakeEquipResultAddress,
  type KeepsakeSelectionAddress,
  type NaturalSelectionResultAddress,
  type ProjectDocument,
  type SemanticAddress,
  type SteadyGrowthOutcomeAddress,
  type TraitOfferAddress,
  type TranscendentEmbryoOutcomeAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  CandidateContextOwner,
  ProjectCandidateSession,
  ProjectCandidateSessionQuery,
  ProjectEvaluation,
} from '@run-planner/engine/simulation';

import { canonicalDigest } from './canonical';

/** One probe and its observed outcome; an evaluator failure is itself an outcome. */
interface ProbeRecord {
  readonly probe: string;
  readonly input: unknown;
  readonly outcome: unknown;
}

function attempt(read: () => unknown): unknown {
  try {
    return { value: read() };
  } catch (error) {
    return error instanceof Error
      ? { thrown: error.name, message: error.message }
      : { thrown: String(error) };
  }
}

/** Every distinct semantic address of the given kinds reachable from a product. */
function harvestAddresses<T extends SemanticAddress>(
  product: unknown,
  kinds: ReadonlySet<string>,
): readonly T[] {
  const found = new Map<string, T>();
  const seen = new Set<object>();
  const walk = (value: unknown) => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const kind = (value as { readonly kind?: unknown }).kind;
    if (typeof kind === 'string' && kinds.has(kind) && 'routeKey' in value) {
      const address = value as T;
      found.set(semanticAddressKey(address), address);
    }
    for (const child of Object.values(value)) walk(child);
  };
  walk(product);
  return [...found.values()];
}

interface SelectedTraitOffer {
  readonly address: TraitOfferAddress;
  readonly offer: AuthoredTraitOffer;
}

function selectedTraitOffers(evaluation: ProjectEvaluation): readonly SelectedTraitOffer[] {
  return evaluation.route.biomes.flatMap((biome) =>
    'rewards' in biome && biome.rewards !== undefined
      ? (biome.rewards as { readonly selectedTraitOffers: readonly SelectedTraitOffer[] })
          .selectedTraitOffers
      : [],
  );
}

/**
 * Evaluates the prepared candidate session for every authored owner the
 * project names, every reached trait offer, every published finding owner a
 * session query addresses, and every native control's context reachability.
 * Returned records are in deterministic construction order.
 */
export function probeCandidates(
  catalog: Catalog,
  project: ProjectDocument,
  session: ProjectCandidateSession,
): readonly ProbeRecord[] {
  const records: ProbeRecord[] = [];
  const seen = new Set<string>();
  const record = (probe: string, input: unknown, read: () => unknown) => {
    const key = `${probe}:${canonicalDigest(input).root}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({ probe, input, outcome: attempt(read) });
  };
  const evaluate = (query: ProjectCandidateSessionQuery) =>
    record('evaluate', query, () => session.evaluate(query));
  const reached = (owner: CandidateContextOwner) =>
    record('contextReached', owner, () => session.contextReached(owner));
  const reward = (
    query: (value: AuthoredRewardState['offer']) => ProjectCandidateSessionQuery,
    state: AuthoredRewardState | null | undefined,
  ) => {
    if (state !== null && state !== undefined) evaluate(query(state.offer));
  };

  const routeKey = project.route.routeKey;
  const startingReward = project.route.loadout.startingReward;
  if (startingReward !== null)
    evaluate({
      kind: 'startingReward',
      reward: createStartingRewardAddress(routeKey),
      value: startingReward,
    });
  for (const biomePlan of project.route.biomes) {
    const topology = biomePlan.topology;
    if (topology === null) continue;
    const biome = createBiomeAddress(routeKey, biomePlan.biomeKey);
    const gameNames = new Map(
      topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence.gameName]),
    );
    for (const occurrence of topology.occurrences) {
      const { occurrenceId, state } = occurrence;
      const owner = createOccurrenceAddress(biome, occurrenceId);
      reached({ kind: 'shipEncounterCount', occurrence: owner });
      if ('reward' in state)
        reward(
          (value) => ({
            kind: 'incomingReward',
            reward: createIncomingRewardAddress(biome, occurrenceId),
            value,
          }),
          state.reward,
        );
      if (state.kind === 'fieldsCombat') {
        for (const groupKey of ['cages', 'optionalRewards'] as const)
          for (const [slotKey, slot] of Object.entries(state[groupKey]))
            reward(
              (value) => ({
                kind: 'localReward',
                reward: createLocalRewardAddress(biome, occurrenceId, groupKey, slotKey),
                value,
              }),
              slot,
            );
        const spatial = [
          { kind: 'entry' } as const,
          { kind: 'nemesis' } as const,
          ...Object.keys(state.spatial.cagePointIdBySlot).map(
            (slotKey) => ({ kind: 'cage', slotKey }) as const,
          ),
          ...Object.keys(state.spatial.optionalPointIdBySlot).map(
            (slotKey) => ({ kind: 'optional', slotKey }) as const,
          ),
        ];
        for (const target of spatial)
          reached({
            kind: 'fieldsSpatialPoint',
            spatial: createFieldsSpatialAddress(owner, target),
          });
      }
      if (state.kind === 'shipCombat') {
        evaluate({
          kind: 'shipEncounterCount',
          occurrence: owner,
          encounterCount: state.encounterCount,
        });
        for (const [wheelKey, wheel] of Object.entries(state.wheels)) {
          const address = createRewardWheelAddress(biome, occurrenceId, wheelKey);
          reached({ kind: 'rewardWheel', wheel: address });
          evaluate({ kind: 'rewardWheelStore', wheel: address, storeKey: wheel.storeKey });
          evaluate({ kind: 'rewardWheelOfferCount', wheel: address, offerCount: wheel.offerCount });
          evaluate({
            kind: 'rewardWheelPicked',
            wheel: address,
            pickedOfferIndex: wheel.pickedOfferIndex,
          });
          for (const [offerKey, offer] of Object.entries(wheel.offers))
            reward(
              (value) => ({
                kind: 'rewardWheelOffer',
                offer: createRewardWheelOfferAddress(biome, occurrenceId, wheelKey, offerKey),
                value,
              }),
              offer,
            );
        }
      }
      if (state.kind === 'shop' && state.shop !== undefined)
        for (const [offerKey, offer] of Object.entries(state.shop.offers)) {
          const address = createShopOfferAddress(biome, occurrenceId, offerKey);
          reward((value) => ({ kind: 'shopOffer', offer: address, value }), offer.reward);
          const { optionKey } = offer;
          if (optionKey !== null)
            reward(
              (value) => ({
                kind: 'shopOfferOption',
                offer: address,
                value: { optionKey, offer: value },
              }),
              offer.reward,
            );
        }
    }
    for (const decision of topology.decisions) {
      switch (decision.kind) {
        case 'exit': {
          const source = decision.source;
          const exitDecision = createExitDecisionAddress(biome, source);
          for (const target of decision.normal.targets) {
            const gameName = gameNames.get(target.occurrenceId);
            if (gameName === undefined) continue;
            // A takeover Preboss batch is owned by its source occurrence, not by
            // each door; a Hub-owned one has no session query.
            if (catalog.rooms.byKey[gameName]?.prebossBatchPolicy?.kind === 'takeOverNormalDoors') {
              if (source.kind === 'occurrence')
                evaluate({ kind: 'takeoverPrebossBatch', source: exitDecision, gameName });
            } else
              evaluate({
                kind: 'roomTarget',
                target: createTargetAddress(biome, source, target.exitKey),
                gameName,
              });
          }
          const store = decision.normal.rewardStore;
          if (store.kind === 'authoredBaseStore' && store.baseRewardStoreKey !== null)
            evaluate({
              kind: 'batchRewardStore',
              rewardStore: createBatchRewardStoreAddress(biome, source),
              storeKey: store.baseRewardStoreKey,
            });
          if (decision.normal.batchState !== null)
            evaluate({
              kind: 'fieldsCageOutcome',
              decision: exitDecision,
              cageOutcome: decision.normal.batchState.cageOutcome,
            });
          break;
        }
        case 'hub': {
          reached({
            kind: 'hubActionOrder',
            hub: createHubDecisionAddress(biome, decision.hubKey),
          });
          for (const target of decision.openTargets)
            reached({
              kind: 'hubSlot',
              slot: createHubSlotAddress(biome, decision.hubKey, target.hubSlotKey),
            });
          break;
        }
        case 'localVisit': {
          const { sourceOccurrenceId, groupKey } = decision;
          reached({
            kind: 'sideRoomEntryOrder',
            group: createLocalVisitOrderAddress(biome, sourceOccurrenceId, groupKey),
          });
          for (const slotKey of Object.keys(decision.targetsBySlot))
            reached({
              kind: 'sideRoomGeneration',
              sideRoom: createLocalVisitSlotAddress(biome, sourceOccurrenceId, groupKey, slotKey),
            });
          break;
        }
      }
    }
  }

  const { evaluation } = session;
  const offers = new Map<string, SelectedTraitOffer>();
  for (const selected of selectedTraitOffers(evaluation)) {
    offers.set(semanticAddressKey(selected.address), selected);
    evaluate({ kind: 'traitOffer', trait: selected.address, value: selected.offer });
  }
  for (const { address: trait, offer: value } of offers.values()) {
    evaluate({ kind: 'ransomAssessment', trait, value });
    if (value.kind !== 'traits') continue;
    for (const optionKey of TRAIT_OPTION_KEYS.slice(0, value.options.length)) {
      evaluate({ kind: 'traitOfferFocusedOption', trait, value, optionKey });
      evaluate({ kind: 'traitAcquisitionTargetDomain', trait, value, optionKey });
      evaluate({ kind: 'circeResolutionDomain', trait, value, optionKey });
      evaluate({ kind: 'echoPomTargetDomain', trait, value, optionKey });
      evaluate({ kind: 'echoLastRunBoonDomain', trait, value, optionKey });
    }
    for (const child of discoverAuthoredTraitCarrierChildren(catalog, trait, value))
      evaluate({ kind: 'traitCarrierChildDomain', trait, value, child });
  }
  for (const acquisition of harvestAddresses<AcquisitionRoleAddress>(
    evaluation,
    new Set(['acquisitionRole']),
  ))
    evaluate({ kind: 'acquisitionConversion', acquisition });
  const owners = [
    ...evaluation.findings.map((finding) => finding.origin),
    ...harvestAddresses(
      evaluation,
      new Set([
        'steadyGrowthOutcome',
        'naturalSelectionResult',
        'keepsakeEquipResult',
        'keepsakeSelection',
        'fountainRarityOutcome',
        'transcendentEmbryoOutcome',
        'judgmentArcana',
        'figurineArcana',
      ]),
    ),
  ];
  for (const owner of owners) {
    switch (owner.kind) {
      case 'traitOffer':
        if (!offers.has(semanticAddressKey(owner)))
          record('chaosOfferDomain', owner, () => session.chaosOfferDomain(owner));
        break;
      case 'steadyGrowthOutcome':
        evaluate({
          kind: 'steadyGrowthOutcome',
          outcome: owner as SteadyGrowthOutcomeAddress,
          targetTraitKey: undefined,
        });
        break;
      case 'naturalSelectionResult': {
        const result = owner as NaturalSelectionResultAddress;
        const selected = offers.get(semanticAddressKey(result.trait));
        if (selected !== undefined)
          evaluate({
            kind: 'naturalSelectionResult',
            result,
            value: selected.offer,
            targets: undefined,
          });
        break;
      }
      case 'keepsakeEquipResult':
        evaluate({ kind: 'keepsakeEquipResult', result: owner as KeepsakeEquipResultAddress });
        break;
      case 'keepsakeSelection':
        evaluate({ kind: 'keepsakeSelection', selection: owner as KeepsakeSelectionAddress });
        break;
      case 'fountainRarityOutcome':
        evaluate({
          kind: 'fountainRarityOutcome',
          outcome: owner as FountainRarityOutcomeAddress,
          targetTraitKey: undefined,
        });
        break;
      case 'transcendentEmbryoOutcome':
        evaluate({
          kind: 'transcendentEmbryoOutcome',
          outcome: owner as TranscendentEmbryoOutcomeAddress,
          value: undefined,
        });
        break;
      case 'judgmentArcana':
        evaluate({
          kind: 'judgmentArcana',
          judgment: owner as JudgmentArcanaAddress,
          arcanaKeys: [],
        });
        break;
      case 'figurineArcana':
        evaluate({
          kind: 'figurineArcana',
          figurine: owner as FigurineArcanaAddress,
          arcanaKeys: [],
        });
        break;
      default:
        // Remaining gaps. Owners with no session query: encounter and Gorgon
        // phases, Hub visits, level resolutions, Room Actions, and Purging Pool,
        // Hermes Shrine and Stygian Well slots. Session queries never issued:
        // acquisition-entry offers, start room, Hub terminal takeover and All
        // Together set domains; Hub slots, Hub action order and side rooms are
        // probed for reachability only.
        break;
    }
  }
  return records;
}
