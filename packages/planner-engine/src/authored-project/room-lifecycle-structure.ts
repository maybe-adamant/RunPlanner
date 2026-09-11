import {
  isCombatBearingEncounterPhaseKind,
  type Catalog,
  type RoomDeclaration,
} from '../catalog-schema';
import type { RoomOccurrence } from './model';
import {
  encounterEnvelopeSlots,
  selectedEncounterAuthoringProfileKey,
} from './room-state/encounter-envelope';

export type RoomActionWindow =
  | { readonly kind: 'standard'; readonly phase: 'beforeCombat' | 'afterCombat' }
  /** A cross-occurrence delivery must run after this exact encounter's end effects. */
  | { readonly kind: 'encounterEnd'; readonly phaseKey: string }
  | { readonly kind: 'postOutgoing' }
  | { readonly kind: 'fields'; readonly phaseKey?: string }
  | { readonly kind: 'shipPreCombat'; readonly wheelKey: string }
  | { readonly kind: 'shipPostCombat'; readonly wheelKey: string };

export interface RoomLifecycleStructurePhase {
  readonly phaseKey: string;
  readonly rewardWheelKey?: string;
}

export type RoomLifecycleStructurePoint =
  | { readonly kind: 'roomEntered'; readonly key: 'roomEntered' }
  | { readonly kind: 'encounterStart'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'bossDefeated'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'encounterEnd'; readonly key: string; readonly phaseKey: string }
  | {
      readonly kind: 'nextPhase';
      readonly key: string;
      readonly wheelKey: string;
      readonly previousWheelKey?: string;
    }
  | { readonly kind: 'outgoingGeneration'; readonly key: 'outgoingGeneration' }
  | { readonly kind: 'cleanup'; readonly key: 'cleanup' };

export interface RoomLifecycleStructure {
  readonly profileKey: string;
  readonly activeEncounterSlotKeys: readonly string[];
  readonly phases: readonly RoomLifecycleStructurePhase[];
  readonly points: readonly RoomLifecycleStructurePoint[];
}

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

