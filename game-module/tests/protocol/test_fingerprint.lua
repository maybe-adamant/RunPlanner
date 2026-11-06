local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local p = require("mods.protocol.primitives")

TestFingerprint = {}

function TestFingerprint.testSharedCanonicalVectors()
    local file = assert(io.open(fixtures.path("fingerprint-vectors.json"), "rb"))
    local source = file:read("*a"); file:close()
    local vectors = assert(p.json.decode(source))
    for _, vector in ipairs(vectors) do
        local value, err = p.json.decode(vector.json)
        assert(value ~= nil, err)
        lu.assertEquals(p.canonicalFingerprintInput(value), vector.canonical, vector.name)
        lu.assertEquals(p.fingerprint(value), vector.fingerprint, vector.name)
    end
end

function TestFingerprint.testOrderingSpellingAndMutations()
    lu.assertEquals(p.fingerprint(assert(p.json.decode('{"z":1,"a":"a"}'))),
        p.fingerprint(assert(p.json.decode('{"a":"\\u0061","z":1e0}'))))
    lu.assertEquals(p.fingerprint(-0), p.fingerprint(0))
    for _, pair in ipairs({
        { "0.3333333333333333", "0.33333333333333" },
        { "0.6666666666666666", "0.66666666666667" },
        { '"é"', '"e"' }, { "1", '"1"' },
        { "[1,2]", "[2,1]" }, { '{"a":true}', '{"A":true}' },
    }) do
        lu.assertNotEquals(p.fingerprint(assert(p.json.decode(pair[1]))),
            p.fingerprint(assert(p.json.decode(pair[2]))))
    end
end

function TestFingerprint.testRejectsNonFiniteNumbers()
    for _, value in ipairs({ math.huge, -math.huge, 0 / 0 }) do
        lu.assertError(p.fingerprint, value)
    end
end

function TestFingerprint.testRejectsInvalidUtf8Scalars()
    for _, bytes in ipairs({
        { 0xed, 0xa0, 0x80 }, { 0xff }, { 0xc0, 0x80 },
        { 0x80 }, { 0xe0, 0x80, 0x80 }, { 0xf0, 0x80, 0x80, 0x80 },
        { 0xf4, 0x90, 0x80, 0x80 }, { 0xe2, 0x82 }, { 0xc2, 0x41 },
    }) do
        local value = string.char(table.unpack(bytes))
        lu.assertError(p.fingerprint, value)
        lu.assertError(p.fingerprint, { [value] = true })
    end
end

-- Whole-document fingerprints of every execution fixture, recorded from the
-- decoder and fingerprint before their speedups; both must stay byte-identical.
local CORPUS = {
    ["automatic-boss.execution.json"] = "5fbf8f29",
    ["dream-mixed-prefix.execution.json"] = "09e38ffc",
    ["dream-o-skipped-ship.execution.json"] = "fe6d0c09",
    ["dream-shrine-pending.execution.json"] = "cb538a08",
    ["dream-start-n-opening.execution.json"] = "1451f1d3",
    ["f-opening.execution.json"] = "9aa4a38c",
    ["fg-anomaly-roster.execution.json"] = "b13cbb0d",
    ["fg-anomaly.execution.json"] = "c4a31031",
    ["fg-ixion-chaos.execution.json"] = "39d7c6ff",
    ["fg-npc-shopping-protection.execution.json"] = "316b0e0a",
    ["fg.execution.json"] = "200a1980",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "37b143dd",
    ["fresh-file-fghi.execution.json"] = "4a4a63f7",
    ["run-modifiers.execution.json"] = "572e044e",
    ["surface-generated-precombat.execution.json"] = "9ac6489b",
    ["surface-n-opening-composition.execution.json"] = "48fef09c",
    ["surface-n-partial-hub.execution.json"] = "51ead0f8",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "ef3ce3d1",
    ["surface-n.execution.json"] = "7925eb18",
    ["surface-no-rerolls.execution.json"] = "d0c55241",
    ["surface-nopq.execution.json"] = "65897e5c",
    ["surface-p-elite-switch.execution.json"] = "88bf49c5",
    ["surface-q-shop-correlation.execution.json"] = "8e8a6565",
    ["surface-scheduled-lifecycle.execution.json"] = "84ac078e",
    ["surface-selene-hex-path.execution.json"] = "b61861d3",
    ["surface-shrine-deliveries.execution.json"] = "1650e9fe",
    ["surface-shrine-rushed-unranked.execution.json"] = "6825539e",
    ["surface-start-q-opening.execution.json"] = "e33bcd2b",
    ["surface-trait-fences.execution.json"] = "9b637e97",
    ["surface-travel-deal-refill-anvil.execution.json"] = "72eda85f",
    ["underworld-arachne-cocoons.execution.json"] = "5a969336",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "b06a27cf",
    ["underworld-f-cut-end.execution.json"] = "c66445bd",
    ["underworld-f-cut-end-rerolls.execution.json"] = "3a02888c",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "992f693a",
    ["underworld-f-rerolls.execution.json"] = "1f75725b",
    ["underworld-f-switches-failed-left.execution.json"] = "b4a0931c",
    ["underworld-f-switches.execution.json"] = "886ce089",
    ["underworld-g-locked-doors.execution.json"] = "f45f552b",
    ["underworld-fgh.execution.json"] = "e001e7f1",
    ["underworld-fghi-empty-shop-group.execution.json"] = "60baf72e",
    ["underworld-fghi.execution.json"] = "03fc873b",
    ["underworld-fog-emitter-reservation.execution.json"] = "4bad1ca3",
    ["underworld-generated-composition.execution.json"] = "8c9e1b01",
    ["underworld-start-g-rivals-boss.execution.json"] = "599da9d8",
    ["underworld-start-i-preboss.execution.json"] = "96218d46",
}

function TestFingerprint.testEveryExecutionFixtureKeepsItsFingerprint()
    local count = 0
    for name, expected in pairs(CORPUS) do
        local file = assert(io.open(fixtures.path(name), "rb"))
        local source = file:read("*a"); file:close()
        lu.assertEquals(p.fingerprint(assert(p.json.decode(source))), expected, name)
        count = count + 1
    end
    lu.assertEquals(count, 47)
end

function TestFingerprint.testAsciiAndMultibyteStringsHashTheirBytes()
    lu.assertEquals(p.canonicalFingerprintInput(assert(p.json.decode('"A\\u0000~"'))), "s41007e;")
    lu.assertEquals(p.canonicalFingerprintInput("Melino\195\171"), "s4d656c696e6fc3ab;")
end

return TestFingerprint
