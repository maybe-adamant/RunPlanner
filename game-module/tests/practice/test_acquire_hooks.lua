-- luacheck: globals TestAcquireHooks
-- The closed classification of every native AcquireFunctionName. The pinned
-- list is the game's distinct TraitData declarations (0.55 scripts); a patch
-- that adds one must be classified here and in the table together.
local lu = require("luaunit")
local acquire = require("mods.practice.acquire_hooks")
local nativeGame = require("tests/harness/native_game")

TestAcquireHooks = {}

local PINNED = {
    restoreState = {
        "AddLastStand", "BankGold", "EchoIncreaseStats", "EchoRepeatKeepsake", "GiveRandomHadesBoonAndBoostBoons",
        "HeraSuperchargeBoon", "IcarusUpgradeBoon", "SetManaRegenUnique", "StartChaosTimer",
        "StartHermesKeepsakeTimer",
    },
    alreadyApplied = {
        "AthenaRefillLastStands", "AttemptAdvanceKeepsake", "ChaosBlessingBonus", "CirceMetaUpgradeRarity",
        "CircePetMultiplier", "CirceRandomMetaUpgrade", "CirceRemoveShrineUpgrades", "DionysusSkipTrait",
        "DistributeLevels", "EchoDoubleLevelBoon", "EchoRefillLastStands", "GiveDurationHammer", "GrantBoons",
        "GrantPotionBonusCharges", "GrantRandomMaxHealth", "KeepsakeAcquireSpellDrop", "KeepsakeAddMaxMana",
        "RemoveArcana", "RewardStoreAddPriority", "SacrificeAllBoon", "UpdateLastMomentManaRestoreEligibility",
        "UpdateStoreItemCostText", "UpdateUpgradableTraitCount", "UpgradeAspect", "UpgradeHammers",
    },
    presentation = { "HeavyArmorInitialPresentation", "SetupBloodDropDisplay" },
    neverRun = { "AddTraitResources", "CirceHeal", "EchoLastReward", "EchoLastRunBoon", "GiveRandomConsumables" },
}

function TestAcquireHooks.testTheTableClassifiesExactlyThePinnedHooks()
    local classified, count = {}, 0
    for name, entry in pairs(acquire.hooks) do
        lu.assertTrue(acquire.CLASSES[entry.class], name)
        lu.assertEquals(entry.write ~= nil, entry.class == "restoreState", name)
        classified[entry.class] = classified[entry.class] or {}
        table.insert(classified[entry.class], name)
        count = count + 1
    end
    for _, names in pairs(classified) do table.sort(names) end
    lu.assertEquals(classified, PINNED)
    lu.assertEquals(count, 42)
end

function TestAcquireHooks.testUnclassifiedHooksAreNamedAndRefuseAPracticeStart()
    local traitData = {
        TimedBuffKeepsake = { AcquireFunctionName = "StartHermesKeepsakeTimer" },
        NewBoon = { AcquireFunctionName = "PatchedAcquire" },
        OtherBoon = { AcquireFunctionName = "PatchedAcquire" },
        Plain = {},
    }
    lu.assertEquals(acquire.unclassified(traitData), { "PatchedAcquire" })
    local ok, failure = pcall(acquire.requireClassified, traitData)
    lu.assertFalse(ok)
    lu.assertEquals({ failure.checkpoint, failure.observed }, { "practice-start:acquire-hook", "PatchedAcquire" })
    lu.assertTrue(pcall(acquire.requireClassified, { TimedBuffKeepsake = traitData.TimedBuffKeepsake }))
    ok, failure = pcall(acquire.restore, { Name = "NewBoon", AcquireFunctionName = "PatchedAcquire" })
    lu.assertFalse(ok)
    lu.assertEquals(failure.observed, "PatchedAcquire")
end

function TestAcquireHooks.testOnlyRestoreStateHooksWriteAndAbsentFieldsKeepTheInstance()
    local droplet = acquire.restore({ AcquireFunctionName = "StartHermesKeepsakeTimer", StartingTime = 300 })
    lu.assertEquals(droplet.CurrentTime, 300)
    local carried = acquire.restore({ AcquireFunctionName = "BankGold", StoredGold = 180 }, {})
    lu.assertEquals(carried.StoredGold, 180)
    lu.assertEquals(acquire.restore({ AcquireFunctionName = "BankGold", StoredGold = 0 }, { storedGold = 245 })
        .StoredGold, 245)
    local consumables = { AcquireFunctionName = "GiveRandomConsumables" }
    lu.assertEquals(acquire.restore(consumables), { AcquireFunctionName = "GiveRandomConsumables" })
end

function TestAcquireHooks.testChaosManaBlessingKeysItsRegenByItsOwnId()
    local restore = nativeGame.install({ GetTraitUniqueId = function() return 77 end })
    local blessing = acquire.restore({ AcquireFunctionName = "SetManaRegenUnique",
        SetupFunction = { Name = "ManaRegenSetup", Args = { Name = "ChaosManaOverTimeBlessing" } } })
    restore()
    lu.assertEquals({ blessing.Id, blessing.SetupFunction.Args.Name }, { 77, 77 })
end
