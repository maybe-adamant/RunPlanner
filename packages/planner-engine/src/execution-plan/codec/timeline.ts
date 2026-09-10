import type {
  ExecutionLifecycleWindow,
  ExecutionTimeline,
  ExecutionTimelineTransaction,
  ExecutionTravelDealRefill,
  ExecutionVolatileKeepsakeEquipResults,
} from '../model';
import {
  MAX_OWNER_STRING,
  array,
  booleanValue,
  exact,
  fail,
  integer,
  object,
  numberRecord,
  stringArray,
  stringValue,
} from './primitives';
import { acquisitionRole, anvilResult, equipResults, reward, traitOffer } from './rewards';

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
  if (record.kind === 'shipPreCombat' || record.kind === 'shipPostCombat') {
    exact(record, ['kind', 'wheelKey'], [], label);
    return Object.freeze({
      kind: record.kind,
      wheelKey: stringValue(record.wheelKey, `${label}.wheelKey`),
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

function wellEffect(value: unknown, label: string) {
  if (
    value !== 'neutral' &&
    value !== 'spark' &&
    value !== 'discount' &&
    value !== 'emptySlot' &&
    value !== 'extended' &&
    value !== 'yarn' &&
    value !== 'hymn' &&
    value !== 'twist' &&
    value !== 'lastStand'
  )
    fail(`${label} is unsupported`);
  return value;
}

function travelDealRefill(value: unknown, label: string): ExecutionTravelDealRefill {
  const record = object(value, label);
  if (record.carrier === 'worldShop') {
    exact(record, ['carrier', 'source', 'replacement'], [], label);
    const source = object(record.source, `${label}.source`);
    exact(source, ['owner', 'offerKey'], [], `${label}.source`);
    const replacement = object(record.replacement, `${label}.replacement`);
    exact(
      replacement,
      ['slotIndex', 'groupIndex', 'optionKey', 'reward'],
      [],
      `${label}.replacement`,
    );
    return Object.freeze({
      carrier: 'worldShop',
      source: Object.freeze({
        owner: stringValue(source.owner, `${label}.source.owner`, MAX_OWNER_STRING),
        offerKey: stringValue(source.offerKey, `${label}.source.offerKey`),
      }),
      replacement: Object.freeze({
        slotIndex: integer(replacement.slotIndex, `${label}.replacement.slotIndex`),
        groupIndex: integer(replacement.groupIndex, `${label}.replacement.groupIndex`),
        optionKey: stringValue(replacement.optionKey, `${label}.replacement.optionKey`),
        reward: reward(replacement.reward, `${label}.replacement.reward`),
      }),
    });
  }
  if (record.carrier === 'stygianWell') {
    exact(record, ['carrier', 'source', 'replacement'], [], label);
    const source = object(record.source, `${label}.source`);
    exact(source, ['owner', 'generationKey'], [], `${label}.source`);
    const generationKey = stringValue(source.generationKey, `${label}.source.generationKey`);
    if (
      generationKey !== 'initial:healing' &&
      generationKey !== 'initial:secondLeft' &&
      generationKey !== 'initial:secondRight'
    )
      fail(`${label}.source.generationKey is unsupported`);
    const replacement = object(record.replacement, `${label}.replacement`);
    exact(
      replacement,
      ['generationKey', 'offerKey', 'effect'],
      ['twistResultKey'],
      `${label}.replacement`,
    );
    if (replacement.generationKey !== 'travelDealRefill')
      fail(`${label}.replacement.generationKey is unsupported`);
    return Object.freeze({
      carrier: 'stygianWell',
      source: Object.freeze({
        owner: stringValue(source.owner, `${label}.source.owner`, MAX_OWNER_STRING),
        generationKey: generationKey as
          'initial:healing' | 'initial:secondLeft' | 'initial:secondRight',
      }),
      replacement: Object.freeze({
        generationKey: 'travelDealRefill' as const,
        offerKey: stringValue(replacement.offerKey, `${label}.replacement.offerKey`),
        effect: wellEffect(replacement.effect, `${label}.replacement.effect`),
        ...(replacement.twistResultKey === undefined
          ? {}
          : {
              twistResultKey: stringValue(
                replacement.twistResultKey,
                `${label}.replacement.twistResultKey`,
              ),
            }),
      }),
    });
  }
  if (record.carrier === 'hermesShrine') {
    exact(record, ['carrier', 'source', 'replacement'], [], label);
    const source = object(record.source, `${label}.source`);
    exact(source, ['generationKey', 'slotIndex'], [], `${label}.source`);
    const generationKey = stringValue(source.generationKey, `${label}.source.generationKey`);
    if (
      generationKey !== 'initial:first' &&
      generationKey !== 'initial:secondLeft' &&
      generationKey !== 'initial:secondRight'
    )
      fail(`${label}.source.generationKey is unsupported`);
    const sourceSlotIndex = integer(source.slotIndex, `${label}.source.slotIndex`, 1);
    if (sourceSlotIndex > 3) fail(`${label}.source.slotIndex is unsupported`);
    const replacement = object(record.replacement, `${label}.replacement`);
    exact(
      replacement,
      ['generationKey', 'slotIndex', 'optionKey', 'rewardType'],
      ['deliverySourceKey', 'purchase'],
      `${label}.replacement`,
    );
    if (replacement.generationKey !== 'travelDealRefill')
      fail(`${label}.replacement.generationKey is unsupported`);
    const replacementSlotIndex = integer(
      replacement.slotIndex,
      `${label}.replacement.slotIndex`,
      1,
    );
    if (replacementSlotIndex > 3 || replacementSlotIndex !== sourceSlotIndex)
      fail(`${label}.replacement.slotIndex must match source slotIndex`);
    const hasDelivery = replacement.deliverySourceKey !== undefined;
    const hasPurchase = replacement.purchase !== undefined;
    if (hasDelivery !== hasPurchase)
      fail(`${label}.replacement.purchase and deliverySourceKey must be paired`);
    const purchase =
      replacement.purchase === undefined
        ? undefined
        : (() => {
            const row = object(replacement.purchase, `${label}.replacement.purchase`);
            exact(row, ['roomDelay', 'rushed'], [], `${label}.replacement.purchase`);
            const roomDelay = integer(row.roomDelay, `${label}.replacement.purchase.roomDelay`);
            if (roomDelay < 2 || roomDelay > 8)
              fail(`${label}.replacement.purchase.roomDelay must be 2-8`);
            return Object.freeze({
              roomDelay: roomDelay as 2 | 3 | 4 | 5 | 6 | 7 | 8,
              rushed: booleanValue(row.rushed, `${label}.replacement.purchase.rushed`),
            });
          })();
    return Object.freeze({
      carrier: 'hermesShrine',
      source: Object.freeze({
        generationKey: generationKey as
          'initial:first' | 'initial:secondLeft' | 'initial:secondRight',
        slotIndex: sourceSlotIndex as 1 | 2 | 3,
      }),
      replacement: Object.freeze({
        generationKey: 'travelDealRefill' as const,
        slotIndex: replacementSlotIndex as 1 | 2 | 3,
        optionKey: stringValue(replacement.optionKey, `${label}.replacement.optionKey`),
        rewardType: stringValue(replacement.rewardType, `${label}.replacement.rewardType`),
        ...(replacement.deliverySourceKey === undefined
          ? {}
          : {
              deliverySourceKey: stringValue(
                replacement.deliverySourceKey,
                `${label}.replacement.deliverySourceKey`,
                MAX_OWNER_STRING,
              ),
            }),
        ...(purchase === undefined ? {} : { purchase }),
      }),
    });
  }
  fail(`${label}.carrier is unsupported`);
}

export function transaction(value: unknown, label: string): ExecutionTimelineTransaction {
  const record = object(value, label);
  const kind = record.kind;
  if (kind === 'chooseRewardWheel') {
    exact(record, ['kind', 'owner', 'window', 'wheelKey', 'pickedOfferKey'], [], label);
    const window = lifecycleWindow(record.window, `${label}.window`);
    if (window.kind !== 'shipPreCombat')
      fail(`${label}.window must be shipPreCombat for a wheel choice`);
    const wheelKey = stringValue(record.wheelKey, `${label}.wheelKey`);
    if (window.wheelKey !== wheelKey) fail(`${label}.window.wheelKey must match the wheel choice`);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window,
      wheelKey,
      pickedOfferKey: stringValue(record.pickedOfferKey, `${label}.pickedOfferKey`),
    });
  }
  if (kind === 'acquisition') {
    exact(
      record,
      ['kind', 'owner', 'sourceOwner', 'reward', 'producerLifecycleKey', 'roles', 'window'],
      ['hermesShrineSourceKey'],
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
      ...(record.hermesShrineSourceKey === undefined
        ? {}
        : {
            hermesShrineSourceKey: stringValue(
              record.hermesShrineSourceKey,
              `${label}.hermesShrineSourceKey`,
              MAX_OWNER_STRING,
            ),
          }),
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
  if (kind === 'itemEffect') {
    exact(record, ['kind', 'owner', 'window', 'itemKey', 'effect', 'extended'], [], label);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window: lifecycleWindow(record.window, `${label}.window`),
      itemKey: stringValue(record.itemKey, `${label}.itemKey`),
      effect: wellEffect(record.effect, `${label}.effect`),
      extended: booleanValue(record.extended, `${label}.extended`),
    });
  }
  if (kind === 'transformation') {
    exact(record, ['kind', 'owner', 'window', 'transformation'], [], label);
    const value = object(record.transformation, `${label}.transformation`);
    if (value.kind === 'anvilOfFates') {
      return Object.freeze({
        kind,
        owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
        window: lifecycleWindow(record.window, `${label}.window`),
        transformation: anvilResult(value, `${label}.transformation`),
      });
    }
    if (value.kind !== 'stygianWellTwist') fail(`${label}.transformation.kind is unsupported`);
    exact(value, ['kind', 'sourceItemKey', 'resultItemKey'], [], `${label}.transformation`);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window: lifecycleWindow(record.window, `${label}.window`),
      transformation: Object.freeze({
        kind: 'stygianWellTwist' as const,
        sourceItemKey: stringValue(value.sourceItemKey, `${label}.transformation.sourceItemKey`),
        resultItemKey: stringValue(value.resultItemKey, `${label}.transformation.resultItemKey`),
      }),
    });
  }
  if (kind === 'travelDealRefill') {
    exact(record, ['kind', 'owner', 'window', 'refill'], [], label);
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window: lifecycleWindow(record.window, `${label}.window`),
      refill: travelDealRefill(record.refill, `${label}.refill`),
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
  if (kind === 'keepsakeReplay') {
    exact(record, ['kind', 'owner', 'window', 'keepsakeKey', 'equipResults'], [], label);
    const window = lifecycleWindow(record.window, `${label}.window`);
    if (window.kind !== 'standard' || window.phase !== 'beforeCombat')
      fail(`${label}.window must be standard beforeCombat`);
    const decodedEquipResults = equipResults(record.equipResults, `${label}.equipResults`);
    const volatileKeys = ['experimentalHammer', 'transcendentEmbryo'].filter(
      (key) => decodedEquipResults[key as keyof typeof decodedEquipResults] !== undefined,
    );
    if (volatileKeys.length !== 1 || decodedEquipResults.jeweledPom !== undefined)
      fail(`${label}.equipResults must contain exactly one volatile replay result`);
    const replayResults: ExecutionVolatileKeepsakeEquipResults =
      decodedEquipResults.experimentalHammer === undefined
        ? { transcendentEmbryo: decodedEquipResults.transcendentEmbryo! }
        : { experimentalHammer: decodedEquipResults.experimentalHammer };
    return Object.freeze({
      kind,
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      window,
      keepsakeKey: stringValue(record.keepsakeKey, `${label}.keepsakeKey`),
      equipResults: replayResults,
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
  return Object.freeze({
    transactions: Object.freeze(transactions),
    dependencies: Object.freeze(dependencies),
    obligations: Object.freeze(obligations),
  });
}
