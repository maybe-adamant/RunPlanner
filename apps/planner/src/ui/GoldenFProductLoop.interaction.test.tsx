// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import {
  encodeProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
  type ProjectEvaluation,
} from '@run-planner/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '../application/createApplication';
import type { ProjectPersistenceAdapters } from '../application/projectPersistence';
import { renderPlannerForInteraction } from '../testing/renderPlanner';
import { semanticOwnerElementId } from './semanticOwner';

type PlannerUser = ReturnType<typeof renderPlannerForInteraction>['user'];

interface OfferSpec {
  readonly rewardType: string;
  readonly source?: string;
}

interface TargetSpec {
  readonly gameName: string;
  readonly offer?: OfferSpec;
}

interface BatchSpec {
  readonly storeKey?: 'MetaProgress';
  readonly targets: readonly TargetSpec[];
}

const goldenBatches: readonly BatchSpec[] = [
  { storeKey: 'MetaProgress', targets: [{ gameName: 'F_Combat02' }] },
  {
    targets: [
      { gameName: 'F_Combat03' },
      { gameName: 'F_Combat03', offer: { rewardType: 'MaxHealthDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'F_Combat04', offer: { rewardType: 'MaxHealthDrop' } },
      { gameName: 'F_Combat04', offer: { rewardType: 'MaxManaDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'F_Combat05', offer: { rewardType: 'StackUpgrade' } },
      { gameName: 'F_Combat11', offer: { rewardType: 'RoomMoneyDrop' } },
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'F_Combat06', offer: { rewardType: 'MetaCardPointsCommonDrop' } },
      { gameName: 'F_Combat06', offer: { rewardType: 'MetaCurrencyDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'F_MiniBoss01' },
      {
        gameName: 'F_MiniBoss02',
        offer: { rewardType: 'Boon', source: 'PoseidonUpgrade' },
      },
    ],
  },
  {
    targets: [{ gameName: 'F_Combat11', offer: { rewardType: 'MaxManaDrop' } }],
  },
  {
    targets: [
      { gameName: 'F_Combat12', offer: { rewardType: 'WeaponUpgrade' } },
      { gameName: 'F_Combat12', offer: { rewardType: 'HermesUpgrade' } },
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'F_Combat14', offer: { rewardType: 'MetaCardPointsCommonDrop' } },
      { gameName: 'F_Combat14', offer: { rewardType: 'MetaCurrencyDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'F_Combat15', offer: { rewardType: 'RoomMoneyDrop' } },
      { gameName: 'F_Combat15', offer: { rewardType: 'SpellDrop' } },
    ],
  },
];

function lastElement(selector: string): HTMLElement {
  const element = [...document.querySelectorAll<HTMLElement>(selector)].at(-1);
  if (element === undefined) {
    throw new Error(`No element matches ${selector}`);
  }
  return element;
}

function decision(batchIndex: number): HTMLElement {
  const element = document.querySelectorAll<HTMLElement>('.decision-card:not(.terminal-card)')[
    batchIndex - 1
  ];
  if (element === undefined) {
    throw new Error(`Decision ${batchIndex} is missing`);
  }
  return element;
}

function exitRow(batchIndex: number, exitIndex: number): HTMLElement {
  const element = decision(batchIndex).querySelectorAll<HTMLElement>('.exit-row')[exitIndex - 1];
  if (element === undefined) {
    throw new Error(`Decision ${batchIndex} exit ${exitIndex} is missing`);
  }
  return element;
}

function roomCategory(gameName: string): 'Combat' | 'Miniboss' {
  return gameName.startsWith('F_MiniBoss') ? 'Miniboss' : 'Combat';
}

async function replaceOffer(
  user: PlannerUser,
  owner: HTMLElement,
  offer: OfferSpec,
): Promise<void> {
  await user.selectOptions(within(owner).getByLabelText('Reward'), offer.rewardType);
  if (offer.source !== undefined) {
    await user.selectOptions(within(owner).getByLabelText('Source'), offer.source);
  }
}

async function authorGoldenF(user: PlannerUser): Promise<void> {
  await user.selectOptions(screen.getByLabelText('Configured biomes'), '1');
  await user.click(screen.getByRole('button', { name: 'Erebus' }));
  await user.selectOptions(screen.getByLabelText('Opening room'), 'F_Opening01');
  await user.click(screen.getByRole('button', { name: 'Start Erebus' }));

  for (const [batchOffset, batch] of goldenBatches.entries()) {
    const batchIndex = batchOffset + 1;
    await user.click(screen.getByRole('button', { name: 'Add Next Decision' }));
    if (batch.storeKey !== undefined) {
      await user.selectOptions(
        within(decision(batchIndex)).getByLabelText('Reward pool'),
        batch.storeKey,
      );
    }
    for (const [targetOffset, target] of batch.targets.entries()) {
      const exitIndex = targetOffset + 1;
      await user.selectOptions(
        within(exitRow(batchIndex, exitIndex)).getByLabelText('Type'),
        roomCategory(target.gameName),
      );
      await user.selectOptions(
        within(exitRow(batchIndex, exitIndex)).getByLabelText('Room'),
        target.gameName,
      );
      if (target.offer !== undefined) {
        await replaceOffer(user, exitRow(batchIndex, exitIndex), target.offer);
      }
    }
    await user.click(within(decision(batchIndex)).getByRole('radio', { name: 'Pick exit 1' }));
  }

  await user.click(screen.getByRole('button', { name: 'Go to Preboss' }));
  const terminal = lastElement('.terminal-card');
  await user.click(within(terminal).getByRole('radio', { name: 'Enter terminal exit 1' }));
  const terminalRows = terminal.querySelectorAll<HTMLElement>('.exit-row');
  const shopRow = terminalRows[0];
  const freeRewardRow = terminalRows[1];
  if (shopRow === undefined || freeRewardRow === undefined) {
    throw new Error('Golden terminal offers are incomplete');
  }
  await replaceOffer(user, freeRewardRow, { rewardType: 'StackUpgrade' });
  const offerTwoHeading = within(shopRow).getByRole('heading', { name: 'Offer 2' });
  const offerTwo = offerTwoHeading.closest<HTMLElement>('.shop-offer');
  if (offerTwo === null) {
    throw new Error('Golden Preboss Offer 2 is missing');
  }
  await replaceOffer(user, offerTwo, { rewardType: 'RoomRewardHealDrop' });
}

function createPersistence(): {
  readonly adapters: ProjectPersistenceAdapters;
  readStoredJson(): string | null;
} {
  let storedJson: string | null = null;
  return {
    adapters: {
      storage: {
        read: () => storedJson,
        write: (json) => {
          storedJson = json;
        },
      },
      transfer: {
        download: () => {},
        upload: () => Promise.resolve(null),
      },
    },
    readStoredJson: () => storedJson,
  };
}

function currentProject(application: PlannerApplication): ProjectDocument {
  return application.store.getState().projectWorkspace.history.present;
}

function currentEvaluation(application: PlannerApplication): ProjectEvaluation {
  return application.store.getState().projectWorkspace.evaluation;
}

const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
);

function stubScrollIntoView() {
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  return scrollIntoView;
}

afterEach(() => {
  cleanup();
  if (originalScrollIntoView === undefined) {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  } else {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
  }
  vi.restoreAllMocks();
});

describe('golden F product loop', () => {
  it('authors, validates, labels, saves, and reloads the representative F project through the browser UI', async () => {
    const persistence = createPersistence();
    const application = createApplication({ projectPersistence: persistence.adapters });
    const { user } = renderPlannerForInteraction({ application });

    await authorGoldenF(user);

    const authored = currentProject(application);
    const evaluated = currentEvaluation(application);
    expect(evaluated.status).toBe('valid');
    expect(evaluated.findings).toEqual([]);
    expect(evaluated.summary).toMatchObject({
      configuredBiomeCount: 1,
      evaluatedBiomeCount: 1,
      validatedBiomeCount: 1,
      eligibleForExecutionPlan: true,
    });
    const text = document.body.textContent ?? '';
    const underworld = authored.routes.find((route) => route.routeKey === 'Underworld');
    const fPlan = underworld?.biomes.find((biome) => biome.biomeKey === 'F');
    if (fPlan?.topology === null || fPlan?.topology === undefined) {
      throw new Error('Golden F topology is missing from its authored project');
    }
    for (const occurrence of fPlan.topology.occurrences) {
      const room = application.catalog.rooms.byKey[occurrence.gameName];
      if (room === undefined) {
        throw new Error(`Golden F room ${occurrence.gameName} is missing from the catalog`);
      }
      expect(text).toContain(room.label);
      expect(text).not.toContain(occurrence.gameName);
      expect(text).not.toContain(occurrence.occurrenceId);
    }
    for (const label of [
      'Root-Stalker',
      'Shadow-Spiller',
      'Preboss Shop',
      'Free Reward',
      'Poseidon',
      'Ashes',
      'Bones',
      'Heal',
    ]) {
      expect(text).toContain(label);
    }
    for (const internalName of [
      'PoseidonUpgrade',
      'MetaCardPointsCommonDrop',
      'MetaCurrencyDrop',
      'RoomRewardHealDrop',
    ]) {
      expect(text).not.toContain(internalName);
    }

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(persistence.readStoredJson()).toBe(encodeProjectDocument(authored));
    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(currentEvaluation(application).status).toBe('empty');
    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(currentProject(application)).toEqual(authored);
    expect(currentEvaluation(application)).toEqual(evaluated);
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
    expect(application.store.getState().projectWorkspace.history.future).toEqual([]);
  }, 30_000);

  it('keeps an incomplete F editable and navigates its finding to the biome owner', async () => {
    const application = createApplication();
    const { user } = renderPlannerForInteraction({ application });
    await user.selectOptions(screen.getByLabelText('Configured biomes'), '1');
    await user.click(screen.getByRole('button', { name: 'Surface' }));
    const finding = currentEvaluation(application).findings[0];
    if (finding === undefined) {
      throw new Error('Incomplete F finding is missing');
    }
    const scrollIntoView = stubScrollIntoView();

    await user.click(screen.getByRole('button', { name: /Start this biome/ }));

    expect(application.store.getState().editorSession.activeSection).toBe('underworld');
    expect(application.store.getState().editorSession.activeUnderworldPanel).toBe('F');
    expect(document.activeElement?.id).toBe(semanticOwnerElementId(finding.origin));
    expect(scrollIntoView).toHaveBeenCalledOnce();
    await user.selectOptions(screen.getByLabelText('Opening room'), 'F_Opening01');
    expect(screen.getByRole('button', { name: 'Start Erebus' })).toHaveProperty('disabled', false);
  });

  it('keeps an early invalid terminal editable and navigates to its exact target owner', async () => {
    const application = createApplication();
    const { user } = renderPlannerForInteraction({ application });
    await user.selectOptions(screen.getByLabelText('Configured biomes'), '1');
    await user.click(screen.getByRole('button', { name: 'Erebus' }));
    await user.selectOptions(screen.getByLabelText('Opening room'), 'F_Opening01');
    await user.click(screen.getByRole('button', { name: 'Start Erebus' }));
    await user.click(screen.getByRole('button', { name: 'Go to Preboss' }));
    await user.click(screen.getByRole('radio', { name: 'Enter terminal exit 1' }));
    const evaluation = currentEvaluation(application);
    const finding = evaluation.findings.find(
      (candidate) => candidate.code === 'targetRoomUnavailable',
    );
    if (finding === undefined) {
      throw new Error('Early terminal target finding is missing');
    }
    stubScrollIntoView();

    await user.click(screen.getByRole('button', { name: /Room cannot appear here/ }));

    expect(evaluation.status).toBe('invalid');
    expect(document.activeElement?.id).toBe(semanticOwnerElementId(finding.origin));
    expect(semanticAddressKey(finding.origin)).toContain('"target"');
    expect(screen.getByRole('button', { name: 'Remove Preboss' })).toBeTruthy();
  });

  it('restores and re-removes authored F state across a destructive route-prefix shrink', async () => {
    const application = createApplication();
    const { user } = renderPlannerForInteraction({ application });
    await user.selectOptions(screen.getByLabelText('Configured biomes'), '1');
    await user.click(screen.getByRole('button', { name: 'Erebus' }));
    await user.selectOptions(screen.getByLabelText('Opening room'), 'F_Opening02');
    await user.click(screen.getByRole('button', { name: 'Start Erebus' }));
    const beforeShrink = currentProject(application);
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Route' }));

    await user.selectOptions(screen.getByLabelText('Configured biomes'), '0');
    expect(currentEvaluation(application).status).toBe('empty');
    expect(globalThis.confirm).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(currentProject(application)).toBe(beforeShrink);
    await user.click(screen.getByRole('button', { name: 'Erebus' }));
    expect(screen.getByRole('heading', { name: 'Opening' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(currentEvaluation(application).status).toBe('empty');
    expect(screen.queryByRole('button', { name: 'Erebus' })).toBeNull();
  });
});
