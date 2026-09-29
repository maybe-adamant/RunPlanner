import type {
  Catalog,
  EncounterAuthoringProfile,
  EncounterCustomizationDecision,
  RoomDeclaration,
} from '../../catalog-schema';
import type { RoomEncounterState } from '../../authored-project/model';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import {
  encounterEnvelopeSlots,
  encounterAuthoringProfileForKey,
  encounterBindingsBySlot,
  selectedEncounterAuthoringProfileKey,
  fixedEncounterDefinitionKey,
} from '../../authored-project/room-state/encounter-envelope';
import type { MaterializedEncounterPhase, ResolvedEncounterPhase } from './model';
import {
  contextuallyReplacedCustomizationDecisions,
  customizationValueKnown,
  supportsGeneratedEncounterCustomization,
} from '../../authored-project/room-state/encounter-customization';

export class EncounterResolutionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'EncounterResolutionContractError';
  }
}

function fail(detail: string): never {
  throw new EncounterResolutionContractError(detail);
}

export function resolvedEncounterPhaseForDefinition(
  catalog: Catalog,
  phase: Pick<
    MaterializedEncounterPhase,
    'slotKey' | 'envelopeKey' | 'figLeafSkip' | 'rewardAttachment' | 'customizationByDecision'
  >,
  encounterKey: string,
  /** Decisions a replaced binding or authored choice owned; their values are never supported. */
  replacedDecisions: readonly EncounterCustomizationDecision[] = [],
): ResolvedEncounterPhase {
  const definition = catalog.encounterDefinitions.byKey[encounterKey];
  if (definition === undefined) return fail(`lost encounter ${encounterKey}`);
  const retained = replacedDecisions.flatMap((decision) => {
    const value = phase.customizationByDecision?.[decision.key];
    return value === undefined
      ? []
      : [Object.freeze({ ...decision, valueSupported: false, value, replaced: true as const })];
  });
  return Object.freeze({
    slotKey: phase.slotKey,
    envelopeKey: phase.envelopeKey,
    encounterKey: definition.key,
    label: definition.label,
    kind: definition.kind,
    countsEncounterDepth: definition.countsEncounterDepth,
    advancesHermesShrineDeliveryUses: definition.advancesHermesShrineDeliveryUses,
    canEncounterSkip: definition.canEncounterSkip === true,
    blocksFigLeaf: definition.blocksFigLeaf === true,
    blocksGorgon: definition.blocksGorgon === true,
    hostsGorgon: definition.hostsGorgon === true,
    skipEndEncounterEffects: definition.skipEndEncounterEffects === true,
    figLeafSkip: phase.figLeafSkip,
    ...(definition.customization === undefined && retained.length === 0
      ? {}
      : {
          customization: Object.freeze([
            ...(definition.customization ?? []).map((decision) => {
              const value = phase.customizationByDecision?.[decision.key];
              const valueSupported =
                value === undefined || customizationValueKnown([decision], decision.key, value);
              return Object.freeze({
                ...decision,
                valueSupported,
                ...(value === undefined ? {} : { value }),
              });
            }),
            ...retained,
          ]),
        }),
    ...(phase.rewardAttachment === undefined ? {} : { rewardAttachment: phase.rewardAttachment }),
    ...(definition.sequenceEffect === undefined
      ? {}
      : { sequenceEffect: definition.sequenceEffect }),
  });
}

/** Reward authorship is intentionally tri-state; absence is not incompleteness. */
export type EncounterResolutionContext = (
  | { readonly kind: 'knownReward'; readonly rewardType: string }
  | { readonly kind: 'noReward' }
  | { readonly kind: 'unavailable' }
) & {
  readonly routeKey: string;
  /** Reached facts a first-biome identity needs; structural traversal omits them. */
  readonly reached?: EncounterResolutionReachedFacts;
};

/** The preparation checkpoint's biome depth and route encounter identities before this phase. */
export interface EncounterResolutionReachedFacts {
  readonly biomeEncounterDepth: number;
  readonly routeEncounterKeyCounts: Readonly<Record<string, number>>;
}

