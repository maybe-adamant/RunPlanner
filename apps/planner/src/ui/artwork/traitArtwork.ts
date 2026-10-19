import { arcanaTraitArtwork } from '@planner/ui/controls/arcana-fear/arcanaArtwork';

import { boonArtwork } from './boons/boonArtwork';
import { chaosArtwork } from './chaos/chaosArtwork';
import { hammerArtwork } from './hammers/hammerArtwork';
import { hermesBoonArtwork } from './hermes/hermesBoonArtwork';
import { hexSpellArtwork } from './hex-spells/hexSpellArtwork';
import { npcBoonArtwork } from './npc-boons/npcBoonArtwork';
import { otherTraitArtwork } from './other-traits/otherTraitArtwork';
import { rewardArtwork } from './rewards/rewardArtwork';

const traitArtwork: Readonly<Record<string, string | null>> = {
  ...boonArtwork,
  ...hermesBoonArtwork,
  ...hammerArtwork,
  ...npcBoonArtwork,
  ...chaosArtwork,
  ...hexSpellArtwork,
  ...arcanaTraitArtwork,
  ...otherTraitArtwork,
  // Champion of Elysium's trait shares its reward's key and art.
  InfernalContractBoon: rewardArtwork.InfernalContractBoon ?? null,
};

/** A trait's icon by catalog trait key; undefined renders a blank slot. */
export function traitIcon(traitKey: string): string | undefined {
  return traitArtwork[traitKey] ?? undefined;
}
