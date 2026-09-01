import type {
  ExecutionLifecycleWindow,
  ExecutionTimeline,
  ExecutionTimelineTransaction,
  ExecutionWellRetainedEffectCorrelation,
} from '../model';
import {
  array,
  booleanValue,
  exact,
  fail,
  object,
  stringArray,
  stringValue,
  wellGenerationKey,
} from './primitives';
import { acquisitionRole, equipResults, reward, traitOffer } from './rewards';

export function lifecycleWindow(value: unknown, label: string): ExecutionLifecycleWindow {
  const record = object(value, label);
  if (record.kind === 'standard') {
    exact(record, ['kind', 'phase'], [], label);
    if (record.phase !== 'beforeCombat' && record.phase !== 'afterCombat')
      fail(`${label}.phase is unsupported`);
    return Object.freeze({ kind: 'standard', phase: record.phase });
  }
  if (record.kind === 'encounterEnd') {
    exact(record, ['kind', 'phaseKey'], [], label);
    return Object.freeze({
      kind: 'encounterEnd',
      phaseKey: stringValue(record.phaseKey, `${label}.phaseKey`),
    });
  }
  if (record.kind === 'postOutgoing') {
    exact(record, ['kind'], [], label);
    return Object.freeze({ kind: 'postOutgoing' });
  }
  fail(`${label}.kind is outside the F/G execution slice`);
}

export function nemesisOutcome(value: unknown, label: string) {
  const record = object(value, label);
  if (record.kind === 'freeItem') {
    exact(record, ['kind'], [], label);
    return Object.freeze({ kind: 'freeItem' as const });
  }
  if (record.kind === 'goldTrade' || record.kind === 'damageTrade') {
    exact(record, ['kind', 'response'], [], label);
    if (record.response !== 'accept' && record.response !== 'decline')
      fail(`${label}.response is unsupported`);
    return Object.freeze({ kind: record.kind, response: record.response });
  }
  if (record.kind === 'traitTrade') {
    exact(record, ['kind', 'traitKey', 'response'], [], label);
    if (record.response !== 'accept' && record.response !== 'decline')
      fail(`${label}.response is unsupported`);
    return Object.freeze({
      kind: 'traitTrade' as const,
      traitKey: stringValue(record.traitKey, `${label}.traitKey`),
      response: record.response,
    });
  }
  if (record.kind === 'damageContest') {
    exact(record, ['kind', 'result'], [], label);
    if (record.result !== 'success' && record.result !== 'failure')
      fail(`${label}.result is unsupported`);
    return Object.freeze({ kind: 'damageContest' as const, result: record.result });
  }
  fail(`${label}.kind is unsupported`);
}

