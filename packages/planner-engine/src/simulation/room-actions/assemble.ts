import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import { roomActionKey } from '../../authored-project/room-actions';
import { parseArtificerReplacementEntryKey } from '../../authored-project/artificer';
import type { RoomActionReference } from '../../authored-project/model';
import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { selectedEncounterDefinitionKey } from '../../authored-project/room-state/encounters';
import { selectedPickupProducer } from '../../authored-project/traits';
import type { CanonicalAuthoredRoom } from '../materialization';
import type {
  RoomActionCheckpoint,
  RoomActionCheckpointContribution,
  RoomActionContribution,
  RoomActionDependency,
  RoomActionProposal,
  RoomActionRoster,
  RoomActionRosterContribution,
  RoomActionRosterIssue,
  RoomActionRow,
  RoomActionWindow,
} from './model';

type RoomActionContributionRoom = Omit<CanonicalAuthoredRoom, 'roomActionRoster'>;

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

function actionOwner(
  room: RoomActionContributionRoom,
  reference: RoomActionReference,
): SemanticAddress {
  return createRoomActionAddress(
    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
    room.occurrenceId,
    roomActionKey(reference),
  );
}

function contribution(
  room: RoomActionContributionRoom,
  reference: RoomActionReference,
  participation: 'required' | 'optional',
  window: RoomActionWindow,
  dependencies: readonly RoomActionDependency[] = [],
  owner: SemanticAddress = actionOwner(room, reference),
): RoomActionContribution {
  return frozen({
    kind: 'action' as const,
    reference,
    owner,
    participation,
    window,
    dependencies: frozen([...dependencies]),
  });
}

function incomingRewardContributions(
  catalog: Catalog,
  room: RoomActionContributionRoom,
): readonly RoomActionContribution[] {
  const incoming = room.incomingReward;
  if (incoming === undefined || incoming.acquisitionEnabled === false) return frozen([]);
  const lifecycle =
    catalog.rewards.producerLifecycles.byKey[incoming.producerLifecycleKey]?.rewardTypes.byKey[
      incoming.offer.rewardType
    ];
  if (lifecycle === undefined) return frozen([]);
  return frozen(
    lifecycle.acquisitionLifecycle.map((binding) => {
      const reference = frozen({
        kind: 'interactIncomingReward' as const,
        producerPoint: binding.lifecyclePoint,
        acquisitionRole: binding.role,
      });
      return contribution(
        room,
        reference,
        'required',
        frozen({
          kind: 'standard' as const,
          phase: binding.lifecyclePoint === 'beforeCombat' ? 'beforeCombat' : 'afterCombat',
        }),
        [],
        createAcquisitionRoleAddress(incoming.origin, binding.role),
      );
    }),
  );
}

