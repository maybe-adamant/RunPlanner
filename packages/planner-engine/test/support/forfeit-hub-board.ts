import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createRouteAddress,
  createStartingRewardAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { loadSurfaceNProject, nBiome, nOccurrenceIds } from '@run-planner/test-fixtures/surface';
import {
  authorLegalTraitOffers,
  collectTestRequiredItems,
} from '@run-planner/test-fixtures/shared';
import { withArcana } from './rerolls';

const settled = (project: ProjectDocument) =>
  collectTestRequiredItems(authorLegalTraitOffers(collectTestRequiredItems(project)));

function withIncomingReward(
  project: ProjectDocument,
  occurrenceId: string,
  value: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, occurrenceId as never),
    value,
  });
}

/**
 * Surface N under Forfeit with no Boon or Hermes before the Hub, so the board
 * draws while Forfeit is unspent: the opening gives a Hammer and PreHub a Hex.
 * Neither can then return, so the board's combat09 and combat03 carry Boons;
 * its first visit, combat05's Hermes, is the one Forfeit takes. DoorReroll is
 * held for board presses.
 */
export function surfaceNForfeitHubBoardProject(): ProjectDocument {
  let project = withArcana(loadSurfaceNProject(), ['DoorReroll']);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFearVowRank',
    route: createRouteAddress('Surface'),
    vowKey: 'BoonSkipShrineUpgrade',
    rank: 1,
  });
  project = settled(
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Surface'),
      value: { rewardType: 'WeaponUpgrade' },
    }),
  );
  project = settled(
    withIncomingReward(project, nOccurrenceIds.preHub, { rewardType: 'SpellDrop' }),
  );
  project = withIncomingReward(project, 'surface-n-combat09', {
    rewardType: 'Boon',
    payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
  });
  project = withIncomingReward(project, 'surface-n-combat03', {
    rewardType: 'Boon',
    payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
  });
  // A picked-up Boon can reach a later visit's offer, so authoring settles twice.
  return settled(settled(project));
}
