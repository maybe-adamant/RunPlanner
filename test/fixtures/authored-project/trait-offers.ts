import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  type ProjectDocument,
  type AuthoredTraitOffer,
  type AuthoredLevelResolution,
} from '@run-planner/engine/authored-project';
import {
  simulateProjectAssembly,
  createPreparedProjectCandidateSession,
  levelResolutionCandidateForProjectEvaluationAssembly,
  type TraitAssessment,
  type SelectedTraitOfferAssessment,
} from '@run-planner/engine/simulation';

export type TraitCandidateSession = ReturnType<typeof createPreparedProjectCandidateSession>;

interface PreparedTraitCandidateProject {
  readonly assembly: ReturnType<typeof simulateProjectAssembly>;
  readonly session: TraitCandidateSession;
}

const preparedCandidateProjects = new WeakMap<ProjectDocument, PreparedTraitCandidateProject>();

function preparedCandidateProjectFor(project: ProjectDocument): PreparedTraitCandidateProject {
  const existing = preparedCandidateProjects.get(project);
  if (existing !== undefined) return existing;
  const assembly = simulateProjectAssembly(catalog, project);
  const prepared = Object.freeze({
    assembly,
    session: createPreparedProjectCandidateSession(catalog, assembly),
  });
  preparedCandidateProjects.set(project, prepared);
  return prepared;
}

function candidateSessionFor(project: ProjectDocument): TraitCandidateSession {
  return preparedCandidateProjectFor(project).session;
}

export function reachedTraitOffers(
  project: ProjectDocument,
): readonly SelectedTraitOfferAssessment[] {
  const evaluation = preparedCandidateProjectFor(project).assembly.evaluation;
  return Object.freeze(
    evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome ? biome.rewards.selectedTraitOffers : [],
      ),
    ),
  );
}

/** Return the prepared exact-address candidate surface for one immutable project. */
export function traitCandidateSession(project: ProjectDocument): TraitCandidateSession {
  return candidateSessionFor(project);
}

export interface TraitCandidateProbe {
  readonly option: AuthoredTraitOffer['options'][number];
  readonly assessment: TraitAssessment;
}

export interface TraitCandidateProbeOptions {
  readonly session?: TraitCandidateSession;
}

export function traitCandidateOptions(
  project: ProjectDocument,
  address: SelectedTraitOfferAssessment['address'],
  giverKey: string,
  options: TraitCandidateProbeOptions = {},
): readonly TraitCandidateProbe[] {
  const session = options.session ?? candidateSessionFor(project);
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) return Object.freeze([]);
  const result: TraitCandidateProbe[] = [];
  for (const traitKey of giver.traitKeys) {
    const trait = catalog.traits.byKey[traitKey];
    if (trait === undefined) continue;
    const rarities =
      trait.rarityDomain.kind === 'ranked' ? trait.rarityDomain.freshOfferRarities : [undefined];
    for (const rarity of rarities) {
      const option = Object.freeze({
        traitKey,
        ...(rarity === undefined ? {} : { rarity }),
      }) as AuthoredTraitOffer['options'][number];
      const value = Object.freeze({
        giverKey,
        options: Object.freeze([option, option, option]) as AuthoredTraitOffer['options'],
        selectedOptionKey: 'option1' as const,
      });
      const evaluation = session.evaluate({ kind: 'traitOffer', trait: address, value });
      if (evaluation.kind !== 'traitOffer') continue;
      const assessments = evaluation.result.branches.flatMap((branch) => branch.assessments);
      const assessment = assessments.find((candidate) => candidate.legal);
      if (assessment === undefined) continue;
      result.push(Object.freeze({ option, assessment }));
      break;
    }
  }
  return Object.freeze(result);
}

/**
 * Find one complete, supported three-option offer through the exact candidate
 * session. The preferred trait, when supplied, is placed in option 1 so the
 * returned value can be used as a concrete acquisition in a fixture.
 */
export function supportedTraitOffer(
  project: ProjectDocument,
  address: SelectedTraitOfferAssessment['address'],
  giverKey: string,
  preferredTraitKey?: string,
  session: TraitCandidateSession = candidateSessionFor(project),
): AuthoredTraitOffer | undefined {
  const probes = traitCandidateOptions(project, address, giverKey, { session });
  const unique = probes.filter(
    (candidate, index, all) =>
      all.findIndex((other) => other.option.traitKey === candidate.option.traitKey) === index,
  );
  const preferred =
    preferredTraitKey === undefined
      ? undefined
      : unique.find((candidate) => candidate.option.traitKey === preferredTraitKey);
  if (preferredTraitKey !== undefined && preferred === undefined) return undefined;
  const ordered = [
    ...(preferred === undefined ? [] : [preferred]),
    ...unique.filter((candidate) => candidate !== preferred),
  ];
  const first = preferred ?? ordered[0];
  if (first === undefined) return undefined;
  const remainder = ordered.filter((candidate) => candidate !== first);
  for (let left = 0; left < remainder.length; left += 1) {
    for (let right = left + 1; right < remainder.length; right += 1) {
      const value = Object.freeze({
        giverKey,
        options: Object.freeze([
          first.option,
          remainder[left]!.option,
          remainder[right]!.option,
        ]) as AuthoredTraitOffer['options'],
        selectedOptionKey: 'option1' as const,
      });
      const evaluation = session.evaluate({ kind: 'traitOffer', trait: address, value });
      if (evaluation.kind === 'traitOffer' && evaluation.result.supported) return value;
    }
  }
  return undefined;
}

