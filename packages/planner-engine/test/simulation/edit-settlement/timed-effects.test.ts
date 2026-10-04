import { loadUnderworldFGProject } from '@run-planner/test-fixtures/underworld';
import { supportedTraitOffer } from '@run-planner/test-fixtures/shared';
import { agreedTimedEffectContact } from '../../../src/simulation/rewards/timed-effects/contacts';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../../src/simulation/evaluation/project-evaluation-assembly';
import { describe, expect, it } from 'vitest';
import {
  loadSurfaceNOPQProject,
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  createSurfaceOSameRoomHermesDeliveriesCheckpoint,
} from '@run-planner/test-fixtures/surface';
import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  applyProjectCommand,
  createSteadyGrowthOutcomeAddress,
  createTranscendentEmbryoOutcomeAddress,
  createLevelResolutionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createKeepsakeEquipResultAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  hermesShrineDeliveryEntryKey,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
  publishProjectHistoryEdit,
  createProjectHistory,
  undoProjectHistory,
  redoProjectHistory,
  type ProjectDocument,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';

const p = createBiomeAddress('Surface', 'P');
const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });
function occurrence(project: ProjectDocument, id: string) {
  return project.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .find((room) => room.occurrenceId === id)!;
}

describe('timed-effect edit settlement', () => {
  it('retains an active downstream Embryo outcome through Shadow activation and removal', () => {
    const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
    const value = { blessingKey: 'ChaosElementalBlessing', blessingValues: {} } as const;
    let project = applyProjectCommand(loadUnderworldFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection,
      keepsakeKey: 'RandomBlessingKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoEquipResult',
      result: createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo'),
      value,
    });
    const f = createBiomeAddress('Underworld', 'F');
    const owner = createOccurrenceAddress(f, createOccurrenceId('golden-f-b7-e1'));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: createTranscendentEmbryoOutcomeAddress(owner, 'Encounter'),
      value,
    });
    const before = evaluate(project);
    expect(before.evaluation.route.biomes[0]?.validity).toBe('valid');
    const contacts =
      candidateArtifactsForProjectEvaluationAssembly(before).biomeAt(f)?.roomLifecycles
        .timedEffects;
    expect(contacts?.some((contact) => contact.owner.occurrenceId === owner.occurrenceId)).toBe(
      true,
    );
    for (const rank of [1, 0]) {
      const settled = settle(project, {
        kind: 'ReplaceFearVowRank',
        route: { kind: 'route', routeKey: 'Underworld' },
        vowKey: 'MinibossCountShrineUpgrade',
        rank,
      });
      expect(settled.evaluation.route.biomes[0]?.validity).toBe('valid');
      expect(
        candidateArtifactsForProjectEvaluationAssembly(settled).biomeAt(f)?.roomLifecycles
          .timedEffects,
      ).toEqual(contacts);
      expect(
        occurrence(settled.project, owner.occurrenceId).encounters.transcendentEmbryoBlessingByPhase
          ?.Encounter,
      ).toEqual(value);
      project = settled.project;
    }
  });
  it('retains both minibosses’ dormant automatic choices through Shadow activation and removal', () => {
    let project = loadUnderworldFGProject();
    const f = createBiomeAddress('Underworld', 'F');
    const rooms = project.route.biomes[0]!.topology!.occurrences.filter(
      (room) => room.gameName === 'F_MiniBoss01' || room.gameName === 'F_MiniBoss02',
    );
    expect(rooms).toHaveLength(2);
    for (const room of rooms) {
      const owner = createOccurrenceAddress(f, room.occurrenceId);
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: createSteadyGrowthOutcomeAddress(owner, 'Encounter'),
        targetTraitKey: 'ApolloWeaponBoon',
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceTranscendentEmbryoTransformation',
        outcome: createTranscendentEmbryoOutcomeAddress(owner, 'Encounter'),
        value: { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
      });
    }
    const original = project;
    for (const rank of [1, 0]) {
      project = settle(project, {
        kind: 'ReplaceFearVowRank',
        route: { kind: 'route', routeKey: 'Underworld' },
        vowKey: 'MinibossCountShrineUpgrade',
        rank,
      }).project;
      for (const room of rooms) {
        expect(occurrence(project, room.occurrenceId).encounters).toEqual(
          occurrence(original, room.occurrenceId).encounters,
        );
      }
    }
  });
  it.each([
    ['surface-p-1-1-p_combat03', 'P_Combat05'],
    ['surface-p-3-1-p_combat04', 'P_Combat05'],
    ['surface-p-4-1-p_combat07', 'P_Combat05'],
  ])('retains equivalent P combat timed authorship at %s', (id, gameName) => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const before = occurrence(project, id);
    const settled = settle(project, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(p, createOccurrenceId(id)),
      gameName,
    });
    const after = occurrence(settled.project, id);
    const reached = candidateArtifactsForProjectEvaluationAssembly(settled)
      .biomeAt(p)
      ?.roomLifecycles.timedEffects.filter(
        (contact) => contact.owner.occurrenceId === id && contact.phaseKey === 'Combat',
      );
    expect(reached).toHaveLength(3);
    expect(
      settled.evaluation.findings.filter(
        (finding) =>
          finding.code === 'steadyGrowthOutcomeMissing' ||
          finding.code === 'transcendentEmbryoOutcomeMissing' ||
          finding.code === 'hermesShrineDeliveryPlacementRequired',
      ),
    ).toEqual([]);
    expect(after.acquisitionSites).toEqual(before.acquisitionSites);
    expect(after.encounters.steadyGrowthTargetByPhase).toEqual(
      before.encounters.steadyGrowthTargetByPhase,
    );
    expect(after.encounters.transcendentEmbryoBlessingByPhase).toEqual(
      before.encounters.transcendentEmbryoBlessingByPhase,
    );
    expect(after.roomActions.order).toEqual(before.roomActions.order);
    const history = publishProjectHistoryEdit(createProjectHistory(project), settled.project);
    expect(undoProjectHistory(history).present).toBe(project);
    expect(redoProjectHistory(undoProjectHistory(history)).present).toBe(settled.project);
  });
  it('retains an unassessed timed suffix when an earlier target is cleared', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const owner = createOccurrenceAddress(p, createOccurrenceId('surface-p-3-1-p_combat04'));
    const settled = settle(project, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: createSteadyGrowthOutcomeAddress(owner, 'Combat'),
      targetTraitKey: null,
    });
    expect(
      settled.evaluation.findings.some((finding) => finding.code === 'steadyGrowthOutcomeMissing'),
    ).toBe(true);
    expect(
      occurrence(settled.project, 'surface-p-4-1-p_combat07').encounters
        .transcendentEmbryoBlessingByPhase,
    ).toEqual(
      occurrence(project, 'surface-p-4-1-p_combat07').encounters.transcendentEmbryoBlessingByPhase,
    );
  });
  it('keeps a context-invalid target when equivalent replacement did not change its clock', () => {
    const owner = createOccurrenceAddress(p, createOccurrenceId('surface-p-3-1-p_combat04'));
    const project = applyProjectCommand(loadSurfaceScheduledLifecycleCheckpoint(), catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: createSteadyGrowthOutcomeAddress(owner, 'Combat'),
      targetTraitKey: 'ZeusWeaponBoon',
    });
    const settled = settle(project, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: owner,
      gameName: 'P_Combat05',
    });
    expect(
      occurrence(settled.project, owner.occurrenceId).encounters.steadyGrowthTargetByPhase?.Combat,
    ).toBe('ZeusWeaponBoon');
  });
  it('resets only vanished combat contacts when replacing combat with story', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const owner = createOccurrenceAddress(p, createOccurrenceId('surface-p-3-1-p_combat04'));
    const settled = settle(project, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: owner,
      gameName: 'P_Story01',
    });
    expect(
      occurrence(settled.project, owner.occurrenceId).encounters.steadyGrowthTargetByPhase?.Combat,
    ).toBeUndefined();
    expect(
      occurrence(settled.project, 'surface-p-4-1-p_combat07').encounters
        .transcendentEmbryoBlessingByPhase,
    ).toEqual(
      occurrence(project, 'surface-p-4-1-p_combat07').encounters.transcendentEmbryoBlessingByPhase,
    );
  });
  it('refuses deleting a valid required Hermes obligation without adding history', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const id = 'surface-p-1-1-p_combat03';
    const reference = occurrence(project, id).roomActions.order.find(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'hermesShrineDelivery',
    )!;
    const before = evaluate(project);
    const settled = settleProjectEdit({
      catalog,
      before,
      command: {
        kind: 'UnplaceGeneratedDelivery',
        action: createRoomActionAddress(p, createOccurrenceId(id), roomActionKey(reference)),
      },
      evaluate,
    });
    expect(settled).toBe(before);
  });
  it('keeps Supply Chain optional when removing an accepted maturity', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const id = 'surface-p-1-1-p_combat03';
    const reference = occurrence(project, id).roomActions.order.find(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.entryKey.startsWith('clockedTraitGenerated:'),
    )!;
    const settled = settle(project, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(p, createOccurrenceId(id), roomActionKey(reference)),
    });
    expect(
      occurrence(settled.project, id).roomActions.order.some(
        (candidate) => roomActionKey(candidate) === roomActionKey(reference),
      ),
    ).toBe(false);
  });
  it('protects an explicitly edited Supply Chain pickup child', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const owner = createOccurrenceAddress(p, createOccurrenceId('surface-p-1-1-p_combat03'));
    const reference = occurrence(project, owner.occurrenceId).roomActions.order.find(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.entryKey.startsWith('clockedTraitGenerated:'),
    );
    if (reference?.kind !== 'interactAcquisitionEntry')
      throw new Error('Supply Chain entry missing');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(owner, reference.siteKey),
      reference.entryKey,
    );
    const value = { kind: 'random', targetTraitKey: 'AresSpecialBoon' } as const;
    const settled = settle(project, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(entry, 'self'),
      value,
    });
    expect(occurrence(settled.project, owner.occurrenceId).roomActions.order).toContainEqual(
      reference,
    );
    expect(
      occurrence(settled.project, owner.occurrenceId).acquisitionSites?.[reference.siteKey]
        ?.pickupEntries?.[reference.entryKey]?.levelResolutionsByAcquisitionRole?.self,
    ).toEqual(value);
  });
  it('retains the unassessed suffix after adding an unresolved Ship phase', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const settled = settle(project, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(
        createBiomeAddress('Surface', 'O'),
        createOccurrenceId('surface-o-combat01'),
      ),
      encounterCount: 3,
    });
    expect(settled.evaluation.status).not.toBe('valid');
    expect(occurrence(settled.project, 'surface-p-1-1-p_combat03').acquisitionSites).toEqual(
      occurrence(project, 'surface-p-1-1-p_combat03').acquisitionSites,
    );
    expect(
      occurrence(settled.project, 'surface-p-3-1-p_combat04').encounters.steadyGrowthTargetByPhase,
    ).toEqual(occurrence(project, 'surface-p-3-1-p_combat04').encounters.steadyGrowthTargetByPhase);
  });
  it('resets a reached displaced Steady Growth target after an earlier acquired interval changes', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const source = occurrence(project, 'surface-n-combat23');
    if (source.state.kind !== 'ephyraCombat') throw new Error('Steady Growth source missing');
    const offer = source.state.reward?.traitOffersByAcquisitionRole.source;
    if (offer?.kind !== 'traits') throw new Error('Steady Growth offer missing');
    const settled = settle(project, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(createBiomeAddress('Surface', 'N'), source.occurrenceId),
        'source',
      ),
      value: {
        ...offer,
        options: [{ ...offer.options[0], rarity: 'Rare' }, offer.options[1]!, offer.options[2]!],
      },
    });
    expect(
      occurrence(settled.project, 'surface-o-combat04').encounters.steadyGrowthTargetByPhase
        ?.Combat1,
    ).toBeUndefined();
    expect(
      settled.evaluation.findings.some((finding) => finding.code === 'steadyGrowthOutcomeMissing'),
    ).toBe(true);
    expect(
      occurrence(settled.project, 'surface-p-3-1-p_combat04').encounters.steadyGrowthTargetByPhase,
    ).toEqual(occurrence(project, 'surface-p-3-1-p_combat04').encounters.steadyGrowthTargetByPhase);
  });
  it('resets an inherited changed-cycle target after a second edit reveals the suffix', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const source = occurrence(project, 'surface-n-combat23');
    if (source.state.kind !== 'ephyraCombat') throw new Error('Steady Growth source missing');
    const offer = source.state.reward?.traitOffersByAcquisitionRole.source;
    if (offer?.kind !== 'traits') throw new Error('Steady Growth offer missing');
    const changed = settle(project, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(createBiomeAddress('Surface', 'N'), source.occurrenceId),
        'source',
      ),
      value: {
        ...offer,
        options: [{ ...offer.options[0], rarity: 'Common' }, offer.options[1]!, offer.options[2]!],
      },
    });
    const owner = createOccurrenceAddress(
      createBiomeAddress('Surface', 'O'),
      createOccurrenceId('surface-o-combat07'),
    );
    const repairCommand = {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: createSteadyGrowthOutcomeAddress(owner, 'Combat1'),
      targetTraitKey: 'ApolloWeaponBoon',
    } as const;
    expect(
      occurrence(changed.project, 'surface-o-preboss:boss').encounters.steadyGrowthTargetByPhase
        ?.Encounter,
    ).toBe('ApolloWeaponBoon');
    const proposed = evaluate(applyProjectCommand(changed.project, catalog, repairCommand));
    const bossContact = candidateArtifactsForProjectEvaluationAssembly(proposed)
      .biomeAt(createBiomeAddress('Surface', 'O'))
      ?.roomLifecycles.timedEffects.find(
        (contact) =>
          contact.effect === 'steadyGrowth' &&
          contact.owner.occurrenceId === 'surface-o-preboss:boss',
      );
    expect(bossContact?.cohorts[0]?.[0]).toMatchObject({ cycle: 1, progress: 5, interval: 6 });
    const repaired = settle(changed.project, repairCommand);
    expect(
      occurrence(repaired.project, 'surface-o-combat07').encounters.steadyGrowthTargetByPhase
        ?.Combat1,
    ).toBe('ApolloWeaponBoon');
    expect(
      occurrence(repaired.project, 'surface-o-preboss:boss').encounters.steadyGrowthTargetByPhase
        ?.Encounter,
    ).toBeUndefined();
    const history = publishProjectHistoryEdit(
      createProjectHistory(changed.project),
      repaired.project,
    );
    expect(undoProjectHistory(history).present).toBe(changed.project);
    expect(redoProjectHistory(undoProjectHistory(history)).present).toBe(repaired.project);
  });
  it('conservatively resets newly reached inherited choices after an ordinary blocker repair', () => {
    const original = loadSurfaceScheduledLifecycleCheckpoint();
    const owner = createOccurrenceAddress(p, createOccurrenceId('surface-p-3-1-p_combat04'));
    const outcome = createSteadyGrowthOutcomeAddress(owner, 'Combat');
    const target = occurrence(original, owner.occurrenceId).encounters.steadyGrowthTargetByPhase
      ?.Combat;
    if (target === undefined) throw new Error('Scheduled target missing');
    const incomplete = applyProjectCommand(original, catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome,
      targetTraitKey: null,
    });
    const repaired = settle(incomplete, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome,
      targetTraitKey: target,
    });
    expect(
      occurrence(repaired.project, owner.occurrenceId).encounters.steadyGrowthTargetByPhase?.Combat,
    ).toBe(target);
    expect(
      occurrence(repaired.project, 'surface-p-4-1-p_combat07').encounters
        .transcendentEmbryoBlessingByPhase?.Combat,
    ).toBeUndefined();
    expect(
      repaired.evaluation.findings.some(
        (finding) => finding.code === 'transcendentEmbryoOutcomeMissing',
      ),
    ).toBe(true);
  });
  it('settles multiple reached missing deliveries in one edit', () => {
    let project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const o = createBiomeAddress('Surface', 'O');
    const source = createOccurrenceAddress(o, createOccurrenceId('surface-o-combat07'));
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:first',
      purchase: { delay: 3, rushed: false },
    });
    const settled = settle(project, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondRight',
      purchase: { delay: 3, rushed: false },
    });
    const deliveries = occurrence(settled.project, 'surface-o-devotion').roomActions.order.filter(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'hermesShrineDelivery',
    );
    expect(deliveries).toHaveLength(3);
    expect(new Set(deliveries.map(roomActionKey)).size).toBe(3);
    expect(
      settled.evaluation.findings.some(
        (finding) => finding.code === 'hermesShrineDeliveryPlacementRequired',
      ),
    ).toBe(false);
  });
  it('clears a reached Embryo transformation when its active keepsake source is removed', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const settled = settle(project, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'ManaOverTimeRefundKeepsake',
    });
    expect(
      occurrence(settled.project, 'surface-n-combat03').encounters.transcendentEmbryoBlessingByPhase
        ?.Encounter,
    ).toBeUndefined();
    expect(
      settled.evaluation.findings.some(
        (finding) => finding.code === 'transcendentEmbryoOutcomeMissing',
      ),
    ).toBe(false);
  });
  it.each(['reschedule', 'restore'] as const)(
    'drops inherited nested Hermes choices on %s without correspondence',
    (operation) => {
      const o = createBiomeAddress('Surface', 'O');
      const source = createOccurrenceAddress(o, createOccurrenceId('surface-o-combat07'));
      const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
      const entry = createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(o, createOccurrenceId('surface-o-devotion')),
          'hermesShrineDelivery',
        ),
        entryKey,
      );
      let project = createSurfaceNOHermesShrineDeliveryCheckpoint();
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: source,
        slotKey: 'secondLeft',
        value: { rewardType: 'BlindBoxLoot' },
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceAcquisitionEntryOffer',
        entry,
        value: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      });
      const trait = createTraitOfferAddress(entry, 'hiddenSource');
      const value = supportedTraitOffer(project, trait, 'Apollo');
      if (value === undefined) throw new Error('Mystery source has no Apollo offer');
      project = applyProjectCommand(project, catalog, { kind: 'ReplaceTraitOffer', trait, value });
      if (operation === 'restore') {
        const reference = occurrence(project, 'surface-o-devotion').roomActions.order.find(
          (reference) =>
            reference.kind === 'interactAcquisitionEntry' && reference.entryKey === entryKey,
        )!;
        project = applyProjectCommand(project, catalog, {
          kind: 'UnplaceGeneratedDelivery',
          action: createRoomActionAddress(
            o,
            createOccurrenceId('surface-o-devotion'),
            roomActionKey(reference),
          ),
        });
      }
      const settled = settle(
        project,
        operation === 'reschedule'
          ? {
              kind: 'SetHermesShrinePurchase',
              occurrence: source,
              generationKey: 'initial:secondLeft',
              purchase: { delay: 4, rushed: false },
            }
          : { kind: 'PlaceHermesShrineDelivery', entry, encounterPhaseKey: 'Encounter' },
      );
      const retained = settled.project.route.biomes
        .flatMap((biome) => biome.topology?.occurrences ?? [])
        .flatMap((room) =>
          room.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey] === undefined
            ? []
            : [
                {
                  room,
                  reward: room.acquisitionSites.hermesShrineDelivery.pickupEntries[entryKey],
                },
              ],
        );
      expect(retained).toHaveLength(1);
      if (operation === 'reschedule')
        expect(retained[0]!.room.occurrenceId).not.toBe('surface-o-devotion');
      expect(retained[0]!.reward).toBeNull();
      expect(retained[0]!.reward?.traitOffersByAcquisitionRole.hiddenSource).not.toEqual(value);
      const history = publishProjectHistoryEdit(createProjectHistory(project), settled.project);
      expect(undoProjectHistory(history).present).toBe(project);
    },
  );
  it('retains a same-room sibling delivery already placed at its due contact', () => {
    const {
      project: complete,
      introEntry,
      combatEntry,
    } = createSurfaceOSameRoomHermesDeliveriesCheckpoint();
    const introTrait = createTraitOfferAddress(introEntry, 'hiddenSource');
    const missingOffers = (assembly: ReturnType<typeof evaluate>) =>
      assembly.evaluation.findings
        .filter((finding) => finding.code === 'traitOfferMissing')
        .map((finding) => semanticAddressKey(finding.origin));
    expect(missingOffers(evaluate(complete))).toEqual([]);
    const nestedOffer = (project: ProjectDocument, entry: typeof introEntry) =>
      occurrence(project, 'surface-o-combat01').acquisitionSites?.hermesShrineDelivery
        ?.pickupEntries?.[entry.entryKey]?.traitOffersByAcquisitionRole.hiddenSource;
    const combatValue = nestedOffer(complete, combatEntry);
    const introValue = nestedOffer(complete, introEntry);
    if (combatValue == null || introValue == null) throw new Error('fixture offers missing');
    // Re-sourcing the Intro Mystery clears its nested offer; Combat1 stays authored but unreached.
    let project = complete;
    for (const source of ['AphroditeUpgrade', 'ApolloUpgrade'] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceAcquisitionEntryOffer',
        entry: introEntry,
        value: { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source } },
      });
    expect(nestedOffer(project, introEntry)).toBeNull();
    const before = evaluate(project);
    expect(missingOffers(before)).toEqual([semanticAddressKey(introTrait)]);
    const settled = settleProjectEdit({
      catalog,
      before,
      command: { kind: 'ReplaceTraitOffer', trait: introTrait, value: introValue },
      evaluate,
    });
    expect(nestedOffer(settled.project, introEntry)).toEqual(introValue);
    expect(nestedOffer(settled.project, combatEntry)).toEqual(combatValue);
    expect(missingOffers(settled)).toEqual([]);
    expect(
      settleProjectEdit({
        catalog,
        before: settled,
        command: {
          kind: 'ReplaceTraitOffer',
          trait: createTraitOfferAddress(combatEntry, 'hiddenSource'),
          value: combatValue,
        },
        evaluate,
      }),
    ).toBe(settled);
    const history = publishProjectHistoryEdit(createProjectHistory(project), settled.project);
    expect(undoProjectHistory(history).present).toBe(project);
  });
  it('treats mixed and missing reached cohorts as unknown correspondence', () => {
    const assembly = evaluate(loadSurfaceScheduledLifecycleCheckpoint());
    const contact = candidateArtifactsForProjectEvaluationAssembly(assembly)
      .biomeAt(p)!
      .roomLifecycles.timedEffects.find(
        (contact) => contact.effect === 'clockedPickup' && contact.cohorts[0]?.length,
      )!;
    expect(agreedTimedEffectContact(contact)).toBeDefined();
    expect(
      agreedTimedEffectContact({ ...contact, cohorts: [contact.cohorts[0]!, []] }),
    ).toBeUndefined();
    expect(agreedTimedEffectContact({ ...contact, cohorts: [] })).toBeUndefined();
    expect(agreedTimedEffectContact(undefined)).toBeUndefined();
  });
  it('places a delayed final-Preboss delivery at its phase-less contact', () => {
    let project = loadSurfaceNOPQProject();
    const source = createOccurrenceAddress(
      p,
      createOccurrenceId('surface-p-preboss-shop:postboss'),
    );
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: source,
        slotKey,
        value: { rewardType },
      });
    const settled = settle(project, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondRight',
      purchase: { delay: 8, rushed: false },
    });
    const key = hermesShrineDeliveryEntryKey(source, 'initial:secondRight');
    expect(occurrence(settled.project, 'surface-q-preboss').roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey: key,
    });
    expect(settled.evaluation.status).toBe('valid');
  });
  it('retracts a removed source and places a newly repurchased obligation on reactivation', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint();
    const o = createBiomeAddress('Surface', 'O');
    const source = createOccurrenceAddress(o, createOccurrenceId('surface-o-combat07'));
    const key = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
    const offers = occurrence(project, source.occurrenceId).hermesShrine!.offerBySlot;
    const removed = settle(project, {
      kind: 'SetHermesShrinePresence',
      occurrence: source,
      present: false,
    });
    const orders = (project: ProjectDocument) =>
      project.route.biomes
        .flatMap((biome) => biome.topology?.occurrences ?? [])
        .flatMap((room) => room.roomActions.order)
        .filter(
          (reference) =>
            reference.kind === 'interactAcquisitionEntry' && reference.entryKey === key,
        );
    expect(orders(removed.project)).toEqual([]);
    let restored = settle(removed.project, {
      kind: 'SetHermesShrinePresence',
      occurrence: source,
      present: true,
    }).project;
    for (const slotKey of ['first', 'secondLeft', 'secondRight'] as const)
      restored = settle(restored, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: source,
        slotKey,
        value: offers[slotKey]!,
      }).project;
    restored = settle(restored, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondLeft',
      purchase: { delay: 3, rushed: false },
    }).project;
    expect(orders(restored)).toHaveLength(1);
  });
  it('automatically restores legacy missing deliveries only during an edit', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const before = evaluate(project);
    expect(before.project).toBe(project);
    const missing = before.evaluation.findings.find(
      (finding) => finding.code === 'hermesShrineDeliveryPlacementRequired',
    );
    expect(missing).toBeDefined();
    if (missing?.origin.kind !== 'acquisitionEntry') throw new Error('missing exact delivery');
    const phase = missing.evidence.encounterPhaseKey;
    const command: ProjectCommand = {
      kind: 'PlaceHermesShrineDelivery',
      entry: missing.origin,
      ...(typeof phase === 'string' ? { encounterPhaseKey: phase } : {}),
    };
    const settled = settleProjectEdit({ catalog, before, command, evaluate });
    expect(
      settled.evaluation.findings.some(
        (finding) => finding.code === 'hermesShrineDeliveryPlacementRequired',
      ),
    ).toBe(false);
    expect(settleProjectEdit({ catalog, before: settled, command, evaluate })).toBe(settled);
  });
});
