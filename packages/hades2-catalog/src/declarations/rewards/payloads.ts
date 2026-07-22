import type { RawRewardKernelInput } from './types';

export const ordinarySources = Object.freeze([
  'AphroditeUpgrade',
  'ApolloUpgrade',
  'AresUpgrade',
  'DemeterUpgrade',
  'HephaestusUpgrade',
  'HeraUpgrade',
  'HestiaUpgrade',
  'PoseidonUpgrade',
  'ZeusUpgrade',
]);

export const payloadDomains = [
  { key: 'BoonSource', kind: 'oneOf', values: ordinarySources },
  { key: 'DevotionPair', kind: 'distinctPair', valueDomain: 'BoonSource' },
] as const satisfies RawRewardKernelInput['payloadDomains'];
