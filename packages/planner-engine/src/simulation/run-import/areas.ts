import type { SemanticAddress } from '../../authored-project';
import type { SemanticFinding } from '../model';
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
    const feature = String((origin as { readonly featureKey?: unknown }).featureKey ?? '');
    if (/well/i.test(feature)) return 'well';
    if (/pool|sell/i.test(feature)) return 'pool';
    if (/anvil/i.test(feature)) return 'anvil';
    if (/star/i.test(feature)) return 'pathOfStars';
    return 'shop';
  }
  return areaByOriginKind[origin.kind] ?? 'other';
}
