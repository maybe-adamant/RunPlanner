import {
  applyProjectCommand,
  roomActionKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { catalog } from '@run-planner/hades2-catalog';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

/**
 * Places a room press through its Rerolls list, then sets its unset result to
 * the first reward its row's picker offers other than `avoid`.
 */
export async function pressWithPickedResult(
  project: ProjectDocument,
  interactionKey: string,
  targetKey: string,
  avoid?: ResolvedRewardOffer | null,
): Promise<ProjectDocument> {
  const list = (document: ProjectDocument) =>
    projectStructuredWorkspaceFixture(document).workspace.interactions.roomRerolls.get(
      interactionKey,
    )!;
  const { command } = list(project).pressIntent(targetKey)!;
  if (command.kind !== 'InsertReroll') throw new Error('expected a room press');
  const placed = applyProjectCommand(project, catalog, command);
  const occurrence = placed.route.biomes
    .find((biome) => biome.biomeKey === command.occurrence.biomeKey)!
    .topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === command.occurrence.occurrenceId,
    )!;
  const rowKey = roomActionKey(occurrence.roomActions.order[command.index]!);
  const interaction = list(placed);
  const resolver = interaction.rowReward(rowKey);
  const reward = resolver
    .model(await resolver.load(), 'type')
    .sections.flatMap((section) => section.items)
    .filter((item) => !item.disabled)
    .map((item) => item.value as ResolvedRewardOffer)
    .find((offer) => JSON.stringify(offer) !== JSON.stringify(avoid))!;
  return applyProjectCommand(
    placed,
    catalog,
    interaction.replaceRewardIntent(rowKey, reward).command,
  );
}
