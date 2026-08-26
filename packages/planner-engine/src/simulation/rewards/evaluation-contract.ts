import type { BiomeHistoryPrefix, CanonicalBiomeHistory } from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalBiome,
  MaterializedBiomePrefix,
} from '../materialization';

/** Private common input vocabulary for one reward-evaluation pass. */
export type BiomeRewardSnapshot =
  CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom });
export type BiomeRewardHistory = CanonicalBiomeHistory | BiomeHistoryPrefix;
