import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredTraitOfferTraits,
  BatchRewardStoreAddress,
  IncomingRewardAddress,
  LocalRewardAddress,
  ProjectCommand,
  ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { authorLegalTraitOffers } from '../shared';
import type { AuthoredProjectCheckpointId } from './manifest';

/**
 * The command list that holds each golden checkpoint at a settled reward-store
 * ledger under the run-scoped controller. The checkpoints are byte-attested
 * saves, not builder output, so they are repaired the way a user's save is:
 * load, apply the commands the support rules force, re-encode. This module is
 * the audit trail — every re-pin is one entry below, in the order a forward pass
 * surfaces it (simulate, take the first store finding, repair, re-simulate).
 *
 * `AuthorLegalTraitOffers` is the ordinary fixture trait-authoring helper, not a
 * command: a store re-pin can invalidate the trait offer behind that door, and
 * the helper re-authors it through `ReplaceTraitOffer` exactly as the workbench
 * would.
 */
export type RewardStoreRepairStep = ProjectCommand | { readonly kind: 'AuthorLegalTraitOffers' };

const underworldG = 'Underworld' as const;

function batchStore(
  biomeKey: string,
  occurrenceId: string,
  routeKey: string = underworldG,
): BatchRewardStoreAddress {
  return createBatchRewardStoreAddress(createBiomeAddress(routeKey, biomeKey), {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId(occurrenceId),
  });
}

function incoming(
  biomeKey: string,
  occurrenceId: string,
  routeKey: string = underworldG,
): IncomingRewardAddress {
  return createIncomingRewardAddress(
    createBiomeAddress(routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
  );
}

function local(
  biomeKey: string,
  occurrenceId: string,
  groupKey: string,
  slotKey: string,
  routeKey: string = underworldG,
): LocalRewardAddress {
  return createLocalRewardAddress(
    createBiomeAddress(routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
    groupKey,
    slotKey,
  );
}

function boon(source: string): ResolvedRewardOffer {
  return Object.freeze({
    rewardType: 'Boon',
    payload: Object.freeze({ kind: 'BoonSource' as const, source }),
  });
}

function drop(rewardType: string): ResolvedRewardOffer {
  return Object.freeze({ rewardType });
}

type TraitSpec = readonly [string, 'Common' | 'Rare' | 'Epic' | 'Heroic'];

function traits(
  giverKey: string,
  [first, second, third]: readonly [TraitSpec, TraitSpec, TraitSpec],
  selectedOptionKey: 'option1' | 'option2' | 'option3' = 'option1',
): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze([
      Object.freeze({ traitKey: first[0], rarity: first[1] }),
      Object.freeze({ traitKey: second[0], rarity: second[1] }),
      Object.freeze({ traitKey: third[0], rarity: third[1] }),
    ] as const),
    selectedOptionKey,
    rarificationActions: Object.freeze([]),
  });
}

/**
 * The Underworld G prefix every F/G checkpoint shares. F's now-counted entries
 * saturate the run-wide ratio high (12 entered / 3 meta, selection 1.35), so G's
 * opening batch can only be MetaProgress, and the Boon behind it — a game
 * impossible pick the old per-biome window hid — becomes a Meta-bag drop.
 */
const goldenGPrefix: readonly RewardStoreRepairStep[] = Object.freeze([
  // 1. Saturated high (12/3, selection 1.35): RunProgress is unsupported.
  {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: batchStore('G', 'golden-g-intro'),
    storeKey: 'MetaProgress',
  },
  // 2. Consequence of 1: the Meta bag carries no Boon.
  {
    kind: 'ReplaceIncomingReward',
    reward: incoming('G', 'golden-g-b1-e1'),
    value: drop('MetaCurrencyBigDrop'),
  },
  // 3. The b3 RunProgress bag is spent, so the owning b2 batch re-pins instead.
  //    Carrying the Boon through an earlier Run-bag door is topology-infeasible:
  //    G_Story01's reward is fixed and the b2 tier is a Meta bag.
  {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: batchStore('G', 'golden-g-b2-e1'),
    storeKey: 'MetaProgress',
  },
  // 4-5. Consequence of 3: both b3 rewards move into the Meta bag.
  {
    kind: 'ReplaceIncomingReward',
    reward: incoming('G', 'golden-g-b3-e2'),
    value: drop('MetaCardPointsCommonBigDrop'),
  },
  {
    kind: 'ReplaceIncomingReward',
    reward: incoming('G', 'golden-g-b3-e3'),
    value: drop('MetaCurrencyBigDrop'),
  },
  // 6. Consequence of 3: the ledger is now saturated low (15/6, selection -0.15).
  {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: batchStore('G', 'golden-g-b3-e1'),
    storeKey: 'RunProgress',
  },
  // 7. Consequence of 6: back into the Run bag.
  {
    kind: 'ReplaceIncomingReward',
    reward: incoming('G', 'golden-g-b4-e1'),
    value: drop('MaxManaDrop'),
  },
  // 8. b7-e1 keeps its Hestia Boon — the route's Boon character is load-bearing
  //    for ~40 dependent tests — but the Hestia pick that moved into the Meta
  //    bag at step 2 leaves its old options ungeneratable, so the offer is
  //    re-authored. Pinned rather than left to the fixture helper so every
  //    F/G checkpoint and every builder that derives from one agree exactly.
  {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(incoming('G', 'golden-g-b7-e1'), 'source'),
    value: traits('Hestia', [
      ['HestiaWeaponBoon', 'Rare'],
      ['HestiaSprintBoon', 'Common'],
      ['CastProjectileBoon', 'Common'],
    ]),
  },
  // 9. The G boss door is now an authored decision. The Preboss inherits no
  //    store, and the run-wide ledger supports RunProgress.
  {
    kind: 'ReplaceBossDoorRewardStore',
    rewardStore: batchStore('G', 'golden-g-preboss-shop'),
    storeKey: 'RunProgress',
  },
]);

