import type { Catalog, EncounterAuthoringProfile, RoomDeclaration } from '../../catalog-schema';
import type { RoomEncounterState } from '../../authored-project/model';
import {
  encounterEnvelopeSlots,
  encounterAuthoringProfileForKey,
  encounterBindingsBySlot,
  selectedEncounterAuthoringProfileKey,
} from '../../authored-project/room-state/encounter-envelope';
import type { MaterializedEncounterPhase, ResolvedEncounterPhase } from './model';

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
    ResolvedEncounterPhase,
    'slotKey' | 'envelopeKey' | 'figLeafSkip' | 'rewardAttachment'
  >,
  encounterKey: string,
): ResolvedEncounterPhase {
  const definition = catalog.encounterDefinitions.byKey[encounterKey];
  if (definition === undefined) return fail(`lost encounter ${encounterKey}`);
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
    ...(phase.rewardAttachment === undefined ? {} : { rewardAttachment: phase.rewardAttachment }),
    ...(definition.sequenceEffect === undefined
      ? {}
      : { sequenceEffect: definition.sequenceEffect }),
  });
}

/** Reward authorship is intentionally tri-state; absence is not incompleteness. */
export type EncounterResolutionContext =
  | { readonly kind: 'knownReward'; readonly rewardType: string }
  | { readonly kind: 'noReward' }
  | { readonly kind: 'unavailable' };

/** Narrow retained facts needed to resolve contextual encounter identity. */
export interface EncounterResolutionRoomFacts {
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly incomingReward?: { readonly offer: { readonly rewardType: string } };
  readonly unresolvedIncomingReward?: unknown;
}

export function encounterResolutionContext(
  room: EncounterResolutionRoomFacts,
  declaration: RoomDeclaration,
): EncounterResolutionContext {
  if (room.clockworkReward === 'goal') {
    return Object.freeze({ kind: 'knownReward', rewardType: 'ClockworkGoal' });
  }
  if (room.incomingReward !== undefined) {
    return Object.freeze({ kind: 'knownReward', rewardType: room.incomingReward.offer.rewardType });
  }
  if (room.unresolvedIncomingReward !== undefined) return Object.freeze({ kind: 'unavailable' });
  return declaration.incomingReward.kind === 'none'
    ? Object.freeze({ kind: 'noReward' })
    : Object.freeze({ kind: 'unavailable' });
}

export function resolveEncounterAuthoringProfile(
  profile: EncounterAuthoringProfile,
  context: EncounterResolutionContext,
): string | undefined {
  if (profile.resolution.kind === 'direct') {
    return profile.resolution.encounterDefinitionKey;
  }
  if (context.kind === 'unavailable') return undefined;
  return context.kind === 'knownReward'
    ? (profile.resolution.encounterDefinitionKeyByRewardType[context.rewardType] ??
        profile.resolution.defaultEncounterDefinitionKey)
    : profile.resolution.defaultEncounterDefinitionKey;
}

/**
 * Materializes a declaration-owned active slot prefix as retained authored
 * choices. Concrete identity and eligibility are intentionally deferred to
 * the exact preparation checkpoint, so no contextual default is guessed here.
 */
export function materializeEncounterPhases(
  catalog: Catalog,
  room: RoomDeclaration,
  encounters: RoomEncounterState,
  activeSlotKeys: readonly string[],
  path: string,
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
      const encounterKey = selectedEncounterAuthoringProfileKey(
        catalog,
        room,
        encounters,
        slotKey,
        path,
      );
      return Object.freeze({
        slotKey,
        envelopeKey: room.encounterEnvelopeKey,
        authoredChoiceKey: encounterKey,
        figLeafSkip: encounters.figLeafSkipByPhase[slotKey] === true,
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
  const definitionKey =
    binding.kind === 'fixed'
      ? binding.encounterDefinitionKey
      : (() => {
          const profile = encounterAuthoringProfileForKey(
            catalog.encounterSets.byKey[binding.encounterSetKey] ??
              fail(`${room.gameName} lost encounter set ${binding.encounterSetKey}`),
            phase.authoredChoiceKey,
            `${room.gameName}.${phase.slotKey}`,
          );
          return resolveEncounterAuthoringProfile(profile, context);
        })();
  return definitionKey === undefined
    ? undefined
    : resolvedEncounterPhaseForDefinition(catalog, phase, definitionKey);
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