/** One profile-owned lifecycle skeleton; authored action ranks populate only its intervals. */
export function assembleRoomLifecycleStructure(options: {
  readonly catalog: Catalog;
  readonly declaration: RoomDeclaration;
  readonly occurrence: RoomOccurrence;
  readonly lifecycleProfileKey: string;
  readonly activeEncounterSlotKeys?: readonly string[];
}): RoomLifecycleStructure {
  const profile = options.catalog.roomLifecycleProfiles.byKey[options.lifecycleProfileKey];
  if (profile === undefined) {
    throw new Error(
      `${options.occurrence.gameName} selected unknown lifecycle ${options.lifecycleProfileKey}`,
    );
  }
  const activeSlotKeys =
    options.activeEncounterSlotKeys === undefined
      ? undefined
      : new Set(options.activeEncounterSlotKeys);
  const activeSlots = encounterEnvelopeSlots(
    options.catalog,
    options.declaration,
    options.occurrence.gameName,
  ).filter(
    (slot, index) =>
      (activeSlotKeys === undefined || activeSlotKeys.has(slot.key)) &&
      (options.occurrence.state.kind !== 'shipCombat' ||
        index < options.occurrence.state.encounterCount),
  );
  const lifecycleSlots = activeSlots.filter((slot) => {
    if (
      options.lifecycleProfileKey === 'FieldsCombatRoom' &&
      slot.rewardAttachment?.kind !== 'localReward'
    ) {
      return false;
    }
    const encounterKey = selectedEncounterAuthoringProfileKey(
      options.catalog,
      options.declaration,
      options.occurrence.encounters,
      slot.key,
      options.occurrence.gameName,
    );
    const encounter = options.catalog.encounterDefinitions.byKey[encounterKey];
    return (
      options.occurrence.state.kind === 'shipCombat' ||
      (encounter !== undefined && isCombatBearingEncounterPhaseKind(encounter.kind))
    );
  });
  const declaredPhases = lifecycleSlots.map((slot) =>
    frozen({
      phaseKey: slot.key,
      ...(slot.rewardAttachment?.kind === 'rewardWheel'
        ? { rewardWheelKey: slot.rewardAttachment.key }
        : {}),
    }),
  );
  const phases =
    options.lifecycleProfileKey === 'FieldsCombatRoom'
      ? (() => {
          const byKey = new Map(declaredPhases.map((phase) => [phase.phaseKey, phase]));
          const ranked = options.occurrence.roomActions.order.flatMap((reference) =>
            reference.kind === 'completeFieldsCage' && byKey.has(reference.phaseKey)
              ? [byKey.get(reference.phaseKey)!]
              : [],
          );
          const rankedKeys = new Set(ranked.map((phase) => phase.phaseKey));
          return frozen([
            ...ranked,
            ...declaredPhases.filter((phase) => !rankedKeys.has(phase.phaseKey)),
          ]);
        })()
      : frozen(declaredPhases);
  const points: RoomLifecycleStructurePoint[] = [
    frozen({ kind: 'roomEntered', key: 'roomEntered' }),
  ];
  phases.forEach((phase, index) => {
    if (phase.rewardWheelKey !== undefined && index > 0) {
      const previousWheelKey = phases[index - 1]?.rewardWheelKey;
      points.push(
        frozen({
          kind: 'nextPhase',
          key: `nextPhase:${phase.rewardWheelKey}`,
          wheelKey: phase.rewardWheelKey,
          ...(previousWheelKey === undefined ? {} : { previousWheelKey }),
        }),
      );
    }
    points.push(
      frozen({
        kind: 'encounterStart',
        key: `encounterStart:${phase.phaseKey}`,
        phaseKey: phase.phaseKey,
      }),
      ...(options.lifecycleProfileKey === 'BossRoom'
        ? [
            frozen({
              kind: 'bossDefeated' as const,
              key: `bossDefeated:${phase.phaseKey}`,
              phaseKey: phase.phaseKey,
            }),
          ]
        : []),
      frozen({
        kind: 'encounterEnd',
        key: `encounterEnd:${phase.phaseKey}`,
        phaseKey: phase.phaseKey,
      }),
    );
  });
  const hasOutgoing = profile.operations.some(
    (operation) => operation.kind === 'generateOutgoingBatch',
  );
  if (hasOutgoing) points.push(frozen({ kind: 'outgoingGeneration', key: 'outgoingGeneration' }));
  points.push(frozen({ kind: 'cleanup', key: 'cleanup' }));
  return frozen({
    profileKey: options.lifecycleProfileKey,
    activeEncounterSlotKeys: frozen(activeSlots.map((slot) => slot.key)),
    phases: frozen(phases),
    points: frozen(points),
  });
}

/** Restrict one rigid structure to an engine-assessed active phase prefix. */
export function scopeRoomLifecycleStructure(
  structure: RoomLifecycleStructure,
  activePhaseKeys: readonly string[],
): RoomLifecycleStructure {
  const active = new Set(activePhaseKeys);
  const phases = structure.phases.filter((phase) => active.has(phase.phaseKey));
  const activeWheelKeys = new Set(
    phases.flatMap((phase) => (phase.rewardWheelKey === undefined ? [] : [phase.rewardWheelKey])),
  );
  const points = structure.points.filter((point) => {
    switch (point.kind) {
      case 'encounterStart':
      case 'bossDefeated':
      case 'encounterEnd':
        return active.has(point.phaseKey);
      case 'nextPhase':
        return activeWheelKeys.has(point.wheelKey);
      case 'roomEntered':
      case 'outgoingGeneration':
      case 'cleanup':
        return true;
    }
  });
  if (
    phases.length === structure.phases.length &&
    points.length === structure.points.length &&
    structure.activeEncounterSlotKeys.every((key) => active.has(key))
  ) {
    return structure;
  }
  return frozen({
    profileKey: structure.profileKey,
    activeEncounterSlotKeys: frozen(
      structure.activeEncounterSlotKeys.filter((key) => active.has(key)),
    ),
    phases: frozen(phases),
    points: frozen(points),
  });
}

