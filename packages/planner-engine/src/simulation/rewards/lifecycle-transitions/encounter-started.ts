import type { Catalog } from '../../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { HistoryEvent } from '../../history';
import type { CanonicalAuthoredRoom } from '../../materialization';
import { assessFigLeafSkip } from '../../encounters';
import { attestFigLeafBranchState, consumeFigLeafUse } from '../../keepsakes';
import { advanceRewardBranches } from '../processing';
import type { RewardBranchState } from '../branch-primitives';
import { ownerRegion } from '../../finding-regions';
import type { FigLeafPhaseCandidateSupport } from '../model';
import type { LifecycleFinding } from './types';

export interface EncounterStartedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly figLeafCandidates: readonly {
    readonly key: string;
    readonly candidate: FigLeafPhaseCandidateSupport;
  }[];
  readonly findings: readonly LifecycleFinding[];
}

/** Applies only the Fig Leaf half of encounter start. Gorgon stays with E4 settlement. */
export function applyEncounterStartedTransition(
  catalog: Catalog,
  snapshot: { readonly entryRoom?: { readonly origin: SemanticAddress } },
  event: Extract<HistoryEvent, { readonly kind: 'encounterStarted' }>,
  room: CanonicalAuthoredRoom | undefined,
  branches: readonly RewardBranchState[],
): EncounterStartedTransition {
  let next = branches;
  const findings: LifecycleFinding[] = [];
  const figLeafCandidates: {
    key: string;
    candidate: FigLeafPhaseCandidateSupport;
  }[] = [];
  if (room !== undefined) {
    const phase = room.encounterPhases.find((candidate) => candidate.slotKey === event.phaseKey);
    if (phase !== undefined) {
      const origin = createEncounterPhaseAddress(
        createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
        { kind: 'occurrence', occurrenceId: room.occurrenceId },
        event.phaseKey,
      );
      const isBiomeStart =
        snapshot.entryRoom !== undefined &&
        semanticAddressKey(snapshot.entryRoom.origin) === semanticAddressKey(event.origin);
      const blockedByEnvelope = room.encounterPhases.some((candidate) => candidate.blocksFigLeaf);
      const nonLeadingCascadePhase =
        phase.skipEndEncounterEffects === true &&
        room.encounterPhases[0]?.slotKey !== phase.slotKey;
      const figLeaf = attestFigLeafBranchState(next);
      const assessment = assessFigLeafSkip({
        selected: phase.figLeafSkip,
        canEncounterSkip: phase.canEncounterSkip,
        biomeStart: isBiomeStart,
        blockedByEnvelope,
        nonLeadingCascadePhase,
        remainingUses: figLeaf?.remainingUses ?? 0,
        activatedThisBiome: figLeaf?.activatedThisBiome ?? false,
        selectionAlreadyResolved: event.figLeafSkipOwner !== true,
      });
      if (phase.figLeafSkip === true && !assessment.legal) {
        findings.push(
          Object.freeze({
            finding: Object.freeze({
              code: 'figLeafSkipUnavailable',
              severity: 'error',
              phase: 'encounterResolution',
              origin,
              evidence: Object.freeze(
                assessment.reason === undefined ? {} : { reason: assessment.reason },
              ),
            }),
            region: ownerRegion(origin),
            chronology: Object.freeze({
              kind: 'history',
              sequence: event.sequence,
              boundary: 'at',
            }),
          }),
        );
      }
      if (
        phase.canEncounterSkip &&
        !isBiomeStart &&
        !blockedByEnvelope &&
        !nonLeadingCascadePhase &&
        figLeaf !== undefined
      ) {
        figLeafCandidates.push(
          Object.freeze({
            key: semanticAddressKey(origin),
            candidate: Object.freeze({
              origin,
              supported: figLeaf.remainingUses > 0 && !figLeaf.activatedThisBiome,
              selected: phase.figLeafSkip === true,
              remainingUses: figLeaf.remainingUses,
              activatedThisBiome: figLeaf.activatedThisBiome,
            }),
          }),
        );
      }
    }
  }
  if (event.figLeafSkipOwner) {
    attestFigLeafBranchState(next);
    next = Object.freeze(
      next.map((branch) =>
        Object.freeze({ ...branch, keepsakes: consumeFigLeafUse(branch.keepsakes) }),
      ),
    );
  }
  return Object.freeze({
    branches: advanceRewardBranches(next, event.sequence),
    figLeafCandidates: Object.freeze(figLeafCandidates),
    findings: Object.freeze(findings),
  });
}
