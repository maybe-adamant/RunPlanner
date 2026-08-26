import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createPostbossKeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';

import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import {
  applyKeepsakeDisposition,
  attestGorgonBranchState,
  beginBiomeKeepsakeState,
  createKeepsakeState,
  keepsakeRankForEquip,
  keepsakeSelectionUnavailableReason,
} from '../../src/simulation/keepsakes';
import { simulateProject } from '../../src/simulation/project';
import {
  applyExperimentalHammerEquipResult,
  applyJeweledPomEquipResult,
  initializeRewardBranches,
  publicRewardBranch,
} from '../../src/simulation/rewards/processing';
import { processEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { attachTraitHistory, foldTraitHistoryEvents } from '../../src/simulation/traits';
import type { RewardBranch } from '../../src/simulation/rewards/model';

const loadout = createDefaultRouteLoadout(catalog);
const arcanaFear = createArcanaFearState(catalog, loadout);

function prerequisiteHistory() {
  return foldTraitHistoryEvents(catalog, [
    {
      kind: 'traitOffer' as const,
      owner: { kind: 'project' as const },
      acquisitionRole: 'demeterSeed',
      sequence: 1,
      giverKey: 'Demeter',
      options: [{ traitKey: 'DemeterWeaponBoon', rarity: 'Common' as const }],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'prerequisiteSeed',
    },
    {
      kind: 'traitOffer' as const,
      owner: { kind: 'project' as const },
      acquisitionRole: 'heraSeed',
      sequence: 2,
      giverKey: 'Hera',
      options: [{ traitKey: 'HeraCastBoon', rarity: 'Common' as const }],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'prerequisiteSeed',
    },
  ]);
}

function cherishedBranchState(startingKeepsakeKey = 'ManaOverTimeRefundKeepsake') {
  const initialized = initializeRewardBranches(
    undefined,
    arcanaFear,
    catalog,
    startingKeepsakeKey,
  )[0]!;
  const prior = prerequisiteHistory();
  const seeded = {
    ...initialized,
    history: attachTraitHistory(initialized.history, prior),
    traitHistory: prior,
  };
  const acquired = processEncounterTraitOffer(
    catalog,
    seeded,
    createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'F'),
      { kind: 'occurrence', occurrenceId: createOccurrenceId('cherished-seed') },
      'Encounter',
    ),
    {
      kind: 'traits',
      giverKey: 'Demeter',
      options: [
        { traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' },
        { traitKey: 'DemeterSpecialBoon', rarity: 'Common' },
        { traitKey: 'DemeterSprintBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
    3,
    'encounterCompleted',
  );
  if (acquired.traitHistory?.equippedTraits.KeepsakeLevelBoon === undefined)
    throw new Error('ordinary Cherished acquisition did not enter canonical trait history');
  return { ...acquired, traitHistory: acquired.traitHistory };
}

function cherishedBranch(startingKeepsakeKey = 'ManaOverTimeRefundKeepsake'): RewardBranch {
  return publicRewardBranch(cherishedBranchState(startingKeepsakeKey));
}

function postbossOwner(biomeKey = 'F') {
  return createPostbossKeepsakeSelectionAddress(
    createOccurrenceAddress(
      createBiomeAddress('Underworld', biomeKey),
      createOccurrenceId(`completion:${biomeKey}:postboss`),
    ),
  );
}

function directLaterEquip(keepsakeKey: string) {
  const branch = cherishedBranchState();
  const rank = keepsakeRankForEquip(catalog, keepsakeKey, branch.traitHistory);
  return {
    branch,
    rank,
    keepsakes: applyKeepsakeDisposition(
      catalog,
      branch.keepsakes,
      { kind: 'replace', keepsakeKey },
      branch.arcanaFear,
      rank,
    ),
  };
}

function evaluatedBiome(project: ReturnType<typeof createGoldenFGHProject>, biomeKey: 'F' | 'G') {
  const biome = simulateProject(catalog, project)
    .routes.find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error(`expected valid ${biomeKey} fixture`);
  return biome;
}

function replayBiome(
  project: ReturnType<typeof createGoldenFGHProject>,
  biomeKey: 'F' | 'G',
  initialBranches: readonly RewardBranch[],
) {
  const biome = evaluatedBiome(project, biomeKey);
  const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
  if (route === undefined) throw new Error('missing Underworld route');
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    biome.snapshot,
    biome.history,
    biomeKey === 'F' ? 0 : 1,
    route.loadout,
    initialBranches,
  ).simulation;
}

describe('Cherished Heirloom later keepsake equips', () => {
  it('records Cherished through the ordinary selected-offer acquisition fold', () => {
    const branch = cherishedBranchState();
    expect(branch.traitHistory.equippedTraits.KeepsakeLevelBoon).toMatchObject({
      giverKey: 'Demeter',
      rarity: 'Duo',
      traitKey: 'KeepsakeLevelBoon',
    });
    expect(branch.traitHistory.events).toContainEqual(
      expect.objectContaining({
        kind: 'traitOffer',
        acquisitionRole: 'selection',
        giverKey: 'Demeter',
        selectedOptionKey: 'option1',
      }),
    );
  });

  it('derives the full six-result rank-IV matrix from canonical trait history', () => {
    const gorgon = directLaterEquip('AthenaEncounterKeepsake');
    expect(gorgon.rank).toBe('Heroic');
    expect(gorgon.keepsakes.gorgon).toEqual({ status: 'pending', rarity: 'Heroic' });

    const figLeaf = directLaterEquip('SkipEncounterKeepsake');
    expect(figLeaf.rank).toBe('Heroic');
    expect(figLeaf.keepsakes.figLeaf).toEqual({
      remainingUses: 4,
      activatedThisBiome: false,
    });

    const callingCard = directLaterEquip('RarifyKeepsake');
    expect(callingCard.rank).toBe('Heroic');
    expect(callingCard.keepsakes.callingCard?.remainingCharges).toBe(8);

    const timePiece = directLaterEquip('GoldifyKeepsake');
    expect(timePiece.rank).toBe('Heroic');
    expect(timePiece.keepsakes.timePiece?.remainingCharges).toBe(5);

    const phial = directLaterEquip('FountainRarityKeepsake');
    expect(phial.rank).toBe('Epic');
    expect(phial.keepsakes.phial).toEqual({ status: 'pending' });

    const pom = directLaterEquip('HadesAndPersephoneKeepsake');
    const pomApplied = applyJeweledPomEquipResult(
      catalog,
      { ...pom.branch, keepsakes: pom.keepsakes },
      'HadesAndPersephoneKeepsake',
      { jeweledPom: { traitKey: 'HadesLifestealBoon' } },
      createKeepsakeEquipResultAddress(postbossOwner(), 'jeweledPom'),
      2,
      pom.rank,
    );
    expect(pom.rank).toBe('Heroic');
    expect(pomApplied.keepsakes.jeweledPom?.levels).toBe(4);

    const hammer = directLaterEquip('TempHammerKeepsake');
    const hammerApplied = applyExperimentalHammerEquipResult(
      catalog,
      { ...hammer.branch, keepsakes: hammer.keepsakes },
      'TempHammerKeepsake',
      { experimentalHammer: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' } },
      createKeepsakeEquipResultAddress(postbossOwner(), 'experimentalHammer'),
      2,
      loadout,
      hammer.rank,
    );
    expect(hammer.rank).toBe('Heroic');
    expect(hammerApplied.keepsakes.experimentalHammers.at(-1)?.remainingUses).toBe(30);
  });

  it('applies rank IV at the legal rack and carries it into the succeeding biome only once', () => {
    const rack = postbossOwner();
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: rack,
      value: { kind: 'replace', keepsakeKey: 'SkipEncounterKeepsake' },
    });
    const throughF = replayBiome(project, 'F', [cherishedBranch()]);
    const afterRack = throughF.branches[0];
    expect(afterRack?.keepsakes).toMatchObject({
      currentKey: 'SkipEncounterKeepsake',
      figLeaf: { remainingUses: 4, activatedThisBiome: false },
      history: [
        { key: 'ManaOverTimeRefundKeepsake', kind: 'start' },
        { key: 'SkipEncounterKeepsake', kind: 'replace' },
      ],
    });

    const succeedingBiome = beginBiomeKeepsakeState(afterRack!.keepsakes);
    expect(succeedingBiome.figLeaf).toEqual({
      remainingUses: 4,
      activatedThisBiome: false,
    });
  });

  it('settles a later Heroic Moon Beam rack equip with its full grant and ordinary priority', () => {
    const rack = postbossOwner();
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: rack,
      value: { kind: 'replace', keepsakeKey: 'SpellTalentKeepsake' },
    });
    const throughF = replayBiome(project, 'F', [cherishedBranch()]);
    const afterRack = throughF.branches[0]!;
    expect(afterRack.keepsakes.currentKey).toBe('SpellTalentKeepsake');
    expect(afterRack.hexProgress).toEqual({ bankedPathPoints: 7, investedPathPoints: 0 });
    expect(afterRack.rewardPriorities).toEqual(['SpellDrop']);
  });

  it('resolves real Postboss Gorgon, Pom, and Hammer paths through the rank forwarding seam', () => {
    const rack = postbossOwner();

    const gorgonProject = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: rack,
      value: { kind: 'replace', keepsakeKey: 'AthenaEncounterKeepsake' },
    });
    expect(
      replayBiome(gorgonProject, 'F', [cherishedBranch()]).branches[0]?.keepsakes,
    ).toMatchObject({
      currentKey: 'AthenaEncounterKeepsake',
      gorgon: { status: 'pending', rarity: 'Heroic' },
    });

    let pomProject = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: rack,
      value: { kind: 'replace', keepsakeKey: 'HadesAndPersephoneKeepsake' },
    });
    pomProject = applyProjectCommand(pomProject, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: createKeepsakeEquipResultAddress(rack, 'jeweledPom'),
      value: { traitKey: 'HadesLifestealBoon' },
    });
    expect(replayBiome(pomProject, 'F', [cherishedBranch()]).branches[0]?.keepsakes).toMatchObject({
      currentKey: 'HadesAndPersephoneKeepsake',
      jeweledPom: { active: true, levels: 4, grantedTraitKey: 'HadesLifestealBoon' },
    });

    let hammerProject = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: rack,
      value: { kind: 'replace', keepsakeKey: 'TempHammerKeepsake' },
    });
    hammerProject = applyProjectCommand(hammerProject, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: createKeepsakeEquipResultAddress(rack, 'experimentalHammer'),
      value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
    });
    const hammer = replayBiome(hammerProject, 'F', [
      cherishedBranch(),
    ]).branches[0]?.keepsakes.experimentalHammers.at(-1);
    expect(catalog.keepsakes.byKey.TempHammerKeepsake?.effect).toMatchObject({
      kind: 'experimentalHammer',
      qualifyingEncounterUsesByRank: { Heroic: 30 },
    });
    // Postboss enters before the ranked rack action, so the new Hammer is not
    // retroactively consumed by that automatic completion.
    expect(hammer).toMatchObject({
      active: true,
      traitKey: 'StaffJumpSpecialTrait',
      remainingUses: 30,
    });
  });

  it('does not replay a retained supported keepsake or add a false neutral effect ledger', () => {
    const retainedProject = createGoldenFGHProject();
    const retainedState = createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear);
    const retained: RewardBranch = {
      ...cherishedBranch(),
      keepsakes: {
        ...retainedState,
        callingCard: { remainingCharges: 2 },
      },
    };
    const afterRetain = replayBiome(retainedProject, 'F', [retained]).branches[0]?.keepsakes;
    expect(afterRetain?.callingCard?.remainingCharges).toBe(2);
    expect(afterRetain?.history.at(-1)).toEqual({ key: 'RarifyKeepsake', kind: 'start' });

    const neutral = directLaterEquip('BossPreDamageKeepsake');
    expect(neutral.rank).toBe('Epic');
    expect(neutral.keepsakes).toMatchObject({
      currentKey: 'BossPreDamageKeepsake',
      removedKeys: ['ManaOverTimeRefundKeepsake'],
      fatedStatus: 'Unknown',
    });
    expect(neutral.keepsakes).not.toHaveProperty('jeweledPom');
    expect(neutral.keepsakes).not.toHaveProperty('experimentalHammer');
  });

  it('keeps invalid replacements inert and isolates a removed supported ledger', () => {
    const prior = createKeepsakeState(catalog, 'GoldifyKeepsake', arcanaFear);
    const removed = applyKeepsakeDisposition(
      catalog,
      prior,
      { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
      arcanaFear,
    );
    const rack = postbossOwner();
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: rack,
      value: { kind: 'replace', keepsakeKey: 'GoldifyKeepsake' },
    });
    const seeded: RewardBranch = { ...cherishedBranch(), keepsakes: removed };
    const evaluated = replayBiome(project, 'F', [seeded]);
    expect(evaluated.branches[0]?.keepsakes).toMatchObject({
      currentKey: 'BossPreDamageKeepsake',
      removedKeys: ['GoldifyKeepsake'],
      timePiece: { remainingCharges: 4 },
    });
    expect(evaluated.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeUnavailable', origin: rack }),
    );
  });

  it('preserves Fated and Unfated legality while resolving only successful rank-IV equips', () => {
    const enabling = directLaterEquip('GoldifyKeepsake').keepsakes;
    expect(enabling).toMatchObject({
      currentKey: 'GoldifyKeepsake',
      fatedStatus: 'Fated',
      timePiece: { remainingCharges: 5 },
    });

    const opposing = directLaterEquip('AthenaEncounterKeepsake').keepsakes;
    expect(opposing).toMatchObject({
      currentKey: 'AthenaEncounterKeepsake',
      fatedStatus: 'Unfated',
      gorgon: { status: 'pending', rarity: 'Heroic' },
    });
    expect(keepsakeSelectionUnavailableReason(catalog, opposing, 'GoldifyKeepsake')).toBe(
      'unfatedEnabling',
    );
    const rejected = applyKeepsakeDisposition(
      catalog,
      opposing,
      { kind: 'replace', keepsakeKey: 'GoldifyKeepsake' },
      arcanaFear,
      'Heroic',
    );
    expect(rejected).toBe(opposing);
    expect(rejected.timePiece).toBeUndefined();
    expect(rejected.gorgon).toEqual({ status: 'pending', rarity: 'Heroic' });
  });

  it('attests both status and effective pending Gorgon rarity across branches', () => {
    const heroic = directLaterEquip('AthenaEncounterKeepsake').keepsakes;
    expect(attestGorgonBranchState([{ keepsakes: heroic }, { keepsakes: heroic }])).toBe('pending');
    const epic = createKeepsakeState(catalog, 'AthenaEncounterKeepsake', arcanaFear);
    expect(() => attestGorgonBranchState([{ keepsakes: heroic }, { keepsakes: epic }])).toThrow(
      'Gorgon branch frontier is divergent',
    );
  });
});
