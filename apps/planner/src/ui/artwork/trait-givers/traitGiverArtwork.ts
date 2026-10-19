import iconAphrodite from './assets/Aphrodite.webp';
import iconApollo from './assets/Apollo.webp';
import iconArachne from './assets/Arachne.webp';
import iconAres from './assets/Ares.webp';
import iconArtemis from './assets/Artemis.webp';
import iconAthena from './assets/Athena.webp';
import iconChaos from './assets/Chaos.webp';
import iconCirce from './assets/Circe.webp';
import iconDemeter from './assets/Demeter.webp';
import iconDionysus from './assets/Dionysus.webp';
import iconEcho from './assets/Echo.webp';
import iconHadesPersephone from './assets/HadesPersephone.webp';
import iconHammer from './assets/Hammer.webp';
import iconHephaestus from './assets/Hephaestus.webp';
import iconHera from './assets/Hera.webp';
import iconHermes from './assets/Hermes.webp';
import iconHestia from './assets/Hestia.webp';
import iconIcarus from './assets/Icarus.webp';
import iconMedea from './assets/Medea.webp';
import iconNarcissus from './assets/Narcissus.webp';
import iconPoseidon from './assets/Poseidon.webp';
import iconSelenesGift from './assets/SelenesGift.webp';
import iconZeus from './assets/Zeus.webp';

/** Boon giver icons by catalog trait giver key; `null` marks a key with no icon yet. */
export const traitGiverArtwork: Readonly<Record<string, string | null>> = {
  Aphrodite: iconAphrodite,
  Arachne: iconArachne,
  Artemis: iconArtemis,
  Athena: iconAthena,
  Icarus: iconIcarus,
  Apollo: iconApollo,
  Ares: iconAres,
  Demeter: iconDemeter,
  Dionysus: iconDionysus,
  Hades: iconHadesPersephone,
  Hephaestus: iconHephaestus,
  Hera: iconHera,
  Hestia: iconHestia,
  Poseidon: iconPoseidon,
  Zeus: iconZeus,
  Hermes: iconHermes,
  Medea: iconMedea,
  Narcissus: iconNarcissus,
  Circe: iconCirce,
  Echo: iconEcho,
  WeaponUpgrade: iconHammer,
  SpellDrop: iconSelenesGift,
  Chaos: iconChaos,
};
