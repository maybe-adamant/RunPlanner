import {
  isCombatBearingEncounterPhaseKind,
  type Catalog,
  type RoomDeclaration,
} from '../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from './addresses';
import { acquisitionSiteFromStorageKey, parseArtificerReplacementEntryKey } from './artificer';
import { parseHermesShrineDeliveryEntryKey } from './hermes-shrine-delivery';
import { authoredAcquisitionSources } from './acquisition-sources';
import {
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  parseSeaStarDuplicateSiteKey,
  seaStarDuplicateUsesFreshObject,
} from './sea-star';
import type { RoomActionReference, RoomOccurrence } from './model';
import {
  encounterEnvelopeSlots,
  selectedEncounterDefinitionKey,
} from './room-state/encounter-envelope';
import { activeRoomActionReferences, roomActionKey } from './room-actions';
import { selectedPickupProducerForEntry } from './pickup-producers';

export type RoomActionParticipation = 'required' | 'optional';

export type RoomActionWindow =
  | { readonly kind: 'standard'; readonly phase: 'beforeCombat' | 'afterCombat' }
  | { readonly kind: 'postOutgoing' }
  | { readonly kind: 'fields'; readonly phaseKey?: string }
  | { readonly kind: 'shipPreCombat'; readonly wheelKey: string }
  | { readonly kind: 'shipPostCombat'; readonly wheelKey: string };

export type RoomActionDependency =
  | { readonly kind: 'afterAction'; readonly action: RoomActionReference }
  | { readonly kind: 'afterCheckpoint'; readonly checkpointKey: string }
  | { readonly kind: 'beforeCheckpoint'; readonly checkpointKey: string };

export interface RoomActionContribution {
  readonly kind: 'action';
  readonly reference: RoomActionReference;
  readonly owner: SemanticAddress;
  readonly participation: RoomActionParticipation;
  readonly window: RoomActionWindow;
  readonly dependencies: readonly RoomActionDependency[];
}

export interface RoomActionCheckpointContribution {
  readonly kind: 'checkpoint';
  readonly checkpointKey: string;
  readonly label: string;
  readonly window: RoomActionWindow;
}

export type RoomActionDomainContribution =
  RoomActionContribution | RoomActionCheckpointContribution;

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

export interface RoomActionDomain {
  readonly owner: ReturnType<typeof createOccurrenceAddress>;
  readonly declaration: RoomDeclaration;
  readonly lifecycleProfileKey: string;
  readonly lifecycleStructure: RoomLifecycleStructure;
  readonly activeReferences: readonly RoomActionReference[];
  readonly contributions: readonly RoomActionDomainContribution[];
}

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

function actionOwner(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): SemanticAddress {
  return createRoomActionAddress(biome, occurrence.occurrenceId, roomActionKey(reference));
}

function artificerSourceActionKey(sourceKey: string, acquisitionRole: string): string {
  return JSON.stringify([sourceKey, acquisitionRole]);
}

function contribution(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
  participation: RoomActionParticipation,
  window: RoomActionWindow,
  dependencies: readonly RoomActionDependency[] = [],
  owner: SemanticAddress = actionOwner(biome, occurrence, reference),
): RoomActionContribution {
  return frozen({
    kind: 'action',
    reference,
    owner,
    participation,
    window,
    dependencies: frozen([...dependencies]),
  });
}

function producerWindow(
  catalog: Catalog,
  lifecycleProfileKey: string,
  producerPoint: string,
): RoomActionWindow {
  const profile = catalog.roomLifecycleProfiles.byKey[lifecycleProfileKey];
  const startIndex = profile?.operations.findIndex(
    (operation) => operation.kind === 'startEncounter',
  );
  const producerIndex = profile?.operations.findIndex(
    (operation) => operation.kind === 'advanceProducer' && operation.point === producerPoint,
  );
  return frozen({
    kind: 'standard',
    phase:
      startIndex !== undefined &&
      startIndex >= 0 &&
      producerIndex !== undefined &&
      producerIndex >= 0 &&
      producerIndex < startIndex
        ? 'beforeCombat'
        : 'afterCombat',
  });
}