function encounterContributions(
  catalog: Catalog,
  declaration: RoomDeclaration,
  room: RoomActionContributionRoom,
): readonly RoomActionContribution[] {
  const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  const result: RoomActionContribution[] = [];
  for (const phase of room.encounterPhases) {
    const encounterKey = selectedEncounterDefinitionKey(
      catalog,
      declaration,
      room.encounters,
      phase.slotKey,
      room.gameName,
    );
    const definition =
      encounterKey === undefined ? undefined : catalog.encounterDefinitions.byKey[encounterKey];
    const phaseOwner = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: room.occurrenceId },
      phase.slotKey,
    );
    const shipWheel =
      phase.rewardAttachment?.kind === 'rewardWheel' ? phase.rewardAttachment.key : undefined;
    const window: RoomActionWindow =
      shipWheel === undefined
        ? room.lifecycleProfileKey === 'FieldsCombatRoom'
          ? frozen({ kind: 'fields', phaseKey: phase.slotKey })
          : frozen({ kind: 'standard', phase: 'afterCombat' })
        : frozen({ kind: 'shipPostCombat', wheelKey: shipWheel });
    if (definition?.traitOfferProducer !== undefined) {
      const reference = frozen({ kind: 'interactEncounter' as const, phaseKey: phase.slotKey });
      const cageDependency =
        room.lifecycleProfileKey === 'FieldsCombatRoom' &&
        phase.rewardAttachment?.kind === 'localReward'
          ? [
              frozen({
                kind: 'afterAction' as const,
                action: frozen({
                  kind: 'completeFieldsCage' as const,
                  phaseKey: phase.slotKey,
                }),
              }),
            ]
          : [];
      result.push(
        contribution(
          room,
          reference,
          'required',
          window,
          [
            ...cageDependency,
            frozen({ kind: 'afterCheckpoint', checkpointKey: `combat:${phase.slotKey}` }),
          ],
          phaseOwner,
        ),
      );
    }
    const gorgon = room.encounters.gorgonResultByPhase?.[phase.slotKey];
    if (gorgon?.deathDefianceConditionMet === true) {
      const reference = frozen({ kind: 'interactGorgon' as const, phaseKey: phase.slotKey });
      const cageDependency =
        room.lifecycleProfileKey === 'FieldsCombatRoom' &&
        phase.rewardAttachment?.kind === 'localReward'
          ? [
              frozen({
                kind: 'afterAction' as const,
                action: frozen({
                  kind: 'completeFieldsCage' as const,
                  phaseKey: phase.slotKey,
                }),
              }),
            ]
          : [];
      result.push(
        contribution(
          room,
          reference,
          'required',
          window,
          [
            ...cageDependency,
            frozen({ kind: 'afterCheckpoint', checkpointKey: `combat:${phase.slotKey}` }),
          ],
          createGorgonPhaseAddress(phaseOwner),
        ),
      );
    }
  }
  return frozen(result);
}

function fieldsContributions(room: RoomActionContributionRoom): readonly RoomActionContribution[] {
  if (room.lifecycleProfileKey !== 'FieldsCombatRoom') return frozen([]);
  const result: RoomActionContribution[] = [];
  for (const reward of [...(room.localRewards ?? []), ...(room.unresolvedLocalRewards ?? [])]) {
    const complete = frozen({
      kind: 'completeFieldsCage' as const,
      phaseKey: reward.encounterPhaseKey,
    });
    result.push(contribution(room, complete, 'required', frozen({ kind: 'fields' })));
    const interact = frozen({
      kind: 'interactLocalReward' as const,
      groupKey: reward.groupKey,
      slotKey: reward.slotKey,
    });
    result.push(
      contribution(
        room,
        interact,
        'required',
        frozen({ kind: 'fields', phaseKey: reward.encounterPhaseKey }),
        [frozen({ kind: 'afterAction', action: complete })],
        reward.origin,
      ),
    );
  }
  for (const reward of [
    ...(room.fieldsOptionalRewards ?? []),
    ...(room.unresolvedFieldsOptionalRewards ?? []),
  ]) {
    const interact = frozen({
      kind: 'interactLocalReward' as const,
      groupKey: reward.groupKey,
      slotKey: reward.slotKey,
    });
    result.push(
      contribution(room, interact, 'optional', frozen({ kind: 'fields' }), [], reward.origin),
    );
  }
  return frozen(result);
}

function wheelContributions(room: RoomActionContributionRoom): readonly RoomActionContribution[] {
  return frozen(
    (room.rewardWheels ?? []).flatMap((wheel) => {
      const choose = frozen({ kind: 'chooseRewardWheel' as const, wheelKey: wheel.wheelKey });
      const acquire = frozen({ kind: 'interactWheelReward' as const, wheelKey: wheel.wheelKey });
      const picked = [...wheel.offers, ...wheel.unresolvedOffers].find((offer) => offer.picked);
      return [
        contribution(
          room,
          choose,
          'required',
          frozen({ kind: 'shipPreCombat', wheelKey: wheel.wheelKey }),
          wheel.wheelKey === 'wheel2'
            ? [frozen({ kind: 'afterCheckpoint', checkpointKey: 'nextPhaseUsable:wheel1' })]
            : [],
          wheel.origin,
        ),
        contribution(
          room,
          acquire,
          'required',
          frozen({ kind: 'shipPostCombat', wheelKey: wheel.wheelKey }),
          [
            frozen({ kind: 'afterAction', action: choose }),
            frozen({
              kind: 'afterCheckpoint',
              checkpointKey: `combat:${wheel.encounterPhaseKey}`,
            }),
          ],
          picked?.origin ?? wheel.origin,
        ),
      ];
    }),
  );
}

