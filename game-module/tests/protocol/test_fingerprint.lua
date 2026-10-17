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
    ["automatic-boss.execution.json"] = "d6de93b6",
    ["dream-mixed-prefix.execution.json"] = "68997b70",
    ["dream-o-skipped-ship.execution.json"] = "690bbeec",
    ["dream-shrine-pending.execution.json"] = "45a8a717",
    ["dream-start-n-opening.execution.json"] = "e45989b8",
    ["f-opening.execution.json"] = "7029ac4a",
    ["fg-anomaly-roster.execution.json"] = "ef6a18d5",
    ["fg-anomaly.execution.json"] = "5ce04f41",
    ["fg-ixion-chaos.execution.json"] = "b0933a1b",
    ["fg-npc-shopping-protection.execution.json"] = "7f19c65d",
    ["fg.execution.json"] = "105fddc8",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "8f7d445c",
    ["fresh-file-fghi.execution.json"] = "9381d514",
    ["run-modifiers.execution.json"] = "1de32898",
    ["surface-generated-precombat.execution.json"] = "4c3da298",
    ["surface-n-opening-composition.execution.json"] = "8737244d",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "4874341c",
    ["surface-n.execution.json"] = "67d99f5e",
    ["surface-no.execution.json"] = "6e225eed",
    ["surface-nop.execution.json"] = "d97ead16",
    ["surface-nopq.execution.json"] = "303417e3",
    ["surface-q-shop-correlation.execution.json"] = "09dc0330",
    ["surface-scheduled-lifecycle.execution.json"] = "5eb7e1f8",
    ["surface-selene-hex-path.execution.json"] = "809a2e2b",
    ["surface-shrine-deliveries.execution.json"] = "0c8fa781",
    ["surface-shrine-rushed-unranked.execution.json"] = "a7b2fc44",
    ["surface-start-q-opening.execution.json"] = "423517ee",
    ["surface-trait-fences.execution.json"] = "3cfcc16e",
    ["surface-travel-deal-refill-anvil.execution.json"] = "aba88658",
    ["underworld-arachne-cocoons.execution.json"] = "1ad3d191",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "1244673b",
    ["underworld-fgh.execution.json"] = "51e132d8",
    ["underworld-fghi-empty-shop-group.execution.json"] = "bea6afe0",
    ["underworld-fghi.execution.json"] = "4e514d89",
    ["underworld-fog-emitter-reservation.execution.json"] = "177cfff0",
    ["underworld-generated-composition.execution.json"] = "11f3fd0c",
    ["underworld-start-g-rivals-boss.execution.json"] = "5b72b62c",
    ["underworld-start-i-preboss.execution.json"] = "9384c1d1",
}

function TestFingerprint.testEveryExecutionFixtureKeepsItsFingerprint()
    local count = 0
    for name, expected in pairs(CORPUS) do
        local file = assert(io.open(fixtures.path(name), "rb"))
        local source = file:read("*a"); file:close()
        lu.assertEquals(p.fingerprint(assert(p.json.decode(source))), expected, name)
        count = count + 1
    end
    lu.assertEquals(count, 39)
end

function TestFingerprint.testAsciiAndMultibyteStringsHashTheirBytes()
    lu.assertEquals(p.canonicalFingerprintInput(assert(p.json.decode('"A\\u0000~"'))), "s41007e;")
    lu.assertEquals(p.canonicalFingerprintInput("Melino\195\171"), "s4d656c696e6fc3ab;")
end

return TestFingerprint
