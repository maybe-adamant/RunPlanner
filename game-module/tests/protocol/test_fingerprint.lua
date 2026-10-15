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
    ["automatic-boss.execution.json"] = "c7dd439a",
    ["dream-mixed-prefix.execution.json"] = "539c90a8",
    ["dream-o-skipped-ship.execution.json"] = "2f6cb65b",
    ["dream-shrine-pending.execution.json"] = "d6c6c134",
    ["dream-start-n-opening.execution.json"] = "9e7a54b8",
    ["f-opening.execution.json"] = "924fc3a8",
    ["fg-anomaly-roster.execution.json"] = "f19655cc",
    ["fg-anomaly.execution.json"] = "fbe20328",
    ["fg-ixion-chaos.execution.json"] = "6edbac3f",
    ["fg-npc-shopping-protection.execution.json"] = "4d92eb0b",
    ["fg.execution.json"] = "62c1f718",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "77b4e779",
    ["fresh-file-fghi.execution.json"] = "01c458f0",
    ["run-modifiers.execution.json"] = "2dd8c8ec",
    ["surface-generated-precombat.execution.json"] = "525ac1e5",
    ["surface-n-opening-composition.execution.json"] = "48425260",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "e851a7cc",
    ["surface-n.execution.json"] = "9e16333d",
    ["surface-no.execution.json"] = "08544d1f",
    ["surface-nop.execution.json"] = "23955498",
    ["surface-nopq.execution.json"] = "bd640741",
    ["surface-q-shop-correlation.execution.json"] = "c77b28cf",
    ["surface-scheduled-lifecycle.execution.json"] = "1b407555",
    ["surface-selene-hex-path.execution.json"] = "224444d6",
    ["surface-shrine-deliveries.execution.json"] = "5ffed7e0",
    ["surface-shrine-rushed-unranked.execution.json"] = "b384fcfd",
    ["surface-start-q-opening.execution.json"] = "3bb8538e",
    ["surface-travel-deal-refill-anvil.execution.json"] = "2a34295f",
    ["underworld-arachne-cocoons.execution.json"] = "b8b71f23",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "7faaf720",
    ["underworld-fgh.execution.json"] = "98b16bfe",
    ["underworld-fghi-empty-shop-group.execution.json"] = "7f6ead50",
    ["underworld-fghi.execution.json"] = "1d4db4fe",
    ["underworld-fog-emitter-reservation.execution.json"] = "4f13b06d",
    ["underworld-generated-composition.execution.json"] = "130d38fa",
    ["underworld-start-g-rivals-boss.execution.json"] = "fc66214d",
    ["underworld-start-i-preboss.execution.json"] = "5ecf542f",
}

function TestFingerprint.testEveryExecutionFixtureKeepsItsFingerprint()
    local count = 0
    for name, expected in pairs(CORPUS) do
        local file = assert(io.open(fixtures.path(name), "rb"))
        local source = file:read("*a"); file:close()
        lu.assertEquals(p.fingerprint(assert(p.json.decode(source))), expected, name)
        count = count + 1
    end
    lu.assertEquals(count, 38)
end

function TestFingerprint.testAsciiAndMultibyteStringsHashTheirBytes()
    lu.assertEquals(p.canonicalFingerprintInput(assert(p.json.decode('"A\\u0000~"'))), "s41007e;")
    lu.assertEquals(p.canonicalFingerprintInput("Melino\195\171"), "s4d656c696e6fc3ab;")
end

return TestFingerprint