function phaseRewardAttachment(
  catalog: Catalog,
  declaration: RoomDeclaration,
  occurrence: RoomOccurrence,
  phaseKey: string,
) {
  return encounterEnvelopeSlots(catalog, declaration, occurrence.gameName).find(
    (phase) => phase.key === phaseKey,
  )?.rewardAttachment;
}

function baseContribution(
  catalog: Catalog,
  biome: BiomeAddress,
  declaration: RoomDeclaration,
  lifecycleProfileKey: string,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): RoomActionContribution {
  switch (reference.kind) {
    case 'useFountain':
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        frozen({ kind: 'standard', phase: 'afterCombat' }),
      );
    case 'interactKeepsakeRack':
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        frozen({ kind: 'standard', phase: 'afterCombat' }),
      );
    case 'purchaseStygianWellOffer':
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        frozen({ kind: 'standard', phase: 'afterCombat' }),
      );
    case 'completeFieldsCage':
      return contribution(biome, occurrence, reference, 'required', frozen({ kind: 'fields' }));
    case 'interactIncomingReward':
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        producerWindow(catalog, lifecycleProfileKey, reference.producerPoint),
        [],
        createAcquisitionRoleAddress(
          createIncomingRewardAddress(biome, occurrence.occurrenceId),
          reference.acquisitionRole,
        ),
      );
    case 'interactLocalReward': {
      const attachment = encounterEnvelopeSlots(catalog, declaration, occurrence.gameName).find(
        (phase) =>
          phase.rewardAttachment?.kind === 'localReward' &&
          phase.rewardAttachment.groupKey === reference.groupKey &&
          phase.rewardAttachment.slotKey === reference.slotKey,
      );
      const required = reference.groupKey === 'cages';
      return contribution(
        biome,
        occurrence,
        reference,
        required ? 'required' : 'optional',
        frozen({
          kind: 'fields',
          ...(attachment === undefined ? {} : { phaseKey: attachment.key }),
        }),
        attachment === undefined
          ? []
          : [
              frozen({
                kind: 'afterAction',
                action: frozen({ kind: 'completeFieldsCage', phaseKey: attachment.key }),
              }),
            ],
        createLocalRewardAddress(
          biome,
          occurrence.occurrenceId,
          reference.groupKey,
          reference.slotKey,
        ),
      );
    }
    case 'chooseRewardWheel':
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        frozen({ kind: 'shipPreCombat', wheelKey: reference.wheelKey }),
        reference.wheelKey === 'wheel2'
          ? [frozen({ kind: 'afterCheckpoint', checkpointKey: 'nextPhaseUsable:wheel1' })]
          : [],
        createRewardWheelAddress(biome, occurrence.occurrenceId, reference.wheelKey),
      );
    case 'interactWheelReward': {
      const wheel =
        occurrence.state.kind === 'shipCombat'
          ? occurrence.state.wheels[reference.wheelKey]
          : undefined;
      const offerKey =
        wheel === undefined ? undefined : Object.keys(wheel.offers)[wheel.pickedOfferIndex - 1];
      const phase = encounterEnvelopeSlots(catalog, declaration, occurrence.gameName).find(
        (candidate) =>
          candidate.rewardAttachment?.kind === 'rewardWheel' &&
          candidate.rewardAttachment.key === reference.wheelKey,
      );
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        frozen({ kind: 'shipPostCombat', wheelKey: reference.wheelKey }),
        [
          frozen({
            kind: 'afterAction',
            action: frozen({ kind: 'chooseRewardWheel', wheelKey: reference.wheelKey }),
          }),
          ...(phase === undefined
            ? []
            : [frozen({ kind: 'afterCheckpoint' as const, checkpointKey: `combat:${phase.key}` })]),
        ],
        offerKey === undefined
          ? createRewardWheelAddress(biome, occurrence.occurrenceId, reference.wheelKey)
          : createRewardWheelOfferAddress(
              biome,
              occurrence.occurrenceId,
              reference.wheelKey,
              offerKey,
            ),
      );
    }
    case 'interactShopOffer':
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        frozen({ kind: 'postOutgoing' }),
        [],
        createShopOfferAddress(biome, occurrence.occurrenceId, reference.offerKey),
      );
    case 'purchaseHermesShrineOffer':
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        frozen({ kind: 'postOutgoing' }),
      );
    case 'sellPurgingPoolTrait':
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        frozen({ kind: 'postOutgoing' }),
      );
    case 'interactEncounter':
    case 'interactGorgon': {
      const attachment = phaseRewardAttachment(
        catalog,
        declaration,
        occurrence,
        reference.phaseKey,
      );
      const window: RoomActionWindow =
        attachment?.kind === 'rewardWheel'
          ? frozen({ kind: 'shipPostCombat', wheelKey: attachment.key })
          : lifecycleProfileKey === 'FieldsCombatRoom'
            ? frozen({ kind: 'fields', phaseKey: reference.phaseKey })
            : frozen({ kind: 'standard', phase: 'afterCombat' });
      const cage =
        lifecycleProfileKey === 'FieldsCombatRoom' && attachment?.kind === 'localReward'
          ? frozen({ kind: 'completeFieldsCage' as const, phaseKey: reference.phaseKey })
          : undefined;
      const encounterKey = selectedEncounterDefinitionKey(
        catalog,
        declaration,
        occurrence.encounters,
        reference.phaseKey,
        occurrence.gameName,
      );
      const phaseIsCombatBearing = isCombatBearingEncounterPhaseKind(
        catalog.encounterDefinitions.byKey[encounterKey]?.kind ?? 'nonCombat',
      );
      const dependencies: RoomActionDependency[] = [
        ...(cage === undefined ? [] : [frozen({ kind: 'afterAction' as const, action: cage })]),
        ...(lifecycleProfileKey === 'FieldsCombatRoom' && attachment === undefined
          ? []
          : phaseIsCombatBearing
            ? [
                frozen({
                  kind: 'afterCheckpoint' as const,
                  checkpointKey: `combat:${reference.phaseKey}`,
                }),
              ]
            : []),
      ];
      const phaseOwner = createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        reference.phaseKey,
      );
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        window,
        dependencies,
        reference.kind === 'interactGorgon' ? createGorgonPhaseAddress(phaseOwner) : phaseOwner,
      );
    }
    case 'interactAcquisitionEntry': {
      const hermesDelivery =
        reference.siteKey === 'hermesShrineDelivery'
          ? parseHermesShrineDeliveryEntryKey(reference.entryKey)
          : undefined;
      const producer = selectedPickupProducerForEntry(
        catalog,
        biome,
        occurrence,
        reference.siteKey,
        reference.entryKey,
      );
      const required =
        hermesDelivery !== undefined ||
        (producer?.pickups.some((pickup) => pickup.key === reference.entryKey && pickup.required) ??
          false);
      const site = acquisitionSiteFromStorageKey(
        createOccurrenceAddress(biome, occurrence.occurrenceId),
        reference.siteKey,
      );
      return contribution(
        biome,
        occurrence,
        reference,
        required ? 'required' : 'optional',
        hermesDelivery !== undefined
          ? frozen({ kind: 'standard', phase: 'afterCombat' })
          : producer?.placement === 'roomExit' ||
              (producer?.source.kind === 'traitOffer' &&
                producer.source.owner.kind === 'shopOffer') ||
              reference.siteKey === 'roomExit'
            ? frozen({ kind: 'postOutgoing' })
            : frozen({ kind: 'standard', phase: 'afterCombat' }),
        producer === undefined
          ? []
          : [frozen({ kind: 'afterAction', action: producer.sourceAction })],
        site === undefined
          ? actionOwner(biome, occurrence, reference)
          : createAcquisitionEntryAddress(site, reference.entryKey),
      );
    }
  }
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
  const combatSlots = activeSlots.filter((slot) => {
    if (
      options.lifecycleProfileKey === 'FieldsCombatRoom' &&
      slot.rewardAttachment?.kind !== 'localReward'
    ) {
      return false;
    }
    const encounterKey = selectedEncounterDefinitionKey(
      options.catalog,
      options.declaration,
      options.occurrence.encounters,
      slot.key,
      options.occurrence.gameName,
    );
    const encounter = options.catalog.encounterDefinitions.byKey[encounterKey];
    return encounter !== undefined && isCombatBearingEncounterPhaseKind(encounter.kind);
  });
  const declaredPhases = combatSlots.map((slot) =>
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
  switch (window.kind) {
    case 'standard':
      return window.phase === 'beforeCombat'
        ? beforePoint((point) => point.kind === 'encounterStart')
        : afterPoint((point) => point.kind === 'encounterEnd');
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

function checkpoints(
  catalog: Catalog,
  declaration: RoomDeclaration,
  occurrence: Pick<RoomOccurrence, 'gameName' | 'roomActions'>,
  structure: RoomLifecycleStructure,
): readonly RoomActionCheckpointContribution[] {
  const envelopeByKey = new Map(
    encounterEnvelopeSlots(catalog, declaration, occurrence.gameName).map((phase) => [
      phase.key,
      phase,
    ]),
  );
  const result: RoomActionCheckpointContribution[] = structure.phases.map((phase) => {
    const attachment = envelopeByKey.get(phase.phaseKey)?.rewardAttachment;
    return frozen({
      kind: 'checkpoint',
      checkpointKey: `combat:${phase.phaseKey}`,
      label: `${phase.phaseKey} complete`,
      window:
        attachment?.kind === 'rewardWheel'
          ? frozen({ kind: 'shipPostCombat', wheelKey: attachment.key })
          : structure.profileKey === 'FieldsCombatRoom'
            ? frozen({ kind: 'fields', phaseKey: phase.phaseKey })
            : frozen({ kind: 'standard', phase: 'afterCombat' }),
    });
  });
  for (const point of structure.points) {
    if (point.kind === 'nextPhase' && point.previousWheelKey !== undefined) {
      result.push(
        frozen({
          kind: 'checkpoint',
          checkpointKey: `nextPhaseUsable:${point.previousWheelKey}`,
          label: `${point.previousWheelKey} next phase usable`,
          window: frozen({ kind: 'shipPostCombat', wheelKey: point.previousWheelKey }),
        }),
      );
    }
  }
  const finalPhase = structure.phases.at(-1);
  const finalWindow: RoomActionWindow =
    structure.profileKey === 'WorldShopRoom'
      ? frozen({ kind: 'postOutgoing' })
      : finalPhase?.rewardWheelKey !== undefined
        ? frozen({ kind: 'shipPostCombat', wheelKey: finalPhase.rewardWheelKey })
        : frozen({ kind: 'standard', phase: 'afterCombat' });
  if (structure.points.some((point) => point.kind === 'outgoingGeneration'))
    result.push(
      frozen({
        kind: 'checkpoint',
        checkpointKey: 'outgoingGeneration',
        label: 'Outgoing generation',
        window: finalWindow,
      }),
    );
  result.push(
    frozen({
      kind: 'checkpoint',
      checkpointKey: 'exitUsable',
      label: 'Exit usable',
      window: finalWindow,
    }),
  );
  return frozen(result);
}

/** Pure authored structural Room Action domain consumed by commands and simulation. */
export function assembleRoomActionDomain(options: {
  readonly catalog: Catalog;
  readonly biome: BiomeAddress;
  readonly occurrence: RoomOccurrence;
  readonly lifecycleProfileKey?: string;
  readonly activeEncounterSlotKeys?: readonly string[];
  readonly activeRewardWheelKeys?: readonly string[];
  /** Evaluated producer disposition from canonical materialization. */
  readonly incomingRewardActive?: boolean;
  readonly shopInventoryActive?: boolean;
}): RoomActionDomain {
  const declaration = options.catalog.rooms.byKey[options.occurrence.gameName];
  if (declaration === undefined) throw new Error(`unknown room ${options.occurrence.gameName}`);
  const lifecycleProfileKey =
    options.lifecycleProfileKey ?? authoredRoomLifecycleProfileKey(declaration, options.occurrence);
  const lifecycleStructure = assembleRoomLifecycleStructure({
    catalog: options.catalog,
    declaration,
    occurrence: options.occurrence,
    lifecycleProfileKey,
    ...(options.activeEncounterSlotKeys === undefined
      ? {}
      : { activeEncounterSlotKeys: options.activeEncounterSlotKeys }),
  });
  const structuralReferences = activeRoomActionReferences(
    options.catalog,
    options.biome,
    options.occurrence,
    {
      ...(options.activeEncounterSlotKeys === undefined
        ? {}
        : { activeEncounterSlotKeys: options.activeEncounterSlotKeys }),
      ...(options.activeRewardWheelKeys === undefined
        ? {}
        : { activeRewardWheelKeys: options.activeRewardWheelKeys }),
      ...(options.incomingRewardActive === undefined
        ? (() => {
            const selectedEncounterSuppressesIncoming = encounterEnvelopeSlots(
              options.catalog,
              declaration,
              declaration.gameName,
            ).some((slot) => {
              const selected = selectedEncounterDefinitionKey(
                options.catalog,
                declaration,
                options.occurrence.encounters,
                slot.key,
                declaration.gameName,
              );
              return (
                selected !== undefined &&
                options.catalog.encounterDefinitions.byKey[selected]?.suppressesIncomingReward ===
                  true
              );
            });
            return {
              incomingRewardActive:
                !selectedEncounterSuppressesIncoming &&
                (options.occurrence.state.kind !== 'anomaly' || options.occurrence.state.success),
            };
          })()
        : { incomingRewardActive: options.incomingRewardActive }),
      ...(options.shopInventoryActive === undefined
        ? {}
        : { shopInventoryActive: options.shopInventoryActive }),
    },
  );
  let actions = structuralReferences.map((reference) =>
    baseContribution(
      options.catalog,
      options.biome,
      declaration,
      lifecycleProfileKey,
      options.occurrence,
      reference,
    ),
  );
  const sourceRewards = new Map(
    authoredAcquisitionSources(options.biome, options.occurrence).map((source) => [
      semanticAddressKey(source.acquisition.owner),
      source.reward,
    ]),
  );
  const orderedActionKeys = new Set(options.occurrence.roomActions.order.map(roomActionKey));
  // Generated pickup actions inherit the exact lifecycle window of their
  // source acquisition. Iterate through the finite action list so a nested
  // Echo replay inherits its parent source before its own child does.
  for (let round = 0; round < actions.length; round += 1) {
    const sourceActions = new Map<string, RoomActionContribution>();
    const sourceActionsByReference = new Map<string, RoomActionContribution>();
    for (const action of actions) {
      sourceActionsByReference.set(roomActionKey(action.reference), action);
      const sourceOwner =
        action.owner.kind === 'acquisitionRole' ? action.owner.owner : action.owner;
      const acquisitionRole =
        action.owner.kind === 'acquisitionRole' ? action.owner.acquisitionRole : 'self';
      sourceActions.set(
        artificerSourceActionKey(semanticAddressKey(sourceOwner), acquisitionRole),
        action,
      );
    }
    // Some sources deliberately settle through a different row.  A rushed
    // Shrine pickup is owned by its virtual acquisition entry but executes in
    // the one purchase action, so its generated Artificer/Sea Star children
    // must inherit that contribution rather than search for a nonexistent
    // acquisition-entry row.
    for (const source of authoredAcquisitionSources(options.biome, options.occurrence)) {
      if (source.action === undefined) continue;
      const contribution = sourceActionsByReference.get(roomActionKey(source.action));
      if (contribution === undefined) continue;
      sourceActions.set(
        artificerSourceActionKey(
          semanticAddressKey(source.acquisition.owner),
          source.acquisition.acquisitionRole,
        ),
        contribution,
      );
    }
    actions = actions.flatMap((action) => {
      if (action.reference.kind !== 'interactAcquisitionEntry') return [action];
      const parsed = parseArtificerReplacementEntryKey(action.reference.entryKey);
      const seaStar =
        action.reference.entryKey === SEA_STAR_DUPLICATE_ENTRY_KEY
          ? parseSeaStarDuplicateSiteKey(action.reference.siteKey)
          : undefined;
      const producer =
        parsed === undefined && seaStar === undefined
          ? selectedPickupProducerForEntry(
              options.catalog,
              options.biome,
              options.occurrence,
              action.reference.siteKey,
              action.reference.entryKey,
            )
          : undefined;
      if (parsed === undefined && seaStar === undefined && producer === undefined) return [action];
      const source =
        parsed === undefined && seaStar === undefined
          ? producer === undefined
            ? undefined
            : sourceActionsByReference.get(roomActionKey(producer.sourceAction))
          : sourceActions.get(
              artificerSourceActionKey(
                (parsed ?? seaStar)!.sourceKey,
                (parsed ?? seaStar)!.acquisitionRole,
              ),
            );
      if (source === undefined || !orderedActionKeys.has(roomActionKey(source.reference)))
        return [];
      if (parsed === undefined && seaStar === undefined && producer?.placement !== 'afterSource')
        return [action];
      if (
        parsed !== undefined &&
        sourceRewards.get(parsed.sourceKey)?.dispositionByAcquisitionRole[parsed.acquisitionRole]
          ?.kind !== 'artificer'
      )
        return [];
      if (
        seaStar !== undefined &&
        sourceRewards.get(seaStar.sourceKey)?.dispositionByAcquisitionRole[seaStar.acquisitionRole]
          ?.kind !== 'normal'
      )
        return [];
      const dependencies = action.dependencies.some(
        (dependency) =>
          dependency.kind === 'afterAction' &&
          roomActionKey(dependency.action) === roomActionKey(source.reference),
      )
        ? action.dependencies
        : frozen([
            ...action.dependencies,
            frozen({ kind: 'afterAction' as const, action: source.reference }),
          ]);
      return [
        frozen({
          ...action,
          ...(parsed !== undefined
            ? { participation: 'required' as const }
            : seaStar !== undefined
              ? {
                  participation: seaStarDuplicateUsesFreshObject(
                    options.catalog,
                    sourceRewards.get(seaStar.sourceKey)!,
                    seaStar.acquisitionRole,
                  )
                    ? ('required' as const)
                    : source.participation,
                }
              : {}),
          window: source.window,
          dependencies,
        }),
      ];
    });
  }
  if (lifecycleProfileKey === 'FieldsCombatRoom') {
    const authoredOrder = new Map(
      options.occurrence.roomActions.order.map((reference, index) => [
        roomActionKey(reference),
        index,
      ]),
    );
    const phaseOrder = new Map(
      encounterEnvelopeSlots(options.catalog, declaration, options.occurrence.gameName).map(
        (phase, index) => [phase.key, index],
      ),
    );
    const contacts = actions.filter(
      (action) =>
        action.reference.kind === 'interactEncounter' || action.reference.kind === 'interactGorgon',
    );
    actions = actions.map((action) => {
      if (action.reference.kind !== 'completeFieldsCage') return action;
      const cageReference = action.reference;
      const ownAuthored = authoredOrder.get(roomActionKey(cageReference));
      const ownDeclared = phaseOrder.get(cageReference.phaseKey) ?? Number.MAX_SAFE_INTEGER;
      const barriers = contacts.filter((contact) => {
        const reference = contact.reference;
        if (reference.kind !== 'interactEncounter' && reference.kind !== 'interactGorgon')
          return false;
        const attachment = phaseRewardAttachment(
          options.catalog,
          declaration,
          options.occurrence,
          reference.phaseKey,
        );
        if (attachment?.kind !== 'localReward') return true;
        if (reference.phaseKey === cageReference.phaseKey) return false;
        const sourceReference = frozen({
          kind: 'completeFieldsCage' as const,
          phaseKey: reference.phaseKey,
        });
        const sourceAuthored = authoredOrder.get(roomActionKey(sourceReference));
        const sourceDeclared = phaseOrder.get(reference.phaseKey) ?? Number.MAX_SAFE_INTEGER;
        if (ownAuthored !== undefined && sourceAuthored !== undefined)
          return sourceAuthored < ownAuthored;
        return sourceDeclared < ownDeclared;
      });
      return frozen({
        ...action,
        dependencies: frozen([
          ...action.dependencies,
          ...barriers.map((barrier) =>
            frozen({ kind: 'afterAction' as const, action: barrier.reference }),
          ),
        ]),
      });
    });
  }
  const contributions = frozen([
    ...actions,
    ...checkpoints(options.catalog, declaration, options.occurrence, lifecycleStructure),
  ]);
  const activeReferences = frozen(actions.map((action) => action.reference));
  const contributedKeys = new Set(actions.map((action) => roomActionKey(action.reference)));
  const activeKeys = new Set(activeReferences.map(roomActionKey));
  if (
    contributedKeys.size !== activeKeys.size ||
    [...contributedKeys].some((key) => !activeKeys.has(key))
  )
    throw new Error(`${options.occurrence.gameName} room-action structural domain drifted`);
  return frozen({
    owner: createOccurrenceAddress(options.biome, options.occurrence.occurrenceId),
    declaration,
    lifecycleProfileKey,
    lifecycleStructure,
    activeReferences,
    contributions,
  });
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
