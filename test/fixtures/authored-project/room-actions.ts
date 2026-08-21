import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  applyProjectCommand,
  createBiomeAddress,
  createAcquisitionEntryAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  roomActionDomainForOccurrence,
  roomActionKey,
  scheduleRequiredRoomActions,
  structurallyActiveOccurrenceIds,
  type AcquisitionRoleAddress,
  type AuthoredRewardState,
  type ProjectDocument,
  type RoomOccurrence,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
} from '@run-planner/engine/authored-project';

/** Test-only aggregate adapter over the closed Room Action membership commands. */
export function replaceTestRoomActionOrder(
  initial: ProjectDocument,
  catalog: Catalog,
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: RoomOccurrence['occurrenceId'],
  references: readonly RoomActionReference[],
): ProjectDocument {
  let document = initial;
  const occurrence = initial.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error('test room-action occurrence is missing');
  const requestedKeys = references.map(roomActionKey);
  if (new Set(requestedKeys).size !== requestedKeys.length) {
    throw new Error('test room-action order contains duplicate references');
  }
  const topology = initial.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)?.topology;
  const domain = roomActionDomainForOccurrence(initial, catalog, biome, occurrenceId)?.domain;
  if (topology === null || topology === undefined || domain === undefined) {
    throw new Error('test room-action domain is missing');
  }
  if (structurallyActiveOccurrenceIds(topology).has(occurrenceId)) {
    const requiredKeys = new Set(
      domain.contributions.flatMap((entry) =>
        entry.kind === 'action' && entry.participation === 'required'
          ? [roomActionKey(entry.reference)]
          : [],
      ),
    );
    const omitted = [...requiredKeys].filter((key) => !requestedKeys.includes(key));
    if (omitted.length > 0) {
      throw new Error(
        `test room-action order omits active required references ${omitted.join(', ')}`,
      );
    }
  }
  if (
    occurrence.roomActions.order.length === references.length &&
    occurrence.roomActions.order.every(
      (reference, index) => roomActionKey(reference) === roomActionKey(references[index]!),
    )
  ) {
    return initial;
  }
  const requestedSet = new Set(requestedKeys);
  for (const reference of [...occurrence.roomActions.order].reverse()) {
    if (requestedSet.has(roomActionKey(reference))) continue;
    document = applyProjectCommand(
      document,
      catalog,
      reference.kind === 'interactShopOffer'
        ? {
            kind: 'ReplaceShopPurchaseParticipation',
            offer: createShopOfferAddress(biome, occurrenceId, reference.offerKey),
            purchased: false,
          }
        : {
            kind: 'RemoveRoomAction',
            action: createRoomActionAddress(biome, occurrenceId, roomActionKey(reference)),
          },
    );
  }
  const currentOccurrence = () =>
    document.routes
      .find((route) => route.routeKey === biome.routeKey)
      ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  for (const reference of references) {
    const current = currentOccurrence();
    if (
      current?.roomActions.order.some(
        (candidate) => roomActionKey(candidate) === roomActionKey(reference),
      )
    ) {
      continue;
    }
    const required = domain.contributions.some(
      (entry) =>
        entry.kind === 'action' &&
        entry.participation === 'required' &&
        roomActionKey(entry.reference) === roomActionKey(reference),
    );
    const index = required
      ? scheduleRequiredRoomActions({
          catalog,
          domain,
          order: current?.roomActions.order ?? [],
          requiredKeys: new Set([roomActionKey(reference)]),
        }).findIndex((candidate) => roomActionKey(candidate) === roomActionKey(reference))
      : (current?.roomActions.order.length ?? 0);
    document = applyProjectCommand(
      document,
      catalog,
      reference.kind === 'interactShopOffer'
        ? {
            kind: 'ReplaceShopPurchaseParticipation',
            offer: createShopOfferAddress(biome, occurrenceId, reference.offerKey),
            purchased: true,
          }
        : {
            kind: 'InsertRoomAction',
            action: createRoomActionAddress(biome, occurrenceId, roomActionKey(reference)),
            reference,
            index,
          },
    );
  }
  for (const [toIndex, reference] of references.entries()) {
    const current = currentOccurrence();
    const fromIndex = current?.roomActions.order.findIndex(
      (candidate) => roomActionKey(candidate) === roomActionKey(reference),
    );
    if (fromIndex === undefined || fromIndex < 0) {
      throw new Error(`test room-action ${roomActionKey(reference)} was not inserted`);
    }
    if (fromIndex === toIndex) continue;
    document = applyProjectCommand(document, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(biome, occurrenceId, roomActionKey(reference)),
      toIndex,
    });
  }
  return document;
}