function shopContributions(room: RoomActionContributionRoom): readonly RoomActionContribution[] {
  if (room.entryState?.kind !== 'shop') return frozen([]);
  return frozen(
    [...room.entryState.offers, ...room.entryState.unresolvedOffers].map((offer) => {
      const reference = frozen({ kind: 'interactShopOffer' as const, offerKey: offer.offerKey });
      return contribution(
        room,
        reference,
        'optional',
        frozen({ kind: 'postOutgoing' }),
        [],
        offer.offerOrigin,
      );
    }),
  );
}

function acquisitionEntryContributions(
  catalog: Catalog,
  room: RoomActionContributionRoom,
  activeKeys: ReadonlySet<string>,
): readonly RoomActionContribution[] {
  const producer = selectedPickupProducer(catalog, room.encounters);
  const requiredKeys = new Set(
    producer?.pickups.filter((pickup) => pickup.required).map((pickup) => pickup.key) ?? [],
  );
  const producedKeys = new Set(producer?.pickups.map((pickup) => pickup.key) ?? []);
  return frozen(
    Object.entries(room.acquisitionSites).flatMap(([siteKey, siteState]) =>
      Object.keys(siteState.entries)
        .map((entryKey) => {
          const reference = frozen({
            kind: 'interactAcquisitionEntry' as const,
            siteKey,
            entryKey,
          });
          if (!activeKeys.has(roomActionKey(reference))) return undefined;
          const site = createAcquisitionEntryAddress(siteState.address, entryKey);
          return contribution(
            room,
            reference,
            requiredKeys.has(entryKey) ? 'required' : 'optional',
            frozen({
              kind: siteKey === 'roomExit' ? 'postOutgoing' : 'standard',
              phase: 'afterCombat',
            } as RoomActionWindow),
            producer !== undefined && producedKeys.has(entryKey)
              ? [
                  frozen({
                    kind: 'afterAction' as const,
                    action: frozen({
                      kind: 'interactEncounter' as const,
                      phaseKey: producer.sourcePhaseKey,
                    }),
                  }),
                ]
              : [],
            site,
          );
        })
        .filter((entry): entry is RoomActionContribution => entry !== undefined),
    ),
  );
}

