import {
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createTargetAddress,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type ExitDecision,
  type ExitDecisionAddress,
  type HubDecision,
  type HubDecisionAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type TargetAddress,
} from '@run-planner/engine/authored-project';

export interface ExpectedWorkspaceOccurrenceOwner {
  readonly address: OccurrenceAddress;
  readonly detail: string;
  readonly gameName: string;
  readonly occurrenceId: OccurrenceId;
}

export interface ExpectedWorkspaceExitDecisionOwner {
  readonly address: ExitDecisionAddress;
  readonly decision: ExitDecision;
}

export interface ExpectedWorkspaceTargetOwner {
  readonly address: TargetAddress;
  readonly decisionAddress: ExitDecisionAddress;
  readonly exitKey: string;
  readonly occurrenceId: OccurrenceId;
  readonly sourceKind: 'batch' | 'linked';
}

export interface ExpectedWorkspaceHubDecisionOwner {
  readonly address: HubDecisionAddress;
  readonly decision: HubDecision;
}

export interface ExpectedWorkspaceHubSlotOwner {
  readonly address: ReturnType<typeof createHubSlotAddress>;
  readonly hubAddress: HubDecisionAddress;
  readonly hubSlotKey: string;
  readonly occurrenceId: OccurrenceId;
}

export interface ExpectedWorkspaceHubVisitOwner {
  readonly address: ReturnType<typeof createHubVisitAddress>;
  readonly hubAddress: HubDecisionAddress;
  readonly hubSlotKey: string;
  readonly visitIndex: number;
}

export interface ExpectedWorkspaceTopologyManifest {
  readonly exitDecisions: readonly ExpectedWorkspaceExitDecisionOwner[];
  readonly hubDecisions: readonly ExpectedWorkspaceHubDecisionOwner[];
  readonly hubSlots: readonly ExpectedWorkspaceHubSlotOwner[];
  readonly hubVisits: readonly ExpectedWorkspaceHubVisitOwner[];
  readonly occurrences: readonly ExpectedWorkspaceOccurrenceOwner[];
  readonly targets: readonly ExpectedWorkspaceTargetOwner[];
}

/**
 * Derive semantic owners from persisted authored structure only. Orphan
 * occurrence records are codec/core concerns and intentionally do not become
 * expected workspace owners.
 */
export function expectedWorkspaceTopologyManifest(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
): ExpectedWorkspaceTopologyManifest {
  const topology = plan.topology;
  if (topology === null) {
    return Object.freeze({
      exitDecisions: Object.freeze([]),
      hubDecisions: Object.freeze([]),
      hubSlots: Object.freeze([]),
      hubVisits: Object.freeze([]),
      occurrences: Object.freeze([]),
      targets: Object.freeze([]),
    });
  }

  const occurrenceRecords = new Map<OccurrenceId, (typeof topology.occurrences)[number]>();
  for (const occurrence of topology.occurrences) {
    if (occurrenceRecords.has(occurrence.occurrenceId)) {
      throw new Error(`${plan.biomeKey} occurrence ${occurrence.occurrenceId} is duplicated`);
    }
    occurrenceRecords.set(occurrence.occurrenceId, occurrence);
  }

  const occurrences = new Map<OccurrenceId, ExpectedWorkspaceOccurrenceOwner>();
  const ownOccurrence = (occurrenceId: OccurrenceId, detail: string): void => {
    const occurrence = occurrenceRecords.get(occurrenceId);
    if (occurrence === undefined) {
      throw new Error(`${detail} references missing occurrence ${occurrenceId}`);
    }
    if (occurrences.has(occurrenceId)) {
      throw new Error(`${detail} gives occurrence ${occurrenceId} multiple structural owners`);
    }
    occurrences.set(
      occurrenceId,
      Object.freeze({
        address: createOccurrenceAddress(biome, occurrenceId),
        detail,
        gameName: occurrence.gameName,
        occurrenceId,
      }),
    );
  };

  const exitDecisions: ExpectedWorkspaceExitDecisionOwner[] = [];
  const hubDecisions: ExpectedWorkspaceHubDecisionOwner[] = [];
  const hubSlots: ExpectedWorkspaceHubSlotOwner[] = [];
  const hubVisits: ExpectedWorkspaceHubVisitOwner[] = [];
  const targets: ExpectedWorkspaceTargetOwner[] = [];

  ownOccurrence(topology.startOccurrenceId, `${plan.biomeKey} start`);
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      const hubAddress = createHubDecisionAddress(biome, decision.hubKey);
      hubDecisions.push(Object.freeze({ address: hubAddress, decision }));
      for (const target of decision.openTargets) {
        ownOccurrence(
          target.occurrenceId,
          `${plan.biomeKey} Hub ${decision.hubKey} slot ${target.hubSlotKey}`,
        );
        hubSlots.push(
          Object.freeze({
            address: createHubSlotAddress(biome, decision.hubKey, target.hubSlotKey),
            hubAddress,
            hubSlotKey: target.hubSlotKey,
            occurrenceId: target.occurrenceId,
          }),
        );
      }
      for (const [index, hubSlotKey] of decision.visitOrder.entries()) {
        hubVisits.push(
          Object.freeze({
            address: createHubVisitAddress(biome, decision.hubKey, index + 1),
            hubAddress,
            hubSlotKey,
            visitIndex: index + 1,
          }),
        );
      }
      continue;
    }

    const decisionAddress = createExitDecisionAddress(biome, decision.source);
    exitDecisions.push(Object.freeze({ address: decisionAddress, decision }));
    if (decision.normal.kind === 'linked') {
      ownOccurrence(
        decision.normal.occurrenceId,
        `${plan.biomeKey} linked target ${decision.normal.exitKey}`,
      );
      targets.push(
        Object.freeze({
          address: createTargetAddress(biome, decision.source, decision.normal.exitKey),
          decisionAddress,
          exitKey: decision.normal.exitKey,
          occurrenceId: decision.normal.occurrenceId,
          sourceKind: 'linked',
        }),
      );
      continue;
    }
    for (const target of decision.normal.targets) {
      ownOccurrence(target.occurrenceId, `${plan.biomeKey} target ${target.exitKey}`);
      targets.push(
        Object.freeze({
          address: createTargetAddress(biome, decision.source, target.exitKey),
          decisionAddress,
          exitKey: target.exitKey,
          occurrenceId: target.occurrenceId,
          sourceKind: 'batch',
        }),
      );
    }
  }

  return Object.freeze({
    exitDecisions: Object.freeze(exitDecisions),
    hubDecisions: Object.freeze(hubDecisions),
    hubSlots: Object.freeze(hubSlots),
    hubVisits: Object.freeze(hubVisits),
    occurrences: Object.freeze([...occurrences.values()]),
    targets: Object.freeze(targets),
  });
}
