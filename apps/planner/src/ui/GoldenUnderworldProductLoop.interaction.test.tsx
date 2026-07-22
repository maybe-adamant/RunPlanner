// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRouteAddress,
  createShopOfferAddress,
  createTargetAddress,
  encodeProjectDocument,
  semanticAddressKey,
  simulateProject,
  type Catalog,
  type OccurrenceId,
  type ProjectDocument,
  type ProjectEvaluation,
} from '@run-planner/engine';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '../application/createApplication';
import {
  createApplicationCapabilities,
  createProjectSimulationScope,
} from '../application/capabilityConfiguration';
import { createCandidateProjectionService } from '../application/candidateProjection';
import type { AutosaveRecoveryAdapter, AutosaveScheduler } from '../application/autosaveRecovery';
import type { ProfileFileAdapter } from '../application/profileFile';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '../application/projectWorkspaceSlice';
import { selectRoomsForCategory } from '../application/roomSelectorProjection';
import { selectProfileStatus } from '../application/store';
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

const goldenGBatches: readonly BatchSpec[] = [
  {
    targets: [{ gameName: 'G_Combat01', offer: { rewardType: 'Boon', source: 'HestiaUpgrade' } }],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'G_Combat02', offer: { rewardType: 'MetaCurrencyBigDrop' } },
      { gameName: 'G_Combat02', offer: { rewardType: 'MetaCardPointsCommonBigDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'G_Combat03', offer: { rewardType: 'MaxHealthDrop' } },
      { gameName: 'G_Combat03', offer: { rewardType: 'MaxManaDrop' } },
      { gameName: 'G_Combat03', offer: { rewardType: 'RoomMoneyDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'G_Combat10', offer: { rewardType: 'SpellDrop' } },
      { gameName: 'G_Combat11', offer: { rewardType: 'MaxHealthDrop' } },
      { gameName: 'G_Combat12', offer: { rewardType: 'MaxManaDrop' } },
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'G_Combat11', offer: { rewardType: 'MetaCurrencyBigDrop' } },
      { gameName: 'G_Combat12', offer: { rewardType: 'MetaCardPointsCommonBigDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'G_Shop01' },
      { gameName: 'G_Combat12', offer: { rewardType: 'StackUpgrade' } },
    ],
  },
  {
    targets: [
      { gameName: 'G_MiniBoss01', offer: { rewardType: 'Boon', source: 'HestiaUpgrade' } },
      { gameName: 'G_MiniBoss02', offer: { rewardType: 'Boon', source: 'ZeusUpgrade' } },
    ],
  },
  {
    targets: [
      { gameName: 'G_Combat12', offer: { rewardType: 'Boon', source: 'HestiaUpgrade' } },
      { gameName: 'G_Combat13', offer: { rewardType: 'TalentDrop' } },
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

function roomCategory(gameName: string): 'Combat' | 'Miniboss' | 'Shop' {
  if (gameName.includes('_MiniBoss')) {
    return 'Miniboss';
  }
  return gameName.includes('_Shop') ? 'Shop' : 'Combat';
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

function resolvedOffer(offer: OfferSpec): ResolvedRewardOffer {
  return offer.source === undefined
    ? Object.freeze({ rewardType: offer.rewardType })
    : Object.freeze({
        rewardType: offer.rewardType,
        payload: Object.freeze({ kind: 'BoonSource' as const, source: offer.source }),
      });
}

function targetOccurrenceId(biomeKey: 'F' | 'G', batchIndex: number, exitIndex: number) {
  return createOccurrenceId(`phase-5-${biomeKey.toLowerCase()}-b${batchIndex}-e${exitIndex}`);
}

function appendGoldenBatches(
  project: ProjectDocument,
  catalog: Catalog,
  biomeKey: 'F' | 'G',
  startId: OccurrenceId,
  batches: readonly BatchSpec[],
): {
  readonly parentGameName: string;
  readonly parentId: OccurrenceId;
  readonly project: ProjectDocument;
} {
  const biome = createBiomeAddress('Underworld', biomeKey);
  let nextProject = project;
  let parentId = startId;
  for (const [batchOffset, batch] of batches.entries()) {
    const batchIndex = batchOffset + 1;
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parentId),
    });
    if (batch.storeKey !== undefined) {
      nextProject = applyProjectCommand(nextProject, catalog, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(biome, parentId),
        storeKey: batch.storeKey,
      });
    }
    for (const [targetOffset, target] of batch.targets.entries()) {
      const exitIndex = targetOffset + 1;
      const occurrenceId = targetOccurrenceId(biomeKey, batchIndex, exitIndex);
      nextProject = applyProjectCommand(nextProject, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, parentId, exitIndex),
        occurrenceId,
        gameName: target.gameName,
      });
      if (target.offer !== undefined) {
        nextProject = applyProjectCommand(nextProject, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(biome, occurrenceId),
          value: resolvedOffer(target.offer),
        });
      }
    }
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, parentId),
      exitIndex: 1,
    });
    if (batch.targets[0]?.gameName === 'G_Shop01') {
      nextProject = applyProjectCommand(nextProject, catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(
          biome,
          targetOccurrenceId('G', batchIndex, 1),
          'MajorNonBoon',
        ),
        value: { rewardType: 'RoomRewardHealDrop' },
      });
    }
    parentId = targetOccurrenceId(biomeKey, batchIndex, 1);
  }
  const parentGameName = batches.at(-1)?.targets[0]?.gameName;
  if (parentGameName === undefined) {
    throw new Error(`${biomeKey} golden batches have no terminal predecessor`);
  }
  return Object.freeze({ parentGameName, parentId, project: nextProject });
}

