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
    ["automatic-boss.execution.json"] = "e6eea0bf",
    ["dream-mixed-prefix.execution.json"] = "552f3da0",
    ["dream-o-skipped-ship.execution.json"] = "6ddd6e68",
    ["dream-shrine-pending.execution.json"] = "72bb4464",
    ["dream-start-n-opening.execution.json"] = "81761243",
    ["f-opening.execution.json"] = "0c42f7a8",
    ["fg-anomaly-roster.execution.json"] = "f7b2b9f8",
    ["fg-anomaly.execution.json"] = "7a65b458",
    ["fg-ixion-chaos.execution.json"] = "2c0db2f4",
    ["fg-npc-shopping-protection.execution.json"] = "6c5e6a99",
    ["fg.execution.json"] = "b4c9c486",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "76c0a9dd",
    ["fresh-file-fghi.execution.json"] = "3b4a9b9b",
    ["run-modifiers.execution.json"] = "11aba32e",
    ["surface-generated-precombat.execution.json"] = "62a0d0da",
    ["surface-n-opening-composition.execution.json"] = "07a965a0",
    ["surface-n-partial-hub.execution.json"] = "94d3f660",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "4f1d72c9",
    ["surface-n.execution.json"] = "b053e2df",
    ["surface-no-rerolls.execution.json"] = "9eb50f9e",
    ["surface-nopq.execution.json"] = "70d8994f",
    ["surface-p-elite-switch.execution.json"] = "75a6ea10",
    ["surface-q-shop-correlation.execution.json"] = "5854adcc",
    ["surface-scheduled-lifecycle.execution.json"] = "ed600752",
    ["surface-selene-hex-path.execution.json"] = "8e9eaac9",
    ["surface-shrine-deliveries.execution.json"] = "8a18b59e",
    ["surface-shrine-rushed-unranked.execution.json"] = "976a5e04",
    ["surface-start-q-opening.execution.json"] = "903dc12f",
    ["surface-trait-fences.execution.json"] = "96b182f8",
    ["surface-travel-deal-refill-anvil.execution.json"] = "7383c75d",
    ["underworld-arachne-cocoons.execution.json"] = "296954a9",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "13f17bfd",
    ["underworld-f-cut-end.execution.json"] = "66fc276f",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "d7b358fb",
    ["underworld-f-rerolls.execution.json"] = "1cbc3e3b",
    ["underworld-f-switches-failed-left.execution.json"] = "a3c81e54",
    ["underworld-f-switches.execution.json"] = "7fcc1f95",
    ["underworld-fgh.execution.json"] = "d1255079",
    ["underworld-fghi-empty-shop-group.execution.json"] = "f2cb8343",
    ["underworld-fghi.execution.json"] = "33a8243d",
    ["underworld-fog-emitter-reservation.execution.json"] = "db9823ef",
    ["underworld-generated-composition.execution.json"] = "c1d42cda",
    ["underworld-start-g-rivals-boss.execution.json"] = "deb3b802",
    ["underworld-start-i-preboss.execution.json"] = "bf6b6ab0",
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
