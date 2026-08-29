import { describe, expect, it } from 'vitest';
import {
  assemble,
  applyProjectCommand,
  catalog,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createGoldenFGHIProject,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  goldenFBiome,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  semanticAddressKey,
  withFPrebossSelection,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';

describe('occurrence room facts', () => {
  it('retains authored incoming reward facts before evaluated room detail exists', () => {
    const occurrenceId = nOccurrenceId('combat05');
    const assembled = assemble(loadSurfaceNOPQProject(), 'Surface', 'N', occurrenceId).assembly.node
      .room;
    const incoming = createIncomingRewardAddress(nBiome, occurrenceId);

    expect(assembled.entered).toBe(false);
    expect(
      assembled.rewardControls.some(
        (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(incoming),
      ),
    ).toBe(true);
  });

  it('keeps a selected Shop editable and withholds retained unpicked Shop inventory', () => {
    const shop = createOccurrenceId('golden-f-preboss-shop');
    const selected = assemble(
      withFPrebossSelection(createGoldenFGHIProject(), 'exit1'),
      'Underworld',
      'F',
      shop,
    ).assembly;
    const dormant = assemble(
      withFPrebossSelection(createGoldenFGHIProject(), 'exit2'),
      'Underworld',
      'F',
      shop,
    ).assembly;

    expect(selected.node.room.roomLocal.kind).toBe('shop');
    if (selected.node.room.roomLocal.kind !== 'shop') throw new Error('selected Shop is missing');
    expect(selected.node.room.roomLocal.materialized).toBe(true);
    expect(Object.isFrozen(selected.node.room.roomLocal)).toBe(true);
    expect(Object.isFrozen(selected.node.room.roomLocal.offers)).toBe(true);
    expect(selected.node.room.roomLocal.offers.map((offer) => [offer.key, offer.label])).toEqual([
      ['Boon', 'Offer 1'],
      ['MajorNonBoon', 'Offer 2'],
      ['Minor', 'Offer 3'],
    ]);
    expect(
      selected.node.room.roomLocal.offers.every(
        (offer) =>
          Object.isFrozen(offer) &&
          Object.isFrozen(offer.purchase) &&
          Object.isFrozen(offer.rewardControl),
      ),
    ).toBe(true);
    expect(selected.occurrenceInteractionRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'roomActions' })]),
    );
    const selectedOffer = selected.node.room.roomLocal.offers.find(
      (offer) => offer.key === 'MajorNonBoon',
    );
    expect(selectedOffer).toMatchObject({
      label: 'Offer 2',
      purchase: {
        address: createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(createOccurrenceAddress(goldenFBiome, shop), 'roomExit'),
          'MajorNonBoon',
        ),
      },
      rewardControl: {
        owner: { address: createShopOfferAddress(goldenFBiome, shop, 'MajorNonBoon') },
      },
    });

    expect(dormant.node.room.roomLocal.kind).toBe('shop');
    if (dormant.node.room.roomLocal.kind !== 'shop') throw new Error('dormant Shop is missing');
    expect(dormant.node.room.roomLocal.materialized).toBe(false);
    expect(dormant.occurrenceInteractionRequirements).toHaveLength(0);
  });

  it('projects a reached Gold duplicate as one supplemental row and ordered peer pickup', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopId),
      'roomExit',
    );
    let project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const initialOccurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const source =
      initialOccurrence?.state.kind === 'shop'
        ? initialOccurrence.state.shop?.offers.Boon
        : undefined;
    if (source === undefined) throw new Error('selected Shop Boon is missing');
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectDerivedShopEntry',
      site,
      entryKey: 'echoDoubleShopReward',
      sourceOfferKey: 'Boon',
    });
    const duplicate = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
    const projected = assemble(project, 'Underworld', 'F', shopId, undefined, (candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: duplicate,
              kind: 'echoDoubleShopReward' as const,
              sourceOfferKey: 'Boon',
              rewardTypes: ['RandomLoot'],
              eligibleSourceOfferKeys: ['Minor', 'Boon', 'MajorNonBoon'],
            },
          ],
    );
    const result = projected.assembly;

    const actions = result.node.room.roomActions;
    if (actions === undefined) throw new Error('Shop room actions are withheld');
    const derived = actions.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.siteKey === 'roomExit' &&
        row.reference.entryKey === 'echoDoubleShopReward',
    );
    expect(derived).toMatchObject({
      reference: {
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: 'echoDoubleShopReward',
      },
    });
    expect(derived?.rewardPayload?.control).toMatchObject({
      kind: 'explicitReward',
      owner: { kind: 'acquisitionEntry', address: duplicate },
    });
    expect(result.node.room.roomLocal.kind).toBe('shop');
    if (result.node.room.roomLocal.kind !== 'shop') throw new Error('Shop summary is missing');
    expect(result.node.room.roomLocal.supplementalOffers).toContainEqual(
      expect.objectContaining({
        kind: 'echoDoubleShopReward',
        sourceOfferKey: 'Boon',
        rewardControl: expect.objectContaining({
          kind: 'explicitReward',
          owner: { kind: 'acquisitionEntry', address: duplicate },
          rewardTypes: ['RandomLoot'],
        }),
      }),
    );
    expect(result.occurrenceInteractionRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'roomActions' })]),
    );
    expect(
      result.occurrenceInteractionRequirements.filter(
        (requirement) => requirement.kind === 'shopPurchaseParticipation',
      ),
    ).toHaveLength(3);
    expect(projected.markers.destinations().get(semanticAddressKey(duplicate))).toMatchObject({
      ownerAddress: duplicate,
      focusAddress: duplicate,
      nodeKey: result.node.key,
    });
  });

  it('projects active Contract and generated Travel rows but never the disabled placeholder', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const shopOccurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const shop = shopOccurrence?.state.kind === 'shop' ? shopOccurrence.state.shop : undefined;
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopId),
      'roomExit',
    );
    if (shop === undefined) throw new Error('Gate B Shop state is missing');
    const contractAddress = createAcquisitionEntryAddress(site, 'infernalContractReward');
    const travelAddress = createAcquisitionEntryAddress(site, 'travelDealRefill');
    const projectWith = (entries: Parameters<typeof assemble>[5]) =>
      assemble(project, 'Underworld', 'F', shopId, undefined, entries).assembly.node.room.roomLocal;

    const contractOnly = projectWith((candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: contractAddress,
              kind: 'infernalContractReward' as const,
              rewardTypes: ['BlindBoxLoot', 'StackUpgrade'],
            },
          ],
    );
    expect(contractOnly).toMatchObject({
      kind: 'shop',
      supplementalOffers: [
        {
          kind: 'infernalContractReward',
          rewardControl: { rewardTypes: ['BlindBoxLoot', 'StackUpgrade'] },
        },
      ],
    });

    const placeholder = projectWith((candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: contractAddress,
              kind: 'infernalContractReward' as const,
              rewardTypes: ['BlindBoxLoot', 'StackUpgrade'],
            },
            { address: travelAddress, kind: 'travelDealPlaceholder' as const },
          ],
    );
    expect(placeholder).toMatchObject({
      kind: 'shop',
      supplementalOffers: [{ kind: 'travelDealPlaceholder' }, { kind: 'infernalContractReward' }],
    });

    const active = projectWith((candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: contractAddress,
              kind: 'infernalContractReward' as const,
              rewardTypes: ['BlindBoxLoot', 'StackUpgrade'],
            },
            {
              address: travelAddress,
              kind: 'travelDealRefill' as const,
              sourceOfferKey: 'MajorNonBoon',
              slotIndex: 1,
              rewardTypes: ['WeaponUpgradeDrop', 'MaxHealthDrop'],
            },
          ],
    );
    expect(active).toMatchObject({
      kind: 'shop',
      supplementalOffers: [
        {
          kind: 'travelDealRefill',
          sourceOfferKey: 'MajorNonBoon',
          purchase: {
            purchased: false,
            reference: {
              kind: 'interactAcquisitionEntry',
              siteKey: 'roomExit',
              entryKey: 'travelDealRefill',
            },
          },
          rewardControl: { rewardTypes: ['WeaponUpgradeDrop', 'MaxHealthDrop'] },
        },
        { kind: 'infernalContractReward' },
      ],
    });
  });
});
