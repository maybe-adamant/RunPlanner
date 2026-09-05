import type {
  ExecutionLifecycleWindow,
  ExecutionTimeline,
  ExecutionTimelineTransaction,
} from '../model';
import {
  MAX_OWNER_STRING,
  array,
  booleanValue,
  exact,
  fail,
  object,
  numberRecord,
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
  if (record.kind === 'bossDefeated') {
    exact(record, ['kind', 'phaseKey'], [], label);
    return Object.freeze({
      kind: 'bossDefeated',
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
    exact(record, ['kind', 'itemGameName'], [], label);
    return Object.freeze({
      kind: 'freeItem' as const,
      itemGameName: stringValue(record.itemGameName, `${label}.itemGameName`),
    });
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
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      sourceOwner: stringValue(record.sourceOwner, `${label}.sourceOwner`, MAX_OWNER_STRING),
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
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
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
    if (record.effect === 'judgment' || record.effect === 'crystalFigurine') {
      exact(
        record,
        ['kind', 'owner', 'effect', 'phaseKey', 'arcanaKeys', 'rarity', 'window'],
        [],
        label,
      );
      return Object.freeze({
        kind,
        owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
        effect: record.effect,
        phaseKey: stringValue(record.phaseKey, `${label}.phaseKey`),
        arcanaKeys: Object.freeze(stringArray(record.arcanaKeys, `${label}.arcanaKeys`)),
        rarity: stringValue(record.rarity, `${label}.rarity`),
        window: lifecycleWindow(record.window, `${label}.window`),
      });
    }
    if (record.effect === 'transcendentEmbryo') {
      exact(
        record,
        [
          'kind',
          'owner',
          'effect',
          'phaseKey',
          'source',
          'target',
          'rarity',
          'blessingValues',
          'window',
        ],
        [],
        label,
      );
      return Object.freeze({
        kind,
        owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
        effect: 'transcendentEmbryo' as const,
        phaseKey: stringValue(record.phaseKey, `${label}.phaseKey`),
        source: stringValue(record.source, `${label}.source`),
        target: stringValue(record.target, `${label}.target`),
        rarity: stringValue(record.rarity, `${label}.rarity`),
        blessingValues: numberRecord(record.blessingValues, `${label}.blessingValues`),
        window: lifecycleWindow(record.window, `${label}.window`),
      });
    }
    exact(
      record,
      ['kind', 'owner', 'effect', 'phaseKey', 'source', 'target', 'window'],
      ['rarity'],
      label,
    );
    if (record.effect !== 'steadyGrowth') fail(`${label}.effect is unsupported`);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
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
    const roles = Object.freeze(
      array(record.roles, `${label}.roles`).map((entry, index) =>
        acquisitionRole(entry, `${label}.roles[${index}]`),
      ),
    );
    if (roles.some((role) => role.seaStarResult !== undefined))
      fail(`${label}.roles may not publish Sea Star results for purchases`);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window: lifecycleWindow(record.window, `${label}.window`),
      offerKey: stringValue(record.offerKey, `${label}.offerKey`),
      rewardType: stringValue(record.rewardType, `${label}.rewardType`),
      sourceOwner: stringValue(record.sourceOwner, `${label}.sourceOwner`, MAX_OWNER_STRING),
      reward: reward(record.reward, `${label}.reward`),
      producerLifecycleKey: stringValue(
        record.producerLifecycleKey,
        `${label}.producerLifecycleKey`,
      ),
      roles,
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
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
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
  if (kind === 'wellRefill') {
    exact(
      record,
      ['kind', 'owner', 'window', 'generationKey', 'offerKey', 'effect'],
      ['twistResultKey'],
      label,
    );
    if (record.generationKey !== 'travelDealRefill') fail(`${label}.generationKey is unsupported`);
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
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window: lifecycleWindow(record.window, `${label}.window`),
      generationKey: 'travelDealRefill' as const,
      offerKey: stringValue(record.offerKey, `${label}.offerKey`),
      effect: record.effect,
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
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window: lifecycleWindow(record.window, `${label}.window`),
      slotKey: record.slotKey as 'left' | 'middle' | 'right',
      traitKey: stringValue(record.traitKey, `${label}.traitKey`),
    });
  }
  if (kind === 'keepsakeChange') {
    exact(record, ['kind', 'owner', 'window', 'keepsakeKey'], ['equipResults'], label);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window: lifecycleWindow(record.window, `${label}.window`),
      keepsakeKey: stringValue(record.keepsakeKey, `${label}.keepsakeKey`),
      ...(record.equipResults === undefined
        ? {}
        : { equipResults: equipResults(record.equipResults, `${label}.equipResults`) }),
    });
  }
  if (kind === 'fountainUse') {
    exact(record, ['kind', 'owner', 'interactionKey', 'window'], ['aromaticPhialTarget'], label);
    if (record.interactionKey !== 'fountain') fail(`${label}.interactionKey is unsupported`);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      interactionKey: 'fountain',
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
  exact(record, ['transactions', 'dependencies', 'obligations'], [], label);
  const transactions = array(record.transactions, `${label}.transactions`).map((entry, index) =>
    transaction(entry, `${label}.transactions[${index}]`),
  );
  const dependencies = array(record.dependencies, `${label}.dependencies`).map((entry, index) => {
    const row = object(entry, `${label}.dependencies[${index}]`);
    exact(row, ['owner', 'afterOwner'], [], `${label}.dependencies[${index}]`);
    return Object.freeze({
      owner: stringValue(row.owner, `${label}.dependencies[${index}].owner`, MAX_OWNER_STRING),
      afterOwner: stringValue(
        row.afterOwner,
        `${label}.dependencies[${index}].afterOwner`,
        MAX_OWNER_STRING,
      ),
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
      owner: stringValue(row.owner, `${label}.obligations[${index}].owner`, MAX_OWNER_STRING),
      checkpoint: row.checkpoint as
        'roomEntered' | 'outgoingGeneration' | 'exitUsable' | 'roomExit',
    });
  });
  const obligationCounts = new Map<string, number>();
  for (const obligation of obligations)
    obligationCounts.set(obligation.owner, (obligationCounts.get(obligation.owner) ?? 0) + 1);
  for (const transaction of transactions) {
    if (obligationCounts.get(transaction.owner) !== 1)
      fail(`${label} must publish exactly one obligation for ${transaction.owner}`);
  }
  return Object.freeze({
    transactions: Object.freeze(transactions),
    dependencies: Object.freeze(dependencies),
    obligations: Object.freeze(obligations),
  });
}
