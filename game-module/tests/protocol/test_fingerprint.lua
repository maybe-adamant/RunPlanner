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
    ["automatic-boss.execution.json"] = "b0a722f0",
    ["dream-mixed-prefix.execution.json"] = "ca7cf902",
    ["dream-o-skipped-ship.execution.json"] = "7dec8a28",
    ["dream-shrine-pending.execution.json"] = "dee746ad",
    ["dream-start-n-opening.execution.json"] = "3efa8716",
    ["f-opening.execution.json"] = "d3dfc5a7",
    ["fg-anomaly-roster.execution.json"] = "887be55a",
    ["fg-anomaly.execution.json"] = "81b1f9e7",
    ["fg-ixion-chaos.execution.json"] = "744a3e7a",
    ["fg-npc-shopping-protection.execution.json"] = "fc5f06ca",
    ["fg.execution.json"] = "c9f9e8ad",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "d56ea7c8",
    ["fresh-file-fghi.execution.json"] = "8f4f179a",
    ["run-modifiers.execution.json"] = "0f311044",
    ["surface-generated-precombat.execution.json"] = "57f78a5b",
    ["surface-n-opening-composition.execution.json"] = "bd6f3583",
    ["surface-n-partial-hub.execution.json"] = "28d605db",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "6fcc6aec",
    ["surface-n.execution.json"] = "31e733aa",
    ["surface-no-rerolls.execution.json"] = "30f0c99d",
    ["surface-nopq.execution.json"] = "231ffc4b",
    ["surface-p-elite-switch.execution.json"] = "0b243de6",
    ["surface-q-shop-correlation.execution.json"] = "85d7f478",
    ["surface-scheduled-lifecycle.execution.json"] = "ac8f162b",
    ["surface-selene-hex-path.execution.json"] = "0dd080cd",
    ["surface-shrine-deliveries.execution.json"] = "c55b6e80",
    ["surface-shrine-rushed-unranked.execution.json"] = "dce57064",
    ["surface-start-q-opening.execution.json"] = "c417bdd8",
    ["surface-trait-fences.execution.json"] = "fac5de6c",
    ["surface-travel-deal-refill-anvil.execution.json"] = "056b2a18",
    ["underworld-arachne-cocoons.execution.json"] = "ffc20756",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "c8107156",
    ["underworld-f-cut-end.execution.json"] = "be17da23",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "8872d4a5",
    ["underworld-f-rerolls.execution.json"] = "b3dc0db8",
    ["underworld-f-switches-failed-left.execution.json"] = "8a90cf89",
    ["underworld-f-switches.execution.json"] = "9819505f",
    ["underworld-fgh.execution.json"] = "4fd458b5",
    ["underworld-fghi-empty-shop-group.execution.json"] = "ecb83576",
    ["underworld-fghi.execution.json"] = "ccada24a",
    ["underworld-fog-emitter-reservation.execution.json"] = "816bc280",
    ["underworld-generated-composition.execution.json"] = "a1a74a62",
    ["underworld-start-g-rivals-boss.execution.json"] = "e31b7b0a",
    ["underworld-start-i-preboss.execution.json"] = "a2b109b3",
}

function TestFingerprint.testEveryExecutionFixtureKeepsItsFingerprint()
    local count = 0
    for name, expected in pairs(CORPUS) do
        local file = assert(io.open(fixtures.path(name), "rb"))
        local source = file:read("*a"); file:close()
        lu.assertEquals(p.fingerprint(assert(p.json.decode(source))), expected, name)
        count = count + 1
    end
    lu.assertEquals(count, 45)
end

function TestFingerprint.testAsciiAndMultibyteStringsHashTheirBytes()
    lu.assertEquals(p.canonicalFingerprintInput(assert(p.json.decode('"A\\u0000~"'))), "s41007e;")
    lu.assertEquals(p.canonicalFingerprintInput("Melino\195\171"), "s4d656c696e6fc3ab;")
end

return TestFingerprint
