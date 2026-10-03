import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createEchoGoldHPrebossProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  createStartingRewardAddress,
  createRoomActionAddress,
  roomActionKey,
  type ProjectDocument,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import {
  assessRoomActionPlacements,
  blockedOccurrenceRoomForProjectEvaluationAssembly,
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

const owner = createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-preboss-shop'));
const site = createAcquisitionSiteAddress(owner, 'roomExit');
const entry = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
const offer = createShopOfferAddress(goldenHBiome, owner.occurrenceId, 'Boon');
const purchase = { kind: 'ReplaceShopPurchaseParticipation', offer, purchased: true } as const;
const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });
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
  it('inserts required membership before the unfinished paid source child is resolved', () => {
    const beforeOrder = shop(project).roomActions.order;
    const settled = settle(project, purchase);
    expect(gold(settled.project)).toBeDefined();
    expect(
      shop(settled.project).roomActions.order.filter((reference) =>
        beforeOrder.some((old) => roomActionKey(old) === roomActionKey(reference)),
      ),
    ).toEqual(beforeOrder);
    expect(
      settled.evaluation.findings.some((finding) => finding.code === 'traitOfferMissing'),
    ).toBe(true);
    const before = evaluate(settled.project);
    expect(settleProjectEdit({ catalog, before, evaluate, command: purchase })).toBe(before);
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
  it('inserts a newly required duplicate when an optional source becomes loot', () => {
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
    expect(gold(settled.project)).toBeDefined();
  });
  it('retains populated incompatible children and placement when a different slot becomes the trigger', () => {
    const second = createShopOfferAddress(goldenHBiome, owner.occurrenceId, 'Minor');
    let initial = settle(project, purchase).project;
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
  it('refuses removing active required membership', () => {
    const settled = settle(project, purchase);
    const room = blockedOccurrenceRoomForProjectEvaluationAssembly(settled, owner);
    if (room === undefined) throw new Error('expected blocked source room');
    const roster = assessRoomActionPlacements(
      settled.project.route,
      owner,
      room.roomActionRoster,
      [],
      derivedAcquisitionEntriesForProjectEvaluationAssembly(settled, site),
    );
    expect(
      roster.proposals.some(
        (proposal) =>
          proposal.kind === 'remove' &&
          proposal.reference.kind === 'interactAcquisitionEntry' &&
          proposal.reference.entryKey === entry.entryKey,
      ),
    ).toBe(false);
    const reference = gold(settled.project);
    if (reference === undefined) throw new Error('required Gold missing');
    expect(
      settleProjectEdit({
        catalog,
        before: settled,
        evaluate,
        command: {
          kind: 'RemoveRoomAction',
          action: createRoomActionAddress(
            goldenHBiome,
            owner.occurrenceId,
            roomActionKey(reference),
          ),
        },
      }),
    ).toBe(settled);
  });
});