/**
 * H's own rooms, reached once G's boss door resolves. The G Boon that moved into
 * the Meta bag was a Hestia pick, so H's Hestia miniboss offer no longer has a
 * supported generation and its three Fields cages fall out of the Run bag.
 */
const goldenHSuffix: readonly RewardStoreRepairStep[] = Object.freeze([
  {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(incoming('H', 'golden-h-miniboss01'), 'source'),
    value: traits('Hestia', [
      ['HestiaSpecialBoon', 'Rare'],
      ['HestiaSprintBoon', 'Common'],
      ['OmegaZeroBurnBoon', 'Common'],
    ]),
  },
  {
    kind: 'ReplaceLocalReward',
    reward: local('H', 'golden-h-combat05', 'cages', 'cage1'),
    value: drop('RoomMoneyDrop'),
  },
  {
    kind: 'ReplaceLocalReward',
    reward: local('H', 'golden-h-combat04', 'cages', 'cage2'),
    value: drop('MaxHealthDrop'),
  },
  {
    kind: 'ReplaceLocalReward',
    reward: local('H', 'golden-h-combat04', 'cages', 'cage3'),
    value: drop('StackUpgrade'),
  },
  // The two Fields cages whose own offers lost their generation to the same
  // moved Hestia pick. Pinned for the same reason step 8 is: every H-carrying
  // checkpoint and every builder derived from one must agree exactly.
  {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(local('H', 'golden-h-combat05', 'cages', 'cage2'), 'source'),
    // Option 3 keeps this cage's originally acquired Apollo trait; only the
    // generated option set had to move.
    value: traits(
      'Apollo',
      [
        ['ApolloWeaponBoon', 'Epic'],
        ['ApolloSprintBoon', 'Common'],
        ['ApolloRetaliateBoon', 'Common'],
      ],
      'option3',
    ),
  },
  {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(local('H', 'golden-h-combat05', 'cages', 'cage3'), 'source'),
    value: traits('Hestia', [
      ['HestiaCastBoon', 'Rare'],
      ['HestiaSprintBoon', 'Common'],
      ['OmegaZeroBurnBoon', 'Common'],
    ]),
  },
]);

const surfaceOBossDoor = (occurrenceId: string): RewardStoreRepairStep => ({
  kind: 'ReplaceBossDoorRewardStore',
  rewardStore: batchStore('O', occurrenceId, 'Surface'),
  storeKey: 'RunProgress',
});

/**
 * P's first store-carrying batch (the `p_combat03` door, not P's opening —
 * that is `surface-p-intro`) is saturated low across N and O's now-counted entries
 * (9 entered / 2 meta, selection -0.022), so its MetaProgress pin re-pins to
 * RunProgress and the four rewards behind it move into the Run bag.
 */
function surfacePSuffix(
  batchSource: string,
  rePicks: readonly (readonly [string, string])[],
  prebossSource?: string,
): readonly RewardStoreRepairStep[] {
  return Object.freeze([
    {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: batchStore('P', batchSource, 'Surface'),
      storeKey: 'RunProgress',
    },
    ...rePicks.map(([occurrenceId, rewardType]): RewardStoreRepairStep => ({
      kind: 'ReplaceIncomingReward',
      reward: incoming('P', occurrenceId, 'Surface'),
      value: drop(rewardType),
    })),
    ...(prebossSource === undefined
      ? []
      : [
          {
            // P's boss door is saturated the other way: by the Preboss's exit
            // the run-wide ledger stands at 17 entered / 2 meta, so the
            // selection value is 0.20 + 10 * (0.20 - 2/17) = 1.0235 >= 1 and
            // MetaProgress is the only supported key. Boss doors never deplete
            // a bag and the reward is forced, so nothing behind the door moves.
            kind: 'ReplaceBossDoorRewardStore' as const,
            rewardStore: batchStore('P', prebossSource, 'Surface'),
            storeKey: 'MetaProgress',
          },
        ]),
    { kind: 'AuthorLegalTraitOffers' as const },
  ]);
}

