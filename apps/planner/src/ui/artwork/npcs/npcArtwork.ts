import iconAetos from './assets/Aetos.webp';
import iconArachne from './assets/Arachne.webp';
import iconArtemis from './assets/Artemis.webp';
import iconAthena from './assets/Athena.webp';
import iconChaos from './assets/Chaos.webp';
import iconCirce from './assets/Circe.webp';
import iconDionysus from './assets/Dionysus.webp';
import iconEcho from './assets/Echo.webp';
import iconEris from './assets/Eris.webp';
import iconHadesPersephone from './assets/HadesPersephone.webp';
import iconHeracles from './assets/Heracles.webp';
import iconIcarus from './assets/Icarus.webp';
import iconMedea from './assets/Medea.webp';
import iconNarcissus from './assets/Narcissus.webp';
import iconNemesis from './assets/Nemesis.webp';
import iconZagreus from './assets/Zagreus.webp';

/** NPC portraits by NPC key (catalog story and field NPCs, Chaos, Eris and Zagreus); `null` marks a key with no icon yet. */
export const npcArtwork: Readonly<Record<string, string | null>> = {
  Arachne: iconArachne,
  Artemis: iconArtemis,
  Athena: iconAthena,
  Chaos: iconChaos,
  Circe: iconCirce,
  Dionysus: iconDionysus,
  Echo: iconEcho,
  Eris: iconEris,
  Hades: iconHadesPersephone,
  Heracles: iconHeracles,
  Icarus: iconIcarus,
  Medea: iconMedea,
  Narcissus: iconNarcissus,
  Nemesis: iconNemesis,
  Zagreus: iconZagreus,
};

/** The NPC's portrait, by NPC key; undefined where the NPC has none. */
export function npcPortrait(npcKey: string | undefined): string | undefined {
  return npcKey === undefined ? undefined : (npcArtwork[npcKey] ?? undefined);
}

/** Aetos, the eagle that may join an encounter; no catalog NPC key names him. */
export const aetosIcon: string = iconAetos;
