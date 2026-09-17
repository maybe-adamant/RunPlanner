import type { WorkspaceHubSlot } from '@planner/projections/structured-workspace';

import aphrodite from './assets/Aphrodite.webp';
import apollo from './assets/Apollo.webp';
import ares from './assets/Ares.webp';
import demeter from './assets/Demeter.webp';
import hammer from './assets/Hammer.webp';
import hephaestus from './assets/Hephaestus.webp';
import hera from './assets/Hera.webp';
import hermes from './assets/Hermes.webp';
import hestia from './assets/Hestia.webp';
import health from './assets/Max Health.webp';
import magick from './assets/Max Magick.webp';
import poseidon from './assets/Poseidon.webp';
import selene from "./assets/Selene's Gift.webp";
import zeus from './assets/Zeus.webp';

const icons: Readonly<Record<string, string>> = {
  AphroditeUpgrade: aphrodite,
  ApolloUpgrade: apollo,
  AresUpgrade: ares,
  DemeterUpgrade: demeter,
  HephaestusUpgrade: hephaestus,
  HeraUpgrade: hera,
  HermesUpgrade: hermes,
  HestiaUpgrade: hestia,
  PoseidonUpgrade: poseidon,
  ZeusUpgrade: zeus,
  MaxHealthDropBig: health,
  MaxManaDropBig: magick,
  WeaponUpgrade: hammer,
  SpellDrop: selene,
};

/** Presentation of the authored door reward, not its eventual pickup outcome. */
export function hubMapReward(slot: WorkspaceHubSlot): {
  readonly summary: string;
  readonly icon?: string;
} {
  if (!slot.open || slot.door?.offerRewardSurface.visibility !== 'visible') {
    return { summary: 'Reward unavailable.' };
  }
  const rewards = slot.door.offerRewardSurface.rewards;
  if (rewards.length === 0) return { summary: 'Reward not configured.' };
  const summary = rewards.map((reward) => reward.summary).join(', ');
  const offer = rewards.length === 1 ? rewards[0]?.offer : undefined;
  const identity =
    offer?.rewardType === 'Boon' && offer.payload?.kind === 'BoonSource'
      ? offer.payload.source
      : offer?.rewardType;
  const icon = identity === undefined ? undefined : icons[identity];
  return { summary, ...(icon === undefined ? {} : { icon }) };
}
