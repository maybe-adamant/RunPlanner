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
    ["automatic-boss.execution.json"] = "fedf868c",
    ["dream-mixed-prefix.execution.json"] = "ec5ef127",
    ["dream-o-skipped-ship.execution.json"] = "947d03cb",
    ["dream-shrine-pending.execution.json"] = "ca64ba85",
    ["dream-start-n-opening.execution.json"] = "24238598",
    ["f-opening.execution.json"] = "d547aa7c",
    ["fg-anomaly-roster.execution.json"] = "82ce2eff",
    ["fg-anomaly.execution.json"] = "5b8891a5",
    ["fg-ixion-chaos.execution.json"] = "48dad576",
    ["fg-npc-shopping-protection.execution.json"] = "9946111f",
    ["fg.execution.json"] = "5a7786bc",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "d17a79b0",
    ["fresh-file-fghi.execution.json"] = "6d7cd665",
    ["run-modifiers.execution.json"] = "66750b80",
    ["surface-generated-precombat.execution.json"] = "fd652b1a",
    ["surface-n-opening-composition.execution.json"] = "bf828cac",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "bf11f4b6",
    ["surface-n.execution.json"] = "29592c89",
    ["surface-no-rerolls.execution.json"] = "57a68cfd",
    ["surface-nopq.execution.json"] = "a9d8d91b",
    ["surface-q-shop-correlation.execution.json"] = "9a4e5744",
    ["surface-scheduled-lifecycle.execution.json"] = "bafba7ed",
    ["surface-selene-hex-path.execution.json"] = "8ea1e12b",
    ["surface-shrine-deliveries.execution.json"] = "2566dbd1",
    ["surface-shrine-rushed-unranked.execution.json"] = "c1a996e5",
    ["surface-start-q-opening.execution.json"] = "3f7c2878",
    ["surface-trait-fences.execution.json"] = "1e1cfe3c",
    ["surface-travel-deal-refill-anvil.execution.json"] = "b16aa055",
    ["underworld-arachne-cocoons.execution.json"] = "cf6a9acc",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "70ba7b48",
    ["underworld-fgh.execution.json"] = "d7bf0b7e",
    ["underworld-fghi-empty-shop-group.execution.json"] = "b7a294b8",
    ["underworld-fghi.execution.json"] = "074a3857",
    ["underworld-fog-emitter-reservation.execution.json"] = "2677bbf4",
    ["underworld-f-rerolls.execution.json"] = "1f45f644",
    ["underworld-generated-composition.execution.json"] = "3fb0b6a1",
    ["underworld-start-g-rivals-boss.execution.json"] = "0c87fb2e",
    ["underworld-start-i-preboss.execution.json"] = "dca7c64c",
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
