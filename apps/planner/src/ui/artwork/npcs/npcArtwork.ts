import iconArachne from './assets/Arachne.webp';
import iconArtemis from './assets/Artemis.webp';
import iconAthena from './assets/Athena.webp';
import iconCirce from './assets/Circe.webp';
import iconDionysus from './assets/Dionysus.webp';
import iconEcho from './assets/Echo.webp';
import iconHadesPersephone from './assets/HadesPersephone.webp';
import iconHeracles from './assets/Heracles.webp';
import iconIcarus from './assets/Icarus.webp';
import iconMedea from './assets/Medea.webp';
import iconNarcissus from './assets/Narcissus.webp';
import iconNemesis from './assets/Nemesis.webp';

/** Story and field NPC icons by catalog NPC key; `null` marks a key with no icon yet. */
export const npcArtwork: Readonly<Record<string, string | null>> = {
  Arachne: iconArachne,
  Artemis: iconArtemis,
  Athena: iconAthena,
  Circe: iconCirce,
  Dionysus: iconDionysus,
  Echo: iconEcho,
  Hades: iconHadesPersephone,
  Heracles: iconHeracles,
  Icarus: iconIcarus,
  Medea: iconMedea,
  Narcissus: iconNarcissus,
  Nemesis: iconNemesis,
};