/** Narrow retained facts needed to resolve contextual encounter identity. */
export interface EncounterResolutionRoomFacts {
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly incomingReward?: { readonly offer: { readonly rewardType: string } };
  readonly unresolvedIncomingReward?: unknown;
}

export function encounterResolutionContext(
  room: EncounterResolutionRoomFacts,
  declaration: RoomDeclaration,
  routeKey: string,
  reached?: EncounterResolutionReachedFacts,
): EncounterResolutionContext {
  const facts = reached === undefined ? { routeKey } : { routeKey, reached };
  if (room.clockworkReward === 'goal') {
    return Object.freeze({ ...facts, kind: 'knownReward', rewardType: 'ClockworkGoal' });
  }
  if (room.incomingReward !== undefined) {
    return Object.freeze({
      ...facts,
      kind: 'knownReward',
      rewardType: room.incomingReward.offer.rewardType,
    });
  }
  if (room.unresolvedIncomingReward !== undefined)
    return Object.freeze({ ...facts, kind: 'unavailable' });
  return declaration.incomingReward.kind === 'none'
    ? Object.freeze({ ...facts, kind: 'noReward' })
    : Object.freeze({ ...facts, kind: 'unavailable' });
}

/**
 * A first-biome identity (route-keyed, else default) resolves at biome
 * encounter depth one while it has not yet occurred on the route: native
 * AlwaysForce until completed.
 */
export function resolveEncounterAuthoringProfile(
  profile: EncounterAuthoringProfile,
  context: EncounterResolutionContext,
): string | undefined {
  if (profile.resolution.kind === 'direct') {
    return profile.resolution.encounterDefinitionKey;
  }
  const firstBiomeKey =
    profile.resolution.firstBiomeEncounterDefinitionKeyByRoute?.[context.routeKey] ??
    profile.resolution.firstBiomeEncounterDefinitionKey;
  if (firstBiomeKey !== undefined) {
    if (context.reached === undefined) return undefined;
    if (
      context.reached.biomeEncounterDepth === 1 &&
      (context.reached.routeEncounterKeyCounts[firstBiomeKey] ?? 0) === 0
    )
      return firstBiomeKey;
  }
  if (context.kind === 'unavailable') return undefined;
  return context.kind === 'knownReward'
    ? (profile.resolution.encounterDefinitionKeyByRewardType[context.rewardType] ??
        profile.resolution.defaultEncounterDefinitionKey)
    : profile.resolution.defaultEncounterDefinitionKey;
}

/**
 * Materializes the active slot prefix. Fixed identity uses declared loadout
 * context here; selectable profiles retain their authored choice for reward
 * resolution and eligibility at the exact preparation checkpoint.
 */
export function materializeEncounterPhases(
  catalog: Catalog,
  room: RoomDeclaration,
  encounters: RoomEncounterState,
  activeSlotKeys: readonly string[],
  path: string,
  rivalsContext?: {
    readonly routePosition: ResolvedRoutePosition;
    readonly configuredRivalsRank: number;
  },
): readonly MaterializedEncounterPhase[] {
  const slots = encounterEnvelopeSlots(catalog, room, path);
  const slotByKey = new Map(slots.map((slot) => [slot.key, slot]));
  const active = new Set(activeSlotKeys);
  if (active.size !== activeSlotKeys.length) {
    return fail(`${room.gameName} repeats an active encounter slot`);
  }
  const expectedPrefix = slots.slice(0, activeSlotKeys.length).map((slot) => slot.key);
  if (
    expectedPrefix.length !== activeSlotKeys.length ||
    expectedPrefix.some((slotKey, index) => slotKey !== activeSlotKeys[index])
  ) {
    return fail(`${room.gameName} selected non-envelope encounter slot order`);
  }
  return Object.freeze(
    activeSlotKeys.map((slotKey) => {
      const slot = slotByKey.get(slotKey);
      if (slot === undefined) return fail(`${room.gameName} has no encounter slot ${slotKey}`);
      let encounterKey = selectedEncounterAuthoringProfileKey(
        catalog,
        room,
        encounters,
        slotKey,
        path,
      );
      const binding = encounterBindingsBySlot(catalog, room, path).get(slotKey)!;
      if (binding.kind === 'fixed')
        encounterKey = fixedEncounterDefinitionKey(binding, rivalsContext);
      return Object.freeze({
        slotKey,
        envelopeKey: room.encounterEnvelopeKey,
        authoredChoiceKey: encounterKey,
        figLeafSkip: encounters.figLeafSkipByPhase[slotKey] === true,
        ...(encounters.customizationByPhase?.[slotKey] === undefined
          ? {}
          : { customizationByDecision: encounters.customizationByPhase[slotKey] }),
        ...(slot.rewardAttachment === undefined ? {} : { rewardAttachment: slot.rewardAttachment }),
      });
    }),
  );
}

