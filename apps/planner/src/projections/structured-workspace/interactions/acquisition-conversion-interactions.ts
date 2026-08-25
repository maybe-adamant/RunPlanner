import {
  seaStarDuplicateSiteKey,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  type AcquisitionDisposition,
} from '@run-planner/engine/authored-project';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';

import { derivedShopPayloadIntent } from './reward-child-command-binding';
import { workspaceInteractionKey } from '../contract';
import type { WorkspaceAcquisitionConversionInteraction, WorkspaceRewardControl } from '../contract';

/** Binds generated-pickup conversion controls and preserves retained Sea Star repair state. */
export function bindAcquisitionConversionInteractions(input: {
  readonly candidates: CandidateProjectionSession;
  readonly project: import('@run-planner/engine/simulation').ProjectEvaluationAssembly['project'];
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly evaluatedConversions: ReadonlyMap<
    string,
    ReturnType<CandidateProjectionSession['acquisitionConversion']>
  >;
}): ReadonlyMap<string, WorkspaceAcquisitionConversionInteraction> {
  const interactions = new Map<string, WorkspaceAcquisitionConversionInteraction>();
  for (const control of input.rewardControls.values()) {
    for (const conversion of control.conversions ?? []) {
      const key = workspaceInteractionKey(conversion.address);
      const evaluated =
        input.evaluatedConversions.get(key) ?? input.candidates.acquisitionConversion(conversion.address);
      const owner = conversion.address.owner;
      const occurrenceId =
        owner.kind === 'acquisitionEntry'
          ? owner.site.owner.kind === 'occurrence'
            ? owner.site.owner.occurrenceId
            : undefined
          : owner.kind === 'encounterPhase'
            ? owner.owner.occurrenceId
            : owner.kind === 'gorgonPhase'
              ? owner.encounter.owner.occurrenceId
              : owner.occurrenceId;
      const occurrence =
        occurrenceId === undefined
          ? undefined
          : input.project.routes
              .find((route) => route.routeKey === conversion.address.routeKey)
              ?.biomes.find((biome) => biome.biomeKey === conversion.address.biomeKey)
              ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
      const seaStarProcced =
        occurrence?.acquisitionSites?.[seaStarDuplicateSiteKey(conversion.address)]?.pickupEntries?.[
          SEA_STAR_DUPLICATE_ENTRY_KEY
        ] !== undefined;
      const support =
        evaluated.kind === 'acquisitionConversion'
          ? {
              timePieceSupported: evaluated.result.timePieceSupported,
              artificerSupported: evaluated.result.artificerSupported,
              seaStarSupported: evaluated.result.seaStarSupported,
              visible:
                evaluated.result.timePieceSupported ||
                evaluated.result.artificerSupported ||
                evaluated.result.seaStarSupported ||
                seaStarProcced ||
                conversion.value.kind !== 'normal',
            }
          : {
              timePieceSupported: false,
              artificerSupported: false,
              seaStarSupported: false,
              visible: seaStarProcced || conversion.value.kind !== 'normal',
            };
      interactions.set(
        key,
        Object.freeze({
          ...support,
          intentFor: (value: AcquisitionDisposition) =>
            derivedShopPayloadIntent(
              control.derivedShopEntryEdit,
              Object.freeze({
                kind: 'ReplaceAcquisitionDisposition' as const,
                acquisition: conversion.address,
                value,
              }),
            ),
          seaStarIntentFor: (procced: boolean) =>
            Object.freeze({
              command: Object.freeze({
                kind: 'ReplaceSeaStarResult' as const,
                acquisition: conversion.address,
                procced,
              }),
              focus: Object.freeze({ owner: conversion.address, timing: 'after' as const }),
            }),
          key,
          owner: conversion.address,
          seaStarProcced,
          value: conversion.value,
        }),
      );
    }
  }
  return interactions;
}
