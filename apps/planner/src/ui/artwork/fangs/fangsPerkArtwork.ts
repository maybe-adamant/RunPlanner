import iconBigger from './assets/Bigger.webp';
import iconBruiser from './assets/Bruiser.webp';
import iconBurner from './assets/Burner.webp';
import iconBurrower from './assets/Burrower.webp';
import iconClanger from './assets/Clanger.webp';
import iconDowner from './assets/Downer.webp';
import iconDrainer from './assets/Drainer.webp';
import iconMorpher from './assets/Morpher.webp';
import iconScraper from './assets/Scraper.webp';
import iconSeeker from './assets/Seeker.webp';
import iconShielder from './assets/Shielder.webp';
import iconShifter from './assets/Shifter.webp';
import iconSlicer from './assets/Slicer.webp';
import iconSpiller from './assets/Spiller.webp';
import iconSpinner from './assets/Spinner.webp';
import iconStopper from './assets/Stopper.webp';
import iconSucker from './assets/Sucker.webp';
import iconSwifter from './assets/Swifter.webp';
import iconThicker from './assets/Thicker.webp';
import iconTougher from './assets/Tougher.webp';

/** Vow of Fangs perk icons by catalog perk key; `null` marks a key with no icon yet. */
export const fangsPerkArtwork: Readonly<Record<string, string | null>> = {
  Blink: iconShifter,
  ExtraDamage: iconBruiser,
  Fog: iconSpiller,
  Frenzy: iconSwifter,
  HeavyArmor: iconThicker,
  Hex: iconMorpher,
  Homing: iconSeeker,
  ManaDrain: iconDrainer,
  Massive: iconBigger,
  Metallic: iconClanger,
  Miasma: iconDowner,
  Molten: iconBurner,
  Orbit: iconSpinner,
  Radial: iconSlicer,
  Rifts: iconScraper,
  Rooting: iconBurrower,
  SpreadHitShields: iconShielder,
  StasisDeath: iconStopper,
  Unflinching: iconTougher,
  Vacuuming: iconSucker,
};
