import type { ExecutionAssemblerInput, ExecutionStartingLoadout } from '../model';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import type { RunStateSnapshot } from '../../simulation/rewards/run-state';

/** Assemble the one immutable run-start contract from the evaluated opening. */
export function executionStartingLoadout(
  assembly: ExecutionAssemblerInput['assembly'],
  openingSnapshot: RunStateSnapshot | undefined,
): ExecutionStartingLoadout {
  if (openingSnapshot === undefined)
    throw new CompilerError(
      'executionCoverageMissing',
      'opening room lacks start-loadout evidence',
    );
  const loadout = assembly.project.route.loadout;
  if (openingSnapshot.arcanaFear.arcana.active.some((card) => card.origin === 'temporary'))
    throw new CompilerError(
      'executionCoverageMissing',
      'route-start Arcana snapshot contains a temporary activation',
    );
  const hex = openingSnapshot.hexProgress;
  let startingHex: ExecutionStartingLoadout['startingHex'];
  if (loadout.aspectKey === 'SuitHexAspect') {
    if (
      loadout.aspectHexTree === undefined ||
      hex.spellTraitKey !== 'SpellMoonBeamTrait' ||
      hex.tree === undefined
    )
      throw new CompilerError(
        'executionCoverageMissing',
        'Selene aspect lacks Sky Fall start evidence',
      );
    const modeled = new Set([...hex.tree.rareTalentKeys, ...hex.tree.epicTalentKeys]);
    const extension = openingSnapshot.hexObserver.talentKeys.filter((key) => !modeled.has(key));
    if (hex.godSentAdded === true && (extension.length !== 2 || extension[0] === extension[1]))
      throw new CompilerError(
        'executionCoverageMissing',
        'Selene God Sent start evidence is not an exact pair',
      );
    if (hex.godSentAdded !== true && extension.length !== 0)
      throw new CompilerError(
        'executionCoverageMissing',
        'Selene start tree has an unmodeled God Sent pair',
      );
    startingHex = Object.freeze({
      spellTraitKey: 'SpellMoonBeamTrait',
      layoutKey: hex.tree.layoutKey,
      rareTalentKeys: Object.freeze([...hex.tree.rareTalentKeys]),
      epicTalentKeys: Object.freeze([...hex.tree.epicTalentKeys]),
      ...(hex.godSentAdded === true
        ? {
            godSent: Object.freeze({
              olympianTalentKey: extension[0]!,
              lineageTalentKey: extension[1]!,
            }),
          }
        : {}),
    });
  }
  return Object.freeze({
    weaponKey: loadout.weaponKey,
    aspectKey: loadout.aspectKey,
    arcana: Object.freeze(
      openingSnapshot.arcanaFear.arcana.active
        .filter(
          (card): card is typeof card & { readonly origin: 'manual' | 'automatic' } =>
            card.origin === 'manual' || card.origin === 'automatic',
        )
        .map((card) =>
          Object.freeze({
            key: card.key,
            origin: card.origin,
            rarity: card.rarity as 'Common' | 'Rare' | 'Epic' | 'Heroic',
          }),
        ),
    ),
    fear: Object.freeze({
      configuredRanks: Object.freeze({ ...openingSnapshot.arcanaFear.fear.configuredRanks }),
      effectiveRanks: Object.freeze({ ...openingSnapshot.arcanaFear.fear.effectiveRanks }),
    }),
    ...(startingHex === undefined ? {} : { startingHex }),
  });
}