function appendGoldenTerminal(
  project: ProjectDocument,
  catalog: Catalog,
  biomeKey: 'F' | 'G' | 'H',
  parentId: OccurrenceId,
  parentGameName: string,
): ProjectDocument {
  const biome = createBiomeAddress('Underworld', biomeKey);
  const parent = catalog.rooms.byKey[parentGameName];
  if (parent === undefined) {
    throw new Error(`${biomeKey} terminal predecessor ${parentGameName} is missing`);
  }
  const targetIds = parent.exits.map((exit) =>
    createOccurrenceId(`phase-5-${biomeKey.toLowerCase()}-terminal-e${exit.index}`),
  );
  let nextProject = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, parentId),
    targetOccurrenceIds: targetIds,
  });
  for (const [index, occurrenceId] of targetIds.slice(1).entries()) {
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, occurrenceId),
      value: { rewardType: index === 0 ? 'StackUpgrade' : 'HermesUpgrade' },
    });
  }
  nextProject = applyProjectCommand(nextProject, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, parentId),
    exitIndex: 1,
  });
  return applyProjectCommand(nextProject, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, targetIds[0]!, 'MajorNonBoon'),
    value: { rewardType: 'RoomRewardHealDrop' },
  });
}

function createGoldenFGProject(
  catalog: Catalog,
  options: { readonly gTerminalParent?: 'G_Combat12' | 'G_Combat14' } = {},
): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'phase-5-product-loop',
    name: 'Phase 5 Product Loop',
    configuredBiomeCounts: { Underworld: 2 },
  });
  const fStart = createOccurrenceId('phase-5-f-start');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: createBiomeAddress('Underworld', 'F'),
    occurrenceId: fStart,
    gameName: 'F_Opening01',
  });
  const f = appendGoldenBatches(project, catalog, 'F', fStart, goldenBatches);
  project = appendGoldenTerminal(f.project, catalog, 'F', f.parentId, f.parentGameName);

  const gStart = createOccurrenceId('phase-5-g-start');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: createBiomeAddress('Underworld', 'G'),
    occurrenceId: gStart,
    gameName: 'G_Intro',
  });
  const gBatches = goldenGBatches.map((batch, index) =>
    index === goldenGBatches.length - 1 && options.gTerminalParent !== undefined
      ? Object.freeze({
          ...batch,
          targets: Object.freeze(
            batch.targets.map((target, targetIndex) =>
              targetIndex === 0
                ? Object.freeze({ ...target, gameName: options.gTerminalParent! })
                : target,
            ),
          ),
        })
      : batch,
  );
  const g = appendGoldenBatches(project, catalog, 'G', gStart, gBatches);
  return appendGoldenTerminal(g.project, catalog, 'G', g.parentId, g.parentGameName);
}

