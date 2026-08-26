import type { Catalog } from '../catalog-schema';
import {
  createBiomeAddress,
  semanticAddressKey,
  type AcquisitionSiteAddress,
  type EncounterPhaseAddress,
  type KeepsakeEquipResultAddress,
  type LevelResolutionAddress,
  type NemesisRandomEventAddress,
  type TraitOfferAddress,
} from '../authored-project/addresses';
import type { CountedRewardBinding } from '../reward-kernel';
import type { ProjectDocument } from '../authored-project/model';
import { prefixAuthoredRooms } from './candidates/evaluated-biome';
import type { ProjectCandidateArtifacts } from './candidate-artifacts';
import type {
  EncounterPhaseCandidateSupport,
  EncounterPhaseSequenceStatus,
} from './encounters/preparation';
import type {
  FigLeafPhaseCandidateSupport,
  GorgonPhaseCandidateSupport,
  NemesisRandomEventCandidateSupport,
} from './rewards/model';
import {
  resolveCountedRewardTypeDomain,
  type CountedRewardOwnerAddress,
} from './rewards/authoring-domain';
import { occurrenceOwnerAddress } from './progressive/finding-location';
import type { CanonicalAuthoredRoom } from './materialization';
import type { ProjectEvaluation, ProjectEvaluationAssembly } from './evaluation-products';

const evaluationSourceProjects = new WeakMap<ProjectEvaluation, ProjectDocument>();

function recordProjectEvaluationSource(
  evaluation: ProjectEvaluation,
  project: ProjectDocument,
): void {
  evaluationSourceProjects.set(evaluation, project);
}
const exactProjectEvaluationAssemblyConstructionToken = Symbol(
  'exactProjectEvaluationAssemblyConstructionToken',
);
let exactProjectEvaluationAssemblyArtifacts:
  ((assembly: ProjectEvaluationAssembly) => ProjectCandidateArtifacts) | undefined;
let isExactProjectEvaluationAssembly:
  ((assembly: ProjectEvaluationAssembly) => boolean) | undefined;

class ExactProjectEvaluationAssembly implements ProjectEvaluationAssembly {
  readonly #candidateArtifacts: ProjectCandidateArtifacts;
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;

  constructor(
    project: ProjectDocument,
    evaluation: ProjectEvaluation,
    candidateArtifacts: ProjectCandidateArtifacts,
    constructionToken: typeof exactProjectEvaluationAssemblyConstructionToken,
  ) {
    if (constructionToken !== exactProjectEvaluationAssemblyConstructionToken) {
      throw new ProjectSimulationContractError(
        'exact project evaluation assemblies may only be constructed by project simulation',
      );
    }
    this.project = project;
    this.evaluation = evaluation;
    this.#candidateArtifacts = candidateArtifacts;
    Object.freeze(this);
  }

  static {
    exactProjectEvaluationAssemblyArtifacts = (
      assembly: ProjectEvaluationAssembly,
    ): ProjectCandidateArtifacts => {
      if (!(assembly instanceof ExactProjectEvaluationAssembly)) {
        throw new ProjectSimulationContractError(
          'prepared project evaluation assembly was not produced by this simulator execution',
        );
      }
      return assembly.#candidateArtifacts;
    };
    isExactProjectEvaluationAssembly = (assembly: ProjectEvaluationAssembly): boolean => {
      const candidateArtifacts = exactProjectEvaluationAssemblyArtifacts;
      if (candidateArtifacts === undefined) return false;
      try {
        candidateArtifacts(assembly);
        return true;
      } catch {
        return false;
      }
    };
  }
}

export class ProjectSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'ProjectSimulationContractError';
  }
}

export function createExactProjectEvaluationAssembly(
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: ProjectCandidateArtifacts,
): ProjectEvaluationAssembly {
  recordProjectEvaluationSource(evaluation, project);
  return new ExactProjectEvaluationAssembly(
    project,
    evaluation,
    candidateArtifacts,
    exactProjectEvaluationAssemblyConstructionToken,
  );
}

export function assertProjectEvaluationSource(
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
): void {
  if (evaluationSourceProjects.get(evaluation) !== project) {
    throw new ProjectSimulationContractError(
      'prepared project evaluation does not belong to the authored project identity',
    );
  }
}

function requireExactProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
): ProjectEvaluationAssembly {
  if (isExactProjectEvaluationAssembly?.(assembly) !== true) {
    throw new ProjectSimulationContractError(
      'prepared project evaluation assembly was not produced by this simulator execution',
    );
  }
  if (assembly.project === undefined || assembly.evaluation === undefined) {
    throw new ProjectSimulationContractError(
      'prepared project evaluation assembly was not produced by this simulator execution',
    );
  }
  assertProjectEvaluationSource(assembly.project, assembly.evaluation);
  return assembly;
}

export function assertProjectEvaluationAssembly(assembly: ProjectEvaluationAssembly): void {
  if (isExactProjectEvaluationAssembly?.(assembly) === true) return;
  // Application overlays intentionally preserve the authored/evaluation
  // identity while replacing only the public evaluation for contract tests.
  // Candidate artifacts remain exact-only; callers that need them still use
  // candidateArtifactsForProjectEvaluationAssembly.
  assertProjectEvaluationSource(assembly.project, assembly.evaluation);
}

/** Engine-internal capability access; the public assembly surface stays data-only. */
export function candidateArtifactsForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
): ProjectCandidateArtifacts {
  const candidateArtifacts = exactProjectEvaluationAssemblyArtifacts;
  if (candidateArtifacts === undefined) {
    throw new ProjectSimulationContractError('candidate artifact access is not initialized');
  }
  return candidateArtifacts(requireExactProjectEvaluationAssembly(assembly));
}

