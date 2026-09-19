import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { assessPublicDreamItinerary } from '@run-planner/engine/authored-project';

const initial = ['G', 'H', 'I', 'O', 'P', 'Q'];
const later = ['G', 'H', 'I', 'O', 'P', 'Q', 'F', 'N'];
const successor = { F: 'G', G: 'H', H: 'I', N: 'O', O: 'P', P: 'Q' } as const;

function expectedChoices(prefix: readonly string[]) {
  const pool = later;
  return pool.map((biomeKey) => ({
    biomeKey,
    legal:
      (prefix.length > 0 || initial.includes(biomeKey)) &&
      !prefix.includes(biomeKey) &&
      (prefix.at(-1) === undefined ||
        successor[prefix.at(-1) as keyof typeof successor] !== biomeKey),
  }));
}

describe('public Dream itinerary policy', () => {
  it('exhaustively exposes the declared choice matrix for every legal four-position prefix', () => {
    const visit = (prefix: readonly string[]) => {
      const assessment = assessPublicDreamItinerary(catalog, prefix);
      expect(assessment.issues).toEqual([]);
      expect(assessment.complete).toBe(prefix.length === 4);
      expect(assessment.legal).toBe(prefix.length === 4);
      expect(assessment.nextChoices.map(({ biomeKey, legal }) => ({ biomeKey, legal }))).toEqual(
        prefix.length === 4 ? [] : expectedChoices(prefix),
      );
      if (prefix.length < 4) {
        for (const choice of assessment.nextChoices.filter((choice) => choice.legal)) {
          visit([...prefix, choice.biomeKey]);
        }
      }
    };
    visit([]);
  });

  it('rejects non-public routes without exposing a continuation domain', () => {
    for (const itinerary of [
      ['F', 'H', 'N', 'P'],
      ['G', 'G', 'N', 'P'],
      ['F', 'G', 'N', 'P'],
      ['N', 'O', 'G', 'H'],
      ['G', 'H', 'I', 'O', 'P'],
      ['Dream_Intro'],
    ]) {
      const assessment = assessPublicDreamItinerary(catalog, itinerary);
      expect(assessment.legal).toBe(false);
      expect(assessment.nextChoices).toEqual([]);
    }
  });

  it('agrees between the final candidate prefix and complete admission', () => {
    const itinerary = ['Q', 'F', 'N', 'H'];
    const prefix = assessPublicDreamItinerary(catalog, itinerary.slice(0, -1));
    expect(prefix.nextChoices).toContainEqual({ biomeKey: 'H', legal: true });
    expect(assessPublicDreamItinerary(catalog, itinerary)).toMatchObject({
      complete: true,
      legal: true,
    });
  });
});
