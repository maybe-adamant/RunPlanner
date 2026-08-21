import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  type ProjectDocument,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
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

/** Test-only assertion for fixture paths that intentionally require a trait outcome. */
export function requireTraits(offer: AuthoredTraitOffer): AuthoredTraitOfferTraits {
  if (offer.kind !== 'traits') throw new Error('fixture expected a trait outcome');
  return offer;
}

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
  readonly option: AuthoredTraitOfferTraits['options'][number];
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
      }) as AuthoredTraitOfferTraits['options'][number];
      const value = Object.freeze({
        kind: 'traits' as const,
        giverKey,
        options: Object.freeze([option, option, option]) as AuthoredTraitOfferTraits['options'],
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
        kind: 'traits' as const,
        giverKey,
        options: Object.freeze([
          first.option,
          remainder[left]!.option,
          remainder[right]!.option,
        ]) as AuthoredTraitOfferTraits['options'],
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
  for (let pass = 0; pass < 96; pass += 1) {
    const assembly = preparedCandidateProjectFor(current).assembly;
    const evaluation = assembly.evaluation;
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    const missing = evaluation.routes
      .flatMap((route) => route.findings)
      .find(
        (finding) => finding.code === 'traitOfferMissing' && finding.origin.kind === 'traitOffer',
      );
    if (missing !== undefined && missing.origin.kind === 'traitOffer') {
      let authored: ProjectDocument | undefined;
      for (const giver of catalog.traitGivers.values) {
        const draft = session.traitOfferStartingDraft(missing.origin, giver.key);
        if (draft === undefined) continue;
        try {
          authored = applyProjectCommand(current, catalog, {
            kind: 'ReplaceTraitOffer',
            trait: missing.origin,
            value: draft,
          });
          break;
        } catch {
          // The command is the authority for the one provider bound to this
          // generic fixture address; other candidate giver probes are ignored.
        }
      }
      if (authored === undefined)
        throw new Error(
          `trait fixture could not author the reached missing offer ${JSON.stringify(missing.origin)}`,
        );
      current = authored;
      continue;
    }
    const invalids = evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome
          ? biome.rewards.selectedTraitOffers.filter((offer) =>
              offer.branches.some(
                (branch) =>
                  branch.assessments.some((assessment) => !assessment.legal) ||
                  !branch.composition.legal ||
                  !branch.replacementComposition.legal ||
                  !branch.targetedAcquisition.legal,
              ),
            )
          : [],
      ),
    );
    let changed = false;
    for (const invalid of invalids) {
      const replacement = session.traitOfferStartingDraft(invalid.address, invalid.offer.giverKey);
      if (replacement === undefined) continue;
      current = applyProjectCommand(current, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: invalid.address,
        value: replacement,
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

/**
 * Re-author only reached Pom children after a fixture deliberately changes an
 * upstream equipped-trait history. This keeps focused product witnesses from
 * rebuilding unrelated trait offers.
 */
export function authorLegalPomResolutions(project: ProjectDocument): ProjectDocument {
  return prepareLegalPomTraitOffers(project).project;
}

/** One exact fixture preparation product for consumers that also need the reached offers. */
export function prepareLegalPomTraitOffers(project: ProjectDocument): {
  readonly project: ProjectDocument;
  readonly offers: readonly SelectedTraitOfferAssessment[];
} {
  let current = project;
  for (let pass = 0; pass < 32; pass += 1) {
    const assembly = preparedCandidateProjectFor(current).assembly;
    const normalized = normalizePomResolutions(current, assembly);
    if (normalized === current) {
      return Object.freeze({
        project: current,
        offers: Object.freeze(
          assembly.evaluation.routes.flatMap((route) =>
            route.biomes.flatMap((biome) =>
              'rewards' in biome ? biome.rewards.selectedTraitOffers : [],
            ),
          ),
        ),
      });
    }
    current = normalized;
  }
  throw new Error('Pom fixture normalization exceeded its bounded edit budget');
}
