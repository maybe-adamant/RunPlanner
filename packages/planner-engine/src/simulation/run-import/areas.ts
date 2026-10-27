import type { SemanticAddress } from '../../authored-project';
import { isRequiredMissingInputFinding, type SemanticFinding } from '../model';
import type { RunImportArea } from './report';

const areaByOriginKind: Readonly<Partial<Record<SemanticAddress['kind'], RunImportArea>>> = {
  route: 'loadout',
  startingReward: 'reward',
  incomingReward: 'reward',
  localReward: 'reward',
  acquisitionEntry: 'reward',
  biome: 'route',
  biomeField: 'route',
  target: 'doors',
  exitDecision: 'doors',
  exitSelection: 'route',
  batchRewardStore: 'doors',
  hubDecision: 'hub',
  hubOpenSet: 'hub',
  hubSlot: 'hub',
  hubVisit: 'hub',
  hubRoom: 'hub',
  localVisitSlot: 'hub',
  localVisitOrder: 'hub',
  hubFountain: 'fountain',
  fountainRarityOutcome: 'fountain',
  traitOffer: 'traitOffer',
  acquisitionRole: 'traitOffer',
  levelResolution: 'traitOffer',
  encounterPhase: 'encounter',
  shopOffer: 'shop',
  rewardWheel: 'wheel',
  rewardWheelOffer: 'wheel',
  fieldsSpatial: 'fields',
  steadyGrowthOutcome: 'traitOffer',
  transcendentEmbryoOutcome: 'embryo',
  additionalExit: 'chaosGate',
  roomAction: 'roomActionOrder',
  nemesisRandomEvent: 'npc',
  figurineArcana: 'other',
  judgmentArcana: 'other',
};

/** The record area a blocking finding belongs to, for the import report. */
export function areaOfFinding(finding: SemanticFinding): RunImportArea {
  const origin = finding.origin;
  if (finding.code === 'roomActionPlacementRequired') return 'roomActionOrder';
  if (finding.code.startsWith('nemesis')) return 'npc';
  if (origin.kind === 'keepsakeSelection')
    return origin.owner === 'routeStart' ? 'loadout' : 'rack';
  if (origin.kind === 'keepsakeEquipResult')
    return 'owner' in origin.selection && origin.selection.owner === 'routeStart'
      ? 'loadout'
      : 'rack';
  if (origin.kind === 'exitDecision' && finding.code === 'batchStateMissing') return 'fields';
  if (finding.code.startsWith('hexActivation')) return 'pathOfStars';
  if (
    origin.kind === 'localReward' &&
    (origin.groupKey === 'cages' || origin.groupKey === 'optionalRewards')
  )
    return 'fields';
  if (origin.kind === 'roomFeature') {
    const target = origin.target.kind;
    if (target.startsWith('stygianWell')) return 'well';
    if (target.startsWith('purgingPool')) return 'pool';
    if (target.startsWith('hermesShrine')) return 'shop';
    if (target === 'fieldsOptionalRewardCount') return 'fields';
    return 'other';
  }
  if (finding.evidence['pickupEffect'] === 'anvilOfFates') return 'anvil';
  return areaByOriginKind[origin.kind] ?? 'other';
}

/** Missing input, and a Pom whose level-up its default authoring leaves unresolved. */
export function isQuestionFinding(finding: SemanticFinding): boolean {
  return (
    finding.code === 'missingPomTarget' ||
    finding.code === 'pomWrongOfferCount' ||
    isRequiredMissingInputFinding(finding)
  );
}
