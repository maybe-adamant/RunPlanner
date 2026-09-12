import type {
  WorkspaceChaosOfferDomain,
  WorkspaceChaosOfferInteraction,
  WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace/contracts/traits';
import { chaosOperandAuthoringValues } from '@run-planner/engine/authored-project';
import type { AuthoredChaosTraitOffer } from '@run-planner/engine/authored-project';
import type { Catalog, TraitRarity } from '@run-planner/engine/catalog-schema';
import type { CandidateProjectionSession } from '@planner/projections/candidates/candidateProjection';
import { projectDirectTraitOutcomePicker } from '@planner/projections/contextual/directTraitOutcomeProjection';

function chaosDomainFromCandidate(
  candidate: import('@run-planner/engine/simulation').ChaosOfferDomain,
  catalog: Catalog,
  value: AuthoredChaosTraitOffer,
): WorkspaceChaosOfferDomain {
  const evaluatedPickerCandidates = (
    keys: readonly string[],
    availableKeys: readonly string[],
    selectedKey: string,
  ) =>
    keys.map((key) => ({
      value: key,
      support: availableKeys.includes(key) ? ('possible' as const) : ('impossible' as const),
      branchSupport: Object.freeze([availableKeys.includes(key)]),
      selected: key === selectedKey,
      ...(availableKeys.includes(key) ? {} : { reason: 'unavailable' as const }),
    }));
  return Object.freeze({
    curseOptions: Object.freeze(
      candidate.curseOptions.map((option, index) =>
        Object.freeze({
          optionKey: option.optionKey,
          cursePicker: projectDirectTraitOutcomePicker(
            evaluatedPickerCandidates(
              option.curseKeys,
              option.availableCurseKeys,
              value.curseOptions[index]!.curseKey,
            ),
            (key) => catalog.chaos.curses.byKey[key]?.label ?? key,
            (key) => key,
          ),
          requirements: option.requirements,
        }),
      ),
    ) as WorkspaceChaosOfferDomain['curseOptions'],
    ...(candidate.selectedCurseKey === undefined
      ? {}
      : { selectedCurseKey: candidate.selectedCurseKey }),
    selectedCurseOperands: candidate.selectedCurseOperands,
    blessingPicker: projectDirectTraitOutcomePicker(
      evaluatedPickerCandidates(
        candidate.blessingKeys,
        candidate.availableBlessingKeys,
        value.blessingKey,
      ),
      (key) => catalog.chaos.blessings.byKey[key]?.label ?? key,
      (key) => key,
    ),
    rarities: candidate.rarities as readonly Exclude<TraitRarity, 'Duo'>[],
    blessingOperands: candidate.blessingOperands,
  });
}

/** Binds the complete Chaos offer envelope for one Chaos trait control. */
export function bindChaosOfferInteraction(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly control: WorkspaceTraitOfferControl;
}): WorkspaceChaosOfferInteraction | undefined {
  const { catalog, candidates, control } = input;
  if (control.giver.providerKind !== 'chaos') return undefined;
  const chaosDomainFor = (value: AuthoredChaosTraitOffer) => {
    const candidate = candidates.chaosOfferDomain(control.address, value)[0];
    return candidate === undefined
      ? undefined
      : chaosDomainFromCandidate(candidate, catalog, value);
  };
  const chaosStartingDraft = (): AuthoredChaosTraitOffer | undefined => {
    if (control.giver.providerKind !== 'chaos') return undefined;
    const candidate = candidates.chaosOfferDomain(control.address)[0];
    const firstBlessingKey = candidate?.blessingKeys[0];
    const firstOptions:
      readonly (AuthoredChaosTraitOffer['curseOptions'][number] | undefined)[] | undefined =
      candidate?.curseOptions.map((option) => {
        const curseKey = option.curseKeys[0];
        const requirement = curseKey === undefined ? undefined : option.requirements[curseKey];
        return curseKey === undefined || requirement === undefined
          ? undefined
          : Object.freeze({ curseKey, requirementCount: requirement.authoringDefault });
      });
    const selectedCurseKey = candidate?.selectedCurseKey;
    const rarity = candidate?.rarities[0] as AuthoredChaosTraitOffer['rarity'] | undefined;
    if (
      candidate === undefined ||
      firstBlessingKey === undefined ||
      rarity === undefined ||
      selectedCurseKey === undefined ||
      firstOptions === undefined ||
      firstOptions.some((option) => option === undefined)
    )
      return undefined;
    return Object.freeze({
      kind: 'chaos' as const,
      giverKey: 'Chaos' as const,
      curseOptions: Object.freeze(firstOptions) as AuthoredChaosTraitOffer['curseOptions'],
      selectedOptionKey: 'option1' as const,
      selectedCurseValues: chaosOperandAuthoringValues(candidate.selectedCurseOperands),
      blessingKey: firstBlessingKey,
      rarity,
      blessingValues: chaosOperandAuthoringValues(
        candidate.blessingOperands[firstBlessingKey] ?? [],
        rarity,
      ),
    });
  };

  return Object.freeze({
    blessingLabel: (blessingKey: string) =>
      catalog.chaos.blessings.byKey[blessingKey]?.label ?? blessingKey,
    curseLabel: (curseKey: string) => catalog.chaos.curses.byKey[curseKey]?.label ?? curseKey,
    domainFor: chaosDomainFor,
    startingDraft: chaosStartingDraft,
  });
}