function createGoldenFGHProject(catalog: Catalog): ProjectDocument {
  const biome = createBiomeAddress('Underworld', 'H');
  const start = createOccurrenceId('phase-6-h-start');
  const combat02 = createOccurrenceId('phase-6-h-combat02');
  const combat09 = createOccurrenceId('phase-6-h-combat09');
  const combat03 = createOccurrenceId('phase-6-h-combat03');
  const miniboss = createOccurrenceId('phase-6-h-miniboss');
  const bridge = createOccurrenceId('phase-6-h-bridge');
  const combat05 = createOccurrenceId('phase-6-h-combat05');
  const combat04 = createOccurrenceId('phase-6-h-combat04');
  let project = applyProjectCommand(createGoldenFGProject(catalog), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 3,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'H_Intro',
  });
  const batches = [
    {
      parent: start,
      targets: [{ occurrenceId: combat02, gameName: 'H_Combat02' }],
      cageOutcome: 'min' as const,
    },
    {
      parent: combat02,
      targets: [
        { occurrenceId: combat09, gameName: 'H_Combat09' },
        { occurrenceId: combat03, gameName: 'H_Combat03' },
      ],
      cageOutcome: 'max' as const,
    },
    {
      parent: combat09,
      targets: [
        { occurrenceId: miniboss, gameName: 'H_MiniBoss01' },
        { occurrenceId: bridge, gameName: 'H_Bridge01' },
      ],
      cageOutcome: 'max' as const,
    },
    {
      parent: miniboss,
      targets: [
        { occurrenceId: combat05, gameName: 'H_Combat05' },
        { occurrenceId: combat04, gameName: 'H_Combat04' },
      ],
      cageOutcome: 'min' as const,
    },
  ];
  for (const batch of batches) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, batch.parent),
    });
    if (batch.cageOutcome === 'max') {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsCageOutcome',
        continuation: createContinuationAddress(biome, batch.parent),
        cageOutcome: batch.cageOutcome,
      });
    }
    for (const [targetOffset, target] of batch.targets.entries()) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, batch.parent, targetOffset + 1),
        occurrenceId: target.occurrenceId,
        gameName: target.gameName,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, batch.parent),
      exitIndex: 1,
    });
  }

  const cageOffers: Readonly<Record<string, readonly OfferSpec[]>> = {
    [combat02]: [
      { rewardType: 'RoomMoneyDrop' },
      { rewardType: 'WeaponUpgrade' },
      { rewardType: 'Boon', source: 'HestiaUpgrade' },
    ],
    [combat09]: [
      { rewardType: 'HermesUpgrade' },
      { rewardType: 'TalentDrop' },
      { rewardType: 'Boon', source: 'HestiaUpgrade' },
    ],
    [combat03]: [
      { rewardType: 'Boon', source: 'ApolloUpgrade' },
      { rewardType: 'Boon', source: 'ZeusUpgrade' },
      { rewardType: 'Boon', source: 'DemeterUpgrade' },
    ],
    [combat05]: [
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'Boon', source: 'ApolloUpgrade' },
      { rewardType: 'Boon', source: 'HestiaUpgrade' },
    ],
    [combat04]: [
      { rewardType: 'MaxManaDrop' },
      { rewardType: 'RoomMoneyDrop' },
      { rewardType: 'Boon', source: 'DemeterUpgrade' },
    ],
  };
  for (const [occurrenceId, offers] of Object.entries(cageOffers)) {
    for (const [slotOffset, offer] of offers.entries()) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(
          biome,
          createOccurrenceId(occurrenceId),
          'cages',
          `cage${slotOffset + 1}`,
        ),
        value: resolvedOffer(offer),
      });
    }
  }
  return appendGoldenTerminal(project, catalog, 'H', combat05, 'H_Combat05');
}

