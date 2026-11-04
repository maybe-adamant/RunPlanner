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
    ["automatic-boss.execution.json"] = "0309f1d1",
    ["dream-mixed-prefix.execution.json"] = "38b3d9c0",
    ["dream-o-skipped-ship.execution.json"] = "95daf2f9",
    ["dream-shrine-pending.execution.json"] = "7a5b60f5",
    ["dream-start-n-opening.execution.json"] = "5734fce3",
    ["f-opening.execution.json"] = "0a466c5e",
    ["fg-anomaly-roster.execution.json"] = "24ea8882",
    ["fg-anomaly.execution.json"] = "b1325c6d",
    ["fg-ixion-chaos.execution.json"] = "e710763c",
    ["fg-npc-shopping-protection.execution.json"] = "a92fbf5e",
    ["fg.execution.json"] = "eabc32c3",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "fd45214e",
    ["fresh-file-fghi.execution.json"] = "36b6c0e9",
    ["run-modifiers.execution.json"] = "91b384ed",
    ["surface-generated-precombat.execution.json"] = "d76fe45c",
    ["surface-n-opening-composition.execution.json"] = "83a9887b",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "86e300c3",
    ["surface-n.execution.json"] = "cb6bb023",
    ["surface-no-rerolls.execution.json"] = "2b8c061a",
    ["surface-nopq.execution.json"] = "8a254978",
    ["surface-q-shop-correlation.execution.json"] = "956330af",
    ["surface-scheduled-lifecycle.execution.json"] = "9681115c",
    ["surface-selene-hex-path.execution.json"] = "9f8a3036",
    ["surface-shrine-deliveries.execution.json"] = "d9150148",
    ["surface-shrine-rushed-unranked.execution.json"] = "7a6de202",
    ["surface-start-q-opening.execution.json"] = "fa4fc92f",
    ["surface-trait-fences.execution.json"] = "9c75eb19",
    ["surface-travel-deal-refill-anvil.execution.json"] = "879c3448",
    ["underworld-arachne-cocoons.execution.json"] = "1c77c776",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "409c8aee",
    ["underworld-fgh.execution.json"] = "03fb2273",
    ["underworld-fghi-empty-shop-group.execution.json"] = "106252b4",
    ["underworld-fghi.execution.json"] = "9e5adc7d",
    ["underworld-fog-emitter-reservation.execution.json"] = "ee338582",
    ["underworld-f-rerolls.execution.json"] = "05530e04",
    ["underworld-generated-composition.execution.json"] = "63f9d3c2",
    ["underworld-start-g-rivals-boss.execution.json"] = "9514190d",
    ["underworld-start-i-preboss.execution.json"] = "396cd613",
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
