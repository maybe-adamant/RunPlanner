import { describe, expect, it } from 'vitest';
import {
  assemble,
  catalog,
  createGoldenFGHIProject,
  createOccurrenceId,
  loadSurfaceNOPQProject,
  nOccurrenceId,
  oOccurrenceIds,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';
import { occurrenceInteractionRequirements } from './occurrence-interaction-requirements';

describe('occurrence interaction requirements', () => {
  it('publishes active Ship phase-count interaction requirements', () => {
    const assembly = assemble(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      oOccurrenceIds.combat07,
    ).assembly;

    expect(assembly.occurrenceInteractionRequirements).toContainEqual(
      expect.objectContaining({ kind: 'shipCombatPhaseCount' }),
    );
  });

  it('owns encounter, room-action, and Shop participation requirements', () => {
    const encounter = assemble(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      nOccurrenceId('combat05'),
    ).assembly;
    const shop = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      createOccurrenceId('golden-f-preboss-shop'),
    ).assembly;

    expect(encounter.occurrenceInteractionRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'encounterPhases' })]),
    );
    expect(shop.occurrenceInteractionRequirements).toContainEqual(
      expect.objectContaining({ kind: 'roomActions' }),
    );
    expect(
      shop.occurrenceInteractionRequirements.filter(
        (requirement) => requirement.kind === 'shopPurchaseParticipation',
      ),
    ).toHaveLength(3);
  });

  it('owns Well, Pool, Shrine, and resource requirement rows', () => {
    const postboss = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    ).assembly.node.room;
    const featureKinds = occurrenceInteractionRequirements(catalog, postboss).map(
      (requirement) => requirement.kind,
    );

    expect(featureKinds).toEqual(expect.arrayContaining(['stygianWell', 'purgingPoolInteraction']));

    const withShrineAndResource = {
      ...postboss,
      resources: [
        {
          family: 'Fishing' as const,
          label: 'Successful Fishing — Water',
          action: 'add' as const,
          interactionKey: 'resource:Fishing',
          legal: true,
        },
      ],
      workbench: {
        ...postboss.workbench,
        features: [
          ...postboss.workbench.features,
          {
            kind: 'hermesShrine' as const,
            assessment: 'unassessed' as const,
            presence: { kind: 'optionalPresent' as const },
            slots: [],
          },
        ],
      },
    };
    expect(
      occurrenceInteractionRequirements(catalog, withShrineAndResource).map(
        (requirement) => requirement.kind,
      ),
    ).toEqual(expect.arrayContaining(['hermesShrine', 'resourcePlacements']));
  });

  it('does not bind presence mutation for a disabled absent Well', () => {
    const postboss = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    ).assembly.node.room;
    const well = postboss.workbench.features.find((feature) => feature.kind === 'stygianWell');
    if (well?.kind !== 'stygianWell') throw new Error('Postboss Well is missing');

    const requirements = occurrenceInteractionRequirements(catalog, {
      ...postboss,
      workbench: {
        ...postboss.workbench,
        features: postboss.workbench.features.map((feature) =>
          feature === well
            ? { ...feature, presence: { kind: 'optionalAbsent' as const, enabled: false } }
            : feature,
        ),
      },
    });
    const requirement = requirements.find((candidate) => candidate.kind === 'stygianWell');
    expect(requirement).toBeDefined();
    expect(requirement).not.toHaveProperty('presenceInteractionKey');
  });
});
