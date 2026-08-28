import type { Catalog } from '../catalog-schema';
import {
  createExitDecisionAddress,
  createHubDecisionAddress,
  createLocalVisitDecisionAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type BiomeAddress,
  type ExitDecisionAddress,
  type HubDecisionAddress,
  type LocalVisitDecisionAddress,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import type {
  AuthoredBiomePlan,
  BiomeTopology,
  ExitDecision,
  HubDecision,
  LocalVisitDecision,
  OccurrenceId,
} from '../authored-project/model';
import {
  additionalExitsForDecision,
  exitDecisionForSource,
  selectedExitContinuation,
} from '../authored-project/topology/query';
import type { BiomeCompletenessResult } from './completeness';
import type { SemanticFinding } from './model';

export type OccurrenceOutgoingStatus =
  | {
      readonly kind: 'authoredDecision';
      readonly owner: ExitDecisionAddress;
    }
  | {
      readonly kind: 'frontier';
      readonly owner: ExitDecisionAddress;
      readonly capability: 'createBatch';
      readonly findings: readonly SemanticFinding[];
    }
  | {
      readonly kind: 'blockedOrUnentered';
      readonly owner: SemanticAddress;
      readonly findings: readonly SemanticFinding[];
      readonly reason: 'notCurrentFrontier' | 'unentered';
    }
  | {
      readonly kind: 'topologyOwned';
      readonly owner: HubDecisionAddress | LocalVisitDecisionAddress;
      readonly topology: 'hub' | 'localVisit';
    }
  | {
      readonly kind: 'terminal';
      readonly owner: OccurrenceAddress;
    }
  | {
      /** Fixed completion topology continuation; never an authored door decision. */
      readonly kind: 'fixedRoom';
      readonly owner: OccurrenceAddress;
      readonly target:
        | { readonly kind: 'fixedOccurrence'; readonly occurrenceId: OccurrenceId }
        | { readonly kind: 'nextBiomeIntro'; readonly biomeKey: string }
        | { readonly kind: 'routeBoundary' };
    };

export interface OccurrenceOutgoingStatusInput {
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  /** Exact authored route prefix; catalog adjacency must not reactivate a configured tail. */
  readonly configuredBiomeKeys: readonly string[];
  readonly completeness: BiomeCompletenessResult;
  readonly findings: readonly SemanticFinding[];
  readonly occurrenceId: OccurrenceId;
  readonly plan: AuthoredBiomePlan;
}

function exactFindings(
  findings: readonly SemanticFinding[],
  owner: SemanticAddress,
): readonly SemanticFinding[] {
  return Object.freeze(
    findings.filter((finding) => semanticAddressKey(finding.origin) === semanticAddressKey(owner)),
  );
}

function selectedSpineOccurrenceIds(topology: BiomeTopology): ReadonlySet<OccurrenceId> {
  const entered = new Set<OccurrenceId>([topology.startOccurrenceId]);
  let current = topology.startOccurrenceId;
  const traversed = new Set<OccurrenceId>();
  while (!traversed.has(current)) {
    traversed.add(current);
    const decision = exitDecisionForSource(topology, { kind: 'occurrence', occurrenceId: current });
    if (decision === undefined) break;
    const selected = selectedExitContinuation(
      decision,
      additionalExitsForDecision(topology, decision),
    );
    if (selected === undefined) break;
    current =
      selected.kind === 'normal' ? selected.target.occurrenceId : selected.exit.occurrenceId;
    entered.add(current);
  }
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      for (const slotKey of decision.visitOrder) {
        const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === slotKey);
        if (target !== undefined) entered.add(target.occurrenceId);
      }
    } else if (decision.kind === 'localVisit') {
      for (const occurrenceId of decision.visitOrder) entered.add(occurrenceId);
    } else if (decision.source.kind === 'hubDecision') {
      const selected = selectedExitContinuation(
        decision,
        additionalExitsForDecision(topology, decision),
      );
      if (selected !== undefined) {
        entered.add(
          selected.kind === 'normal' ? selected.target.occurrenceId : selected.exit.occurrenceId,
        );
      }
    }
  }
  return entered;
}

function authoredDecision(
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
): ExitDecision | undefined {
  return exitDecisionForSource(topology, { kind: 'occurrence', occurrenceId });
}

