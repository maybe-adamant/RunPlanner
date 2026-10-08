-- luacheck: globals TestVictorySummary
local lu = require("luaunit")
local victorySummary = require("mods.host.victory_summary")

TestVictorySummary = {}

local function stubModule()
    local tables, hooks = {}, {}
    local module = {
        overlays = {
            order = { module = 30 },
            createTable = function(name, spec) tables[name] = spec end,
            afterHook = function(path, callback) hooks[path] = callback end,
        },
    }
    return module, tables, hooks
end

function TestVictorySummary.testRowsNameTheLastExitedOccurrenceOnly()
    lu.assertEquals(victorySummary.rows(nil), {})
    lu.assertEquals(victorySummary.rows({ state = "synchronized" }), {})
    lu.assertEquals(victorySummary.rows({ lastExited = { gameName = "F_Combat11" } }),
        { { text = "Planned" }, { text = "Erebus · Combat 11" } })
    local preboss = { gameName = "I_PreBoss01" }
    lu.assertEquals(victorySummary.rows({ state = "synchronized",
        current = { gameName = "I_Boss01" }, lastExited = preboss }),
        { { text = "Planned" }, { text = "Tartarus · Boss" } })
    lu.assertEquals(victorySummary.rows({ state = "desynchronized",
        current = { gameName = "I_Boss01" }, lastExited = preboss }),
        { { text = "Planned" }, { text = "Tartarus · Preboss" } })
end

function TestVictorySummary.testDeclaresOneVictoryStackTableAndRefreshesOnRunClear()
    local module, tables, hooks = stubModule()
    local snapshot, failInspection = { lastExited = { gameName = "F_Combat11" } }, false
    victorySummary.attach(module, function()
        if failInspection then error("inspection failure") end
        return snapshot
    end)
    local spec = tables["victory-summary"]
    lu.assertEquals(spec.region, "victoryStack")
    lu.assertEquals(spec.maxRows, 4)
    lu.assertEquals(spec.order, 30)
    lu.assertEquals(spec.columns, { { key = "text" } })

    local sets, refreshes = {}, {}
    local overlay = {
        setTable = function(name, rows) sets[#sets + 1] = { name = name, rows = rows } end,
        refresh = function(name) refreshes[#refreshes + 1] = name end,
    }
    local opened = hooks.OnScreenOpened
    lu.assertNotNil(opened)
    opened(nil, nil, overlay, { path = "OnScreenOpened", args = { { Name = "TraitTrayScreen" } } })
    opened(nil, nil, overlay, { path = "OnScreenOpened", args = {} })
    lu.assertEquals(#sets, 0)
    lu.assertEquals(#refreshes, 0)

    opened(nil, nil, overlay, { path = "OnScreenOpened", args = { { Name = "RunClear" } } })
    lu.assertEquals(sets, { { name = "victory-summary",
        rows = { { text = "Planned" }, { text = "Erebus · Combat 11" } } } })
    lu.assertEquals(refreshes, { "victory-summary" })

    failInspection = true
    lu.assertTrue(pcall(opened, nil, nil, overlay, { args = { { Name = "RunClear" } } }))
    lu.assertEquals(sets[2], { name = "victory-summary", rows = {} })
    lu.assertEquals(#refreshes, 2)
end
