import { afterEach, describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  hermesShrineDeliveryEntryKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import * as commands from '../../../src/authored-project/commands/dispatch';

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
});
