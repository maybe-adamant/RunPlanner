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
    ["automatic-boss.execution.json"] = "4a31f4a4",
    ["dream-mixed-prefix.execution.json"] = "3e7fe57e",
    ["dream-o-skipped-ship.execution.json"] = "26c55c05",
    ["dream-shrine-pending.execution.json"] = "6f430445",
    ["dream-start-n-opening.execution.json"] = "c847cbe7",
    ["f-opening.execution.json"] = "c31a86b3",
    ["fg-anomaly-roster.execution.json"] = "a3e6e777",
    ["fg-anomaly.execution.json"] = "6abaaf1a",
    ["fg-ixion-chaos.execution.json"] = "0d8247fb",
    ["fg-npc-shopping-protection.execution.json"] = "d93b1ed7",
    ["fg.execution.json"] = "b9639ed6",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "ec63f304",
    ["fresh-file-fghi.execution.json"] = "a6d80081",
    ["run-modifiers.execution.json"] = "7f5bc89c",
    ["surface-generated-precombat.execution.json"] = "f12df7c9",
    ["surface-n-opening-composition.execution.json"] = "7799107f",
    ["surface-n-partial-hub.execution.json"] = "181b2b3e",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "2d8aa281",
    ["surface-n.execution.json"] = "eeaeaa65",
    ["surface-no-rerolls.execution.json"] = "ece11f38",
    ["surface-nopq.execution.json"] = "aead1c36",
    ["surface-p-elite-switch.execution.json"] = "3bd2d944",
    ["surface-q-shop-correlation.execution.json"] = "37fcd3cf",
    ["surface-scheduled-lifecycle.execution.json"] = "8965c06d",
    ["surface-selene-hex-path.execution.json"] = "bff72926",
    ["surface-shrine-deliveries.execution.json"] = "edc08c40",
    ["surface-shrine-rushed-unranked.execution.json"] = "3664fde5",
    ["surface-start-q-opening.execution.json"] = "2d6c6df9",
    ["surface-trait-fences.execution.json"] = "e00ef5ff",
    ["surface-travel-deal-refill-anvil.execution.json"] = "5150972e",
    ["underworld-arachne-cocoons.execution.json"] = "23acd822",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "d6953bca",
    ["underworld-f-cut-end.execution.json"] = "c736aca3",
    ["underworld-f-cut-end-rerolls.execution.json"] = "1f46525d",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "74411439",
    ["underworld-f-rerolls.execution.json"] = "29a8eeef",
    ["underworld-f-switches-failed-left.execution.json"] = "a3267282",
    ["underworld-f-switches.execution.json"] = "bd8cc4fe",
    ["underworld-g-locked-doors.execution.json"] = "38ba1e3f",
    ["underworld-fgh.execution.json"] = "87f29ea3",
    ["underworld-fghi-empty-shop-group.execution.json"] = "98fa400e",
    ["underworld-fghi.execution.json"] = "e8aead31",
    ["underworld-fog-emitter-reservation.execution.json"] = "f57928c9",
    ["underworld-generated-composition.execution.json"] = "17a355d0",
    ["underworld-start-g-rivals-boss.execution.json"] = "84a4f5bd",
    ["underworld-start-i-preboss.execution.json"] = "4ad87c01",
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
