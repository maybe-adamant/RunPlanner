-- luacheck: globals TestNpcTraitOfferAdapter
local lu = require("luaunit")
local adapters = require("mods/room/timeline/acquisitions/npc/trait_offer")

TestNpcTraitOfferAdapter = {}

function TestNpcTraitOfferAdapter.testTraitAdapterPassesAuthoredRowsThroughTheRowLevelStub()
    local row = {
        transaction = {},
        detail = {
            traitOffer = {
                kind = "traits", selected = "option2",
                options = { { key = "ApolloBoon", rarity = "Rare" }, { key = "HeraBoon", effectiveLevel = 4 } },
            },
        },
    }
    local loot = { UpgradeOptions = { { ItemName = "NativeA" }, { ItemName = "NativeB" } } }
    local received = {}
    local rowOptions = {
        rowLevel = function(value) received[#received + 1] = value; return "row-" .. tostring(value) end,
    }
    lu.assertTrue(adapters.applyTraitOffer(row, loot, rowOptions))
    lu.assertEquals(loot.UpgradeOptions[1].ItemName, "ApolloBoon")
    lu.assertEquals(loot.UpgradeOptions[1].Rarity, "Rare")
    lu.assertEquals(loot.UpgradeOptions[2].ItemName, "HeraBoon")
    lu.assertEquals(loot.UpgradeOptions[2].StackNum, "row-4")
    lu.assertEquals(received, { 4 })
end
