import iconCocoonErebus from './assets/CocoonErebus.webp';
import iconCocoonOceanus from './assets/CocoonOceanus.webp';

/** Encounter icons that replace their NPC's portrait, by catalog encounter key; `null` marks a key with no icon yet. */
export const encounterArtwork: Readonly<Record<string, string | null>> = {
  ArachneCombatF: iconCocoonErebus,
  ArachneCombatG: iconCocoonOceanus,
};
