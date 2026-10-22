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
    ["automatic-boss.execution.json"] = "c8d6eff0",
    ["dream-mixed-prefix.execution.json"] = "5b94bb17",
    ["dream-o-skipped-ship.execution.json"] = "ab01115e",
    ["dream-shrine-pending.execution.json"] = "1c1d1744",
    ["dream-start-n-opening.execution.json"] = "a728de17",
    ["f-opening.execution.json"] = "ae063410",
    ["fg-anomaly-roster.execution.json"] = "29602ef8",
    ["fg-anomaly.execution.json"] = "2e4579ea",
    ["fg-ixion-chaos.execution.json"] = "6acf31ef",
    ["fg-npc-shopping-protection.execution.json"] = "785303a1",
    ["fg.execution.json"] = "7cc5570a",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "712fbe77",
    ["fresh-file-fghi.execution.json"] = "fe25e816",
    ["run-modifiers.execution.json"] = "74b557df",
    ["surface-generated-precombat.execution.json"] = "5a35eb32",
    ["surface-n-opening-composition.execution.json"] = "d9c622e1",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "c63cc2df",
    ["surface-n.execution.json"] = "04137e06",
    ["surface-nopq.execution.json"] = "7d841901",
    ["surface-q-shop-correlation.execution.json"] = "934ea985",
    ["surface-scheduled-lifecycle.execution.json"] = "40a75f29",
    ["surface-selene-hex-path.execution.json"] = "9ed879b4",
    ["surface-shrine-deliveries.execution.json"] = "eaf1dc4d",
    ["surface-shrine-rushed-unranked.execution.json"] = "3f15f0fa",
    ["surface-start-q-opening.execution.json"] = "eeff7400",
    ["surface-trait-fences.execution.json"] = "11968b36",
    ["surface-travel-deal-refill-anvil.execution.json"] = "ef8c1629",
    ["underworld-arachne-cocoons.execution.json"] = "15a77615",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "d9dc220d",
    ["underworld-fgh.execution.json"] = "5134da0c",
    ["underworld-fghi-empty-shop-group.execution.json"] = "e9c23ff2",
    ["underworld-fghi.execution.json"] = "61b47824",
    ["underworld-fog-emitter-reservation.execution.json"] = "e02bbd69",
    ["underworld-generated-composition.execution.json"] = "3ef311a2",
    ["underworld-start-g-rivals-boss.execution.json"] = "6be7b97f",
    ["underworld-start-i-preboss.execution.json"] = "8e96e308",
}

function TestFingerprint.testEveryExecutionFixtureKeepsItsFingerprint()
    local count = 0
    for name, expected in pairs(CORPUS) do
        local file = assert(io.open(fixtures.path(name), "rb"))
        local source = file:read("*a"); file:close()
        lu.assertEquals(p.fingerprint(assert(p.json.decode(source))), expected, name)
        count = count + 1
    end
    lu.assertEquals(count, 37)
end

function TestFingerprint.testAsciiAndMultibyteStringsHashTheirBytes()
    lu.assertEquals(p.canonicalFingerprintInput(assert(p.json.decode('"A\\u0000~"'))), "s41007e;")
    lu.assertEquals(p.canonicalFingerprintInput("Melino\195\171"), "s4d656c696e6fc3ab;")
end

return TestFingerprint