/** Narrow reachability query for one exact immediate-keepsake child. */
export function keepsakeEquipResultCandidateForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  address: KeepsakeEquipResultAddress,
) {
  return candidateArtifactsForProjectEvaluationAssembly(assembly).keepsakeEquipResults.at(address);
}

/** Narrow supported candidate capability for one reached Pom owner. */
export function levelResolutionCandidateForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  address: LevelResolutionAddress,
) {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(address.routeKey, address.biomeKey))
    ?.levelResolutions.at(address);
}

/** Narrow supported candidate capability for one reached trait-offer child. */
export function traitOfferCandidateForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  address: TraitOfferAddress,
) {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(address.routeKey, address.biomeKey))
    ?.traitOffers.at(address);
}

/** Exact Pool generation capability retained when progressive assessment clamps its reward view. */
export function purgingPoolCandidateForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  occurrence: import('../authored-project/addresses').OccurrenceAddress,
) {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(occurrence.routeKey, occurrence.biomeKey))
    ?.purgingPools.at(occurrence);
}

/** Exact Shrine entry-frontier capability retained by project evaluation. */
export function hermesShrineCandidateForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  occurrence: import('../authored-project/addresses').OccurrenceAddress,
) {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(occurrence.routeKey, occurrence.biomeKey))
    ?.hermesShrines.at(occurrence);
}

/** Exact Well entry-frontier capability retained by project evaluation. */
export function stygianWellCandidateForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  occurrence: import('../authored-project/addresses').OccurrenceAddress,
) {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(occurrence.routeKey, occurrence.biomeKey))
    ?.stygianWells.at(occurrence);
}

/**
 * Supported exact-assembly query for one encounter phase. Application
 * composition may ask whether a particular declared phase has an evaluated
 * candidate capability, but cannot traverse the artifact graph itself.
 */
export function encounterPhaseCandidateSupportForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  phase: EncounterPhaseAddress,
): EncounterPhaseCandidateSupport | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(phase.routeKey, phase.biomeKey))
    ?.encounters.at(phase);
}

/** Narrow Fig Leaf capability for one exact phase owner. */
export function encounterPhaseFigLeafSupportForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  phase: EncounterPhaseAddress,
): FigLeafPhaseCandidateSupport | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(phase.routeKey, phase.biomeKey))
    ?.encounters.figLeafAt(phase);
}

/** Narrow engine-published Gorgon reached/pending capability for one exact phase. */
export function encounterPhaseGorgonSupportForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  phase: EncounterPhaseAddress,
): GorgonPhaseCandidateSupport | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(phase.routeKey, phase.biomeKey))
    ?.encounters.gorgonAt(phase);
}

/** Exact branch-correlated candidate capability for one reached Nemesis event. */
export function nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  event: NemesisRandomEventAddress,
): NemesisRandomEventCandidateSupport | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(event.routeKey, event.biomeKey))
    ?.encounters.nemesisAt(event);
}

/**
 * Supported exact-assembly query for one structurally declared encounter
 * phase. Unlike candidate support, this preserves the distinction between an
 * evaluated dormant suffix and an owner with no preparation coverage.
 */
export function encounterPhaseSequenceStatusForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  phase: EncounterPhaseAddress,
): EncounterPhaseSequenceStatus | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(phase.routeKey, phase.biomeKey))
    ?.encounters.statusAt(phase);
}

/** Narrow exact-assembly query for derived entries at one reached acquisition site. */
export function derivedAcquisitionEntriesForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  site: AcquisitionSiteAddress,
) {
  return (
    candidateArtifactsForProjectEvaluationAssembly(assembly)
      .biomeAt(createBiomeAddress(site.routeKey, site.biomeKey))
      ?.derivedAcquisitionEntries.entriesAt(site) ?? Object.freeze([])
  ).map(({ address, capability }) => Object.freeze({ address, ...capability }));
}

/**
 * The exact blocked occurrence remains an authored repair surface even when
 * execution assessment stops inside one of its actions. Later occurrences in
 * the materialized plan remain hidden until their own execution frontier is
 * reached.
 */
export function blockedOccurrenceRoomForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  occurrence: import('../authored-project/addresses').OccurrenceAddress,
): CanonicalAuthoredRoom | undefined {
  const exact = requireExactProjectEvaluationAssembly(assembly);
  const biome = exact.evaluation.routes
    .find((route) => route.routeKey === occurrence.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === occurrence.biomeKey);
  if (
    biome?.coverage.kind !== 'prefix' ||
    biome.coverage.blockedAt === undefined ||
    !('materializedPrefix' in biome)
  ) {
    return undefined;
  }
  const blockedOccurrence = occurrenceOwnerAddress(biome.coverage.blockedAt);
  if (
    blockedOccurrence === undefined ||
    semanticAddressKey(blockedOccurrence) !== semanticAddressKey(occurrence)
  ) {
    return undefined;
  }
  return prefixAuthoredRooms(biome.materializedPrefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(occurrence),
  );
}

/** Exact-assembly entry point for one synchronous counted-reward authoring domain. */
export function countedRewardTypeDomain(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  owner: CountedRewardOwnerAddress,
  binding: CountedRewardBinding,
): readonly string[] {
  const candidateArtifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
  const evaluatedProducer = candidateArtifacts
    .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
    ?.rewardProducers.at(owner);
  return resolveCountedRewardTypeDomain(
    catalog,
    assembly.project,
    owner,
    binding,
    evaluatedProducer,
  );
}
