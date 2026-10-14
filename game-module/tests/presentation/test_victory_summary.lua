-- luacheck: globals TestVictorySummary
local lu = require("luaunit")
local victorySummary = require("mods.presentation.victory_summary")

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

local function plan(displayName)
    return {
        displayName = displayName, planFingerprint = "06bef552",
        selectedOccurrenceIds = { "a", "b", "c" },
        occurrencesById = {
            a = { id = "a", gameName = "F_Combat11" }, b = { id = "b", gameName = "I_PreBoss01" },
            c = { id = "c", gameName = "I_Boss01" },
        },
    }
end

function TestVictorySummary.testRowsNameThePlanAndItsOutcome()
    lu.assertEquals(victorySummary.rows(nil), {})
    lu.assertEquals(victorySummary.rows({ state = "inactive", reason = "not-started" }), {})
    -- A run whose plan was dropped by turning the module off has no summary.
    lu.assertEquals(victorySummary.rows({ state = "inactive", reason = "disabled" }), {})
    lu.assertEquals(victorySummary.rows({ state = "inactive", reason = "disabled", slot = 2, plan = plan(),
        index = 3, current = plan().occurrencesById.c }), {})
    local named = plan("Golden run")
    lu.assertEquals(victorySummary.rows({ state = "synchronized", reason = "ready", slot = 2, plan = named,
        index = 3, current = named.occurrencesById.c }),
        { { text = "Planned run - Golden run" }, { text = "Complete" } })
    lu.assertEquals(victorySummary.rows({ state = "inactive", reason = "configured-prefix-complete", slot = 2,
        plan = plan(), index = 2 }, { [2] = { planName = "Overview name", fingerprint = "06bef552" } }),
        { { text = "Planned run - Overview name" }, { text = "Complete" } })
    lu.assertEquals(victorySummary.rows({ state = "desynchronized", reason = "first-mismatch", slot = 4,
        plan = plan(), index = 2, current = plan().occurrencesById.b }, { [4] = { planName = "Other", fingerprint = "x" } }),
        { { text = "Planned run - Slot 4" }, { text = "Out of sync at Tartarus Preboss" } })
    lu.assertEquals(victorySummary.rows({ state = "desynchronized", reason = "first-mismatch", slot = 4,
        plan = plan(), index = 2, issue = { checkpoint = "room-entry", expected = plan().occurrencesById.b,
            observed = { id = "b", gameName = "I_Combat07" } } }),
        { { text = "Planned run - Slot 4" }, { text = "Out of sync at Tartarus Combat 7" } })
    lu.assertEquals(victorySummary.rows({ state = "desynchronized", reason = "first-mismatch", slot = 4,
        plan = plan(), index = 2 }),
        { { text = "Planned run - Slot 4" }, { text = "Out of sync at Tartarus Preboss" } })
end

function TestVictorySummary.testAPlanWithTheEventEntrysFingerprintIsNamedByItsEvent()
    local event = { id = "2026-w42-staff", title = "Week 42: Staff sprint", endsAt = "2026-10-19T00:00:00Z" }
    local entries = { [0] = { planName = "Staff sprint", fingerprint = "06bef552", event = event } }
    local present = { [0] = true }
    local complete = { state = "inactive", reason = "configured-prefix-complete", slot = 0, plan = plan("Staff sprint"),
        index = 3 }
    lu.assertEquals(victorySummary.rows(complete, entries, present),
        { { text = "Planned event - Week 42: Staff sprint" }, { text = "Complete" } })
    -- Naming follows the fingerprint, not the slot the run was played from.
    complete.slot = 5
    lu.assertEquals(victorySummary.rows(complete, entries, present)[1],
        { text = "Planned event - Week 42: Staff sprint" })
    -- An entry left behind after the event slot's file is gone names no event.
    lu.assertEquals(victorySummary.rows(complete, entries, {})[1], { text = "Planned run - Staff sprint" })
    lu.assertEquals(victorySummary.rows(complete, entries)[1], { text = "Planned run - Staff sprint" })
    entries[0].fingerprint = "ffffffff"
    lu.assertEquals(victorySummary.rows(complete, entries, present)[1], { text = "Planned run - Staff sprint" })
    entries[0] = { planName = "Staff sprint", fingerprint = "06bef552" }
    complete.slot = 0
    lu.assertEquals(victorySummary.rows(complete, entries, present)[1], { text = "Planned run - Staff sprint" })
end

function TestVictorySummary.testDeclaresOneVictoryStackTableAndRefreshesOnRunClear()
    local module, tables, hooks = stubModule()
    local snapshot = { state = "desynchronized", reason = "first-mismatch", slot = 3, plan = plan(), index = 1,
        current = plan().occurrencesById.a }
    local failInspection, overviewReads = false, 0
    victorySummary.attach(module, function()
        if failInspection then error("inspection failure") end
        return snapshot
    end, { read = function()
        overviewReads = overviewReads + 1
        return { [3] = { planName = "Erebus warmup", fingerprint = "06bef552" } }, {}
    end })
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
        rows = { { text = "Planned run - Erebus warmup" }, { text = "Out of sync at Erebus Combat 11" } } } })
    lu.assertEquals(overviewReads, 1)
    lu.assertEquals(refreshes, { "victory-summary" })

    failInspection = true
    lu.assertTrue(pcall(opened, nil, nil, overlay, { args = { { Name = "RunClear" } } }))
    lu.assertEquals(sets[2], { name = "victory-summary", rows = {} })
    lu.assertEquals(#refreshes, 2)
end
