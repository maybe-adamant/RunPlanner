import { surfaceScheduledLifecycleWithQSupplyChainSlicesProject } from '@run-planner/test-fixtures/scheduled-lifecycle';
import { loadSurfaceNOHermesShrineDeliveryCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createStartingRewardAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createBiomeAddress,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
  parseClockedTraitGeneratedPickupEntryKey,
  applyProjectHistoryCommand,
  createProjectHistory,
  roomActionKey,
  semanticAddressKey,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import {
  oBiome,
  oOccurrenceIds,
  createStaleSurfaceHermesDeliveryPlacement,
} from '@run-planner/test-fixtures/surface';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

it('routes a loaded stale delivery finding to its bound unplacement repair and restores it with Undo', () => {
  const { project, host, source, entryKey } = createStaleSurfaceHermesDeliveryPlacement();
  const projected = projectStructuredWorkspaceFixture(project);
  const finding = projected.evaluation.findings.find(
    (finding) =>
      finding.code === 'rewardSourceUnavailable' &&
      (finding.evidence as { reason?: string } | undefined)?.reason === 'staleHermesShrineDelivery',
  );
  expect(finding).toBeDefined();
  const node = projected.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === host.occurrenceId,
    );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error('delivery host missing');
  const row = node.room.roomActions?.rows.find(
    (row) =>
      row.reference.kind === 'interactAcquisitionEntry' && row.reference.entryKey === entryKey,
  );
  if (row === undefined) throw new Error('retained delivery missing');
  expect(row.placementAssessment).toMatchObject({ kind: 'invalid', source });
  expect(row.rewardPayload).toBeUndefined();
  expect(projected.workspace.focusByOwner.get(semanticAddressKey(finding!.origin))).toMatchObject({
    focusKey: row.marker.focusKey,
    roomTab: 'actions',
  });
  const interaction = projected.workspace.interactions.roomActions.get(semanticAddressKey(host));
  const proposal = interaction?.proposals.find(
    (proposal) => proposal.kind === 'unplace' && roomActionKey(proposal.reference) === row.key,
  );
  if (interaction === undefined || proposal === undefined)
    throw new Error('unplacement binding missing');
  const intent = interaction.intentFor(proposal.key);
  expect(intent.command).toEqual({ kind: 'UnplaceGeneratedDelivery', action: row.address });
  const history = applyProjectHistoryCommand(
    createProjectHistory(project),
    catalog,
    intent.command,
  );
  expect(
    history.present.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === host.occurrenceId)
      ?.roomActions.order.some((reference) => roomActionKey(reference) === row.key),
  ).toBe(false);
  expect(undoProjectHistory(history).present).toBe(project);
  const restored = projectStructuredWorkspaceFixture(undoProjectHistory(history).present);
  expect(
    restored.workspace.interactions.roomActions
      .get(semanticAddressKey(host))
      ?.proposals.some((proposal) => proposal.kind === 'unplace'),
  ).toBe(true);
});

it('publishes independent structural repair behind an earlier blocker without an evaluated timeline', () => {
  const { project, host, entryKey } = createStaleSurfaceHermesDeliveryPlacement();
  const blocked = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Surface'),
    value: null,
  });
  const projected = projectStructuredWorkspaceFixture(blocked);
  const node = projected.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === host.occurrenceId,
    );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error('retained delivery host missing');
  expect(node.room.entered).toBe(false);
  expect(node.room.roomActions).toBeUndefined();
  expect(node.room.placementRepairs).toEqual([
    expect.objectContaining({
      reference: expect.objectContaining({ entryKey }),
      assessment: expect.objectContaining({ kind: 'invalid', reason: 'sourceInactive' }),
    }),
  ]);
  expect(projected.workspace.authoringReadiness(host)).toBe('locked');
  expect(
    projected.workspace.interactions.roomActions
      .get(semanticAddressKey(host))
      ?.intentFor('structuralUnplace:0').command.kind,
  ).toBe('UnplaceGeneratedDelivery');
});