/** Apply an explicit test-owned transformation to one occurrence's semantic Room Action references. */
export function editTestRoomActionOrder(
  initial: ProjectDocument,
  catalog: Catalog,
  owner: ReturnType<typeof createOccurrenceAddress>,
  edit: (order: readonly RoomActionReference[]) => readonly RoomActionReference[],
): ProjectDocument {
  const biome = createBiomeAddress(owner.routeKey, owner.biomeKey);
  const occurrence = initial.routes
    .find((route) => route.routeKey === owner.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === owner.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === owner.occurrenceId);
  if (occurrence === undefined) throw new Error('test room-action occurrence is missing');
  return replaceTestRoomActionOrder(
    initial,
    catalog,
    biome,
    owner.occurrenceId,
    edit(occurrence.roomActions.order),
  );
}

/** Select the exact Shop-offer interaction actions that participate in a test. */
export function replaceTestShopOfferActions(
  initial: ProjectDocument,
  catalog: Catalog,
  owner: ReturnType<typeof createOccurrenceAddress>,
  offerKeys: readonly string[],
): ProjectDocument {
  return editTestRoomActionOrder(initial, catalog, owner, (order) => [
    ...order.filter((reference) => reference.kind !== 'interactShopOffer'),
    ...offerKeys.map((offerKey) => ({ kind: 'interactShopOffer' as const, offerKey })),
  ]);
}

/** Test-only authoring adapter for the intent/source-produced/pickup split. */
export function authorTestArtificerReplacement(
  initial: ProjectDocument,
  catalog: Catalog,
  acquisition: AcquisitionRoleAddress,
  replacement: AuthoredRewardState,
): ProjectDocument {
  const source = acquisition.owner;
  const occurrenceId = (() => {
    switch (source.kind) {
      case 'acquisitionEntry':
        return source.site.owner.kind === 'occurrence' ? source.site.owner.occurrenceId : undefined;
      case 'encounterPhase':
        return source.owner.occurrenceId;
      case 'gorgonPhase':
        return source.encounter.owner.occurrenceId;
      case 'incomingReward':
      case 'localReward':
      case 'rewardWheelOffer':
      case 'shopOffer':
        return source.occurrenceId;
    }
  })();
  if (occurrenceId === undefined) throw new Error('test Artificer source is not occurrence-owned');
  const occurrence = createOccurrenceAddress(
    createBiomeAddress(acquisition.routeKey, acquisition.biomeKey),
    occurrenceId,
  );
  let document = applyProjectCommand(initial, catalog, {
    kind: 'ReplaceAcquisitionDisposition',
    acquisition,
    value: { kind: 'artificer' },
  });
  const site = artificerAcquisitionSite(occurrence, source);
  const entry = createAcquisitionEntryAddress(
    site,
    artificerReplacementEntryKey(source, acquisition.acquisitionRole),
  );
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry,
    value: replacement.offer,
  });
  for (const [role, offer] of Object.entries(replacement.traitOffersByAcquisitionRole)) {
    if (offer === null) continue;
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(entry, role),
      value: offer,
    });
  }
  for (const [role, resolution] of Object.entries(
    replacement.levelResolutionsByAcquisitionRole ?? {},
  )) {
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(entry, role),
      value: resolution,
    });
  }
  return document;
}
