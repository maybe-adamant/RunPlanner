import iconAether from './assets/Aether.webp';
import iconAir from './assets/Air.webp';
import iconEarth from './assets/Earth.webp';
import iconFire from './assets/Fire.webp';
import iconWater from './assets/Water.webp';

/** Element icons by catalog trait element; `null` marks a key with no icon yet. */
export const elementArtwork: Readonly<Record<string, string | null>> = {
  Aether: iconAether,
  Earth: iconEarth,
  Air: iconAir,
  Fire: iconFire,
  Water: iconWater,
};
