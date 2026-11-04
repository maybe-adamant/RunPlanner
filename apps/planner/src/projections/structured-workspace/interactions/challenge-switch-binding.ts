import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  challengeSwitchEncounterSupportForProjectEvaluationAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';

import type { WorkspaceChallengeSwitchInteraction } from '../contracts/features';
import type { WorkspaceOccurrenceInteractionRequirement } from './interaction-requirements';
import { bindEncounterCustomizationInteraction } from './encounter-customization-binding';

type ChallengeSwitchRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'challengeSwitch' }
>;

/** A switch host's observation, elite pin and encounter customization commands. */
export function bindChallengeSwitchInteraction(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  requirement: ChallengeSwitchRequirement,
): WorkspaceChallengeSwitchInteraction {
  const { owner } = requirement;
  const customization = requirement.encounter?.customization;
  return Object.freeze({
    key: requirement.interactionKey,
    owner,
    observeIntentFor: (variantKey: string | null) =>
      Object.freeze({
        command: Object.freeze({
          kind: 'ReplaceChallengeSwitch' as const,
          occurrence: owner,
          variantKey,
        }),
      }),
    eliteIntentFor: (
      elite: { readonly enemyKey: string; readonly attributeKeys: readonly string[] } | null,
    ) =>
      Object.freeze({
        command: Object.freeze({
          kind: 'ReplaceChallengeSwitchElite' as const,
          occurrence: owner,
          elite:
            elite === null
              ? null
              : Object.freeze({ ...elite, attributeKeys: Object.freeze([...elite.attributeKeys]) }),
        }),
      }),
    ...(customization === undefined
      ? {}
      : {
          customization: bindEncounterCustomizationInteraction({
            catalog,
            key: requirement.interactionKey,
            owner: requirement.address,
            customization,
            encounterDefinitionKey: requirement.encounter?.definitionKey,
            generatedSupport: () => {
              try {
                return challengeSwitchEncounterSupportForProjectEvaluationAssembly(assembly, owner);
              } catch (error) {
                if (error instanceof Error && error.name === 'ProjectSimulationContractError')
                  return undefined;
                throw error;
              }
            },
            // A switch encounter has no infinite roster.
            rosterSupport: () => undefined,
            intentFor: (decisionKey, value) =>
              Object.freeze({
                command: Object.freeze({
                  kind: 'ReplaceChallengeSwitchCustomization' as const,
                  occurrence: owner,
                  decisionKey,
                  value,
                }),
              }),
          }),
        }),
  });
}
