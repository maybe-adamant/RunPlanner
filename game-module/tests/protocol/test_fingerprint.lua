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
    ["automatic-boss.execution.json"] = "eb252aad",
    ["dream-mixed-prefix.execution.json"] = "163728e7",
    ["dream-o-skipped-ship.execution.json"] = "6a319f2d",
    ["dream-shrine-pending.execution.json"] = "b485be12",
    ["dream-start-n-opening.execution.json"] = "bba222b3",
    ["f-opening.execution.json"] = "03278292",
    ["fg-anomaly-roster.execution.json"] = "4633d2ee",
    ["fg-anomaly.execution.json"] = "dc4f1405",
    ["fg-ixion-chaos.execution.json"] = "d6da0a03",
    ["fg-npc-shopping-protection.execution.json"] = "e68fedbb",
    ["fg.execution.json"] = "dfe45c15",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "2aa61087",
    ["fresh-file-fghi.execution.json"] = "a39841f0",
    ["run-modifiers.execution.json"] = "0bab690d",
    ["surface-generated-precombat.execution.json"] = "7b9473ef",
    ["surface-n-opening-composition.execution.json"] = "4625317a",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "158a7c09",
    ["surface-n.execution.json"] = "42506f3c",
    ["surface-no.execution.json"] = "a2694bf6",
    ["surface-nop.execution.json"] = "e40e9f3b",
    ["surface-nopq.execution.json"] = "7a40fa7a",
    ["surface-q-shop-correlation.execution.json"] = "12582b6f",
    ["surface-scheduled-lifecycle.execution.json"] = "72608245",
    ["surface-selene-hex-path.execution.json"] = "2f70f2f2",
    ["surface-shrine-deliveries.execution.json"] = "1c7c5f14",
    ["surface-shrine-rushed-unranked.execution.json"] = "d22693f5",
    ["surface-start-q-opening.execution.json"] = "bfe009f4",
    ["surface-trait-fences.execution.json"] = "0ae00595",
    ["surface-travel-deal-refill-anvil.execution.json"] = "f1a09ea5",
    ["underworld-arachne-cocoons.execution.json"] = "fe187034",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "1f7648c4",
    ["underworld-fgh.execution.json"] = "f4c482b9",
    ["underworld-fghi-empty-shop-group.execution.json"] = "f5dd1752",
    ["underworld-fghi.execution.json"] = "e7bb5762",
    ["underworld-fog-emitter-reservation.execution.json"] = "60b11cc7",
    ["underworld-generated-composition.execution.json"] = "ed75e2a7",
    ["underworld-start-g-rivals-boss.execution.json"] = "ebaa7cd0",
    ["underworld-start-i-preboss.execution.json"] = "12d0b6d8",
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
