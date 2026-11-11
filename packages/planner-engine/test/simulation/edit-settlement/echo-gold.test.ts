import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createEchoGoldHPrebossProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  createStartingRewardAddress,
  createRoomActionAddress,
  roomActionKey,
  seaStarDuplicateSourceIsActive,
  type ProjectDocument,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';

const owner = createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-preboss-shop'));
const site = createAcquisitionSiteAddress(owner, 'roomExit');
const entry = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
const offer = createShopOfferAddress(goldenHBiome, owner.occurrenceId, 'Boon');
const purchase = { kind: 'ReplaceShopPurchaseParticipation', offer, purchased: true } as const;
const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly;
const shop = (project: ProjectDocument) =>
  project.route.biomes
    .find((biome) => biome.biomeKey === 'H')!
    .topology!.occurrences.find((room) => room.occurrenceId === owner.occurrenceId)!;
const gold = (project: ProjectDocument) =>
  shop(project).roomActions.order.find(
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' && reference.entryKey === entry.entryKey,
  );
let project: ProjectDocument;
beforeAll(() => {
  project = createEchoGoldHPrebossProject();
});

describe('required Echo Gold activation', () => {
  it('places no required duplicate while the paid source child is unresolved', () => {
    const beforeOrder = shop(project).roomActions.order;
    const settled = settle(project, purchase);
    expect(gold(settled.project)).toBeUndefined();
    expect(
      shop(settled.project).roomActions.order.filter((reference) =>
        beforeOrder.some((old) => roomActionKey(old) === roomActionKey(reference)),
      ),
    ).toEqual(beforeOrder);
    expect(
      settled.evaluation.findings.some((finding) => finding.code === 'traitOfferMissing'),
    ).toBe(true);
    const before = evaluate(settled.project);
    expect(settleProjectEdit({ catalog, before, evaluate, command: purchase }).assembly).toBe(
      before,
    );
  });
  it('keeps an existing imported required omission through a source edit and allows Restore', () => {
    const imported = applyProjectCommand(project, catalog, purchase);
    expect(gold(imported)).toBeUndefined();
    const changed = settle(imported, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    expect(gold(changed.project)).toBeUndefined();
    const restored = settle(changed.project, {
      kind: 'PlaceEchoGoldPickup',
      site,
      entryKey: 'echoDoubleShopReward',
      sourceOfferKey: 'Boon',
    });
    expect(gold(restored.project)).toBeDefined();
  });
  it('does not normalize an old omission merely because an earlier blocker is repaired', () => {
    const imported = applyProjectCommand(project, catalog, purchase);
    const initial = imported.route.loadout.startingReward;
    const blocked = applyProjectCommand(imported, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: null,
    });
    const settled = settle(blocked, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: initial,
    });
    expect(gold(settled.project)).toBeUndefined();
  });
  it('keeps a duplicated consumable optional', () => {
    const optional = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'BlindBoxLoot' },
    });
    expect(gold(settle(optional, purchase).project)).toBeUndefined();
  });
  it('never lets Sea Star duplicate the Echo Gold copy', () => {
    const minor = createShopOfferAddress(goldenHBiome, owner.occurrenceId, 'Minor');
    let duplicated = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: minor,
      purchased: true,
    });
    duplicated = applyProjectCommand(duplicated, catalog, {
      kind: 'PlaceEchoGoldPickup',
      site,
      entryKey: 'echoDoubleShopReward',
      sourceOfferKey: 'Minor',
    });
    duplicated = applyProjectCommand(duplicated, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition: createAcquisitionRoleAddress(entry, 'self'),
      procced: true,
    });
    const siteKey = Object.keys(shop(duplicated).acquisitionSites ?? {}).find((key) =>
      key.startsWith('seaStarDuplicate:'),
    )!;

    // The copy is spawned with CanDuplicate cleared, so the result stays dormant.
    expect(seaStarDuplicateSourceIsActive(catalog, goldenHBiome, shop(duplicated), siteKey)).toBe(
      false,
    );
    expect(() => evaluate(duplicated)).not.toThrow();
  });
  it('leaves a newly required duplicate live when an optional source becomes loot', () => {
    let optional = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'BlindBoxLoot' },
    });
    optional = applyProjectCommand(optional, catalog, purchase);
    const settled = settle(optional, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    expect(gold(settled.project)).toBeUndefined();
    // Once the Boon's offer is authored, the unplaced duplicate stands with its finding.
    expect(evaluate(authorLegalTraitOffers(settled.project)).evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'echoGoldPickupPlacementRequired' }),
    );
  });
  it('retains populated incompatible children and placement when a different slot becomes the trigger', () => {
    const second = createShopOfferAddress(goldenHBiome, owner.occurrenceId, 'Minor');
    let initial = applyProjectCommand(settle(project, purchase).project, catalog, {
      kind: 'PlaceEchoGoldPickup',
      site,
      entryKey: 'echoDoubleShopReward',
      sourceOfferKey: 'Boon',
    });
    initial = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceShopOffer',
      offer: second,
      value: { rewardType: 'StackUpgrade' },
    });
    initial = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: second,
      purchased: true,
    });
    initial = applyProjectCommand(initial, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(
        goldenHBiome,
        owner.occurrenceId,
        roomActionKey(gold(initial)!),
      ),
      toIndex: shop(initial).roomActions.order.length - 1,
    });
    initial = authorLegalTraitOffers(initial);
    const previous = shop(initial);
    const payload = previous.acquisitionSites?.roomExit?.pickupEntries?.echoDoubleShopReward;
    expect(payload).toBeDefined();
    expect(payload?.traitOffersByAcquisitionRole.source).toEqual(
      expect.objectContaining({ selectedOptionKey: expect.any(String) }),
    );
    const command = { kind: 'ReplaceShopPurchaseParticipation', offer, purchased: false } as const;
    const settled = settle(initial, command);
    expect(shop(settled.project).roomActions.order).toEqual(
      previous.roomActions.order.filter(
        (reference) => !(reference.kind === 'interactShopOffer' && reference.offerKey === 'Boon'),
      ),
    );
    expect(
      shop(settled.project).acquisitionSites?.roomExit?.pickupEntries?.echoDoubleShopReward,
    ).toEqual(payload);
    expect(settled.evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'shopPurchaseUnavailable',
        origin: entry,
        evidence: { kind: 'echoShopDuplicatePayload', sourceOfferKey: 'Minor' },
      }),
    );
    const reference = gold(initial)!;
    const omitted = applyProjectCommand(initial, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenHBiome, owner.occurrenceId, roomActionKey(reference)),
    });
    expect(gold(settle(omitted, command).project)).toBeUndefined();
  });
  it('takes a placed duplicate with its purchase', () => {
    const placed = authorLegalTraitOffers(
      settle(settle(project, purchase).project, {
        kind: 'PlaceEchoGoldPickup',
        site,
        entryKey: 'echoDoubleShopReward',
        sourceOfferKey: 'Boon',
      }).project,
    );
    expect(gold(placed)).toBeDefined();

    const unbought = settle(placed, { ...purchase, purchased: false });

    expect(gold(unbought.project)).toBeUndefined();
    expect(unbought.evaluation.findings.map((finding) => finding.code)).not.toContain(
      'echoGoldPickupPlacementRequired',
    );
  });
  it('removes a placed required duplicate, which lies live again with its finding', () => {
    const placed = evaluate(
      authorLegalTraitOffers(
        settle(settle(project, purchase).project, {
          kind: 'PlaceEchoGoldPickup',
          site,
          entryKey: 'echoDoubleShopReward',
          sourceOfferKey: 'Boon',
        }).project,
      ),
    );
    const reference = gold(placed.project);
    if (reference === undefined) throw new Error('required Gold missing');
    const removed = settleProjectEdit({
      catalog,
      before: placed,
      evaluate,
      command: {
        kind: 'RemoveRoomAction',
        action: createRoomActionAddress(goldenHBiome, owner.occurrenceId, roomActionKey(reference)),
      },
    }).assembly;
    expect(gold(removed.project)).toBeUndefined();
    expect(removed.evaluation.findings.map((finding) => finding.code)).toContain(
      'echoGoldPickupPlacementRequired',
    );
  });
});
