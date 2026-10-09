import type { Catalog, TraitSelectedDisposition } from '../../../catalog-schema';
import {
  createHexTreeAddress,
  type HexTreeAddress,
  type TraitOfferAddress,
} from '../../../authored-project/addresses';
import type { HexTalentTreeViolation } from '../../../authored-project/traits/hex-talent-tree';
import { assessAuthoredHexTree } from '../../../authored-project/traits/hex-tree';
import type { AuthoredTraitOfferTraits } from '../../../authored-project/traits/state';
import { ownerRegion, type FindingChronology } from '../../finding-regions';
import { bankPathPoints, installHexTree } from '../../hex-progress';
import type { SemanticFinding } from '../../model';
import type { ReachedTraitOfferEvaluation } from '../../traits';
import type { RewardBranchState } from '../branch-primitives';
import type { TraitChildFindingEntry } from './selected-child-settlement';

/** One finding on the tree naming the nodes of its tree-wide violations. */
export function hexTreeFindings(
  owner: HexTreeAddress['owner'],
  spellTraitKey: string,
  violations: readonly HexTalentTreeViolation[],
  lifecyclePoint: string,
): readonly SemanticFinding[] {
  if (violations.length === 0) return Object.freeze([]);
  const nodeKeys = [...new Set(violations.flatMap((violation) => violation.nodeKeys))];
  return Object.freeze([
    Object.freeze({
      code: 'hexTalentTreeUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: createHexTreeAddress(owner),
      evidence: Object.freeze({
        lifecyclePoint,
        traitKey: spellTraitKey,
        nodeKeys: Object.freeze(nodeKeys),
        violations: Object.freeze(
          violations.map((violation) =>
            Object.freeze({
              kind: violation.kind,
              nodeKeys: Object.freeze([...violation.nodeKeys]),
              ...(violation.kind === 'repeatedTalent' ? { talentKey: violation.talentKey } : {}),
            }),
          ),
        ),
      }),
    }),
  ]);
}

/** Installs the selected Spell Drop's realised tree and preserves its settled evidence. */
export function settleSelectedHexTree(
  catalog: Catalog,
  branch: RewardBranchState,
  offer: AuthoredTraitOfferTraits,
  selectedTraitKey: string | undefined,
  evaluation: ReachedTraitOfferEvaluation,
  frozenAcquisition: boolean,
  finding: {
    readonly traitAddress: TraitOfferAddress | undefined;
    readonly lifecyclePoint: string;
    readonly sequence: number;
    readonly chronology?: FindingChronology;
  },
): { readonly branch: RewardBranchState; readonly findings: readonly TraitChildFindingEntry[] } {
  if (
    offer.giverKey !== 'SpellDrop' ||
    selectedTraitKey === undefined ||
    offer.hexTree === undefined
  )
    return { branch, findings: [] };
  const findings =
    finding.traitAddress === undefined || frozenAcquisition
      ? []
      : hexTreeFindings(
          finding.traitAddress,
          selectedTraitKey,
          assessAuthoredHexTree(catalog, selectedTraitKey, offer.hexTree),
          finding.lifecyclePoint,
        ).map((entry): TraitChildFindingEntry =>
          Object.freeze({
            finding: entry,
            atomicRegion: ownerRegion(finding.traitAddress!),
            chronology:
              finding.chronology ??
              Object.freeze({ kind: 'history', sequence: finding.sequence, boundary: 'at' }),
          }),
        );
  const settled = installHexTree(catalog, branch, selectedTraitKey, offer.hexTree);
  if (frozenAcquisition) return { branch: settled, findings };
  const progress = settled.state.hexProgress;
  const godSent =
    progress.godSentAdded === true ? catalog.hexes.byKey[selectedTraitKey]?.godSent : undefined;
  if (
    progress.spellTraitKey !== selectedTraitKey ||
    progress.tree?.layoutKey !== offer.hexTree.layoutKey ||
    (progress.godSentAdded === true && godSent === undefined)
  )
    throw new Error('settled SpellDrop Hex evidence is incomplete');
  const settledHexTree = Object.freeze({
    spellTraitKey: selectedTraitKey,
    layoutKey: offer.hexTree.layoutKey,
    nodes: progress.tree.nodes,
    ...(godSent === undefined
      ? {}
      : {
          godSent: Object.freeze({
            olympianTalentKey: godSent.olympianTalentKey,
            lineageTalentKey: godSent.lineageTalentKey,
          }),
        }),
  });
  return {
    branch: Object.freeze({
      ...settled,
      traitEvaluations: Object.freeze([
        ...(settled.traitEvaluations ?? []).slice(0, -1),
        Object.freeze({ ...evaluation, settledHexTree }),
      ]),
    }),
    findings,
  };
}

export function settleMoonBeamPathPoints(
  catalog: Catalog,
  branch: RewardBranchState,
  selectedDisposition: TraitSelectedDisposition | undefined,
  currentKeepsakeKey: string | null,
): RewardBranchState {
  return selectedDisposition?.kind === 'advanceCurrentKeepsake' &&
    currentKeepsakeKey !== null &&
    catalog.keepsakes.byKey[currentKeepsakeKey]?.effect?.kind === 'moonBeam'
    ? bankPathPoints(branch, 2)
    : branch;
}
