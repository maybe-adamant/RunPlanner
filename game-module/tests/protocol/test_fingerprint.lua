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
    ["automatic-boss.execution.json"] = "09486af1",
    ["dream-mixed-prefix.execution.json"] = "7276a415",
    ["dream-o-skipped-ship.execution.json"] = "6cb2488d",
    ["dream-shrine-pending.execution.json"] = "cc4614c1",
    ["dream-start-n-opening.execution.json"] = "60507cb5",
    ["f-opening.execution.json"] = "d6e548e1",
    ["fg-anomaly-roster.execution.json"] = "8b1683d2",
    ["fg-anomaly.execution.json"] = "ac2d8e7d",
    ["fg-ixion-chaos.execution.json"] = "b7312af1",
    ["fg-npc-shopping-protection.execution.json"] = "9b2ea2ec",
    ["fg.execution.json"] = "ffdacef8",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "0a8a5a89",
    ["fresh-file-fghi.execution.json"] = "1cdc4770",
    ["run-modifiers.execution.json"] = "2ff930d8",
    ["surface-generated-precombat.execution.json"] = "e7aec09b",
    ["surface-n-opening-composition.execution.json"] = "ea254807",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "ce66e9b1",
    ["surface-n.execution.json"] = "f1a22f47",
    ["surface-no.execution.json"] = "80c9d6d7",
    ["surface-nop.execution.json"] = "8bf8158a",
    ["surface-nopq.execution.json"] = "fc3bc20d",
    ["surface-q-shop-correlation.execution.json"] = "de9e1eb1",
    ["surface-scheduled-lifecycle.execution.json"] = "60edef28",
    ["surface-selene-hex-path.execution.json"] = "55103392",
    ["surface-shrine-deliveries.execution.json"] = "383a060f",
    ["surface-shrine-rushed-unranked.execution.json"] = "df66e086",
    ["surface-start-q-opening.execution.json"] = "06285e05",
    ["surface-trait-fences.execution.json"] = "31063d15",
    ["surface-travel-deal-refill-anvil.execution.json"] = "28cd872d",
    ["underworld-arachne-cocoons.execution.json"] = "c210f8bc",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "ffe76195",
    ["underworld-fgh.execution.json"] = "95549e4b",
    ["underworld-fghi-empty-shop-group.execution.json"] = "ad714efb",
    ["underworld-fghi.execution.json"] = "4a8542e4",
    ["underworld-fog-emitter-reservation.execution.json"] = "f07003b4",
    ["underworld-generated-composition.execution.json"] = "d883b96e",
    ["underworld-start-g-rivals-boss.execution.json"] = "6c2bddc6",
    ["underworld-start-i-preboss.execution.json"] = "3b121ce3",
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
