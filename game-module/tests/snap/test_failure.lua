-- luacheck: globals TestSnapFailure
local lu = require("luaunit")
local failure = require("mods.snap.failure")

TestSnapFailure = {}

local before = {
    { family = "keepsakes", paths = { "keepsakes.held=1->0" } },
    { family = "hermesDeliveries", paths = { "hermesDeliveries.1=nil->SpellDrop:8" } },
}

local trigger = {
    checkpoint = "room-exit-conformance:hermesDeliveries", expected = {}, observed = { "SpellDrop:8" },
}

function TestSnapFailure.testAStillDifferingWriteListsEveryFamilyAndTheTrigger()
    local record = failure.record({
        room = "O_Combat12", occurrenceId = "O-draft-3", frame = true, kind = "still-differs",
        trigger = trigger, before = before,
        after = { { family = "keepsakes", paths = { "keepsakes.held=1->0" } } },
    })
    lu.assertEquals(record.failedFamilies, { "keepsakes" })
    lu.assertEquals(record.differedFamilies, { "keepsakes", "hermesDeliveries" })
    lu.assertEquals(failure.lines(record), {
        "[RunPlanner] snap failed room=O_Combat12 occurrence=O-draft-3 frame=yes kind=still-differs"
            .. " failed=keepsakes differed=keepsakes,hermesDeliveries"
            .. " trigger=room-exit-conformance:hermesDeliveries",
        "[RunPlanner] snap failed detail trigger room-exit-conformance:hermesDeliveries expected={}"
            .. " observed={1=SpellDrop:8}",
        "[RunPlanner] snap failed detail before keepsakes: keepsakes.held=1->0",
        "[RunPlanner] snap failed detail before hermesDeliveries: hermesDeliveries.1=nil->SpellDrop:8",
        "[RunPlanner] snap failed detail after keepsakes: keepsakes.held=1->0",
    })
end

function TestSnapFailure.testAnUnwritableFamilyAndAFaultNameTheirCause()
    local unwritable = failure.record({
        room = "F_A", occurrenceId = "a", frame = true, kind = "unwritable", before = before,
        unwritable = { family = "reward-store", reason = "Missing undeclared" },
    })
    lu.assertEquals(unwritable.failedFamilies, { "reward-store" })
    lu.assertEquals(failure.lines(unwritable)[4],
        "[RunPlanner] snap failed detail unwritable reward-store: Missing undeclared")
    local fault = failure.record({
        room = "F_A", occurrenceId = "a", frame = true, kind = "fault", before = before, err = "boom",
    })
    lu.assertEquals(fault.failedFamilies, { "keepsakes", "hermesDeliveries" })
    local lines = failure.lines(fault)
    lu.assertStrContains(lines[1], "kind=fault failed=keepsakes,hermesDeliveries")
    lu.assertStrContains(lines[1], "trigger=none")
    lu.assertEquals(lines[#lines], "[RunPlanner] snap failed detail error boom")
end

function TestSnapFailure.testControlCharactersCannotStartANewLogLine()
    local record = failure.record({
        room = "F_A", occurrenceId = "a", frame = true, kind = "unwritable",
        before = { { family = "keepsakes", paths = { "keepsakes.held=a\nb" } } },
        unwritable = { family = "reward-store", reason = "bad\r\nreason" },
        trigger = { checkpoint = "c", expected = "x\ty", observed = "back\\slash" },
        err = "line one\nline two",
    })
    lu.assertEquals(failure.lines(record), {
        "[RunPlanner] snap failed room=F_A occurrence=a frame=yes kind=unwritable"
            .. " failed=reward-store differed=keepsakes trigger=c",
        "[RunPlanner] snap failed detail trigger c expected=x\\009y observed=back\\092slash",
        "[RunPlanner] snap failed detail before keepsakes: keepsakes.held=a\\010b",
        "[RunPlanner] snap failed detail unwritable reward-store: bad\\013\\010reason",
        "[RunPlanner] snap failed detail error line one\\010line two",
    })
end

function TestSnapFailure.testLargeFamiliesAreSummarised()
    local paths = {}
    for index = 1, 9 do paths[index] = "traitInventory.present." .. index .. "=" .. string.rep("x", 300) end
    local record = failure.record({ room = "F_A", kind = "fault", before = {
        { family = "traitInventory", paths = paths },
    } })
    local kept = record.before[1].paths
    lu.assertEquals(#kept, 7)
    lu.assertEquals(kept[7], "+3 more")
    lu.assertEquals(#kept[1], 203)
end
