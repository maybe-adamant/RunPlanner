import { describe, expect, it } from 'vitest';
import {
  createFieldsSpatialAddress,
  createOccurrenceAddress,
} from '@run-planner/engine/authored-project';
import {
  applyProjectCommand,
  assemble,
  catalog,
  createGoldenFGHIProject,
  createIncomingRewardAddress,
  createOccurrenceId,
  goldenHBiome,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  semanticAddressKey,
  goldenFOccurrenceId,
  goldenFStartId,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';
import { loadNemesisFieldsCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';

describe('structured workspace composer assembly', () => {
  it('does not need evaluation entry to preserve authored room-local controls', () => {
    const { assembly } = assemble(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      nOccurrenceId('combat05'),
    );
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));

    expect(assembly.node.room.entered).toBe(false);
    expect(
      assembly.node.room.rewardControls.some(
        (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(incoming),
      ),
    ).toBe(true);
  });

  it('returns immutable ordinary and fixed workbenches with their exact marker destinations', () => {
    const project = createGoldenFGHIProject();
    const fixed = assemble(project, 'Underworld', 'F', goldenFStartId);
    const ordinary = assemble(project, 'Underworld', 'F', goldenFOccurrenceId(1, 1));

    expect(fixed.assembly.node.room.occurrenceId).toBe(goldenFStartId);
    expect(ordinary.assembly.node.room.rewardControls).toHaveLength(1);
    expect(fixed.markers.destinations().get(fixed.assembly.node.marker.focusKey)?.nodeKey).toBe(
      fixed.assembly.node.key,
    );
    expect(
      ordinary.markers.destinations().get(ordinary.assembly.node.marker.focusKey)?.nodeKey,
    ).toBe(ordinary.assembly.node.key);
  });

  it('routes H Fields placement markers to Layout and keeps Timeline unchanged', () => {
    const project = createGoldenFGHIProject();
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const result = assemble(project, 'Underworld', 'H', occurrenceId);
    const room = result.assembly.node.room;
    if (room.roomLocal.kind !== 'fields') throw new Error('H Fields room is missing');
    for (const control of room.roomLocal.spatial) {
      expect(result.markers.destinations().get(control.marker.focusKey)).toMatchObject({
        focusAddress: control.address,
        nodeKey: result.assembly.node.key,
        roomTab: 'layout',
      });
    }
    const entry = room.roomLocal.spatial.find((control) => control.target.kind === 'entry');
    if (entry === undefined) throw new Error('H Fields entry placement is missing');
    const replacement = entry.pointChoices.find(
      (choice) => choice.value !== null && choice.value !== entry.pointId,
    );
    if (replacement?.value == null) throw new Error('H Fields alternate entry is missing');
    const edited = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(
        createOccurrenceAddress(goldenHBiome, occurrenceId),
        entry.target,
      ),
      pointId: replacement.value,
    });
    const editedRoom = assemble(edited, 'Underworld', 'H', occurrenceId).assembly.node.room;
    expect(editedRoom.roomActions?.timeline.entries).toEqual(room.roomActions?.timeline.entries);
    if (editedRoom.roomLocal.kind !== 'fields') throw new Error('edited H Fields room is missing');
    expect(
      editedRoom.roomLocal.spatial.find((control) => control.target.kind === 'entry')?.pointId,
    ).toBe(replacement.value);
  });

  it('publishes an active Nemesis placement on Layout and hides it when dormant', () => {
    const active = assemble(
      loadNemesisFieldsCheckpoint(),
      'Underworld',
      'H',
      createOccurrenceId('golden-h-combat05'),
    );
    const activeFields = active.assembly.node.room.roomLocal;
    if (activeFields.kind !== 'fields') throw new Error('active H Fields room is missing');
    const nemesis = activeFields.spatial.find((control) => control.target.kind === 'nemesis');
    expect(nemesis).toBeDefined();
    expect(nemesis?.pointChoices.map((choice) => choice.label)).toContain('Optional Point 1');
    expect(active.markers.destinations().get(nemesis!.marker.focusKey)).toMatchObject({
      roomTab: 'layout',
    });

    const dormant = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      createOccurrenceId('golden-h-combat05'),
    ).assembly.node.room.roomLocal;
    if (dormant.kind !== 'fields') throw new Error('dormant H Fields room is missing');
    expect(dormant.spatial.some((control) => control.target.kind === 'nemesis')).toBe(false);
  });

  it('publishes forced-missing Shrine inventory rows on the Overview for repair', () => {
    const checkpoint = loadSurfaceNOCheckpoint();
    const project = {
      ...checkpoint,
      route: {
        ...checkpoint.route,
        biomes: checkpoint.route.biomes.map((biome) =>
          biome.biomeKey !== 'N' || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((occurrence) => {
                    if (occurrence.occurrenceId !== 'surface-n-preboss:postboss') return occurrence;
                    const { hermesShrine: _removed, ...withoutShrine } = occurrence;
                    void _removed;
                    return withoutShrine;
                  }),
                },
              },
        ),
      },
    };
    const result = assemble(
      project,
      'Surface',
      'N',
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    const shrine = result.assembly.node.room.workbench.features.find(
      (feature) => feature.kind === 'hermesShrine',
    );
    if (shrine?.kind !== 'hermesShrine') throw new Error('forced Shrine feature is missing');
    expect(shrine.presence.kind).toBe('forcedPresent');
    expect(shrine.slots).toHaveLength(3);
    for (const slot of shrine.slots) {
      expect(slot.rewardType).toBeNull();
      expect(slot.candidateRewards.length).toBeGreaterThan(0);
      expect(result.markers.destinations().get(slot.marker.focusKey)).toMatchObject({
        focusAddress: slot.address,
        nodeKey: result.assembly.node.key,
        roomTab: 'overview',
      });
    }
  });
});
