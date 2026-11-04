import {
  orderedPrefixUseDomains,
  type AuthoredEncounterCustomization,
  type AuthoredGeneratedEncounterCustomization,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  encounterCompositionView,
  type GeneratedEncounterCandidateCapability,
  type InfiniteRosterCandidateCapability,
} from '@run-planner/engine/simulation';

import type {
  WorkspaceEncounterCustomizationDecision,
  WorkspaceEncounterCustomizationInteraction,
} from '../contracts/locals';
import {
  projectEncounterComposition,
  projectGeneratedEncounterAssessment,
  projectGeneratedEncounterHighlightPicker,
  projectGeneratedEncounterWaveDraft,
  projectGeneratedFangsDraft,
} from './generated-encounter-projection';
import { bindGeneratedEncounterEdits } from './generated-encounter-edits';
import { projectInfiniteRosterDraft } from './infinite-roster-projection';

/**
 * One encounter's customization decisions bound to the command that saves
 * them, assessed through the encounter's exact generation and roster support.
 */
export function bindEncounterCustomizationInteraction(input: {
  readonly catalog: Catalog;
  readonly key: string;
  readonly owner: WorkspaceEncounterCustomizationInteraction['owner'];
  readonly customization: readonly WorkspaceEncounterCustomizationDecision[];
  readonly encounterDefinitionKey: string | undefined;
  readonly generatedSupport: () => GeneratedEncounterCandidateCapability | undefined;
  readonly rosterSupport: () => InfiniteRosterCandidateCapability | undefined;
  readonly intentFor: WorkspaceEncounterCustomizationInteraction['intentFor'];
}): WorkspaceEncounterCustomizationInteraction {
  const { catalog, customization, encounterDefinitionKey, intentFor, key, owner } = input;
  const generatedDecision = customization.find(
    (decision) => decision.selection.kind === 'generated',
  );
  const generatedSelection =
    generatedDecision?.selection.kind === 'generated' ? generatedDecision.selection : undefined;
  const generatedCapability =
    generatedDecision === undefined ? undefined : input.generatedSupport();
  const generatedBound =
    generatedDecision === undefined ||
    generatedSelection === undefined ||
    generatedCapability?.decisionKey !== generatedDecision.key
      ? undefined
      : { capability: generatedCapability, selection: generatedSelection };
  const generatedLabels =
    generatedSelection === undefined
      ? []
      : [
          ...generatedSelection.choices,
          ...generatedSelection.fixedEnemies,
          ...(generatedDecision?.retainedChoiceLabels ?? []),
        ];
  const introductionLabel = (encounterKey: string) =>
    catalog.encounterDefinitions.byKey[encounterKey]?.label ?? encounterKey;
  // Every generated product follows one value: the saved one, or a dialog draft.
  const generatedProductsFor = (decisions: readonly WorkspaceEncounterCustomizationDecision[]) => {
    const decision = decisions.find((entry) => entry.selection.kind === 'generated');
    const generatedValue: AuthoredGeneratedEncounterCustomization =
      decision?.value?.kind === 'generated' ? decision.value : { kind: 'generated' };
    const engineAssessment = generatedBound?.capability.assess(generatedValue);
    const assessment =
      engineAssessment === undefined
        ? undefined
        : projectGeneratedEncounterAssessment(
            engineAssessment,
            generatedLabels,
            introductionLabel,
            generatedValue,
          );
    const compositionView =
      decision === undefined
        ? undefined
        : encounterCompositionView(
            catalog,
            {
              ...(encounterDefinitionKey === undefined
                ? {}
                : { selectedEncounterDefinitionKey: encounterDefinitionKey }),
              customization: decisions,
            },
            engineAssessment,
          );
    const composition =
      compositionView === undefined ? undefined : projectEncounterComposition(compositionView);
    if (generatedBound === undefined || engineAssessment === undefined)
      return { generatedValue, assessment, composition };
    const { capability, selection } = generatedBound;
    const { fangs: _fangs, ...withoutFangs } = generatedValue;
    void _fangs;
    return {
      generatedValue,
      assessment,
      composition,
      highlightPicker: projectGeneratedEncounterHighlightPicker(
        engineAssessment,
        generatedValue.highlightKey,
        generatedLabels,
        selection.choices.map((choice) => choice.key),
        introductionLabel,
      ),
      waveDraftFor: (
        waveIndex: number,
        confirmedSeedCount: number,
        typeKeys: readonly string[],
      ) => {
        const waves = [
          ...(generatedValue.waves?.filter((wave) => wave.waveIndex !== waveIndex) ?? []),
          Object.freeze({ waveIndex, typeKeys: Object.freeze([...typeKeys]) }),
        ].sort((left, right) => left.waveIndex - right.waveIndex);
        return projectGeneratedEncounterWaveDraft(
          capability.assess(Object.freeze({ ...generatedValue, waves: Object.freeze(waves) })),
          waveIndex,
          confirmedSeedCount,
          typeKeys,
          generatedLabels,
          introductionLabel,
        );
      },
      fangsDraftFor: (
        fangs: { readonly typeKey: string; readonly perkKeys: readonly string[] } | undefined,
      ) =>
        projectGeneratedFangsDraft(
          capability.assess(
            Object.freeze({
              ...withoutFangs,
              ...(fangs === undefined ? {} : { fangs }),
            }),
          ),
          fangs,
          generatedLabels,
          selection.fangs?.perks ?? {},
        ),
    };
  };
  const savedGenerated = generatedProductsFor(customization);
  const rosterDecision = customization.find(
    (decision) => decision.selection.kind === 'infiniteRoster',
  );
  const rosterCapability = rosterDecision === undefined ? undefined : input.rosterSupport();
  const rosterBound =
    rosterDecision?.selection.kind === 'infiniteRoster' &&
    rosterCapability?.decisionKey === rosterDecision.key
      ? { capability: rosterCapability, choices: rosterDecision.selection.choices }
      : undefined;
  const declaredDecisions =
    encounterDefinitionKey === undefined
      ? undefined
      : catalog.encounterDefinitions.byKey[encounterDefinitionKey]?.customization;
  // A drafted value differs from the saved one; its use domains follow the draft.
  const draftDecision = (
    decision: (typeof customization)[number],
    value: AuthoredEncounterCustomization | undefined,
  ): (typeof customization)[number] => {
    if (JSON.stringify(value) === JSON.stringify(decision.value)) return decision;
    const { value: _saved, ...rest } = decision;
    void _saved;
    // Draft values are chosen from the published domains, except retained ordered-prefix uses.
    const valueSupported =
      value?.kind !== 'orderedPrefix' ||
      value.choiceKeys.every((key) =>
        decision.selection.kind === 'orderedPrefix'
          ? decision.selection.choices.some((choice) => choice.key === key)
          : false,
      );
    if (decision.selection.kind !== 'orderedPrefix')
      return Object.freeze({
        ...rest,
        valueSupported,
        ...(value === undefined ? {} : { value }),
      } as (typeof customization)[number]);
    const onRouteKeys = decision.selection.choices.map((choice) => choice.key);
    const declared = declaredDecisions?.find((entry) => entry.key === decision.key);
    const uses =
      declared?.selection.kind === 'orderedPrefix'
        ? orderedPrefixUseDomains(
            {
              ...declared,
              selection: {
                ...declared.selection,
                choices: declared.selection.choices.filter((choice) =>
                  onRouteKeys.includes(choice.key),
                ),
              },
            },
            value,
          )
        : undefined;
    return Object.freeze({
      ...rest,
      valueSupported,
      ...(value === undefined ? {} : { value }),
      selection: Object.freeze({
        ...decision.selection,
        uses: uses ?? decision.selection.uses,
      }),
    } as (typeof customization)[number]);
  };
  return Object.freeze({
    key,
    owner,
    ...(rosterBound === undefined
      ? {}
      : {
          infiniteRosterDraftFor: (typeKeys: readonly string[]) =>
            projectInfiniteRosterDraft(
              rosterBound.capability.assess(typeKeys),
              typeKeys,
              rosterBound.choices,
            ),
        }),
    intentFor,
    ...(savedGenerated.assessment === undefined
      ? {}
      : { generatedAssessment: savedGenerated.assessment }),
    ...(savedGenerated.composition === undefined
      ? {}
      : { generatedComposition: savedGenerated.composition }),
    ...(generatedCapability === undefined
      ? {}
      : { initializeGenerated: generatedCapability.initialize }),
    draftFor: (values: Readonly<Record<string, AuthoredEncounterCustomization | undefined>>) => {
      const decisions = Object.freeze(
        customization.map((decision) => draftDecision(decision, values[decision.key])),
      );
      const generated = decisions.every((decision, index) => decision === customization[index])
        ? savedGenerated
        : generatedProductsFor(decisions);
      const roster = rosterDecision === undefined ? undefined : values[rosterDecision.key];
      return Object.freeze({
        decisions,
        ...(generated.assessment === undefined
          ? {}
          : {
              generatedAssessment: generated.assessment,
              generatedEdits: bindGeneratedEncounterEdits(
                generated.generatedValue,
                generated.assessment,
              ),
            }),
        ...(generated.composition === undefined
          ? {}
          : { generatedComposition: generated.composition }),
        ...(generated.highlightPicker === undefined
          ? {}
          : { generatedHighlightPicker: generated.highlightPicker }),
        ...(generated.waveDraftFor === undefined
          ? {}
          : { generatedWaveDraftFor: generated.waveDraftFor }),
        ...(generated.fangsDraftFor === undefined
          ? {}
          : { generatedFangsDraftFor: generated.fangsDraftFor }),
        ...(rosterBound === undefined || roster?.kind !== 'infiniteRoster'
          ? {}
          : {
              infiniteRosterSupported: rosterBound.capability.assess(roster.typeKeys).supported,
            }),
      });
    },
  });
}