/**
 * Test fixtures use the engine's candidate authority to author legal defaults
 * for every reached trait offer. This keeps unrelated route/workspace fixtures
 * valid while exercising the same three-option command and legality contract
 * as an editor user.
 */
export function authorLegalTraitOffers(project: ProjectDocument): ProjectDocument {
  let current = project;
  for (let pass = 0; pass < 32; pass += 1) {
    const assembly = simulateProjectAssembly(catalog, current);
    const evaluation = assembly.evaluation;
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    const invalids = evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome
          ? biome.rewards.selectedTraitOffers.filter((offer) =>
              offer.branches.some((branch) =>
                branch.assessments.some((assessment) => !assessment.legal),
              ),
            )
          : [],
      ),
    );
    let changed = false;
    for (const invalid of invalids) {
      const giver = catalog.traitGivers.byKey[invalid.offer.giverKey];
      if (giver === undefined) continue;
      const probes = traitCandidateOptions(current, invalid.address, invalid.offer.giverKey, {
        session,
      });
      const candidates = [
        ...probes
          .filter((candidate) => candidate.assessment.replacementTransition === undefined)
          .map((candidate) => candidate.option),
        ...probes
          .filter((candidate) => candidate.assessment.replacementTransition !== undefined)
          .map((candidate) => candidate.option),
      ];
      const unique = candidates.filter(
        (candidate, index, all) =>
          all.findIndex((other) => other.traitKey === candidate.traitKey) === index,
      );
      if (unique.length < 3) continue;
      const replacement = Object.freeze([
        unique[0]!,
        unique[1]!,
        unique[2]!,
      ]) as AuthoredTraitOffer['options'];
      current = applyProjectCommand(current, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: invalid.address,
        value: Object.freeze({
          giverKey: invalid.offer.giverKey,
          options: replacement,
          selectedOptionKey: 'option1',
        }),
      });
      changed = true;
    }
    // Once an offer changes, its later Pom context must be rebuilt on the
    // next pass. Otherwise the same immutable assembly is also the exact
    // source for every reached Pom capability below.
    if (changed) continue;
    const normalizedPoms = normalizePomResolutions(current, assembly);
    if (normalizedPoms === current) return current;
    current = normalizedPoms;
  }
  throw new Error('trait fixture normalization exceeded its bounded edit budget');
}

/**
 * Fixtures enumerate only the opaque engine-owned Pom capability. They never
 * duplicate the target predicate or choice-cardinality rule.
 */
function normalizePomResolutions(
  project: ProjectDocument,
  assembly: ReturnType<typeof simulateProjectAssembly>,
): ProjectDocument {
  const resolutions = assembly.evaluation.routes.flatMap((route) =>
    route.biomes.flatMap((biome) =>
      'rewards' in biome ? biome.rewards.selectedLevelResolutions : [],
    ),
  );
  let current = project;
  for (const resolution of resolutions) {
    if (!resolution.branches.some((branch) => branch.findings.length > 0)) continue;
    const capability = levelResolutionCandidateForProjectEvaluationAssembly(
      assembly,
      resolution.address,
    );
    if (capability === undefined) continue;
    for (const [branchIndex, branch] of capability.branches.entries()) {
      const targetKeys = branch.eligibleTargetTraitKeys;
      const offeredTraitKeys = targetKeys.slice(0, branch.requiredOfferCount);
      for (const targetTraitKey of branch.effectKind === 'choice' ? offeredTraitKeys : targetKeys) {
        const value: AuthoredLevelResolution =
          branch.effectKind === 'random'
            ? Object.freeze({ kind: 'random', targetTraitKey })
            : Object.freeze({
                kind: 'choice',
                offeredTraitKeys: Object.freeze(offeredTraitKeys),
                selectedTraitKey: targetTraitKey,
              });
        if (capability.evaluate(value)[branchIndex]?.supported !== true) continue;
        current = applyProjectCommand(current, catalog, {
          kind: 'ReplaceLevelResolution',
          levelResolution: resolution.address,
          value,
        });
        break;
      }
      if (current !== project) break;
    }
  }
  return current;
}
