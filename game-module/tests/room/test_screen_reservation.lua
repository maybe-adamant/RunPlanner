-- luacheck: globals TestScreenReservation
local lu = require("luaunit")
local definition = require("mods.room.timeline.acquisitions.screen_reservation")

TestScreenReservation = {}

local function installed()
    local callbacks = {}
    local instance = definition.create()
    instance.attach({ hooks = { wrap = function(name, _, callback) callbacks[name] = callback end } })
    return instance, callbacks
end

-- A native generation over `pool` that honours ExclusionNames and fills up to `choices` rows.
local function nativeGeneration(pool, choices, calls)
    return function(loot, args)
        local excluded = {}
        for _, name in ipairs(args and args.ExclusionNames or {}) do excluded[name] = true end
        calls[#calls + 1] = args and args.ExclusionNames or {}
        local rows = {}
        for _, name in ipairs(pool) do
            if #rows < choices and not excluded[name] then rows[#rows + 1] = { ItemName = name } end
        end
        loot.UpgradeOptions = rows
        loot.RarityChances = { Rare = 0.1 }
    end
end

local function names(loot)
    local result = {}
    for index, row in ipairs(loot.UpgradeOptions) do result[index] = row.ItemName end
    return result
end

local function withNative(callbacks, native, body)
    local prior, priorChoices = _G.SetTraitsOnLoot, _G.GetTotalLootChoices
    _G.SetTraitsOnLoot = function(loot, args) return callbacks.SetTraitsOnLoot(nil, {}, native, loot, args) end
    local ok, failure = pcall(body)
    _G.SetTraitsOnLoot, _G.GetTotalLootChoices = prior, priorChoices
    if not ok then error(failure, 0) end
end

-- The native reroll: one random shown row is banned from the next screen.
local function reroll(callbacks, loot, banned)
    callbacks.RerollBoonLoot(nil, {}, function()
        _G.SetTraitsOnLoot(loot, { IgnoreAllRarityBonus = true, ExclusionNames = { banned } })
    end, {}, { LootData = loot })
end

function TestScreenReservation.testEarlierScreensKeepThePlannedRowsFreeAndTheFinalScreenStaysNative()
    local instance, callbacks = installed()
    local calls = {}
    local native = nativeGeneration({ "A", "B", "C", "D", "E", "F", "G" }, 3, calls)
    local loot = { UpgradeOptions = { { ItemName = "A" }, { ItemName = "C" }, { ItemName = "D" } },
        RarityChances = { Epic = 0.2 } }
    withNative(callbacks, native, function()
        _G.GetTotalLootChoices = function() return 3 end
        instance.initial(loot, { planned = 2, names = { "A", "B" }, picked = "A" })
        -- The shown initial screen held a planned row; it is regenerated as a native reroll would.
        lu.assertEquals(names(loot), { "C", "D", "E" })
        lu.assertEquals(calls, { { "A", "B" } })
        reroll(callbacks, loot, "D")
        lu.assertEquals(names(loot), { "C", "E", "F" })
        lu.assertEquals(calls[2], { "D", "A", "B" })
        -- The planned final screen is generated natively and installed over by its adapter.
        reroll(callbacks, loot, "E")
        lu.assertEquals(calls[3], { "E" })
        lu.assertEquals(names(loot), { "A", "B", "C" })
    end)
end

function TestScreenReservation.testAClearInitialScreenIsKeptAsGenerated()
    local instance, callbacks = installed()
    local calls = {}
    local loot = { UpgradeOptions = { { ItemName = "C" }, { ItemName = "D" } } }
    withNative(callbacks, nativeGeneration({ "A", "B", "C" }, 3, calls), function()
        instance.initial(loot, { planned = 1, names = { "A" }, picked = "A" })
    end)
    lu.assertEquals(names(loot), { "C", "D" })
    lu.assertEquals(calls, {})
end

function TestScreenReservation.testAScreenThatWouldShrinkReservesOnlyThePickedRowOrNothing()
    local instance, callbacks = installed()
    local calls = {}
    -- Reserving A and B leaves two rows of a native three; reserving A alone keeps three.
    local loot = { UpgradeOptions = { { ItemName = "C" } } }
    withNative(callbacks, nativeGeneration({ "A", "B", "C", "D", "E" }, 3, calls), function()
        instance.initial(loot, { planned = 3, names = { "A", "B" }, picked = "A" })
        reroll(callbacks, loot, "C")
    end)
    lu.assertEquals(calls, { { "C", "A", "B" }, { "C" }, { "C", "A" } })
    lu.assertEquals(names(loot), { "B", "D", "E" })

    -- With only three eligible rows, any reservation shrinks the screen: native rows stay.
    instance, callbacks = installed()
    calls = {}
    loot = { UpgradeOptions = { { ItemName = "A" }, { ItemName = "B" }, { ItemName = "C" } }, Marker = "native" }
    withNative(callbacks, nativeGeneration({ "A", "B", "C" }, 3, calls), function()
        instance.initial(loot, { planned = 2, names = { "A", "B" }, picked = "B" })
    end)
    lu.assertEquals(calls, { { "A", "B" }, { "B" } })
    lu.assertEquals(names(loot), { "A", "B", "C" })
    lu.assertEquals(loot.Marker, "native")
    lu.assertNil(loot.RarityChances)
end

function TestScreenReservation.testChaosTransformingRowsAndUnplannedScreensStayNative()
    local instance, callbacks = installed()
    local calls = {}
    local chaos = { TransformingTraits = true, UpgradeOptions = { { ItemName = "A" } } }
    local other = { UpgradeOptions = { { ItemName = "A" } } }
    withNative(callbacks, nativeGeneration({ "A", "B", "C" }, 3, calls), function()
        instance.initial(chaos, { planned = 2, names = { "A" }, picked = "A" })
        instance.initial(other, { planned = 0, names = { "A" }, picked = "A" })
        reroll(callbacks, chaos, "A")
        reroll(callbacks, other, "A")
    end)
    lu.assertEquals(calls, { { "A" }, { "A" } })
end