export function roomActionContributions(options: {
  readonly catalog: Catalog;
  readonly declaration: RoomDeclaration;
  readonly room: RoomActionContributionRoom;
  readonly activeReferences: readonly RoomActionReference[];
}): readonly RoomActionRosterContribution[] {
  const { catalog, declaration, room } = options;
  const authoritativeKeys = new Set(options.activeReferences.map(roomActionKey));
  const checkpoints: RoomActionRosterContribution[] = room.encounterPhases.flatMap((phase) => [
    frozen({
      kind: 'checkpoint' as const,
      checkpointKey: `combat:${phase.slotKey}`,
      label: `${phase.label} complete`,
      window:
        phase.rewardAttachment?.kind === 'rewardWheel'
          ? frozen({ kind: 'shipPostCombat' as const, wheelKey: phase.rewardAttachment.key })
          : room.lifecycleProfileKey === 'FieldsCombatRoom'
            ? frozen({ kind: 'fields' as const, phaseKey: phase.slotKey })
            : frozen({ kind: 'standard' as const, phase: 'afterCombat' as const }),
    }),
  ]);
  if (room.rewardWheels !== undefined) {
    for (const wheel of room.rewardWheels.slice(0, -1)) {
      checkpoints.push(
        frozen({
          kind: 'checkpoint',
          checkpointKey: `nextPhaseUsable:${wheel.wheelKey}`,
          label: `${wheel.wheelKey} next phase usable`,
          window: frozen({ kind: 'shipPostCombat', wheelKey: wheel.wheelKey }),
        }),
      );
    }
  }
  const lifecycle = catalog.roomLifecycleProfiles.byKey[room.lifecycleProfileKey];
  if (lifecycle?.operations.some((operation) => operation.kind === 'generateOutgoingBatch')) {
    checkpoints.push(
      frozen({
        kind: 'checkpoint',
        checkpointKey: 'outgoingGeneration',
        label: 'Outgoing generation',
        window:
          room.lifecycleProfileKey === 'WorldShopRoom'
            ? frozen({ kind: 'postOutgoing' })
            : frozen({ kind: 'standard', phase: 'afterCombat' }),
      }),
    );
  }
  checkpoints.push(
    frozen({
      kind: 'checkpoint',
      checkpointKey: 'exitUsable',
      label: 'Exit usable',
      window:
        room.lifecycleProfileKey === 'WorldShopRoom'
          ? frozen({ kind: 'postOutgoing' })
          : room.lifecycleProfileKey === 'ShipCombatRoom' && room.rewardWheels?.length
            ? frozen({
                kind: 'shipPostCombat',
                wheelKey: room.rewardWheels[room.rewardWheels.length - 1]!.wheelKey,
              })
            : frozen({ kind: 'standard', phase: 'afterCombat' }),
    }),
  );
  let all: RoomActionRosterContribution[] = [
    ...incomingRewardContributions(catalog, room),
    ...fieldsContributions(room),
    ...wheelContributions(room),
    ...shopContributions(room),
    ...acquisitionEntryContributions(catalog, room, authoritativeKeys),
    ...encounterContributions(catalog, declaration, room),
    ...checkpoints,
  ];
  const sourceActions = new Map<string, RoomActionContribution>();
  for (const entry of all) {
    if (entry.kind !== 'action') continue;
    const sourceOwner = entry.owner.kind === 'acquisitionRole' ? entry.owner.owner : entry.owner;
    sourceActions.set(semanticAddressKey(sourceOwner), entry);
  }
  all = all.map((entry) => {
    if (entry.kind !== 'action' || entry.reference.kind !== 'interactAcquisitionEntry') {
      return entry;
    }
    const parsed = parseArtificerReplacementEntryKey(entry.reference.entryKey);
    if (parsed === undefined) return entry;
    const source = sourceActions.get(parsed.sourceKey);
    if (source === undefined) return entry;
    return frozen({
      ...entry,
      participation: source.participation,
      window: source.window,
      dependencies: frozen([
        ...entry.dependencies,
        frozen({ kind: 'afterAction' as const, action: source.reference }),
      ]),
    });
  });
  const contributedKeys = new Set(
    all
      .filter((entry): entry is RoomActionContribution => entry.kind === 'action')
      .map((entry) => roomActionKey(entry.reference)),
  );
  if (
    contributedKeys.size !== authoritativeKeys.size ||
    [...contributedKeys].some((key) => !authoritativeKeys.has(key))
  ) {
    const invented = [...contributedKeys].filter((key) => !authoritativeKeys.has(key));
    const missing = [...authoritativeKeys].filter((key) => !contributedKeys.has(key));
    throw new Error(
      `${room.gameName} room-action contribution domain drifted from authored structure; invented=${JSON.stringify(invented)} missing=${JSON.stringify(missing)}`,
    );
  }
  if (room.lifecycleProfileKey === 'FieldsCombatRoom') {
    const phaseRank = new Map(room.encounterPhases.map((phase, index) => [phase.slotKey, index]));
    const contacts = all.filter(
      (entry): entry is RoomActionContribution =>
        entry.kind === 'action' &&
        (entry.reference.kind === 'interactEncounter' || entry.reference.kind === 'interactGorgon'),
    );
    return frozen(
      all.map((entry) => {
        if (entry.kind !== 'action' || entry.reference.kind !== 'completeFieldsCage') return entry;
        const ownRank = phaseRank.get(entry.reference.phaseKey) ?? -1;
        const barriers = contacts
          .filter((contact) => {
            const reference = contact.reference;
            return (
              (reference.kind === 'interactEncounter' || reference.kind === 'interactGorgon') &&
              (phaseRank.get(reference.phaseKey) ?? ownRank) < ownRank
            );
          })
          .map((contact) => frozen({ kind: 'afterAction' as const, action: contact.reference }));
        return frozen({ ...entry, dependencies: frozen([...entry.dependencies, ...barriers]) });
      }),
    );
  }
  return frozen(all);
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

function assessOrder(
  order: readonly RoomActionReference[],
  active: ReadonlyMap<string, RoomActionContribution>,
  checkpoints: ReadonlyMap<string, RoomActionCheckpointContribution>,
): readonly RoomActionRosterIssue[] {
  const issues: RoomActionRosterIssue[] = [];
  const indexes = new Map(order.map((reference, index) => [roomActionKey(reference), index]));
  for (const reference of order) {
    const entry = active.get(roomActionKey(reference));
    if (entry === undefined) {
      issues.push(frozen({ kind: 'stale', reference }));
      continue;
    }
    for (const dependency of entry.dependencies) {
      const ownIndex = indexes.get(roomActionKey(reference));
      if (dependency.kind === 'afterAction') {
        const dependencyIndex = indexes.get(roomActionKey(dependency.action));
        if (dependencyIndex !== undefined && ownIndex !== undefined && ownIndex > dependencyIndex)
          continue;
        issues.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `must follow ${roomActionKey(dependency.action)}`,
          }),
        );
        continue;
      }
      const checkpoint = checkpoints.get(dependency.checkpointKey);
      if (checkpoint === undefined || ownIndex === undefined) {
        issues.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `has unknown checkpoint ${dependency.checkpointKey}`,
          }),
        );
        continue;
      }
      const ownRank = roomActionWindowRank(entry.window);
      const checkpointRank = roomActionWindowRank(checkpoint.window);
      const valid =
        dependency.kind === 'afterCheckpoint'
          ? ownRank >= checkpointRank
          : ownRank <= checkpointRank;
      if (!valid) {
        issues.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `${dependency.kind} ${dependency.checkpointKey}`,
          }),
        );
      }
    }
  }
  for (const entry of active.values()) {
    if (entry.participation === 'required' && !indexes.has(roomActionKey(entry.reference))) {
      issues.push(frozen({ kind: 'unrankedRequired', reference: entry.reference }));
    }
  }
  const ranked = order.flatMap((reference) => {
    const entry = active.get(roomActionKey(reference));
    return entry === undefined ? [] : [entry];
  });
  for (let index = 1; index < ranked.length; index += 1) {
    const left = ranked[index - 1]!;
    const right = ranked[index]!;
    if (roomActionWindowRank(left.window) > roomActionWindowRank(right.window)) {
      issues.push(
        frozen({
          kind: 'window',
          reference: right.reference,
          detail: 'crosses a fixed lifecycle window',
        }),
      );
    }
  }
  return frozen(issues);
}

