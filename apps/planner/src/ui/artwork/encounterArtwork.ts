import { enemyArtwork } from './enemies/enemyArtwork';
import { encounterArtwork } from './encounters/encounterArtwork';
import { fangsPerkArtwork } from './fangs/fangsPerkArtwork';
import { minibossArtwork } from './minibosses/minibossArtwork';

/** An enemy's icon by catalog enemy key; undefined renders a blank slot. */
export function enemyIcon(enemyKey: string | undefined): string | undefined {
  return enemyKey === undefined ? undefined : (enemyArtwork[enemyKey] ?? undefined);
}

/** A Vow of Fangs perk's icon by catalog perk key. */
export function fangsPerkIcon(perkKey: string | undefined): string | undefined {
  return perkKey === undefined ? undefined : (fangsPerkArtwork[perkKey] ?? undefined);
}

/** A miniboss encounter's icon by its native encounter declaration key. */
export function minibossIcon(definitionKey: string): string | undefined {
  return minibossArtwork[definitionKey] ?? undefined;
}

/** An encounter's own icon by native encounter declaration key, ahead of its NPC portrait. */
export function encounterIcon(definitionKey: string): string | undefined {
  return encounterArtwork[definitionKey] ?? undefined;
}
