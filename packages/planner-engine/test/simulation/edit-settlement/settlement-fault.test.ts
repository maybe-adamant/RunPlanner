import { afterEach, describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  hermesShrineDeliveryEntryKey,
  ProjectCommandContractError,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { settleCommandUnlessRefused } from '../../../src/simulation/edit-settlement';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import * as commands from '../../../src/authored-project/commands/dispatch';
import * as chronology from '../../../src/simulation/rewards/biome/chronology-accumulator';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);

describe('settlement repeat-repair guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stops at a repeated delivery repair and reports the fault instead of throwing', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
        'hermesShrineDelivery',
      ),
      hermesShrineDeliveryEntryKey(source, 'initial:secondLeft'),
    );
    const apply = commands.applyProjectCommand;
    // The due delivery's placement never takes effect, so its obligation stays due.
    vi.spyOn(commands, 'applyProjectCommand').mockImplementation((document, catalog, command) =>
      command.kind === 'PlaceHermesShrineDelivery' ? document : apply(document, catalog, command),
    );
    const command = {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondRight',
      value: { rewardType: 'MaxManaDrop' },
    } as const;
    const before = evaluate(project);
    const settled = settleProjectEdit({ catalog, before, command, evaluate });
    expect(settled.fault).toEqual({
      key: expect.stringMatching(/^delivery:/),
      owner: entry,
    });
    expect(settled.assembly.project).toEqual(apply(project, catalog, command));
    expect(settled.assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'hermesShrineDeliveryPlacementRequired', origin: entry }),
    );
  });

  it('throws a repair the command authority refuses after evaluation', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const apply = commands.applyProjectCommand;
    vi.spyOn(commands, 'applyProjectCommand').mockImplementation((document, catalog, command) => {
      if (command.kind === 'PlaceHermesShrineDelivery')
        throw new ProjectCommandContractError(command.kind, command.entry, 'refused repair');
      return apply(document, catalog, command);
    });
    const command = {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
      slotKey: 'secondRight',
      value: { rewardType: 'MaxManaDrop' },
    } as const;
    expect(() => settleCommandUnlessRefused(catalog, evaluate(project), command)).toThrow(
      'refused repair',
    );
  });

  it('reports a timed outcome whose reached branches land it at different encounters', () => {
    const outcome = createSteadyGrowthOutcomeAddress(
      createTraitOfferAddress(createIncomingRewardAddress(oBiome, oOccurrenceIds.combat07), 'self'),
      1,
    );
    const create = chronology.createChronologyAccumulator;
    vi.spyOn(chronology, 'createChronologyAccumulator').mockImplementation((rooms) => {
      const accumulator = create(rooms);
      return Object.freeze({
        ...accumulator,
        finish: () =>
          Object.freeze({ ...accumulator.finish(), divergentOutcomeLandings: [outcome] }),
      });
    });
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const command = {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
      slotKey: 'secondRight',
      value: { rewardType: 'MaxManaDrop' },
    } as const;
    const settled = settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });
    expect(settled.fault).toEqual({
      key: expect.stringMatching(/^divergentLanding:/),
      owner: outcome,
    });
    expect(
      settled.assembly.evaluation.findings.map((finding) => finding.origin),
    ).not.toContainEqual(outcome);
  });
});
