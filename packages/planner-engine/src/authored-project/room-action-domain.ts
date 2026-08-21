import type { Catalog, RoomDeclaration } from '../catalog-schema';
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
import type { RoomActionReference, RoomOccurrence } from './model';
import { encounterEnvelopeSlots } from './room-state/encounters';
import { activeRoomActionReferences, roomActionKey } from './room-actions';
import { selectedPickupProducer } from './traits';

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

export interface RoomActionDomain {
  readonly owner: ReturnType<typeof createOccurrenceAddress>;
  readonly declaration: RoomDeclaration;
  readonly lifecycleProfileKey: string;
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

function acquisitionSourceRewards(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): ReadonlyMap<string, import('./model').AuthoredRewardState> {
  const result = new Map<string, import('./model').AuthoredRewardState>();
  const add = (
    owner: SemanticAddress,
    reward: import('./model').AuthoredRewardState | null | undefined,
  ) => {
    if (reward !== null && reward !== undefined) result.set(semanticAddressKey(owner), reward);
  };
  switch (occurrence.state.kind) {
    case 'counted':
    case 'fixed':
    case 'anomaly':
    case 'ephyraCombat':
    case 'freeReward':
      add(createIncomingRewardAddress(biome, occurrence.occurrenceId), occurrence.state.reward);
      break;
    case 'fieldsCombat':
      for (const [slotKey, reward] of Object.entries(occurrence.state.cages))
        add(createLocalRewardAddress(biome, occurrence.occurrenceId, 'cages', slotKey), reward);
      for (const [slotKey, reward] of Object.entries(occurrence.state.optionalRewards))
        add(
          createLocalRewardAddress(biome, occurrence.occurrenceId, 'optionalRewards', slotKey),
          reward,
        );
      break;
    case 'shipCombat':
      for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels))
        for (const [offerKey, reward] of Object.entries(wheel.offers))
          add(
            createRewardWheelOfferAddress(biome, occurrence.occurrenceId, wheelKey, offerKey),
            reward,
          );
      break;
    case 'shop':
      for (const [offerKey, offer] of Object.entries(occurrence.state.shop?.offers ?? {}))
        add(createShopOfferAddress(biome, occurrence.occurrenceId, offerKey), offer.reward);
      break;
    case 'none':
      break;
  }
  for (const [siteKey, site] of Object.entries(occurrence.acquisitionSites ?? {})) {
    const siteAddress = acquisitionSiteFromStorageKey(
      createOccurrenceAddress(biome, occurrence.occurrenceId),
      siteKey,
    );
    if (siteAddress === undefined) continue;
    for (const [entryKey, reward] of Object.entries(site.pickupEntries ?? {}))
      add(createAcquisitionEntryAddress(siteAddress, entryKey), reward);
  }
  return result;
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
      const dependencies: RoomActionDependency[] = [
        ...(cage === undefined ? [] : [frozen({ kind: 'afterAction' as const, action: cage })]),
        ...(lifecycleProfileKey === 'FieldsCombatRoom' && attachment === undefined
          ? []
          : [
              frozen({
                kind: 'afterCheckpoint' as const,
                checkpointKey: `combat:${reference.phaseKey}`,
              }),
            ]),
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
      const producer = selectedPickupProducer(catalog, occurrence.encounters);
      const required =
        producer?.pickups.some((pickup) => pickup.key === reference.entryKey && pickup.required) ??
        false;
      const site = acquisitionSiteFromStorageKey(
        createOccurrenceAddress(biome, occurrence.occurrenceId),
        reference.siteKey,
      );
      return contribution(
        biome,
        occurrence,
        reference,
        required ? 'required' : 'optional',
        reference.siteKey === 'roomExit'
          ? frozen({ kind: 'postOutgoing' })
          : frozen({ kind: 'standard', phase: 'afterCombat' }),
        producer?.pickups.some((pickup) => pickup.key === reference.entryKey)
          ? [
              frozen({
                kind: 'afterAction',
                action: frozen({ kind: 'interactEncounter', phaseKey: producer.sourcePhaseKey }),
              }),
            ]
          : [],
        site === undefined
          ? actionOwner(biome, occurrence, reference)
          : createAcquisitionEntryAddress(site, reference.entryKey),
      );
    }
  }
}