export function transaction(value: unknown, label: string): ExecutionTimelineTransaction {
  const record = object(value, label);
  const kind = record.kind;
  if (kind === 'acquisition') {
    exact(
      record,
      ['kind', 'owner', 'sourceOwner', 'reward', 'producerLifecycleKey', 'roles', 'window'],
      [],
      label,
    );
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, 256),
      sourceOwner: stringValue(record.sourceOwner, `${label}.sourceOwner`, 256),
      reward: reward(record.reward, `${label}.reward`),
      producerLifecycleKey: stringValue(
        record.producerLifecycleKey,
        `${label}.producerLifecycleKey`,
      ),
      roles: Object.freeze(
        array(record.roles, `${label}.roles`).map((entry, index) =>
          acquisitionRole(entry, `${label}.roles[${index}]`),
        ),
      ),
      window: lifecycleWindow(record.window, `${label}.window`),
    });
  }
  if (kind === 'encounterInteraction') {
    exact(record, ['kind', 'owner', 'phaseKey', 'window'], ['resolution'], label);
    const resolution =
      record.resolution === undefined
        ? undefined
        : object(record.resolution, `${label}.resolution`);
    if (
      resolution !== undefined &&
      resolution.kind !== 'traitOffer' &&
      resolution.kind !== 'nemesisRandomEvent'
    )
      fail(`${label}.resolution.kind is unsupported`);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, 256),
      phaseKey: stringValue(record.phaseKey, `${label}.phaseKey`),
      ...(resolution === undefined
        ? {}
        : {
            resolution:
              resolution.kind === 'traitOffer'
                ? Object.freeze({
                    kind: 'traitOffer' as const,
                    offer: traitOffer(resolution.offer, `${label}.resolution.offer`),
                  })
                : Object.freeze({
                    kind: 'nemesisRandomEvent' as const,
                    outcome: nemesisOutcome(resolution.outcome, `${label}.resolution.outcome`),
                  }),
          }),
      window: lifecycleWindow(record.window, `${label}.window`),
    });
  }
  if (kind === 'automatic') {
    exact(
      record,
      ['kind', 'owner', 'effect', 'phaseKey', 'source', 'target', 'window'],
      ['rarity'],
      label,
    );
    if (record.effect !== 'steadyGrowth' && record.effect !== 'transcendentEmbryo')
      fail(`${label}.effect is unsupported`);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, 256),
      effect: record.effect,
      phaseKey: stringValue(record.phaseKey, `${label}.phaseKey`),
      source: stringValue(record.source, `${label}.source`),
      target: stringValue(record.target, `${label}.target`),
      ...(record.rarity === undefined
        ? {}
        : { rarity: stringValue(record.rarity, `${label}.rarity`) }),
      window: lifecycleWindow(record.window, `${label}.window`),
    });
  }
  if (kind === 'shopPurchase') {
    exact(
      record,
      [
        'kind',
        'owner',
        'window',
        'offerKey',
        'rewardType',
        'sourceOwner',
        'reward',
        'producerLifecycleKey',
        'roles',
      ],
      [],
      label,
    );
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, 256),
      window: lifecycleWindow(record.window, `${label}.window`),
      offerKey: stringValue(record.offerKey, `${label}.offerKey`),
      rewardType: stringValue(record.rewardType, `${label}.rewardType`),
      sourceOwner: stringValue(record.sourceOwner, `${label}.sourceOwner`, 256),
      reward: reward(record.reward, `${label}.reward`),
      producerLifecycleKey: stringValue(
        record.producerLifecycleKey,
        `${label}.producerLifecycleKey`,
      ),
      roles: Object.freeze(
        array(record.roles, `${label}.roles`).map((entry, index) =>
          acquisitionRole(entry, `${label}.roles[${index}]`),
        ),
      ),
    });
  }
  if (kind === 'wellPurchase') {
    exact(
      record,
      ['kind', 'owner', 'window', 'offerKey', 'generationKey', 'effect', 'extendedDirectPurchase'],
      ['twistResultKey'],
      label,
    );
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, 256),
      window: lifecycleWindow(record.window, `${label}.window`),
      offerKey: stringValue(record.offerKey, `${label}.offerKey`),
      generationKey: wellGenerationKey(record.generationKey, `${label}.generationKey`),
      effect: (() => {
        if (
          record.effect !== 'neutral' &&
          record.effect !== 'spark' &&
          record.effect !== 'discount' &&
          record.effect !== 'emptySlot' &&
          record.effect !== 'extended' &&
          record.effect !== 'yarn' &&
          record.effect !== 'hymn' &&
          record.effect !== 'twist' &&
          record.effect !== 'lastStand'
        )
          fail(`${label}.effect is unsupported`);
        return record.effect;
      })(),
      extendedDirectPurchase: booleanValue(
        record.extendedDirectPurchase,
        `${label}.extendedDirectPurchase`,
      ),
      ...(record.twistResultKey === undefined
        ? {}
        : { twistResultKey: stringValue(record.twistResultKey, `${label}.twistResultKey`) }),
    });
  }
  if (kind === 'poolSale') {
    exact(record, ['kind', 'owner', 'window', 'slotKey', 'traitKey'], [], label);
    if (!['left', 'middle', 'right'].includes(record.slotKey as string))
      fail(`${label}.slotKey is unsupported`);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, 256),
      window: lifecycleWindow(record.window, `${label}.window`),
      slotKey: record.slotKey as 'left' | 'middle' | 'right',
      traitKey: stringValue(record.traitKey, `${label}.traitKey`),
    });
  }
  if (kind === 'keepsakeChange') {
    exact(record, ['kind', 'owner', 'window', 'keepsakeKey'], ['equipResults'], label);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, 256),
      window: lifecycleWindow(record.window, `${label}.window`),
      keepsakeKey: stringValue(record.keepsakeKey, `${label}.keepsakeKey`),
      ...(record.equipResults === undefined
        ? {}
        : { equipResults: equipResults(record.equipResults, `${label}.equipResults`) }),
    });
  }
  if (kind === 'fountainUse') {
    exact(record, ['kind', 'owner', 'window'], ['aromaticPhialTarget'], label);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, 256),
      window: lifecycleWindow(record.window, `${label}.window`),
      ...(record.aromaticPhialTarget === undefined
        ? {}
        : {
            aromaticPhialTarget: stringValue(
              record.aromaticPhialTarget,
              `${label}.aromaticPhialTarget`,
            ),
          }),
    });
  }
  fail(`${label}.kind is unsupported`);
}

