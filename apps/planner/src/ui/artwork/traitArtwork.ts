import { boonArtwork } from './boons/boonArtwork';
import { chaosArtwork } from './chaos/chaosArtwork';
import { hammerArtwork } from './hammers/hammerArtwork';
import { hermesBoonArtwork } from './hermes/hermesBoonArtwork';
import { hexSpellArtwork } from './hex-spells/hexSpellArtwork';
import { npcBoonArtwork } from './npc-boons/npcBoonArtwork';

const traitArtwork: Readonly<Record<string, string | null>> = {
  ...boonArtwork,
  ...hermesBoonArtwork,
  ...hammerArtwork,
  ...npcBoonArtwork,
  ...chaosArtwork,
  ...hexSpellArtwork,
};

/** A trait's icon by catalog trait key; undefined renders a blank slot. */
export function traitIcon(traitKey: string): string | undefined {
  return traitArtwork[traitKey] ?? undefined;
}
