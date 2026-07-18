import type { RawPayloadDomainDeclaration } from '../types';

export const rewardPayloadDomains = [
  {
    key: 'BoonSource',
    kind: 'oneOf',
    values: [
      'AphroditeUpgrade',
      'ApolloUpgrade',
      'AresUpgrade',
      'DemeterUpgrade',
      'HephaestusUpgrade',
      'HeraUpgrade',
      'HestiaUpgrade',
      'PoseidonUpgrade',
      'ZeusUpgrade',
    ],
  },
  {
    key: 'DevotionPair',
    kind: 'distinctPair',
    valueDomain: 'BoonSource',
  },
] as const satisfies readonly RawPayloadDomainDeclaration[];
