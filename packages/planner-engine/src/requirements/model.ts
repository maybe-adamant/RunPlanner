export interface NumericRange {
  readonly min?: number;
  readonly max?: number;
}

export type CounterAxis =
  | 'biomeDepthCache'
  | 'biomeEncounterDepth'
  | 'encounterDepth'
  | 'enteredBiomes'
  | 'upgradableTraitCount';

export type HistoryRecord = 'biomeUseRecord' | 'lootTypeHistory' | 'roomsEntered' | 'useRecord';

export type CurrentRunFlag = 'allSpellInvested' | 'pendingSpellDrop';

export type RequirementExpression =
  | {
      readonly kind: 'all';
      readonly requirements: readonly RequirementExpression[];
    }
  | {
      readonly kind: 'any';
      readonly requirements: readonly RequirementExpression[];
    }
  | {
      readonly kind: 'not';
      readonly requirement: RequirementExpression;
    }
  | {
      readonly kind: 'counterRange';
      readonly axis: CounterAxis;
      readonly range: NumericRange;
    }
  | {
      readonly kind: 'recordCount';
      readonly record: HistoryRecord;
      readonly keys: readonly string[];
      readonly range: NumericRange;
    }
  | {
      readonly kind: 'distinctRecordKeyCount';
      readonly record: HistoryRecord;
      readonly keys: readonly string[];
      readonly range: NumericRange;
    }
  | {
      readonly kind: 'recentEnvelopeSlotCount';
      readonly envelopeKey: string;
      readonly slotKey: string;
      readonly roomWindow: number;
      readonly range: NumericRange;
    }
  | {
      readonly kind: 'notInCurrentRoomShopOptions';
      readonly rewardType: string;
    }
  | {
      readonly kind: 'rewardLookupExcludes';
      readonly lookupKey: string;
      readonly rewardType: string;
    }
  | {
      readonly kind: 'minRoomsSinceEvent';
      readonly event: string;
      readonly count: number;
    }
  | {
      readonly kind: 'minExits';
      readonly count: number;
    }
  | {
      readonly kind: 'currentRoomRewardExcludes';
      readonly rewardTypes: readonly string[];
    }
  | {
      readonly kind: 'currentBatchTargetCount';
      readonly range: NumericRange;
    }
  | {
      readonly kind: 'currentBatchRoomCount';
      readonly roomGameNames: readonly string[];
      readonly range: NumericRange;
    }
  | {
      readonly kind: 'clockworkGoalsRemaining';
      readonly range: NumericRange;
    }
  | {
      readonly kind: 'clockworkNonGoalCapacity';
      readonly reserve: number;
    }
  | {
      readonly kind: 'flagEquals';
      readonly flag: CurrentRunFlag;
      readonly value: boolean;
    };