function createGoldenFGHIProject(catalog: Catalog): ProjectDocument {
  const biome = createBiomeAddress('Underworld', 'I');
  let project = applyProjectCommand(createGoldenFGHProject(catalog), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 4,
  });
  let parent: OccurrenceId | null = null;
  const batches = [
    { targets: ['I_Combat01'] },
    { targets: ['I_Combat02', 'I_Combat03'] },
    { targets: ['I_Combat05'] },
    { targets: ['I_Combat06'] },
    { targets: ['I_Combat09'] },
  ] as const;
  for (const [batchIndex, batch] of batches.entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parent),
    });
    for (const [targetIndex, gameName] of batch.targets.entries()) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, parent, targetIndex + 1),
        occurrenceId: createOccurrenceId(
          targetIndex === 0
            ? `phase-6-i-goal-${batchIndex + 1}`
            : `phase-6-i-peer-${batchIndex + 1}-${targetIndex + 1}`,
        ),
        gameName,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, parent),
      exitIndex: 1,
    });
    parent = createOccurrenceId(`phase-6-i-goal-${batchIndex + 1}`);
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, parent),
  });
  const preboss = createOccurrenceId('phase-6-i-preboss');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, parent, 1),
    occurrenceId: preboss,
    gameName: 'I_PreBoss02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, parent, 2),
    occurrenceId: createOccurrenceId('phase-6-i-terminal-peer'),
    gameName: 'I_MiniBoss01',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, parent),
    exitIndex: 1,
  });
}

function createPersistence(): {
  readonly profileFile: ProfileFileAdapter;
  readStoredJson(): string | null;
} {
  let storedJson: string | null = null;
  return {
    profileFile: {
      save: (_fileName, json) => {
        storedJson = json;
        return Promise.resolve('saved');
      },
      load: () => Promise.resolve(storedJson),
    },
    readStoredJson: () => storedJson,
  };
}

function createRecoveryPersistence(): {
  readonly adapter: AutosaveRecoveryAdapter;
  readonly scheduler: AutosaveScheduler;
  flush(): void;
  readStoredJson(): string | null;
} {
  let storedJson: string | null = null;
  let pending: { cancelled: boolean; task: () => void } | null = null;
  return {
    adapter: {
      read: () => storedJson,
      write: (json) => {
        storedJson = json;
      },
      clear: () => {
        storedJson = null;
      },
    },
    scheduler: {
      schedule: (_delayMs, task) => {
        if (pending !== null) {
          pending.cancelled = true;
        }
        const scheduled = { cancelled: false, task };
        pending = scheduled;
        return () => {
          scheduled.cancelled = true;
        };
      },
    },
    flush() {
      if (pending === null || pending.cancelled) {
        throw new Error('No recovery autosave is pending');
      }
      const scheduled = pending;
      pending = null;
      scheduled.task();
    },
    readStoredJson: () => storedJson,
  };
}

function assertAccessibleControlSurface(): void {
  const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const control of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'input, select',
  )) {
    expect(
      control.labels?.length !== 0 ||
        control.hasAttribute('aria-label') ||
        control.hasAttribute('aria-labelledby'),
      `${control.tagName.toLowerCase()}#${control.id} needs an accessible label`,
    ).toBe(true);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
    expect(
      button.textContent?.trim() !== '' ||
        button.hasAttribute('aria-label') ||
        button.hasAttribute('aria-labelledby'),
      'button needs an accessible name',
    ).toBe(true);
  }
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

