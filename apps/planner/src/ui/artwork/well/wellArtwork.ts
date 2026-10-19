import iconArchaicSeal from './assets/ArchaicSeal.webp';
import iconBraidOfAtlas from './assets/BraidOfAtlas.webp';
import iconBreathOfEros from './assets/BreathOfEros.webp';
import iconCentaurSoul from './assets/CentaurSoul.webp';
import iconCharityBottle from './assets/CharityBottle.webp';
import iconChimaeraJerky from './assets/ChimaeraJerky.webp';
import iconDanaidDagger from './assets/DanaidDagger.webp';
import iconDustParcel from './assets/DustParcel.webp';
import iconExhumedRemains from './assets/ExhumedRemains.webp';
import iconFaintFlicker from './assets/FaintFlicker.webp';
import iconFatefulTwist from './assets/FatefulTwist.webp';
import iconFerryVoucher from './assets/FerryVoucher.webp';
import iconGaiasGift from './assets/GaiasGift.webp';
import iconHydralite from './assets/Hydralite.webp';
import iconIgnitedIchor from './assets/IgnitedIchor.webp';
import iconKissOfStyx from './assets/KissOfStyx.webp';
import iconLifeEssence from './assets/LifeEssence.webp';
import iconMistVeil from './assets/MistVeil.webp';
import iconPriceOfMidas from './assets/PriceOfMidas.webp';
import iconPythonScales from './assets/PythonScales.webp';
import iconSacrificialHymn from './assets/SacrificialHymn.webp';
import iconSparkOfIxion from './assets/SparkOfIxion.webp';
import iconSplinteredShield from './assets/SplinteredShield.webp';
import iconWitchsMark from './assets/WitchsMark.webp';
import iconYarnOfAriadne from './assets/YarnOfAriadne.webp';

/** Well of Charon item icons by catalog shop option key; `null` marks a key with no icon yet. */
export const wellArtwork: Readonly<Record<string, string | null>> = {
  ArmorBoostStore: iconSplinteredShield,
  DamageSelfDrop: iconPriceOfMidas,
  HealDropRange: iconLifeEssence,
  EmptyMaxHealthShopItem: iconCentaurSoul,
  FirstHitHealTrait: iconBreathOfEros,
  TemporaryDoorHealTrait: iconHydralite,
  TemporaryHealExpirationTrait: iconCharityBottle,
  LastStandShopItem: iconKissOfStyx,
  TemporaryImprovedSecondaryTrait: iconChimaeraJerky,
  TemporaryImprovedCastTrait: iconBraidOfAtlas,
  TemporaryMoveSpeedTrait: iconIgnitedIchor,
  TemporaryBoonRarityTrait: iconYarnOfAriadne,
  TemporaryImprovedExTrait: iconWitchsMark,
  TemporaryImprovedDefenseTrait: iconPythonScales,
  TemporaryDiscountTrait: iconFerryVoucher,
  TemporaryForcedSecretDoorTrait: iconSparkOfIxion,
  TemporaryEmptySlotDamageTrait: iconDanaidDagger,
  ExtendedShopTrait: iconArchaicSeal,
  MetaCurrencyRange: iconExhumedRemains,
  MetaCardPointsCommonRange: iconDustParcel,
  MemPointsCommonRange: iconFaintFlicker,
  SeedMysteryRange: iconGaiasGift,
  RandomStoreItem: iconFatefulTwist,
  LimitedManaRegenDrop: iconMistVeil,
  LimitedSwapTraitDrop: iconSacrificialHymn,
};