export function timeline(value: unknown, label: string): ExecutionTimeline {
  const record = object(value, label);
  exact(record, ['transactions', 'dependencies', 'obligations', 'streams'], [], label);
  const transactions = array(record.transactions, `${label}.transactions`).map((entry, index) =>
    transaction(entry, `${label}.transactions[${index}]`),
  );
  const dependencies = array(record.dependencies, `${label}.dependencies`).map((entry, index) => {
    const row = object(entry, `${label}.dependencies[${index}]`);
    exact(row, ['owner', 'afterOwner'], [], `${label}.dependencies[${index}]`);
    return Object.freeze({
      owner: stringValue(row.owner, `${label}.dependencies[${index}].owner`, 256),
      afterOwner: stringValue(row.afterOwner, `${label}.dependencies[${index}].afterOwner`, 256),
    });
  });
  const obligations = array(record.obligations, `${label}.obligations`).map((entry, index) => {
    const row = object(entry, `${label}.obligations[${index}]`);
    exact(row, ['owner', 'checkpoint'], [], `${label}.obligations[${index}]`);
    if (
      !['roomEntered', 'outgoingGeneration', 'exitUsable', 'roomExit'].includes(
        row.checkpoint as string,
      )
    )
      fail(`${label}.obligations[${index}].checkpoint is unsupported`);
    return Object.freeze({
      owner: stringValue(row.owner, `${label}.obligations[${index}].owner`, 256),
      checkpoint: row.checkpoint as
        'roomEntered' | 'outgoingGeneration' | 'exitUsable' | 'roomExit',
    });
  });
  const streams = array(record.streams, `${label}.streams`).map((entry, index) => {
    const row = object(entry, `${label}.streams[${index}]`);
    exact(row, ['key', 'owners'], [], `${label}.streams[${index}]`);
    return Object.freeze({
      key: stringValue(row.key, `${label}.streams[${index}].key`),
      owners: Object.freeze(stringArray(row.owners, `${label}.streams[${index}].owners`)),
    });
  });
  return Object.freeze({
    transactions: Object.freeze(transactions),
    dependencies: Object.freeze(dependencies),
    obligations: Object.freeze(obligations),
    streams: Object.freeze(streams),
  });
}

export function wellRetainedEffects(
  value: unknown,
  label: string,
): readonly ExecutionWellRetainedEffectCorrelation[] {
  return Object.freeze(
    array(value, label).map((entry, index) => {
      const row = object(entry, `${label}[${index}]`);
      exact(row, ['producerOwner', 'effect', 'consumerOwner'], [], `${label}[${index}]`);
      if (row.effect !== 'extended' && row.effect !== 'yarn' && row.effect !== 'hymn')
        fail(`${label}[${index}].effect is unsupported`);
      return Object.freeze({
        producerOwner: stringValue(row.producerOwner, `${label}[${index}].producerOwner`, 256),
        effect: row.effect,
        consumerOwner: stringValue(row.consumerOwner, `${label}[${index}].consumerOwner`, 256),
      });
    }),
  );
}
