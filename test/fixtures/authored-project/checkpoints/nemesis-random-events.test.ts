import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  fieldsOptionalRewardCountSupport,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  loadNemesisFieldsCheckpoint,
  loadNemesisPomSeaStarCheckpoint,
  loadNemesisTraitTradeCheckpoint,
} from './underworld';
import {
  createNemesisFieldsCheckpoint,
  createNemesisPomCheckpoint,
  createNemesisPomSeaStarCheckpoint,
  createNemesisTraitTradeCheckpoint,
  nemesisPomResultAcquisition,
} from '../routes/nemesis-random-events';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '../routes/underworld';

function occurrence(
  project: ReturnType<typeof loadNemesisTraitTradeCheckpoint>,
  biomeKey: 'F' | 'H',
  id: string,
) {
  const selected = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === id);
  if (selected === undefined) throw new Error(`Nemesis checkpoint occurrence ${id} is missing`);
  return selected;
}

describe('Nemesis random-event checkpoint recipes', () => {
  it('attests each saved checkpoint to its semantic-command recipe', () => {
    expect(loadNemesisTraitTradeCheckpoint()).toEqual(createNemesisTraitTradeCheckpoint());
    expect(loadNemesisFieldsCheckpoint()).toEqual(createNemesisFieldsCheckpoint());
    expect(loadNemesisPomSeaStarCheckpoint()).toEqual(createNemesisPomSeaStarCheckpoint());
  });

  it('keeps the accepted F trait trade required, suppresses its incoming reward, and retains normal continuation', () => {
    const project = loadNemesisTraitTradeCheckpoint();
    const id = goldenFOccurrenceId(5, 1);
    const selected = occurrence(project, 'F', id);
    expect(selected.encounters.nemesisRandomEventByPhase?.Encounter).toMatchObject({
      kind: 'traitTrade',
      response: 'accept',
    });
    expect(
      selected.acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result,
    ).toMatchObject({
      offer: { rewardType: 'RoomMoneyTripleDrop' },
    });
    expect(selected.roomActions.order).toContainEqual({
      kind: 'interactEncounter',
      phaseKey: 'Encounter',
    });
    expect(selected.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'nemesisGenerated:Encounter',
      entryKey: 'result',
    });
    expect(selected.roomActions.order).not.toContainEqual(
      expect.objectContaining({ kind: 'interactIncomingReward' }),
    );
    const incoming = createIncomingRewardAddress(goldenFBiome, id);
    const f = simulateProjectAssembly(catalog, project)
      .evaluation.routes.flatMap((route) => route.biomes)
      .find((biome) => biome.origin.biomeKey === 'F');
    if (f === undefined || !('rewards' in f)) throw new Error('F reward evaluation is missing');
    expect(
      f.rewards.branches.every((branch) =>
        branch.events.every(
          (event) =>
            event.kind !== 'concreteAcquisition' ||
            semanticAddressKey(event.origin) !== semanticAddressKey(incoming),
        ),
      ),
    ).toBe(true);
    const sourceDecision = (value: ReturnType<typeof createGoldenFGHIProject>) =>
      value.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.decisions.find(
          (decision) =>
            decision.kind === 'exit' &&
            decision.source.kind === 'occurrence' &&
            decision.source.occurrenceId === id,
        );
    expect(sourceDecision(project)).toEqual(sourceDecision(createGoldenFGHIProject()));
  });

  it('keeps H physical-four Fields at effective three and interleaves the optional free result among cage actions', () => {
    const id = createOccurrenceId('golden-h-combat05');
    const selected = occurrence(loadNemesisFieldsCheckpoint(), 'H', id);
    if (selected.state.kind !== 'fieldsCombat') throw new Error('H fixture is not a Fields room');
    expect(selected.state.optionalRewardCount).toBe(3);
    expect(
      fieldsOptionalRewardCountSupport(
        catalog,
        selected,
        createOccurrenceAddress(goldenHBiome, id),
      ),
    ).toMatchObject({
      physicalMaximum: 4,
      effectiveMaximum: 3,
      reservesNemesisPosition: true,
    });
    const resultIndex = selected.roomActions.order.findIndex(
      (action) =>
        action.kind === 'interactAcquisitionEntry' &&
        action.siteKey === 'nemesisGenerated:Passive' &&
        action.entryKey === 'result',
    );
    expect(resultIndex).toBeGreaterThan(0);
    expect(selected.roomActions.order[resultIndex - 1]).toMatchObject({
      kind: 'completeFieldsCage',
    });
    expect(selected.roomActions.order[resultIndex + 1]).toMatchObject({
      kind: 'interactLocalReward',
    });
  });

  it('keeps the Pom/Hammer result and Sea Star child on ordinary acquisition sites; Time Piece is its alternate disposition', () => {
    const project = loadNemesisPomSeaStarCheckpoint();
    const selected = occurrence(project, 'F', goldenFOccurrenceId(5, 1));
    const result = selected.acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result;
    expect(result?.offer.rewardType).toMatch(/^(StackUpgrade|WeaponUpgrade)$/);
    expect(
      Object.keys(selected.acquisitionSites ?? {}).some((key) =>
        key.startsWith('seaStarDuplicate:'),
      ),
    ).toBe(true);
    const seaStarEvaluation = simulateProjectAssembly(catalog, project).evaluation;
    expect(seaStarEvaluation.findings).not.toContainEqual(
      expect.objectContaining({ code: 'seaStarDuplicationUnavailable' }),
    );
    expect(
      selected.roomActions.order.some(
        (action) =>
          action.kind === 'interactAcquisitionEntry' &&
          action.siteKey.startsWith('seaStarDuplicate:'),
      ),
    ).toBe(true);
    const alternate = applyProjectCommand(createNemesisPomCheckpoint(), catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: nemesisPomResultAcquisition(),
      value: { kind: 'timePiece' },
    });
    const alternateResult = occurrence(alternate, 'F', goldenFOccurrenceId(5, 1))
      .acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result;
    expect(alternateResult?.dispositionByAcquisitionRole.self).toEqual({ kind: 'timePiece' });
    expect(
      Object.keys(
        occurrence(alternate, 'F', goldenFOccurrenceId(5, 1)).acquisitionSites ?? {},
      ).some((key) => key.startsWith('seaStarDuplicate:')),
    ).toBe(false);
  });
});
