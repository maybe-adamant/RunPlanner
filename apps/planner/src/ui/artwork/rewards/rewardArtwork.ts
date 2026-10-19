import iconAir from './assets/Air.webp';
import iconAllElements from './assets/AllElements.webp';
import iconAnvil from './assets/Anvil.webp';
import iconAphrodite from './assets/Aphrodite.webp';
import iconApollo from './assets/Apollo.webp';
import iconAres from './assets/Ares.webp';
import iconArmor from './assets/Armor.webp';
import iconArmorBigBoostShop from './assets/ArmorBigBoostShop.webp';
import iconAshes from './assets/Ashes.webp';
import iconBones from './assets/Bones.webp';
import iconBoon2 from './assets/Boon2.webp';
import iconChampionOfElysium from './assets/ChampionOfElysium.webp';
import iconChaos from './assets/Chaos.webp';
import iconClockworkCountdown5 from './assets/ClockworkCountdown5.webp';
import iconDemeter from './assets/Demeter.webp';
import iconEarth from './assets/Earth.webp';
import iconEmptyMaxHealth from './assets/EmptyMaxHealth.webp';
import iconFire from './assets/Fire.webp';
import iconGold from './assets/Gold.webp';
import iconHammer from './assets/Hammer.webp';
import iconHeal from './assets/Heal.webp';
import iconHealBigDrop from './assets/HealBigDrop.webp';
import iconHephaestus from './assets/Hephaestus.webp';
import iconHera from './assets/Hera.webp';
import iconHermes from './assets/Hermes.webp';
import iconHestia from './assets/Hestia.webp';
import iconKissOfStyx from './assets/KissOfStyx.webp';
import iconMaxHealth from './assets/MaxHealth.webp';
import iconMaxHealthDropBigPreview from './assets/MaxHealthDropBigPreview.webp';
import iconMaxMagick from './assets/MaxMagick.webp';
import iconMaxManaDropBigPreview from './assets/MaxManaDropBigPreview.webp';
import iconMetaCardPointsCommonBigDrop from './assets/MetaCardPointsCommonBigDrop.webp';
import iconMetaCurrencyBigDrop from './assets/MetaCurrencyBigDrop.webp';
import iconMoonDust from './assets/MoonDust.webp';
import iconMysteryBox from './assets/MysteryBox.webp';
import iconNectar from './assets/Nectar.webp';
import iconNightmare from './assets/Nightmare.webp';
import iconObolPoints from './assets/ObolPoints.webp';
import iconOnion from './assets/Onion.webp';
import iconPathOfStars from './assets/PathOfStars.webp';
import iconPomOfPower from './assets/PomOfPower.webp';
import iconPomSlice from './assets/PomSlice.webp';
import iconPoseidon from './assets/Poseidon.webp';
import iconPsyche from './assets/Psyche.webp';
import iconRoomMoneyTripleDropPreview from './assets/RoomMoneyTripleDropPreview.webp';
import iconSelenesGift from './assets/SelenesGift.webp';
import iconShop from './assets/Shop.webp';
import iconStackUpgradeBigPreview from './assets/StackUpgradeBigPreview.webp';
import iconStackUpgradeTriplePreview from './assets/StackUpgradeTriplePreview.webp';
import iconStory from './assets/Story.webp';
import iconWater from './assets/Water.webp';
import iconZeus from './assets/Zeus.webp';

/** Reward icons by catalog reward type; `null` marks a key with no icon yet. */
export const rewardArtwork: Readonly<Record<string, string | null>> = {
  AphroditeUpgrade: iconAphrodite,
  ApolloUpgrade: iconApollo,
  AresUpgrade: iconAres,
  DemeterUpgrade: iconDemeter,
  HephaestusUpgrade: iconHephaestus,
  HeraUpgrade: iconHera,
  HestiaUpgrade: iconHestia,
  PoseidonUpgrade: iconPoseidon,
  ZeusUpgrade: iconZeus,
  HermesUpgrade: iconHermes,
  StackUpgrade: iconPomOfPower,
  StackUpgradeBig: iconStackUpgradeBigPreview,
  StackUpgradeTriple: iconStackUpgradeTriplePreview,
  WeaponUpgrade: iconHammer,
  SpellDrop: iconSelenesGift,
  MaxHealthDrop: iconMaxHealth,
  MaxHealthDropBig: iconMaxHealthDropBigPreview,
  MaxHealthDropSmall: iconMaxHealth,
  EmptyMaxHealthSmallDrop: iconEmptyMaxHealth,
  EmptyMaxHealthDrop: iconEmptyMaxHealth,
  MaxManaDrop: iconMaxMagick,
  MaxManaDropBig: iconMaxManaDropBigPreview,
  MaxManaDropSmall: iconMaxMagick,
  Currency: iconGold,
  RoomMoneyDrop: iconGold,
  RoomMoneySmallDrop: iconGold,
  RoomMoneyTripleDrop: iconRoomMoneyTripleDropPreview,
  RoomMoneyTinyDrop: iconGold,
  TalentDrop: iconPathOfStars,
  TalentBigDrop: iconPathOfStars,
  MinorTalentDrop: iconPathOfStars,
  RoomRewardHealDrop: iconHeal,
  HealDrop: iconHeal,
  HealDropMinor: iconHeal,
  HealBigDrop: iconHealBigDrop,
  RoomRewardConsolationPrize: iconOnion,
  ArmorBoost: iconArmor,
  ArmorBigBoost: iconArmorBigBoostShop,
  AirBoost: iconAir,
  EarthBoost: iconEarth,
  FireBoost: iconFire,
  WaterBoost: iconWater,
  ElementalBoost: iconAllElements,
  StoreRewardRandomStack: iconPomSlice,
  LastStandDrop: iconKissOfStyx,
  ChaosWeaponUpgrade: iconAnvil,
  InfernalContractBoon: iconChampionOfElysium,
  TrialUpgrade: iconChaos,
  GiftDrop: iconNectar,
  MetaCurrencyDrop: iconBones,
  MetaCurrencyBigDrop: iconMetaCurrencyBigDrop,
  MetaCardPointsCommonDrop: iconAshes,
  MetaCardPointsCommonBigDrop: iconMetaCardPointsCommonBigDrop,
  MemPointsCommonDrop: iconPsyche,
  WeaponPointsRareDrop: iconNightmare,
  CardUpgradePointsDrop: iconMoonDust,
  CharonPointsDrop: iconObolPoints,
  Boon: iconBoon2,
  Devotion: null,
  RandomLoot: iconBoon2,
  BlindBoxLoot: iconMysteryBox,
  WeaponUpgradeDrop: iconHammer,
  ShopHermesUpgrade: iconHermes,
  Story: iconStory,
  Shop: iconShop,
  ClockworkGoal: iconClockworkCountdown5,
};