function localOwner(
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
): LocalVisitDecision | undefined {
  return topology.decisions.find(
    (decision): decision is LocalVisitDecision =>
      decision.kind === 'localVisit' &&
      (decision.sourceOccurrenceId === occurrenceId ||
        Object.values(decision.targetsBySlot).some(
          (target) => target.occurrenceId === occurrenceId,
        )),
  );
}

function hubOwner(topology: BiomeTopology, occurrenceId: OccurrenceId): HubDecision | undefined {
  return topology.decisions.find(
    (decision): decision is HubDecision =>
      decision.kind === 'hub' &&
      (decision.source.occurrenceId === occurrenceId ||
        decision.openTargets.some((target) => target.occurrenceId === occurrenceId)),
  );
}

/**
 * Closed occurrence-local outgoing status. Consumers never substitute the
 * biome-global frontier for this exact occurrence or infer Hub/local ownership
 * from presentation order.
 */
export function evaluateOccurrenceOutgoingStatus(
  input: OccurrenceOutgoingStatusInput,
): OccurrenceOutgoingStatus {
  const { biome, catalog, completeness, occurrenceId, plan } = input;
  const topology = plan.topology;
  const occurrenceOwner = createOccurrenceAddress(biome, occurrenceId);
  if (topology === null) {
    return Object.freeze({
      kind: 'blockedOrUnentered' as const,
      owner: occurrenceOwner,
      findings: exactFindings(input.findings, occurrenceOwner),
      reason: 'unentered' as const,
    });
  }
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence === undefined) {
    throw new Error(`${occurrenceId} is not an occurrence in ${plan.biomeKey}`);
  }

  const fixedLink = topology.fixedRoomLinks.find(
    (link) => link.sourceOccurrenceId === occurrenceId,
  );
  if (fixedLink !== undefined) {
    return Object.freeze({
      kind: 'fixedRoom' as const,
      owner: occurrenceOwner,
      target: Object.freeze({
        kind: 'fixedOccurrence' as const,
        occurrenceId: fixedLink.targetOccurrenceId,
      }),
    });
  }

  const decision = authoredDecision(topology, occurrenceId);
  if (decision !== undefined) {
    return Object.freeze({
      kind: 'authoredDecision' as const,
      owner: createExitDecisionAddress(biome, decision.source),
    });
  }

  const local = localOwner(topology, occurrenceId);
  if (local !== undefined) {
    return Object.freeze({
      kind: 'topologyOwned' as const,
      owner: createLocalVisitDecisionAddress(biome, local.sourceOccurrenceId, local.groupKey),
      topology: 'localVisit' as const,
    });
  }
  const hub = hubOwner(topology, occurrenceId);
  if (hub !== undefined) {
    return Object.freeze({
      kind: 'topologyOwned' as const,
      owner: createHubDecisionAddress(biome, hub.hubKey),
      topology: 'hub' as const,
    });
  }

  const entered = selectedSpineOccurrenceIds(topology).has(occurrenceId);
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (entered && (room?.kind === 'Boss' || room?.kind === 'PostBoss')) {
    const biomeIndex = input.configuredBiomeKeys.indexOf(biome.biomeKey);
    const nextBiomeKey = biomeIndex >= 0 ? input.configuredBiomeKeys[biomeIndex + 1] : undefined;
    return Object.freeze({
      kind: 'fixedRoom' as const,
      owner: occurrenceOwner,
      target:
        nextBiomeKey === undefined
          ? Object.freeze({ kind: 'routeBoundary' as const })
          : Object.freeze({ kind: 'nextBiomeIntro' as const, biomeKey: nextBiomeKey }),
    });
  }

  if (
    entered &&
    completeness.completion === 'incomplete' &&
    completeness.frontier.kind === 'exitDecision' &&
    completeness.frontier.source.kind === 'occurrence' &&
    completeness.frontier.source.occurrenceId === occurrenceId
  ) {
    return Object.freeze({
      kind: 'frontier' as const,
      owner: completeness.frontier,
      capability: 'createBatch' as const,
      findings: exactFindings(input.findings, completeness.frontier),
    });
  }

  return Object.freeze({
    kind: 'blockedOrUnentered' as const,
    owner: occurrenceOwner,
    findings: exactFindings(input.findings, occurrenceOwner),
    reason: entered ? ('notCurrentFrontier' as const) : ('unentered' as const),
  });
}