export function resolveMaterializedEncounterPhase(
  catalog: Catalog,
  room: RoomDeclaration,
  phase: MaterializedEncounterPhase,
  context: EncounterResolutionContext,
): ResolvedEncounterPhase | undefined {
  const binding = encounterBindingsBySlot(catalog, room, room.gameName).get(phase.slotKey);
  if (binding === undefined) return fail(`${room.gameName} lost binding ${phase.slotKey}`);
  if (
    binding.kind === 'fixed' &&
    phase.authoredChoiceKey !== binding.encounterDefinitionKey &&
    phase.authoredChoiceKey !== binding.rivalsEncounterDefinitionKey &&
    phase.authoredChoiceKey !== binding.shadowEncounterDefinitionKey
  ) {
    return fail(
      `${room.gameName}.${phase.slotKey} has invalid fixed identity ${phase.authoredChoiceKey}`,
    );
  }
  const definitionKey =
    binding.kind === 'fixed'
      ? phase.authoredChoiceKey
      : (() => {
          const profile = encounterAuthoringProfileForKey(
            catalog.encounterSets.byKey[binding.encounterSetKey] ??
              fail(`${room.gameName} lost encounter set ${binding.encounterSetKey}`),
            phase.authoredChoiceKey,
            `${room.gameName}.${phase.slotKey}`,
          );
          return resolveEncounterAuthoringProfile(profile, context);
        })();
  if (definitionKey === undefined) return undefined;
  const routeFreeRoom = catalog.rooms.byKey[room.gameName];
  const resolved = resolvedEncounterPhaseForDefinition(
    catalog,
    phase,
    definitionKey,
    routeFreeRoom === undefined
      ? []
      : contextuallyReplacedCustomizationDecisions(catalog, routeFreeRoom, room, phase.slotKey, {
          authoredChoiceKey: phase.authoredChoiceKey,
          encounterDefinitionKey: definitionKey,
        }),
  );
  if (supportsGeneratedEncounterCustomization(room) || resolved.customization === undefined)
    return resolved;
  return Object.freeze({
    ...resolved,
    customization: Object.freeze(
      resolved.customization.filter((decision) => decision.selection.kind !== 'generated'),
    ),
  });
}

export function resolveMaterializedEncounterPhases(
  catalog: Catalog,
  room: RoomDeclaration,
  phases: readonly MaterializedEncounterPhase[],
  context: EncounterResolutionContext,
): readonly ResolvedEncounterPhase[] {
  return Object.freeze(
    phases.map((phase) => {
      const resolved = resolveMaterializedEncounterPhase(catalog, room, phase, context);
      if (resolved === undefined) {
        return fail(
          `${room.gameName}.${phase.slotKey} has unavailable contextual encounter identity`,
        );
      }
      return resolved;
    }),
  );
}

export function alwaysActiveEncounterSlotKeys(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): readonly string[] {
  return Object.freeze(
    encounterEnvelopeSlots(catalog, room, path)
      .filter((slot) => slot.activation === 'always')
      .map((slot) => slot.key),
  );
}