export function assembleRoomActionRoster(options: {
  readonly owner: OccurrenceAddress;
  readonly order: readonly RoomActionReference[];
  readonly contributions: readonly RoomActionRosterContribution[];
}): RoomActionRoster {
  const actions = options.contributions.filter(
    (entry): entry is RoomActionContribution => entry.kind === 'action',
  );
  const active = new Map(actions.map((entry) => [roomActionKey(entry.reference), entry]));
  const checkpointContributions = new Map(
    options.contributions
      .filter((entry): entry is RoomActionCheckpointContribution => entry.kind === 'checkpoint')
      .map((entry) => [entry.checkpointKey, entry]),
  );
  const issues = assessOrder(options.order, active, checkpointContributions);
  const issueKeys = new Set(
    issues
      .filter((issue) => issue.kind !== 'unrankedRequired')
      .map((issue) => roomActionKey(issue.reference)),
  );
  const rows: RoomActionRow[] = options.order.map((reference, index) => {
    const entry = active.get(roomActionKey(reference));
    return frozen({
      reference,
      key: roomActionKey(reference),
      owner:
        entry?.owner ??
        createRoomActionAddress(
          createBiomeAddress(options.owner.routeKey, options.owner.biomeKey),
          options.owner.occurrenceId,
          roomActionKey(reference),
        ),
      participation: entry?.participation ?? 'optional',
      window: entry?.window ?? frozen({ kind: 'standard', phase: 'afterCombat' }),
      dependencies: entry?.dependencies ?? frozen([]),
      rank: index + 1,
      stale: entry === undefined,
      executable: entry !== undefined && !issueKeys.has(roomActionKey(reference)),
    });
  });
  for (const action of actions) {
    if (
      options.order.some(
        (reference) => roomActionKey(reference) === roomActionKey(action.reference),
      )
    )
      continue;
    rows.push(
      frozen({
        reference: action.reference,
        key: roomActionKey(action.reference),
        owner: action.owner,
        participation: action.participation,
        window: action.window,
        dependencies: action.dependencies,
        rank: null,
        stale: false,
        executable: false,
      }),
    );
  }
  const proposals: RoomActionProposal[] = [];
  const authoredKeys = new Set(options.order.map(roomActionKey));
  for (const row of rows) {
    if (row.stale) {
      const fromIndex = options.order.findIndex(
        (reference) => roomActionKey(reference) === row.key,
      );
      proposals.push(
        frozen({
          kind: 'remove',
          reference: row.reference,
          fromIndex,
          order: frozen(options.order.filter((_, index) => index !== fromIndex)),
          structurallyAuthorable: true,
        }),
      );
      continue;
    }
    if (row.rank !== null && row.participation === 'optional') {
      const fromIndex = row.rank - 1;
      proposals.push(
        frozen({
          kind: 'remove',
          reference: row.reference,
          fromIndex,
          order: frozen(options.order.filter((_, index) => index !== fromIndex)),
          structurallyAuthorable: true,
        }),
      );
    }
    if (!authoredKeys.has(row.key)) {
      for (let toIndex = 0; toIndex <= options.order.length; toIndex += 1) {
        const order = [...options.order];
        order.splice(toIndex, 0, row.reference);
        proposals.push(
          frozen({
            kind: 'insert',
            reference: row.reference,
            toIndex,
            order: frozen(order),
            structurallyAuthorable: !assessOrder(order, active, checkpointContributions).some(
              (issue) => issue.kind === 'dependency' || issue.kind === 'window',
            ),
          }),
        );
      }
    }
  }
  for (let fromIndex = 0; fromIndex < options.order.length; fromIndex += 1) {
    const reference = options.order[fromIndex]!;
    if (!active.has(roomActionKey(reference))) continue;
    for (let toIndex = 0; toIndex < options.order.length; toIndex += 1) {
      if (fromIndex === toIndex) continue;
      const order = [...options.order];
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, reference);
      proposals.push(
        frozen({
          kind: 'move',
          reference,
          fromIndex,
          toIndex,
          order: frozen(order),
          structurallyAuthorable: !assessOrder(order, active, checkpointContributions).some(
            (issue) => issue.kind === 'dependency' || issue.kind === 'window',
          ),
        }),
      );
    }
  }
  const lastRequiredRank = rows.reduce(
    (rank, row) =>
      row.rank !== null && row.participation === 'required' && row.window.kind !== 'postOutgoing'
        ? Math.max(rank, row.rank)
        : rank,
    0,
  );
  const checkpoints: RoomActionCheckpoint[] = options.contributions
    .filter((entry) => entry.kind === 'checkpoint')
    .map((entry) =>
      frozen({
        checkpointKey: entry.checkpointKey,
        label: entry.label,
        window: entry.window,
        afterRank:
          entry.checkpointKey === 'outgoingGeneration'
            ? lastRequiredRank
            : entry.checkpointKey === 'exitUsable'
              ? rows.reduce(
                  (rank, row) =>
                    row.rank !== null && row.participation === 'required'
                      ? Math.max(rank, row.rank)
                      : rank,
                  0,
                )
              : rows.reduce(
                  (rank, row) =>
                    row.rank !== null &&
                    roomActionWindowRank(row.window) <= roomActionWindowRank(entry.window)
                      ? Math.max(rank, row.rank)
                      : rank,
                  0,
                ),
      }),
    );
  return frozen({
    rows: frozen(rows),
    checkpoints: frozen(checkpoints),
    issues,
    proposals: frozen(proposals),
    valid: issues.length === 0,
  });
}
