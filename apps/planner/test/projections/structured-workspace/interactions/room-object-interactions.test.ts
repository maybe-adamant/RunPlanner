import { expect, it } from 'vitest';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';

import { bindRoomObjectInteractions } from '@planner/projections/structured-workspace/interactions/room-object-interactions';

const owner = createOccurrenceAddress(
  createBiomeAddress('Surface', 'O'),
  createOccurrenceId('shrine-room'),
);
const buy = {
  kind: 'PurchaseHermesShrineOffer' as const,
  occurrence: owner,
  generationKey: 'travelDealRefill' as const,
  rushed: false,
};

it('appends an entry option’s command, or a blank item’s chosen command', () => {
  const { roomObjectEntries } = bindRoomObjectInteractions([
    {
      kind: 'roomObjectActions',
      owner,
      interactionKey: 'shrine',
      options: [
        {
          key: 'buy:travelDealRefill',
          command: buy,
          choices: [
            {
              key: 'ArmorBoost',
              label: 'Armor',
              rewardType: 'ArmorBoost',
              command: { ...buy, rewardType: 'ArmorBoost' },
            },
          ],
        },
      ],
    },
  ]);
  const entry = roomObjectEntries.get('shrine')!;
  expect(entry.intentFor('buy:travelDealRefill').command).toEqual(buy);
  expect(
    entry
      .choices('buy:travelDealRefill')
      .sections.flatMap((section) => section.items.map((item) => item.value.key)),
  ).toEqual(['ArmorBoost']);
  expect(entry.choiceIntentFor('buy:travelDealRefill', 'ArmorBoost').command).toEqual({
    ...buy,
    rewardType: 'ArmorBoost',
  });
  expect(() => entry.choiceIntentFor('buy:travelDealRefill', 'HealDrop')).toThrow(/is not offered/);
  expect(() => entry.intentFor('rush:initial:first')).toThrow(/is not an option/);
});