const surfacePNamedRePicks = Object.freeze([
  ['surface-p-2-1-p_combat02', 'MaxManaDrop'],
  ['surface-p-2-2-p_combat06', 'RoomMoneyDrop'],
  ['surface-p-3-1-p_combat04', 'StackUpgrade'],
  // WeaponUpgrade rather than the Run bag's TalentDrop: the derived
  // scheduled-lifecycle route reorders N's hub, which spends the Talent entry
  // before P, and the forward pass picks WeaponUpgrade for both orders.
  ['surface-p-3-2-p_combat08', 'WeaponUpgrade'],
] as const);

const plans: Readonly<
  Partial<Record<AuthoredProjectCheckpointId, readonly RewardStoreRepairStep[]>>
> = {
  'underworld-fg': goldenGPrefix,
  'underworld-f-pool': goldenGPrefix,
  'underworld-fgh': Object.freeze([...goldenGPrefix, ...goldenHSuffix]),
  'underworld-fghi': Object.freeze([...goldenGPrefix, ...goldenHSuffix]),
  'nemesis-f-trait-trade': Object.freeze([...goldenGPrefix, ...goldenHSuffix]),
  // The Sea Star checkpoint stops at an F frontier, so its own pass never
  // reaches G — but it carries the same F/G/H/I document, and its builder
  // derives from the repaired F/G/H/I checkpoint, so it repairs identically.
  'nemesis-f-pom-sea-star': Object.freeze([...goldenGPrefix, ...goldenHSuffix]),
  'nemesis-h-fields': Object.freeze([
    ...goldenGPrefix,
    ...goldenHSuffix,
    // Newly reached once the cages resolve: the Fields optional slot the
    // checkpoint left unauthored behind the invalid G prefix.
    {
      kind: 'ReplaceLocalReward',
      reward: local('H', 'golden-h-combat05', 'optionalRewards', 'optional3'),
      value: drop('RoomMoneyTinyDrop'),
    },
  ]),

  // Surface: O, P and Q boss doors become authored decisions; only P's opening
  // batch moves under the corrected ratio.
  'surface-no': Object.freeze([surfaceOBossDoor('surface-o-preboss')]),
  'surface-no-hermes-shrine-delivery': Object.freeze([surfaceOBossDoor('surface-o-preboss')]),
  'surface-n-quick-buck': Object.freeze([
    {
      kind: 'ReplaceIncomingReward',
      reward: incoming('N', 'surface-n-combat05', 'Surface'),
      value: drop('SpellDrop'),
    },
    {
      kind: 'ReplaceIncomingReward',
      reward: incoming('N', 'surface-n-combat09', 'Surface'),
      value: boon('HestiaUpgrade'),
    },
    { kind: 'AuthorLegalTraitOffers' },
  ]),
  'surface-nop': Object.freeze([
    surfaceOBossDoor('surface-o-preboss'),
    ...surfacePSuffix('surface-p-1-1-p_combat03', surfacePNamedRePicks, 'surface-p-preboss-shop'),
  ]),
  'surface-nopq': Object.freeze([
    surfaceOBossDoor('surface-o-preboss'),
    ...surfacePSuffix('surface-p-1-1-p_combat03', surfacePNamedRePicks, 'surface-p-preboss-shop'),
    // Q's bound comes from `completion.bossRewardStorePolicy` (RoomDataQ.lua:44,
    // target 0.15); the run-wide ledger leans RunProgress there.
    {
      kind: 'ReplaceBossDoorRewardStore',
      rewardStore: batchStore('Q', 'surface-q-preboss', 'Surface'),
      storeKey: 'RunProgress',
    },
  ]),
  'surface-p-steady-growth-shrine-frontier': Object.freeze([
    surfaceOBossDoor('85c1be67-d8b3-45d9-9ba1-679718f781c3'),
    ...surfacePSuffix('eb5dbf89-fb20-4daa-b4e8-1ae2c8ef63f6', [
      ['59213773-32f1-4ccc-87a4-4eaf95e43b54', 'MaxManaDrop'],
      ['4a89190c-43f9-471a-9d8e-654d25338fa0', 'RoomMoneyDrop'],
    ]),
  ]),
};

export const rewardStoreRepairPlans = Object.freeze(plans);

export function applyRewardStoreRepair(
  document: ProjectDocument,
  steps: readonly RewardStoreRepairStep[],
): ProjectDocument {
  let current = document;
  for (const step of steps) {
    current =
      step.kind === 'AuthorLegalTraitOffers'
        ? authorLegalTraitOffers(current)
        : applyProjectCommand(current, catalog, step);
  }
  return current;
}