export function roomLifecycleWindowOrdinal(
  structure: RoomLifecycleStructure,
  window: RoomActionWindow,
): number {
  const pointIndex = (predicate: (point: RoomLifecycleStructurePoint) => boolean): number => {
    const index = structure.points.findIndex(predicate);
    return index < 0 ? 0 : index;
  };
  const beforePoint = (predicate: (point: RoomLifecycleStructurePoint) => boolean): number =>
    pointIndex(predicate) * 2;
  const afterPoint = (predicate: (point: RoomLifecycleStructurePoint) => boolean): number =>
    pointIndex(predicate) * 2 + 1;
  const lastAfterPoint = (predicate: (point: RoomLifecycleStructurePoint) => boolean): number => {
    const index = structure.points.reduce(
      (last, point, candidateIndex) => (predicate(point) ? candidateIndex : last),
      -1,
    );
    return (index < 0 ? 0 : index) * 2 + 1;
  };
  switch (window.kind) {
    case 'standard':
      return window.phase === 'beforeCombat'
        ? beforePoint((point) => point.kind === 'encounterStart')
        : lastAfterPoint((point) => point.kind === 'encounterEnd');
    case 'encounterEnd':
      return afterPoint(
        (point) => point.kind === 'encounterEnd' && point.phaseKey === window.phaseKey,
      );
    case 'fields':
      return 1;
    case 'shipPreCombat':
      return structure.points.some(
        (point) => point.kind === 'nextPhase' && point.wheelKey === window.wheelKey,
      )
        ? afterPoint((point) => point.kind === 'nextPhase' && point.wheelKey === window.wheelKey)
        : beforePoint(
            (point) =>
              point.kind === 'encounterStart' &&
              structure.phases.some(
                (phase) =>
                  phase.phaseKey === point.phaseKey && phase.rewardWheelKey === window.wheelKey,
              ),
          );
    case 'shipPostCombat':
      return afterPoint(
        (point) =>
          point.kind === 'encounterEnd' &&
          structure.phases.some(
            (phase) =>
              phase.phaseKey === point.phaseKey && phase.rewardWheelKey === window.wheelKey,
          ),
      );
    case 'postOutgoing':
      return afterPoint((point) => point.kind === 'outgoingGeneration');
  }
}

/** Declaration/state-owned lifecycle selection before simulation materialization. */
export function authoredRoomLifecycleProfileKey(
  declaration: RoomDeclaration,
  occurrence: RoomOccurrence,
  role: 'ordinary' | 'ephyraSide' = 'ordinary',
): string {
  if (role === 'ephyraSide') return 'EphyraSideRoom';
  if (declaration.lifecycleProfileKey !== undefined) return declaration.lifecycleProfileKey;
  if (declaration.mode.kind !== 'authored') return 'RewardlessRoom';
  switch (declaration.mode.templateKey) {
    case 'Anomaly':
    case 'Chaos':
    case 'ContractBoss':
      return 'StandardRewardRoom';
    case 'Boss':
      return 'BossRoom';
    case 'ClockworkCombat':
      return occurrence.state.kind === 'counted' && occurrence.state.reward === null
        ? 'ClockworkGoalRoom'
        : 'StandardRewardRoom';
    case 'Devotion':
      return 'DevotionRoom';
    case 'EphyraCombat':
      return 'EphyraMainRoom';
    case 'EphyraSideRoom':
      return 'StandardRewardRoom';
    case 'FieldsCombat':
      return 'FieldsCombatRoom';
    case 'ShipCombat':
      return 'ShipCombatRoom';
    case 'Shop':
      return declaration.kind === 'Preboss' ? 'PrebossShopRoom' : 'WorldShopRoom';
    case 'Preboss':
      return occurrence.state.kind === 'shop' ? 'PrebossShopRoom' : 'PrebossFreeRewardRoom';
    case 'PostBoss':
      return 'PostBossRoom';
    case 'FixedIntro':
    case 'RewardlessCombat':
      return 'RewardlessCombatRoom';
    case 'FixedOpening':
      return 'OpeningRewardRoom';
    case 'FixedPreHub':
    case 'Fountain':
    case 'Miniboss':
    case 'StandardCombat':
      return declaration.encounterEnvelopeKey === 'PEncounter'
        ? 'PCombatRoom'
        : 'StandardRewardRoom';
    case 'Story':
      return 'StandardRewardRoom';
  }
}