describe('golden Underworld product loop', () => {
  it('authors, validates, labels, saves, and reloads the representative F project through the browser UI', async () => {
    const persistence = createPersistence();
    const application = createApplication({ profileFile: persistence.profileFile });
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

    await user.click(screen.getByRole('button', { name: 'Save Profile' }));
    await screen.findByText('Saved the profile.');
    expect(persistence.readStoredJson()).toBe(encodeProjectDocument(authored));
    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(currentEvaluation(application).status).toBe('empty');
    await user.click(screen.getByRole('button', { name: 'Load Profile' }));
    await screen.findByText('Loaded the profile.');

    expect(currentProject(application)).toEqual(authored);
    expect(currentEvaluation(application)).toEqual(evaluated);
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
    expect(application.store.getState().projectWorkspace.history.future).toEqual([]);
  }, 45_000);

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

  it('keeps G authoring available while incomplete F blocks its simulation', async () => {
    const application = createApplication();
    const { user } = renderPlannerForInteraction({ application });

    await user.selectOptions(screen.getByLabelText('Configured biomes'), '2');
    await user.click(screen.getByRole('button', { name: 'Oceanus' }));

    expect(screen.getByText('Blocked', { selector: '.status-badge' })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Starting room'), 'G_Intro');
    await user.click(screen.getByRole('button', { name: 'Start Oceanus' }));
    await user.click(screen.getByRole('button', { name: 'Add Next Decision' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'Combat');

    const roomOption = screen.getByRole('option', { name: 'Combat 01' });
    expect(roomOption.getAttribute('data-candidate-support')).toBe('unavailable');
    expect(currentEvaluation(application).routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(
      ['F'],
    );
    expect(
      currentEvaluation(application).findings.every(
        (finding) =>
          finding.origin.kind !== 'project' &&
          (finding.origin.kind === 'route' || finding.origin.biomeKey === 'F'),
      ),
    ).toBe(true);
  });

  it('keeps authored I visible while an incomplete H prefix blocks its simulation', async () => {
    const application = createApplication();
    const project = applyProjectCommand(
      createGoldenFGHIProject(application.catalog),
      application.catalog,
      {
        kind: 'RemoveBatch',
        continuation: createContinuationAddress(
          createBiomeAddress('Underworld', 'H'),
          createOccurrenceId('phase-6-h-miniboss'),
        ),
      },
    );
    application.store.dispatch(authoredProjectReplaced(project));
    const { user } = renderPlannerForInteraction({ application });

    await user.click(screen.getByRole('button', { name: 'Tartarus' }));

    expect(screen.getByText('Blocked', { selector: '.status-badge' })).toBeTruthy();
    expect(screen.getByLabelText('Maximum NonGoal rewards')).toHaveProperty('value', '3');
    expect(
      screen.getByLabelText('Maximum NonGoal rewards').getAttribute('data-candidate-support'),
    ).toBe('unavailable');
    expect(currentEvaluation(application).routes[0]?.horizon).toEqual({
      kind: 'incomplete',
      biomeKey: 'H',
      blockedBiomeKeys: ['I'],
    });
    expect(currentProject(application)).toBe(project);
  });

  it('navigates, authors, undoes, and redoes G after a validated F prefix', async () => {
    const application = createApplication();
    const { user } = renderPlannerForInteraction({ application });
    await authorGoldenF(user);
    await user.click(screen.getByRole('button', { name: 'Route' }));
    await user.selectOptions(screen.getByLabelText('Configured biomes'), '2');
    const gFinding = currentEvaluation(application).findings.find(
      (finding) =>
        finding.code === 'biomeTopologyMissing' &&
        finding.origin.kind !== 'project' &&
        finding.origin.kind !== 'route' &&
        finding.origin.biomeKey === 'G',
    );
    if (gFinding === undefined) {
      throw new Error('Configured G topology finding is missing');
    }
    const scrollIntoView = stubScrollIntoView();

    await user.click(screen.getByRole('button', { name: /Start this biome/ }));

    expect(application.store.getState().editorSession.activeUnderworldPanel).toBe('G');
    expect(document.activeElement?.id).toBe(semanticOwnerElementId(gFinding.origin));
    expect(scrollIntoView).toHaveBeenCalledOnce();
    const start = screen.getByLabelText('Starting room');
    expect(
      within(start)
        .getByRole('option', { name: 'Entrance' })
        .getAttribute('data-candidate-support'),
    ).toBe('forced');
    await user.selectOptions(start, 'G_Intro');
    await user.click(screen.getByRole('button', { name: 'Start Oceanus' }));
    const started = currentProject(application);
    expect(screen.getByRole('heading', { name: 'Intro' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Start Oceanus' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(currentProject(application)).toBe(started);
    expect(screen.getByRole('heading', { name: 'Intro' })).toBeTruthy();
  }, 30_000);

  it('renders and edits the maximum-width G preboss fork through the shared editor', async () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectReplaced(
        createGoldenFGProject(application.catalog, { gTerminalParent: 'G_Combat14' }),
      ),
    );
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));

    const heading = screen.getByRole('heading', { name: 'Preboss from Combat 14' });
    const terminal = heading.closest<HTMLElement>('.terminal-card');
    if (terminal === null) {
      throw new Error('maximum-width G preboss editor is missing');
    }
    expect(within(terminal).getAllByRole('radio')).toHaveLength(3);
    expect(within(terminal).getByRole('heading', { name: 'Preboss Shop' })).toBeTruthy();
    expect(within(terminal).getAllByRole('heading', { name: 'Free Reward' })).toHaveLength(2);

    await view.user.click(within(terminal).getByRole('radio', { name: 'Enter terminal exit 3' }));

    const underworld = currentProject(application).routes.find(
      (route) => route.routeKey === 'Underworld',
    );
    const g = underworld?.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.kind !== 'LinearBiome') {
      throw new Error('maximum-width fixture lost its G plan');
    }
    expect(g.topology?.continuations.at(-1)).toMatchObject({
      kind: 'terminal',
      pickedExitIndex: 3,
    });
    expect(currentEvaluation(application).status).toBe('valid');
  }, 30_000);

  it('closes the complete F/G/H/I browser loop with profiles, recovery, accessibility, and responsive projections', async () => {
    stubScrollIntoView();
    const persistence = createPersistence();
    const recovery = createRecoveryPersistence();
    const application = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
      profileFile: persistence.profileFile,
    });
    application.store.dispatch(
      authoredProjectReplaced(createGoldenFGHIProject(application.catalog)),
    );
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));

    const authored = currentProject(application);
    const evaluated = currentEvaluation(application);
    expect(evaluated.status).toBe('valid');
    expect(evaluated.findings).toEqual([]);
    expect(evaluated.summary).toMatchObject({
      configuredBiomeCount: 4,
      evaluatedBiomeCount: 4,
      validatedBiomeCount: 4,
      eligibleForExecutionPlan: true,
    });
    expect(evaluated.routes[0]?.validatedPrefix).toEqual(['F', 'G', 'H', 'I']);
    const gEvaluation = evaluated.routes[0]?.biomes[1];
    if (gEvaluation?.completion !== 'complete') {
      throw new Error('Golden G browser project did not produce a complete evaluation');
    }
    expect(gEvaluation.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'G_Boss01',
      'G_PostBoss01',
    ]);
    const hEvaluation = evaluated.routes[0]?.biomes[2];
    if (hEvaluation?.completion !== 'complete') {
      throw new Error('Golden H browser project did not produce a complete evaluation');
    }
    expect(hEvaluation.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'H_Boss01',
      'H_PostBoss01',
    ]);
    const iEvaluation = evaluated.routes[0]?.biomes[3];
    if (iEvaluation?.completion !== 'complete') {
      throw new Error('Golden I browser project did not produce a complete evaluation');
    }
    expect(iEvaluation.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'I_Boss01',
      'I_PostBoss01',
    ]);
    const underworld = authored.routes.find((route) => route.routeKey === 'Underworld');
    const gPlan = underworld?.biomes.find((biome) => biome.biomeKey === 'G');
    if (gPlan?.kind !== 'LinearBiome' || gPlan.topology === null) {
      throw new Error('Golden G topology is missing from its authored project');
    }
    const text = document.body.textContent ?? '';
    for (const occurrence of gPlan.topology.occurrences) {
      const room = application.catalog.rooms.byKey[occurrence.gameName];
      if (room === undefined) {
        throw new Error(`Golden G room ${occurrence.gameName} is missing from the catalog`);
      }
      expect(text).toContain(room.label);
      expect(text).not.toContain(occurrence.gameName);
      expect(text).not.toContain(occurrence.occurrenceId);
    }
    for (const label of ['Deep Serpent', 'King Vermin', 'Midshop', 'Hestia', 'Zeus', 'Heal']) {
      expect(text).toContain(label);
    }
    for (const internalName of [
      'HestiaUpgrade',
      'ZeusUpgrade',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonBigDrop',
      'RoomRewardHealDrop',
    ]) {
      expect(text).not.toContain(internalName);
    }
    assertAccessibleControlSurface();
    expect(screen.getByRole('button', { name: 'Oceanus' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('status', { name: 'Profile status: Unsaved' })).toBeTruthy();

    const hPlan = underworld?.biomes.find((biome) => biome.biomeKey === 'H');
    if (hPlan?.kind !== 'LinearBiome' || hPlan.topology === null) {
      throw new Error('Golden H topology is missing from its authored project');
    }
    await view.user.click(screen.getByRole('button', { name: 'Fields of Mourning' }));
    const hText = document.body.textContent ?? '';
    for (const occurrence of hPlan.topology.occurrences) {
      const room = application.catalog.rooms.byKey[occurrence.gameName];
      if (room === undefined) {
        throw new Error(`Golden H room ${occurrence.gameName} is missing from the catalog`);
      }
      expect(hText).toContain(room.label);
      expect(hText).not.toContain(occurrence.gameName);
      expect(hText).not.toContain(occurrence.occurrenceId);
    }
    const fieldsOutcomes = screen.getAllByLabelText('Fields door roll');
    expect(fieldsOutcomes).toHaveLength(4);
    expect(
      fieldsOutcomes.every(
        (control) => control.getAttribute('data-candidate-support') !== 'unavailable',
      ),
    ).toBe(true);
    expect(screen.getAllByLabelText('Fields cage rewards')).toHaveLength(5);
    assertAccessibleControlSurface();

    const firstCage = within(screen.getAllByLabelText('Fields cage rewards')[0]!).getByRole(
      'region',
      { name: 'Cage 1' },
    );
    await view.user.selectOptions(within(firstCage).getByLabelText('Reward'), 'MaxManaDrop');
    expect(currentProject(application)).not.toEqual(authored);
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(currentProject(application)).toEqual(authored);

    await view.user.selectOptions(screen.getAllByLabelText('Fields door roll')[3]!, 'max');
    expect(currentEvaluation(application).status).toBe('invalid');
    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    await view.user.click(
      screen.getByRole('button', { name: /Fields door roll cannot occur here/ }),
    );
    expect(
      screen.getByRole('button', { name: 'Fields of Mourning' }).getAttribute('aria-current'),
    ).toBe('page');
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(currentProject(application)).toEqual(authored);

    const iPlan = underworld?.biomes.find((biome) => biome.biomeKey === 'I');
    if (iPlan?.kind !== 'LinearBiome' || iPlan.topology === null) {
      throw new Error('Golden I topology is missing from its authored project');
    }
    await view.user.click(screen.getByRole('button', { name: 'Tartarus' }));
    const iText = document.body.textContent ?? '';
    for (const occurrence of iPlan.topology.occurrences) {
      const room = application.catalog.rooms.byKey[occurrence.gameName];
      if (room === undefined) {
        throw new Error(`Golden I room ${occurrence.gameName} is missing from the catalog`);
      }
      expect(iText).toContain(room.label);
      expect(iText).not.toContain(occurrence.gameName);
      expect(iText).not.toContain(occurrence.occurrenceId);
    }
    expect(screen.getByLabelText('Maximum NonGoal rewards')).toHaveProperty('value', '3');
    expect(
      screen.getByLabelText('Maximum NonGoal rewards').getAttribute('data-candidate-support'),
    ).not.toBe('unavailable');
    expect(screen.getAllByText('Clockwork Goal')).toHaveLength(5);
    expect(screen.getByText('Offer 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to Preboss' })).toBeNull();
    assertAccessibleControlSurface();

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(
          createBiomeAddress('Underworld', 'I'),
          createOccurrenceId('phase-6-i-terminal-peer'),
        ),
        gameName: 'I_PreBoss02',
      }),
    );
    expect(currentEvaluation(application).status).toBe('invalid');
    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    await view.user.click(screen.getByRole('button', { name: /Room cannot appear here/ }));
    expect(screen.getByRole('button', { name: 'Tartarus' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(currentProject(application)).toEqual(authored);

    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));

    const firstExit = exitRow(1, 1);
    const alternative = within(firstExit).getByRole('option', { name: 'Combat 02' });
    expect(alternative.getAttribute('data-candidate-support')).toBe('possible');
    await view.user.selectOptions(within(firstExit).getByLabelText('Room'), 'G_Combat02');
    expect(currentProject(application)).not.toEqual(authored);
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(currentProject(application)).toEqual(authored);

    const capabilities = createApplicationCapabilities(application.catalog);
    const candidateProjection = createCandidateProjectionService(application.catalog, (project) =>
      simulateProject(application.catalog, project, createProjectSimulationScope(capabilities)),
    );
    const firstHContinuation = hPlan.topology.continuations[0];
    if (firstHContinuation?.kind !== 'batch') {
      throw new Error('Golden H first decision is missing');
    }
    const hCandidateStarted = performance.now();
    const projectedHOutcomes = candidateProjection.fieldsCageOutcomes(
      authored,
      createContinuationAddress(
        createBiomeAddress('Underworld', 'H'),
        firstHContinuation.parentOccurrenceId,
      ),
      ['min', 'max'],
    );
    const hCandidateDurationMs = performance.now() - hCandidateStarted;
    expect(projectedHOutcomes).toHaveLength(2);
    expect(
      projectedHOutcomes.every((candidate) => candidate.evaluation.context === 'evaluated'),
    ).toBe(true);
    const iCandidateStarted = performance.now();
    const projectedIFields = candidateProjection.biomeFields(
      authored,
      createBiomeFieldAddress(createBiomeAddress('Underworld', 'I'), 'maxNonGoalRewards'),
      [3, 4, 5, 6],
    );
    const iCandidateDurationMs = performance.now() - iCandidateStarted;
    expect(projectedIFields).toHaveLength(4);
    expect(
      projectedIFields.every((candidate) => candidate.evaluation.context === 'evaluated'),
    ).toBe(true);
    const firstGContinuation = gPlan.topology.continuations[0];
    if (firstGContinuation?.kind !== 'batch') {
      throw new Error('Golden G first decision is missing');
    }
    const combatRooms = selectRoomsForCategory(application.catalog, 'G', 'Combat');
    const candidateStarted = performance.now();
    const projectedCandidates = candidateProjection.roomTargets(
      authored,
      createTargetAddress(
        createBiomeAddress('Underworld', 'G'),
        firstGContinuation.parentOccurrenceId,
        1,
      ),
      combatRooms,
    );
    const candidateDurationMs = performance.now() - candidateStarted;
    expect(projectedCandidates).toHaveLength(combatRooms.length);
    expect(
      projectedCandidates.every((candidate) => candidate.evaluation.context === 'evaluated'),
    ).toBe(true);

    const rebuildStarted = performance.now();
    expect(
      simulateProject(application.catalog, authored, createProjectSimulationScope(capabilities)),
    ).toEqual(evaluated);
    const rebuildDurationMs = performance.now() - rebuildStarted;
    const editStarted = performance.now();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(
          createBiomeAddress('Underworld', 'G'),
          targetOccurrenceId('G', 1, 1),
        ),
        gameName: 'G_Combat02',
      }),
    );
    const representativeEditDurationMs = performance.now() - editStarted;
    const undoStarted = performance.now();
    application.store.dispatch(authoredProjectUndoRequested());
    const cachedUndoDurationMs = performance.now() - undoStarted;
    expect(rebuildDurationMs, `full rebuild took ${rebuildDurationMs.toFixed(1)} ms`).toBeLessThan(
      750,
    );
    expect(
      candidateDurationMs,
      `cold G candidate projection took ${candidateDurationMs.toFixed(1)} ms`,
    ).toBeLessThan(750);
    expect(
      hCandidateDurationMs,
      `cold H candidate projection took ${hCandidateDurationMs.toFixed(1)} ms`,
    ).toBeLessThan(750);
    expect(
      iCandidateDurationMs,
      `cold I candidate projection took ${iCandidateDurationMs.toFixed(1)} ms`,
    ).toBeLessThan(750);
    expect(
      representativeEditDurationMs,
      `representative edit publication took ${representativeEditDurationMs.toFixed(1)} ms`,
    ).toBeLessThan(750);
    expect(
      cachedUndoDurationMs,
      `cached undo publication took ${cachedUndoDurationMs.toFixed(1)} ms`,
    ).toBeLessThan(50);
    expect(currentProject(application)).toEqual(authored);
    expect(currentEvaluation(application)).toEqual(evaluated);

    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(authored));
    await view.user.click(screen.getByRole('button', { name: 'Save Profile' }));
    await screen.findByText('Saved the profile.');
    expect(persistence.readStoredJson()).toBe(encodeProjectDocument(authored));
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');
    await view.user.click(screen.getByRole('button', { name: 'New' }));
    expect(currentEvaluation(application).status).toBe('empty');
    await view.user.click(screen.getByRole('button', { name: 'Load Profile' }));
    await screen.findByText('Loaded the profile.');
    expect(currentProject(application)).toEqual(authored);
    expect(currentEvaluation(application)).toEqual(evaluated);

    application.dispose();
    view.unmount();
    const recoveredApplication = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
    });
    renderPlannerForInteraction({ application: recoveredApplication });
    expect(selectProfileStatus(recoveredApplication.store.getState())).toBe('Recovered');
    expect(currentProject(recoveredApplication)).toEqual(authored);
    expect(currentEvaluation(recoveredApplication)).toEqual(evaluated);
    expect(screen.getByRole('status', { name: 'Profile status: Recovered' })).toBeTruthy();
  }, 90_000);
});
