import { ownerRegion, type FindingChronology } from '../../../finding-regions';
import { rewardFinding } from '../../findings';

export interface LifecycleFinding {
  readonly finding: ReturnType<typeof rewardFinding>;
  readonly region: ReturnType<typeof ownerRegion>;
  readonly chronology: FindingChronology;
}