it('binds reached active-source obsolete placement to unplace with reason-specific copy', () => {
  let project = loadSurfaceNOHermesShrineDeliveryCheckpoint();
  const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat01);
  const dueHost = project.route.biomes
    .find((biome) => biome.biomeKey === 'O')
    ?.topology?.occurrences.find((room) => room.occurrenceId === oOccurrenceIds.devotion);
  const reference = dueHost?.roomActions.order.find(
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'hermesShrineDelivery',
  );
  if (reference?.kind !== 'interactAcquisitionEntry') throw new Error('delivery missing');
  project = applyProjectCommand(project, catalog, {
    kind: 'PlaceHermesShrineDelivery',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, reference.siteKey),
      reference.entryKey,
    ),
    encounterPhaseKey: 'Encounter',
  });
  const projected = projectStructuredWorkspaceFixture(project);
  const node = projected.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === host.occurrenceId,
    );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error('host missing');
  const row = node.room.roomActions?.rows.find(
    (row) => roomActionKey(row.reference) === roomActionKey(reference),
  );
  expect(row?.placementAssessment).toMatchObject({ kind: 'invalid', reason: 'dueContactMismatch' });
  expect(row?.issues).toEqual([
    'This pickup does not belong at this contact; remove its retained placement to repair it.',
  ]);
  expect(row?.rewardPayload).toBeUndefined();
  const interaction = projected.workspace.interactions.roomActions.get(semanticAddressKey(host));
  const proposal = interaction?.proposals.find((proposal) => proposal.kind === 'unplace');
  expect(proposal).toBeDefined();
  expect(interaction?.intentFor(proposal!.key).command.kind).toBe('UnplaceGeneratedDelivery');
});
it.each([true, false])(
  'keeps a valid delayed Hermes editor when payload refresh is %s',
  (refreshPayload) => {
    let project = loadSurfaceNOHermesShrineDeliveryCheckpoint();
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    const occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find((room) => room.occurrenceId === host.occurrenceId);
    const reference = occurrence?.roomActions.order.find(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'hermesShrineDelivery',
    );
    if (reference?.kind !== 'interactAcquisitionEntry') throw new Error('delivery missing');
    const parsed = parseHermesShrineDeliveryEntryKey(reference.entryKey)!;
    const source = createOccurrenceAddress(
      createBiomeAddress(parsed.routeKey, parsed.biomeKey),
      parsed.sourceOccurrenceId,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondLeft',
      value: { rewardType: 'ShopHermesUpgrade' },
    });
    if (refreshPayload)
      project = applyProjectCommand(project, catalog, {
        kind: 'PlaceHermesShrineDelivery',
        entry: createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(host, reference.siteKey),
          reference.entryKey,
        ),
        encounterPhaseKey: 'Encounter',
      });
    const projected = projectStructuredWorkspaceFixture(project);
    const node = projected.workspace.route.biomes
      .flatMap((biome) => biome.nodes)
      .find(
        (node) =>
          node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === host.occurrenceId,
      );
    if (node?.kind !== 'occurrenceWorkbench') throw new Error('host missing');
    const row = node.room.roomActions?.rows.find(
      (row) => roomActionKey(row.reference) === roomActionKey(reference),
    );
    expect(row?.placementAssessment?.kind).toBe('valid');
    expect(row?.rewardPayload).toBeDefined();
    expect(
      projected.workspace.interactions.roomActions
        .get(semanticAddressKey(host))
        ?.proposals.some((proposal) => proposal.kind === 'unplace'),
    ).toBe(false);
  },
);

it('binds a reached obsolete clocked placement to ordinary removal while preserving recurring siblings', () => {
  const original = surfaceScheduledLifecycleWithQSupplyChainSlicesProject();
  const biome = original.route.biomes.find((biome) => biome.biomeKey === 'Q')!;
  const due = biome.topology!.occurrences.find((room) =>
    room.roomActions.order.some(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        parseClockedTraitGeneratedPickupEntryKey(reference.entryKey) !== undefined,
    ),
  )!;
  const reference = due.roomActions.order.find(
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' &&
      parseClockedTraitGeneratedPickupEntryKey(reference.entryKey) !== undefined,
  )!;
  if (reference.kind !== 'interactAcquisitionEntry') throw new Error('clocked pickup missing');
  const oldHost = biome.topology!.occurrences.find(
    (room) => room.gameName.startsWith('Q_Combat') && room.occurrenceId !== due.occurrenceId,
  )!;
  const host = createOccurrenceAddress(createBiomeAddress('Surface', 'Q'), oldHost.occurrenceId);
  const project = applyProjectCommand(original, catalog, {
    kind: 'PlaceClockedTraitPickup',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'roomExit'),
      reference.entryKey,
    ),
    encounterPhaseKey: 'Encounter',
    rewardType: 'StoreRewardRandomStack',
    producerLifecycleKey: 'GeneratedTraitPickup',
  });
  const projected = projectStructuredWorkspaceFixture(project);
  const node = projected.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === host.occurrenceId,
    );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error('clocked host missing');
  const row = node.room.roomActions?.rows.find(
    (row) => roomActionKey(row.reference) === roomActionKey(reference),
  );
  expect(row?.placementAssessment).toMatchObject({
    kind: 'invalid',
    source: { kind: 'clockedTraitPickup' },
  });
  const interaction = projected.workspace.interactions.roomActions.get(semanticAddressKey(host));
  const proposal = interaction?.proposals.find(
    (proposal) =>
      proposal.kind === 'remove' && roomActionKey(proposal.reference) === roomActionKey(reference),
  );
  expect(proposal).toBeDefined();
  expect(interaction?.intentFor(proposal!.key).command.kind).toBe('RemoveRoomAction');
  const history = applyProjectHistoryCommand(
    createProjectHistory(project),
    catalog,
    interaction!.intentFor(proposal!.key).command,
  );
  expect(
    history.present.route.biomes
      .find((biome) => biome.biomeKey === 'Q')
      ?.topology?.occurrences.find((room) => room.occurrenceId === due.occurrenceId)?.roomActions
      .order,
  ).toEqual(due.roomActions.order);
  expect(undoProjectHistory(history).present).toBe(project);
});

