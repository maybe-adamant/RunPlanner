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
  decodeProjectDocument,
  roomActionKey,
  type AcquisitionRoleAddress,
  type AuthoredRewardState,
  type ProjectDocument,
  type RoomOccurrence,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  evaluateBiomeCompleteness,
  assembleRoomActionRoster,
  materializeBiome,
  materializeBiomePrefix,
  type RoomActionRoster,
  type RoomActionRosterContribution,
} from '@run-planner/engine/simulation';
import {
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
} from '@run-planner/engine/authored-project';

function materializedActionRosters(
  project: ProjectDocument,
  catalog: Catalog,
): ReadonlyMap<string, RoomActionRoster> {
  const result = new Map<string, RoomActionRoster>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    const candidate = value as {
      readonly kind?: string;
      readonly occurrenceId?: string;
      readonly roomActionRoster?: RoomActionRoster;
    };
    if (
      candidate.kind === 'authored' &&
      candidate.occurrenceId !== undefined &&
      candidate.roomActionRoster !== undefined
    ) {
      result.set(candidate.occurrenceId, candidate.roomActionRoster);
    }
    for (const child of Object.values(value)) visit(child);
  };
  for (const route of project.routes) {
    for (const biomePlan of route.biomes) {
      const biome = createBiomeAddress(route.routeKey, biomePlan.biomeKey);
      const completeness = evaluateBiomeCompleteness(catalog, biome, biomePlan);
      const materialized =
        completeness.completion === 'complete'
          ? materializeBiome(catalog, biome, completeness, route.loadout)
          : materializeBiomePrefix(catalog, biome, biomePlan, route.loadout);
      visit(materialized);
    }
  }
  return result;
}

/** Populate declaration-required chronology in complete product fixtures only. */
export function authorRequiredTestRoomActions(
  initial: ProjectDocument,
  catalog: Catalog,
): ProjectDocument {
  const rosters = materializedActionRosters(initial, catalog);
  const orderByOccurrence = new Map<string, readonly RoomActionReference[]>();
  for (const route of initial.routes) {
    for (const biomePlan of route.biomes) {
      const biome = createBiomeAddress(route.routeKey, biomePlan.biomeKey);
      for (const occurrence of biomePlan.topology?.occurrences ?? []) {
        const initialRoster = rosters.get(occurrence.occurrenceId);
        if (initialRoster === undefined) continue;
        const contributions: readonly RoomActionRosterContribution[] = Object.freeze([
          ...initialRoster.rows.flatMap((row) =>
            row.stale
              ? []
              : [
                  {
                    kind: 'action' as const,
                    reference: row.reference,
                    owner: row.owner,
                    participation: row.participation,
                    window: row.window,
                    dependencies: row.dependencies,
                  },
                ],
          ),
          ...initialRoster.checkpoints.map((checkpoint) => ({
            kind: 'checkpoint' as const,
            checkpointKey: checkpoint.checkpointKey,
            label: checkpoint.label,
            window: checkpoint.window,
          })),
        ]);
        const staleKeys = new Set(
          initialRoster.rows.filter((row) => row.stale).map((row) => row.key),
        );
        let order: readonly RoomActionReference[] = occurrence.roomActions.order.filter(
          (reference) => !staleKeys.has(roomActionKey(reference)),
        );
        for (let editCount = 0; editCount < contributions.length; editCount += 1) {
          const roster = assembleRoomActionRoster({
            owner: createOccurrenceAddress(biome, occurrence.occurrenceId),
            order,
            contributions,
          });
          const missing = roster.rows.find(
            (row) => row.participation === 'required' && row.rank === null,
          );
          if (missing === undefined) break;
          const proposal = roster.proposals.find(
            (candidate) =>
              candidate.kind === 'insert' &&
              candidate.structurallyAuthorable &&
              roomActionKey(candidate.reference) === missing.key,
          );
          if (proposal?.toIndex === undefined) {
            throw new Error(`required room action ${missing.key} has no legal insertion proposal`);
          }
          order = proposal.order;
        }
        if (
          order.length !== occurrence.roomActions.order.length ||
          order.some(
            (reference, index) =>
              roomActionKey(reference) !== roomActionKey(occurrence.roomActions.order[index]!),
          )
        ) {
          orderByOccurrence.set(
            JSON.stringify([route.routeKey, biomePlan.biomeKey, occurrence.occurrenceId]),
            order,
          );
        }
      }
    }
  }
  if (orderByOccurrence.size === 0) return initial;
  return decodeProjectDocument(
    Object.freeze({
      ...initial,
      routes: Object.freeze(
        initial.routes.map((route) =>
          Object.freeze({
            ...route,
            biomes: Object.freeze(
              route.biomes.map((biomePlan) =>
                biomePlan.topology === null
                  ? biomePlan
                  : Object.freeze({
                      ...biomePlan,
                      topology: Object.freeze({
                        ...biomePlan.topology,
                        occurrences: Object.freeze(
                          biomePlan.topology.occurrences.map((occurrence) => {
                            const order = orderByOccurrence.get(
                              JSON.stringify([
                                route.routeKey,
                                biomePlan.biomeKey,
                                occurrence.occurrenceId,
                              ]),
                            );
                            return order === undefined
                              ? occurrence
                              : Object.freeze({
                                  ...occurrence,
                                  roomActions: Object.freeze({ order }),
                                });
                          }),
                        ),
                      }),
                    }),
              ),
            ),
          }),
        ),
      ),
    }),
    catalog,
  );
}

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
  if (
    occurrence.roomActions.order.length === references.length &&
    occurrence.roomActions.order.every(
      (reference, index) => roomActionKey(reference) === roomActionKey(references[index]!),
    )
  ) {
    return initial;
  }
  for (const reference of [...occurrence.roomActions.order].reverse()) {
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
  for (const [index, reference] of references.entries()) {
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