function checkpoints(
  catalog: Catalog,
  declaration: RoomDeclaration,
  occurrence: RoomOccurrence,
  lifecycleProfileKey: string,
  activeEncounterSlotKeys?: readonly string[],
): readonly RoomActionCheckpointContribution[] {
  const activeSlots =
    activeEncounterSlotKeys === undefined ? undefined : new Set(activeEncounterSlotKeys);
  const phases = encounterEnvelopeSlots(catalog, declaration, occurrence.gameName).filter(
    (phase, index) =>
      (activeSlots === undefined || activeSlots.has(phase.key)) &&
      (occurrence.state.kind !== 'shipCombat' || index < occurrence.state.encounterCount),
  );
  const result: RoomActionCheckpointContribution[] = phases.map((phase) =>
    frozen({
      kind: 'checkpoint',
      checkpointKey: `combat:${phase.key}`,
      label: `${phase.key} complete`,
      window:
        phase.rewardAttachment?.kind === 'rewardWheel'
          ? frozen({ kind: 'shipPostCombat', wheelKey: phase.rewardAttachment.key })
          : lifecycleProfileKey === 'FieldsCombatRoom'
            ? frozen({ kind: 'fields', phaseKey: phase.key })
            : frozen({ kind: 'standard', phase: 'afterCombat' }),
    }),
  );
  if (occurrence.state.kind === 'shipCombat') {
    const activeWheelKeys = Object.keys(occurrence.state.wheels).slice(
      0,
      occurrence.state.encounterCount === 2 ? 1 : 2,
    );
    for (const wheelKey of activeWheelKeys.slice(0, -1))
      result.push(
        frozen({
          kind: 'checkpoint',
          checkpointKey: `nextPhaseUsable:${wheelKey}`,
          label: `${wheelKey} next phase usable`,
          window: frozen({ kind: 'shipPostCombat', wheelKey }),
        }),
      );
  }
  const finalWindow: RoomActionWindow =
    lifecycleProfileKey === 'WorldShopRoom'
      ? frozen({ kind: 'postOutgoing' })
      : occurrence.state.kind === 'shipCombat'
        ? frozen({
            kind: 'shipPostCombat',
            wheelKey: occurrence.state.encounterCount === 2 ? 'wheel1' : 'wheel2',
          })
        : frozen({ kind: 'standard', phase: 'afterCombat' });
  const profile = catalog.roomLifecycleProfiles.byKey[lifecycleProfileKey];
  if (profile?.operations.some((operation) => operation.kind === 'generateOutgoingBatch'))
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
  readonly shopInventoryActive?: boolean;
}): RoomActionDomain {
  const declaration = options.catalog.rooms.byKey[options.occurrence.gameName];
  if (declaration === undefined) throw new Error(`unknown room ${options.occurrence.gameName}`);
  const lifecycleProfileKey =
    options.lifecycleProfileKey ?? authoredRoomLifecycleProfileKey(declaration, options.occurrence);
  const activeReferences = activeRoomActionReferences(
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
      ...(options.occurrence.state.kind === 'anomaly'
        ? { incomingRewardActive: options.occurrence.state.success }
        : {}),
      ...(options.shopInventoryActive === undefined
        ? {}
        : { shopInventoryActive: options.shopInventoryActive }),
    },
  );
  let actions = activeReferences.map((reference) =>
    baseContribution(
      options.catalog,
      options.biome,
      declaration,
      lifecycleProfileKey,
      options.occurrence,
      reference,
    ),
  );
  const sourceActions = new Map<string, RoomActionContribution>();
  for (const action of actions) {
    const sourceOwner = action.owner.kind === 'acquisitionRole' ? action.owner.owner : action.owner;
    sourceActions.set(semanticAddressKey(sourceOwner), action);
  }
  const sourceRewards = acquisitionSourceRewards(options.biome, options.occurrence);
  actions = actions.map((action) => {
    if (action.reference.kind !== 'interactAcquisitionEntry') return action;
    const parsed = parseArtificerReplacementEntryKey(action.reference.entryKey);
    if (parsed === undefined) return action;
    const source = sourceActions.get(parsed.sourceKey);
    if (source === undefined) return action;
    const disposition = sourceRewards.get(parsed.sourceKey)?.dispositionByAcquisitionRole[
      parsed.acquisitionRole
    ];
    if (disposition?.kind !== 'artificer') return action;
    return frozen({
      ...action,
      participation: source.participation,
      window: source.window,
      dependencies: frozen([
        ...action.dependencies,
        frozen({ kind: 'afterAction' as const, action: source.reference }),
      ]),
    });
  });
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
    ...checkpoints(
      options.catalog,
      declaration,
      options.occurrence,
      lifecycleProfileKey,
      options.activeEncounterSlotKeys,
    ),
  ]);
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
    activeReferences,
    contributions,
  });
}

/** Declaration/state-owned lifecycle selection before simulation materialization. */
export function authoredRoomLifecycleProfileKey(
  declaration: RoomDeclaration,
  occurrence: RoomOccurrence,
  role: 'ordinary' | 'ephyraOpening' | 'ephyraSide' = 'ordinary',
): string {
  if (role === 'ephyraOpening') return 'EphyraOpeningRoom';
  if (role === 'ephyraSide') return 'EphyraSideRoom';
  if (declaration.lifecycleProfileKey !== undefined) return declaration.lifecycleProfileKey;
  if (declaration.mode.kind !== 'authored') return 'RewardlessRoom';
  switch (declaration.mode.templateKey) {
    case 'Anomaly':
    case 'Chaos':
    case 'ContractBoss':
      return 'StandardRewardRoom';
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
    case 'FixedIntro':
    case 'RewardlessCombat':
      return 'RewardlessCombatRoom';
    case 'FixedOpening':
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

export function roomActionWindowRank(window: RoomActionWindow): number {
  switch (window.kind) {
    case 'standard':
      return window.phase === 'beforeCombat' ? 10 : 30;
    case 'fields':
      return 30;
    case 'shipPreCombat':
      return window.wheelKey === 'wheel1' ? 10 : 40;
    case 'shipPostCombat':
      return window.wheelKey === 'wheel1' ? 30 : 60;
    case 'postOutgoing':
      return 80;
  }
}
