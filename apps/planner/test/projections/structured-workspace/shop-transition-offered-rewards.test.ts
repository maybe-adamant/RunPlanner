import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createShopOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

const gBiome = createBiomeAddress('Underworld', 'G');
/** The reached ordinary World Shop and the unchosen sibling door beside it. */
const shopId = createOccurrenceId('golden-g-b5-e1');
const siblingId = createOccurrenceId('golden-g-b5-e2');
const minorOffer = createShopOfferAddress(gBiome, shopId, 'Minor');

function splitProject(sibling: 'StackUpgrade' | 'SpellDrop', authorSpellSlot = false) {
  const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(gBiome, siblingId),
    value: { rewardType: sibling },
  });
  return authorSpellSlot
    ? applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOfferOption',
        offer: minorOffer,
        value: { optionKey: 'SpellDrop', offer: { rewardType: 'SpellDrop' } },
      })
    : project;
}

async function minorSlotPicker(sibling: 'StackUpgrade' | 'SpellDrop') {
  const { evaluation, workspace } = projectStructuredWorkspaceFixture(splitProject(sibling));
  const interaction = workspace.interactions.shopOffers.get(semanticAddressKey(minorOffer));
  if (interaction === undefined) throw new Error('G Shop Minor slot has no offer editor');
  const picker = await interaction.load();
  return {
    findingCodes: evaluation.findings.map((finding) => finding.code),
    spell: picker.sections
      .flatMap((section) => section.items.map((item) => ({ section: section.kind, item })))
      .find((entry) => entry.item.value.optionKey === 'SpellDrop'),
  };
}

it('withholds the ordinary Shop Spell Drop from the picker after an unchosen Spell Drop door', async () => {
  const blocked = await minorSlotPicker('SpellDrop');
  // The Shop's authored inventory is untouched here, so nothing reports it;
  // only the Spell Drop alternative the picker could offer is closed. The one
  // co-finding is the golden batch's own bag, which has no Spell Drop entry
  // left to hand that door: a fixture consequence of moving the reward, pinned
  // exactly so a new finding here cannot hide behind a loose assertion.
  expect(blocked.findingCodes).toEqual(['rewardBagEntryUnavailable']);
  expect(blocked.spell).toMatchObject({
    section: 'unavailable',
    item: { disabled: true, value: { optionKey: 'SpellDrop' } },
  });
});

it('offers the Shop Spell Drop again once that sibling reward is replaced', async () => {
  const repaired = await minorSlotPicker('StackUpgrade');
  // This also witnesses the in-biome room-entry clear: the golden fixture
  // already offers a Spell Drop earlier in G, on the batch sourced at
  // golden-g-b4-e1. Reaching this Shop therefore requires that earlier set to
  // have been dropped at each room entry rather than carried forward.
  expect(repaired.findingCodes).toEqual([]);
  expect(repaired.spell?.section).not.toBe('unavailable');
  expect(repaired.spell).toMatchObject({ item: { disabled: false } });
});

it('reports the authored Spell Drop inventory and repairs it through the sibling', () => {
  // The blocked inventory leaves no surviving branch, so this finding list is
  // truncated at that point: later rooms are never evaluated and cannot add
  // findings of their own. That is why it is exactly one entry rather than the
  // bag co-finding the picker cases also see.
  const blocked = projectStructuredWorkspaceFixture(splitProject('SpellDrop', true));
  expect(
    blocked.evaluation.findings.map(
      (finding) => `${finding.code}@${semanticAddressKey(finding.origin)}`,
    ),
  ).toEqual([`shopOfferUnavailable@${semanticAddressKey(minorOffer)}`]);
  const repaired = projectStructuredWorkspaceFixture(splitProject('StackUpgrade', true));
  expect(repaired.evaluation.findings).toEqual([]);
});
