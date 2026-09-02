import { catalog } from '@run-planner/hades2-catalog';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  createFigurineArcanaAddress,
  createJudgmentArcanaAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  deriveRouteLoadout,
  type ProjectDocument,
} from '../../../src/authored-project';

/** A compact deterministic route with reached bossDefeated automatic outcomes. */
export function bossAutomaticOutcomeProject(): ProjectDocument {
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: createRouteAddress('Underworld'),
    arcanaKeys: ['ChanneledCast'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'BossMetaUpgradeKeepsake',
  });
  const active = deriveRouteLoadout(catalog, project.route.loadout).activeArcanaKeys;
  const judgmentKeys = catalog.arcanaCards.values
    .filter((card) => !active.includes(card.key))
    .slice(0, 5)
    .map((card) => card.key);
  const figurineKeys = catalog.arcanaCards.values
    .filter((card) => !active.includes(card.key) && !judgmentKeys.includes(card.key))
    .slice(0, 2)
    .map((card) => card.key);
  const boss = createOccurrenceAddress(
    goldenFBiome,
    createOccurrenceId('golden-f-preboss-shop:boss'),
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: createJudgmentArcanaAddress(boss, 'Encounter'),
    arcanaKeys: judgmentKeys,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFigurineArcana',
    figurine: createFigurineArcanaAddress(boss, 'Encounter'),
    arcanaKeys: figurineKeys,
  });
  const gJudgmentKeys = catalog.arcanaCards.values
    .filter(
      (card) =>
        !active.includes(card.key) &&
        !judgmentKeys.includes(card.key) &&
        !figurineKeys.includes(card.key),
    )
    .slice(0, 5)
    .map((card) => card.key);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: createJudgmentArcanaAddress(
      createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-preboss-shop:boss')),
      'Encounter',
    ),
    arcanaKeys: gJudgmentKeys,
  });
}