it('distinguishes two uncovered retained deliveries and binds the selected repair exactly', () => {
  const { project, host, source, entryKey } = createStaleSurfaceHermesDeliveryPlacement();
  const originalHost = project.route.biomes
    .find((biome) => biome.biomeKey === host.biomeKey)!
    .topology!.occurrences.find((room) => room.occurrenceId === host.occurrenceId)!;
  let second = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHermesShrineOffer',
    occurrence: source,
    slotKey: 'secondLeft',
    value: { rewardType: 'MaxHealthDrop' },
  });
  second = applyProjectCommand(second, catalog, {
    kind: 'SetHermesShrinePurchase',
    occurrence: source,
    generationKey: 'initial:secondLeft',
    purchase: { delay: 2, rushed: false },
  });
  const secondEntryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
  second = applyProjectCommand(second, catalog, {
    kind: 'PlaceHermesShrineDelivery',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      secondEntryKey,
    ),
    encounterPhaseKey: 'Encounter',
  });
  // Retain both production-built placements to represent a loaded snapshot.
  const loaded = {
    ...second,
    route: {
      ...second.route,
      biomes: second.route.biomes.map((biome) =>
        biome.biomeKey !== host.biomeKey || biome.topology === null
          ? biome
          : {
              ...biome,
              topology: {
                ...biome.topology,
                occurrences: biome.topology.occurrences.map((room) =>
                  room.occurrenceId !== host.occurrenceId
                    ? room
                    : {
                        ...room,
                        roomActions: {
                          order: [
                            ...originalHost.roomActions.order,
                            ...room.roomActions.order.filter(
                              (reference) =>
                                !originalHost.roomActions.order.some(
                                  (original) =>
                                    roomActionKey(original) === roomActionKey(reference),
                                ),
                            ),
                          ],
                        },
                        acquisitionSites: {
                          ...room.acquisitionSites,
                          hermesShrineDelivery: {
                            pickupEntries: {
                              ...originalHost.acquisitionSites?.hermesShrineDelivery?.pickupEntries,
                              ...room.acquisitionSites?.hermesShrineDelivery?.pickupEntries,
                            },
                          },
                        },
                      },
                ),
              },
            },
      ),
    },
  };
  const blocked = applyProjectCommand(loaded, catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Surface'),
    value: null,
  });
  const projected = projectStructuredWorkspaceFixture(blocked);
  const node = projected.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === host.occurrenceId,
    );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error('retained host missing');
  expect(node.room.placementRepairs).toHaveLength(2);
  expect(new Set(node.room.placementRepairs!.map((repair) => repair.label)).size).toBe(2);
  const selectedIndex = node.room.placementRepairs!.findIndex(
    (repair) =>
      repair.reference.kind === 'interactAcquisitionEntry' &&
      repair.reference.entryKey === secondEntryKey,
  );
  const interaction = projected.workspace.interactions.roomActions.get(semanticAddressKey(host))!;
  const repaired = applyProjectCommand(
    blocked,
    catalog,
    interaction.intentFor(`structuralUnplace:${selectedIndex}`).command,
  );
  const retained = repaired.route.biomes
    .find((biome) => biome.biomeKey === host.biomeKey)!
    .topology!.occurrences.find((room) => room.occurrenceId === host.occurrenceId)!;
  expect(retained.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]).toBeDefined();
  expect(
    retained.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[secondEntryKey],
  ).toBeUndefined();
});
