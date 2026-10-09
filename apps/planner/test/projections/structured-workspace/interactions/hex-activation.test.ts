import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  semanticAddressKey,
  type AcquisitionRoleAddress,
  type AuthoredRoomState,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  loadSurfaceOrdinaryHexPathCheckpoint,
  loadSurfaceSeleneHexPathCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';

import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import {
  bindHexActivationInteraction,
  condensedTalents,
} from '@planner/projections/structured-workspace/interactions/hex-activation';

/** A room's reward, where its state carries one. */
function roomReward(state: AuthoredRoomState | undefined) {
  return state !== undefined && 'reward' in state ? state.reward : null;
}

/** Every Path screen role whose reward carries a selection, in route order. */
function pathScreens(project: ProjectDocument): readonly AcquisitionRoleAddress[] {
  return project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
      Object.keys(roomReward(occurrence.state)?.hexActivationsByAcquisitionRole ?? {}).map((role) =>
        createAcquisitionRoleAddress(
          createIncomingRewardAddress(
            createBiomeAddress('Surface', biome.biomeKey),
            occurrence.occurrenceId,
          ),
          role,
        ),
      ),
    ),
  );
}

function workspaceScreen(project: ProjectDocument, address: AcquisitionRoleAddress | undefined) {
  const { workspace } = projectStructuredWorkspaceFixture(project);
  const bound =
    address === undefined
      ? undefined
      : workspace.interactions.acquisitionConversions.get(semanticAddressKey(address))
          ?.hexActivation;
  if (bound === undefined) throw new Error('Path screen is not bound');
  return bound;
}

function seleneScreens() {
  const project = loadSurfaceSeleneHexPathCheckpoint();
  const [spellDrop, talentDrop] = pathScreens(project);
  return {
    spellDrop: workspaceScreen(project, spellDrop),
    talentDrop: workspaceScreen(project, talentDrop),
  };
}

describe('Path of Stars screen interaction', () => {
  it('binds both Selene screens with their saved selections and talent summaries', () => {
    const { spellDrop, talentDrop } = seleneScreens();
    expect(spellDrop).toMatchObject({
      contextReached: true,
      launcher: { label: 'Edit Path of Stars' },
      selectedNodeKeys: ['1:2', '1:4', '2:2'],
    });
    expect(talentDrop.selectedNodeKeys).toEqual(['2:4', '3:1', '3:2']);
    expect(talentDrop.launcher.detail).toBeDefined();
    expect(condensedTalents(['Omen', 'Brilliance', 'Omen', 'Sting', 'Sting'])).toBe(
      'Omen ×2, Brilliance, Sting ×2',
    );
    expect(talentDrop.intentFor(['2:4'])).toMatchObject({
      command: { kind: 'ReplaceHexActivation', value: { selectedNodeKeys: ['2:4'] } },
    });
  });

  it('projects earlier investments, the spent budget and removal-only selected nodes', () => {
    const { talentDrop } = seleneScreens();
    const board = talentDrop.boardFor(talentDrop.selectedNodeKeys!)!;
    const state = (key: string) => board.nodes.find((node) => node.nodeKey === key);
    expect(board.pointsLabel).toBe('3 of 3 points');
    expect(board.issues).toEqual([]);
    for (const key of ['1:2', '1:4', '2:2'])
      expect(state(key)).toMatchObject({ state: 'invested' });
    expect(state('1:2')?.toggled).toBeUndefined();
    expect(state('3:1')).toMatchObject({ state: 'selected', toggled: ['2:4', '3:2'] });
    // A spent screen adds nothing more; every other node is inert.
    expect(board.nodes.filter((node) => node.state === 'available')).toEqual([]);
    expect(
      board.nodes.filter((node) => node.state === 'unavailable' && node.toggled !== undefined),
    ).toEqual([]);
  });

  it('reports an under-spent draft and a selection cut off from the tree', () => {
    const { talentDrop } = seleneScreens();
    const fewer = talentDrop.boardFor(['2:4', '3:1'])!;
    expect(fewer.pointsLabel).toBe('2 of 3 points');
    expect(fewer.issues.map(([key]) => key)).toEqual(['selectionCount']);
    const added = fewer.nodes.find((node) => node.state === 'available');
    expect(added?.toggled).toEqual(['2:4', '3:1', added?.nodeKey]);

    // Removing a node its dependant hangs from is allowed and reported on the dependant.
    const deeper = fewer.nodes.find(
      (node) => node.state === 'available' && node.nodeKey.startsWith('4:'),
    );
    if (deeper === undefined) throw new Error('3:1 opens no depth-4 node');
    const withDeeper = talentDrop.boardFor(deeper.toggled!)!;
    const parent = withDeeper.nodes.find((node) => node.nodeKey === '3:1')!;
    expect(parent.state).toBe('selected');
    const cut = talentDrop.boardFor(parent.toggled!)!;
    expect(cut.nodes.filter((node) => node.conflict).map((node) => node.state)).toEqual([
      'selected',
    ]);
    expect(cut.issues.map(([key]) => key)).toEqual(['unreachable', 'selectionCount']);
  });

  it('keeps every saved conflicting node removable or reported', () => {
    const { talentDrop } = seleneScreens();
    const reinvested = talentDrop.boardFor(['1:2', '2:4', '3:1'])!;
    expect(reinvested.nodes.find((node) => node.nodeKey === '1:2')).toMatchObject({
      state: 'selected',
      conflict: true,
      toggled: ['2:4', '3:1'],
    });
    expect(reinvested.issues.map(([key]) => key)).toEqual(['alreadyInvested']);

    // Nodes off the board, an unknown key or a God Sent node not yet added, are cleared whole.
    const ordinary = loadSurfaceOrdinaryHexPathCheckpoint();
    const screen = workspaceScreen(ordinary, pathScreens(ordinary)[0]);
    const layout = catalog.hexes.byKey['SpellPolymorphTrait']!.layouts.byKey['Lung']!;
    const olympian = layout.nodes.values.find((node) => node.kind === 'olympianSpell')!.key;
    const offBoard = screen.boardFor(['1:2', '9:9', olympian])!;
    expect(offBoard.nodes.map((node) => node.nodeKey)).not.toContain(olympian);
    expect(offBoard.nodes.map((node) => node.nodeKey)).not.toContain('9:9');
    expect(offBoard.issues.map(([key]) => key)).toEqual(['unknownNode', 'absentNode']);
  });

  it('binds a screen the engine has not reached only while the reward holds a selection', () => {
    const address = createAcquisitionRoleAddress(
      createIncomingRewardAddress(createBiomeAddress('Surface', 'P'), 'unreached' as never),
      'self',
    );
    const unreached = { catalog, address, capability: undefined };
    const lost = bindHexActivationInteraction({
      ...unreached,
      value: { selectedNodeKeys: ['1:2'] },
    });
    expect(lost).toMatchObject({ contextReached: false, selectedNodeKeys: ['1:2'] });
    expect(lost?.boardFor(['1:2'])).toBeUndefined();
    expect(bindHexActivationInteraction({ ...unreached, value: undefined })).toBeUndefined();
  });
});
