import { describe, expect, it } from 'vitest';

import { candidateSupport } from '@planner/projections/candidates/candidateProjection';
import { bind } from '@planner-test/support/structured-workspace/interaction-binding.test-support';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import {
  createFreshFileFirstSequence,
  createMatureCombat01Sequence,
} from '@run-planner/test-fixtures/fresh-file';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

/** Traits each row of the one bound Apollo screen can hold. */
async function apolloRowDomains(project: ProjectDocument, routeKey: string) {
  const { interactions } = bind(project, routeKey, 'F');
  const interaction = [...interactions.traitOffers.values()].find(
    (candidate) => candidate.giver.key === 'Apollo',
  );
  if (interaction?.value?.kind !== 'traits') throw new Error('the Apollo screen is missing');
  const value = interaction.value;
  return Promise.all(
    (['option1', 'option2', 'option3'] as const).map(async (optionKey) => {
      const domain = await interaction.optionDomain(value, optionKey).load();
      return [
        ...new Set(
          domain.candidates
            .filter((candidate) => ['possible', 'forced'].includes(candidateSupport(candidate)))
            .map(({ value: option }) => option.traitKey),
        ),
      ];
    }),
  );
}

describe('first Apollo screen projection', () => {
  it('offers only the forced loot table on Fresh File', async () => {
    const rows = await apolloRowDomains(
      authorLegalTraitOffers(createFreshFileFirstSequence()),
      'FreshFile',
    );
    expect(rows).toEqual([['ApolloWeaponBoon'], ['ApolloSprintBoon'], ['ApolloManaBoon']]);
  });

  it('keeps the ordinary Apollo domain on a mature F_Combat01', async () => {
    const offered = (await apolloRowDomains(createMatureCombat01Sequence(), 'Underworld')).flat();
    expect(offered).toEqual(
      expect.arrayContaining(['ApolloSpecialBoon', 'ApolloCastBoon', 'ApolloRetaliateBoon']),
    );
  });
});
