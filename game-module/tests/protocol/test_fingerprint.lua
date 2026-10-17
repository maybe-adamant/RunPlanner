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
    ["automatic-boss.execution.json"] = "aac020a5",
    ["dream-mixed-prefix.execution.json"] = "4aa1ee25",
    ["dream-o-skipped-ship.execution.json"] = "c119f882",
    ["dream-shrine-pending.execution.json"] = "907ac672",
    ["dream-start-n-opening.execution.json"] = "0c9d17b5",
    ["f-opening.execution.json"] = "2c17ba03",
    ["fg-anomaly-roster.execution.json"] = "aa353bc0",
    ["fg-anomaly.execution.json"] = "9f8e6146",
    ["fg-ixion-chaos.execution.json"] = "3c376b7c",
    ["fg-npc-shopping-protection.execution.json"] = "0dfd50c0",
    ["fg.execution.json"] = "ef070148",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "0a1bdf43",
    ["fresh-file-fghi.execution.json"] = "2f1f4cd2",
    ["run-modifiers.execution.json"] = "cecd6d2d",
    ["surface-generated-precombat.execution.json"] = "1fa282b1",
    ["surface-n-opening-composition.execution.json"] = "28640fab",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "a8a54195",
    ["surface-n.execution.json"] = "7f725489",
    ["surface-no.execution.json"] = "6ae200bb",
    ["surface-nop.execution.json"] = "3c7adae5",
    ["surface-nopq.execution.json"] = "fc115c32",
    ["surface-q-shop-correlation.execution.json"] = "9793266c",
    ["surface-scheduled-lifecycle.execution.json"] = "b3b6be39",
    ["surface-selene-hex-path.execution.json"] = "c2ceae79",
    ["surface-shrine-deliveries.execution.json"] = "b552d7bc",
    ["surface-shrine-rushed-unranked.execution.json"] = "49873c7f",
    ["surface-start-q-opening.execution.json"] = "d2df2745",
    ["surface-trait-fences.execution.json"] = "c64704a9",
    ["surface-travel-deal-refill-anvil.execution.json"] = "ef98da1c",
    ["underworld-arachne-cocoons.execution.json"] = "46ae9372",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "9608e436",
    ["underworld-fgh.execution.json"] = "2e0d1a53",
    ["underworld-fghi-empty-shop-group.execution.json"] = "47bca885",
    ["underworld-fghi.execution.json"] = "1dc16acc",
    ["underworld-fog-emitter-reservation.execution.json"] = "53b4b982",
    ["underworld-generated-composition.execution.json"] = "c5d2274b",
    ["underworld-start-g-rivals-boss.execution.json"] = "0466c167",
    ["underworld-start-i-preboss.execution.json"] = "6e48c663",
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
