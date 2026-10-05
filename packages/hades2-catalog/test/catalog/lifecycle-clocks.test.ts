import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

describe('declaration-owned lifecycle clocks', () => {
  it('declares Experimental Hammer use advancement independently of encounter depth', () => {
    for (const gameName of [
      'F_Combat02',
      'F_MiniBoss01',
      'F_Boss01',
      'G_Story01',
      'F_Reprieve01',
      'F_Shop01',
      'G_Intro',
      'N_Hub',
      'F_PostBoss01',
      'O_Combat04',
      'H_Combat02',
    ]) {
      expect(catalog.rooms.byKey[gameName]?.advancesExperimentalHammerUses, gameName).toBe(true);
    }
    expect(
      catalog.rooms.values
        .filter((room) => !room.advancesExperimentalHammerUses)
        .map((room) => room.gameName),
    ).toEqual([
      'N_Sub01',
      'N_Sub02',
      'N_Sub03',
      'N_Sub04',
      'N_Sub05',
      'N_Sub06',
      'N_Sub07',
      'N_Sub08',
      'N_Sub09',
      'N_Sub10',
      'N_Sub11',
      'N_Sub12',
      'N_Sub13',
      'N_Sub14',
      'N_Sub15',
    ]);
    const sideBinding = catalog.rooms.byKey.N_Sub01?.encounterSlotBindings[0];
    expect(sideBinding?.kind).toBe('set');
    if (sideBinding?.kind === 'set') expect(sideBinding.encounterSetKey).toBe('NEncountersSubRoom');
    expect(catalog.rooms.byKey.F_Opening01?.advancesExperimentalHammerUses).toBe(true);
    expect(
      catalog.rooms.values
        .filter((room) => room.gameName.startsWith('N_Sub'))
        .every(
          (room) =>
            room.ignoreEncounterUses &&
            room.skipRoomsPerUpgrade &&
            !room.advancesExperimentalHammerUses &&
            !room.advancesHermesShrineDeliveryUses,
        ),
    ).toBe(true);
  });

  it('declares delayed Hermes Shrine use advancement independently of room shape', () => {
    const ephyraSideRooms = catalog.rooms.values.filter(
      (room) => room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraSideRoom',
    );
    expect(ephyraSideRooms).not.toHaveLength(0);
    expect(ephyraSideRooms.every((room) => room.advancesHermesShrineDeliveryUses === false)).toBe(
      true,
    );
    expect(catalog.rooms.byKey.N_Sub10?.advancesHermesShrineDeliveryUses).toBe(false);
    expect(catalog.rooms.byKey.N_Hub?.advancesHermesShrineDeliveryUses).toBe(true);
    expect(catalog.rooms.byKey.O_Combat04?.advancesHermesShrineDeliveryUses).toBe(true);
    expect(
      catalog.encounterDefinitions.byKey.PreHubGeneratedN?.advancesHermesShrineDeliveryUses,
    ).toBe(true);
    expect(
      catalog.encounterDefinitions.byKey.GeneratedNSubRoom?.advancesHermesShrineDeliveryUses,
    ).toBe(true);
    expect(
      catalog.encounterDefinitions.byKey.GeneratedO_Intro01?.advancesHermesShrineDeliveryUses,
    ).toBe(true);
    expect(catalog.encounterDefinitions.byKey.GeneratedO_Intro01?.countsEncounterDepth).toBe(false);
    expect(
      catalog.encounterDefinitions.byKey.Story_Circe_01?.advancesHermesShrineDeliveryUses,
    ).toBe(false);
    expect(catalog.encounterDefinitions.byKey.DevotionTestO?.advancesHermesShrineDeliveryUses).toBe(
      true,
    );
  });

  it('pins every encounter definition that advances delayed Hermes Shrine deliveries', () => {
    // Audited allow-list: combat-bearing encounters only. A new or changed
    // envelope that opts in must be added here deliberately.
    expect(
      catalog.encounterDefinitions.values
        .filter((definition) => definition.advancesHermesShrineDeliveryUses)
        .map((definition) => definition.key),
    ).toEqual([
      'GeneratedAnomalyB',
      'BossZagreus01',
      'OpeningGeneratedF',
      'GeneratedF',
      'FIntroFight',
      'RadiatorIntro',
      'ScreamerIntro',
      'DevotionTestF',
      'ArtemisCombatF',
      'ArachneCombatF',
      'NemesisCombatF',
      'MiniBossTreant',
      'MiniBossFogEmitter',
      'MiniBossAssassin',
      'MiniBossTreant_Shrine',
      'MiniBossFogEmitter_Shrine',
      'BossHecate01',
      'BossHecate02',
      'FishmanIntro',
      'GeneratedG',
      'FishSwarmerIntro',
      'TurtleIntro',
      'DevotionTestG',
      'ArtemisCombatG',
      'ArachneCombatG',
      'NemesisCombatG',
      'MiniBossWaterUnit',
      'MiniBossCrawler',
      'MiniBossJellyfish',
      'BossScylla01',
      'BossScylla02',
      'GeneratedH_Passive',
      'GeneratedH_PassiveSmall',
      'GeneratedH',
      'GeneratedH_Treant2',
      'GeneratedH_Screamer2',
      'MournerIntro',
      'LamiaIntro',
      'LovesickIntro',
      'LycanthropeIntro',
      'NemesisCombatH',
      'MiniBossVampire',
      'MiniBossLamia',
      'BossInfestedCerberus01',
      'BossInfestedCerberus02',
      'ClockworkIntro',
      'GeneratedIChronosIntro',
      'GeneratedI_SmallChronosIntro',
      'GeneratedI',
      'GeneratedI_GoalReward',
      'GeneratedI_Small',
      'GeneratedI_Small_GoalReward',
      'DevotionTestI',
      'NemesisCombatI',
      'MiniBossRatCatcher',
      'MiniBossGoldElemental',
      'BossChronos01',
      'BossChronos02',
      'OpeningGeneratedN',
      'PreHubGeneratedN',
      'GeneratedN',
      'ArtemisCombatN',
      'HeraclesCombatN',
      'GeneratedN_Smaller',
      'GeneratedN_Bigger',
      'GeneratedNSubRoom',
      'GeneratedNSubRoom_Bigger',
      'MiniBossSatyrCrossbow',
      'MiniBossBoar',
      'BossPolyphemus01',
      'BossPolyphemus02',
      'GeneratedO_Intro01',
      'GeneratedO',
      'HeraclesCombatO',
      'IcarusCombatO',
      'MiniBossCharybdis',
      'MiniBossCaptain',
      'DevotionTestO',
      'BossEris01',
      'BossEris02',
      'PIntroCombat01',
      'PIntroCombat02',
      'PIntroCombat03',
      'PIntroCombat04',
      'PIntroCombat05',
      'PIntroCombat06',
      'PIntroCombat07',
      'PIntroCombat08',
      'PIntroCombat09',
      'PIntroCombat_DragonQuad',
      'PIntroCombat_ZombieFishing',
      'PIntroCombat_ZombieQuad',
      'PIntroCombat_SapperGate',
      'PIntroCombat_CrossbowStatues',
      'PIntroCombat_SapperOverlook',
      'GeneratedP_PreCombat',
      'P_Combat01_PreCombat01',
      'P_Combat01_PreCombat02',
      'P_Combat01_PreCombat03',
      'P_Combat01_PreCombat04',
      'P_Combat02_PreCombat01',
      'P_Combat02_PreCombat02',
      'P_Combat02_PreCombat03',
      'P_Combat03_PreCombat01',
      'P_Combat03_PreCombat02',
      'P_Combat03_PreCombat03',
      'P_Combat04_PreCombat01',
      'P_Combat04_PreCombat02',
      'P_Combat04_PreCombat03',
      'P_Combat05_PreCombat01',
      'P_Combat05_PreCombat02',
      'P_Combat05_PreCombat03',
      'P_Combat06_PreCombat01',
      'P_Combat06_PreCombat02',
      'P_Combat06_PreCombat03',
      'P_Combat06_PreCombat04',
      'P_Combat07_PreCombat01',
      'P_Combat07_PreCombat02',
      'P_Combat07_PreCombat03',
      'P_Combat08_PreCombat01',
      'P_Combat08_PreCombat02',
      'P_Combat08_PreCombat03',
      'P_Combat09_PreCombat01',
      'P_Combat09_PreCombat02',
      'P_Combat09_PreCombat03',
      'P_Combat10_PreCombat01',
      'P_Combat10_PreCombat02',
      'P_Combat10_PreCombat03',
      'P_Combat11_PreCombat01',
      'P_Combat11_PreCombat02',
      'P_Combat11_PreCombat03',
      'P_Combat11_PreCombat04',
      'P_Combat12_PreCombat01',
      'P_Combat12_PreCombat02',
      'P_Combat12_PreCombat03',
      'P_Combat13_PreCombat01',
      'P_Combat13_PreCombat02',
      'P_Combat13_PreCombat03',
      'P_Combat14_PreCombat01',
      'P_Combat14_PreCombat02',
      'P_Combat14_PreCombat03',
      'P_Combat15_PreCombat01',
      'P_Combat15_PreCombat02',
      'P_Combat15_PreCombat03',
      'P_Combat15_PreCombat04',
      'P_Combat16_PreCombat01',
      'P_Combat16_PreCombat02',
      'P_Combat16_PreCombat03',
      'GeneratedP',
      'GeneratedP_Large',
      'HeraclesCombatP',
      'IcarusCombatP',
      'AthenaCombatP',
      'MiniBossTalos',
      'MiniBossDragon',
      'BossPrometheus01',
      'BossPrometheus02',
      'GeneratedQ',
      'GeneratedQ_Islands',
      'GeneratedQ_Large',
      'MiniBossBrute',
      'MiniBossStalker',
      'BossTyphonTail01',
      'BossTyphonEye01',
      'BossTyphonHead01',
      'BossTyphonHead02',
    ]);
    expect(
      catalog.encounterDefinitions.values
        .filter((definition) => !definition.advancesHermesShrineDeliveryUses)
        .every((definition) => definition.kind === 'nonCombat' || definition.kind === 'story'),
    ).toBe(true);
  });

  it('pins every room declaration that never advances delayed Hermes Shrine deliveries', () => {
    expect(
      catalog.rooms.values
        .filter((room) => !room.advancesHermesShrineDeliveryUses)
        .map((room) => room.gameName),
    ).toEqual([
      'N_Sub01',
      'N_Sub02',
      'N_Sub03',
      'N_Sub04',
      'N_Sub05',
      'N_Sub06',
      'N_Sub07',
      'N_Sub08',
      'N_Sub09',
      'N_Sub10',
      'N_Sub11',
      'N_Sub12',
      'N_Sub13',
      'N_Sub14',
      'N_Sub15',
    ]);
  });
});
