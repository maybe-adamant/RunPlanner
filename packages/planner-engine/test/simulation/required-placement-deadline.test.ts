import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createShopOfferAddress,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  liveActionsForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { surfaceCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/surface';
import { underworldCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createEchoGoldHPrebossProject } from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);

function room(routeKey: string, biomeKey: string, occurrenceId: string): OccurrenceAddress {
  return createOccurrenceAddress(
    createBiomeAddress(routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
  );
}

/** The plan with one row taken back, as Remove leaves a required row. */
function removed(project: ProjectDocument, at: OccurrenceAddress, reference: RoomActionReference) {
  return applyProjectCommand(project, catalog, {
    kind: 'RemoveRoomAction',
    action: createRoomActionAddress(
      createBiomeAddress(at.routeKey, at.biomeKey),
      at.occurrenceId,
      roomActionKey(reference),
    ),
  });
}

/** The finding the walk stopped on. */
function stop(project: ProjectDocument) {
  return evaluate(project).evaluation.issue?.reasons[0];
}

describe('a required row left unplaced', () => {
  it('falls due before a later-window row placed after it', () => {
    const shop = room('Underworld', 'F', 'golden-f-preboss-shop:postboss');
    const fountain = { kind: 'useFountain' } as const;
    const finding = stop(
      removed(
        underworldCheckpointArtifacts['underworld-world-shop-travel-deal'].load(),
        shop,
        fountain,
      ),
    );

    expect(finding).toMatchObject({
      code: 'roomActionPlacementRequired',
      origin: createRoomActionAddress(
        createBiomeAddress('Underworld', 'F'),
        shop.occurrenceId,
        roomActionKey(fountain),
      ),
      evidence: {
        deadline: 'action',
        deadlineAction: roomActionKey({
          kind: 'purchaseStygianWellOffer',
          generationKey: 'initial:secondLeft',
        }),
      },
    });
  });

  it('falls due before the fight a pickup taken before combat starts', () => {
    const start = room('Underworld', 'F', 'golden-f-start');
    const reward = {
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'source',
    } as const;
    const finding = stop(
      removed(underworldCheckpointArtifacts['underworld-fg'].load(), start, reward),
    );

    expect(finding).toMatchObject({
      code: 'roomActionPlacementRequired',
      evidence: { deadline: 'encounter', deadlinePhase: 'Encounter' },
    });
    expect(finding?.evidence).not.toHaveProperty('deadlineAction');
  });

  it("falls due at a Ship phase's end effects", () => {
    const ship = room('Surface', 'O', 'surface-o-combat02');
    const wheelReward = { kind: 'interactWheelReward', wheelKey: 'wheel1' } as const;
    const finding = stop(
      removed(surfaceCheckpointArtifacts['surface-encounter-showcase'].load(), ship, wheelReward),
    );

    expect(finding).toMatchObject({
      code: 'roomActionPlacementRequired',
      evidence: { deadline: 'phaseEnd', deadlinePhase: 'Combat1' },
    });
  });
});

describe("Gold Gold Gold's duplicate left unplaced", () => {
  const hBiome = createBiomeAddress('Underworld', 'H');
  const shop = room('Underworld', 'H', 'golden-h-preboss-shop');

  const duplicate = {
    kind: 'interactAcquisitionEntry',
    siteKey: 'roomExit',
    entryKey: 'echoDoubleShopReward',
  } as const;

  /** The Shop's Boon bought and its duplicate placed after it. */
  function duplicatePlaced(): ProjectDocument {
    const bought = applyProjectCommand(createEchoGoldHPrebossProject(), catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: createShopOfferAddress(hBiome, shop.occurrenceId, 'Boon'),
      purchased: true,
    });
    return authorLegalTraitOffers(
      applyProjectCommand(bought, catalog, {
        kind: 'PlaceEchoGoldPickup',
        site: createAcquisitionSiteAddress(shop, 'roomExit'),
        entryKey: 'echoDoubleShopReward',
        sourceOfferKey: 'Boon',
      }),
    );
  }
  const isDuplicate = (finding: { readonly code: string }) =>
    finding.code === 'echoGoldPickupPlacementRequired';

  it('stands at its deadline, past the purchase that spawns it', () => {
    const placed = duplicatePlaced();
    expect(evaluate(placed).evaluation.findings.filter(isDuplicate)).toEqual([]);

    const assembly = evaluate(removed(placed, shop, duplicate));
    expect(assembly.evaluation.issue?.reasons[0]).toMatchObject({
      code: 'echoGoldPickupPlacementRequired',
      evidence: { deadline: 'leave' },
    });
    expect(assembly.evaluation.findings.filter(isDuplicate)).toHaveLength(1);
  });

  it('is withheld while the walk stops before the Shop', () => {
    const project = removed(duplicatePlaced(), shop, duplicate);
    // The first H room the walk reaches that collects a reward, before the Shop.
    const assembly = evaluate(project);
    const earlier = project.route.biomes
      .find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.map((occurrence) => room('Underworld', 'H', occurrence.occurrenceId))
      .find(
        (candidate) =>
          candidate.occurrenceId !== shop.occurrenceId &&
          liveActionsForProjectEvaluationAssembly(catalog, assembly, candidate) !== undefined &&
          roomRows(project, candidate).some(
            (reference) => reference.kind === 'interactIncomingReward',
          ),
      );
    if (earlier === undefined) throw new Error('no reached H room collects a reward');
    const reward = roomRows(project, earlier).find(
      (reference) => reference.kind === 'interactIncomingReward',
    )!;
    const stopped = evaluate(removed(project, earlier, reward));
    const finding = stopped.evaluation.issue?.reasons[0];

    expect(finding?.code).toBe('roomActionPlacementRequired');
    expect(semanticAddressKey(finding!.origin)).toContain(earlier.occurrenceId);
    expect(stopped.evaluation.findings.filter(isDuplicate)).toEqual([]);
  });
});

function roomRows(project: ProjectDocument, at: OccurrenceAddress) {
  return (
    project.route.biomes
      .find((biome) => biome.biomeKey === at.biomeKey)
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === at.occurrenceId)
      ?.roomActions.order ?? []
  );
}
