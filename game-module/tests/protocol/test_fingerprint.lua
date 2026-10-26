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
    ["automatic-boss.execution.json"] = "2319591e",
    ["dream-mixed-prefix.execution.json"] = "ebb3d26a",
    ["dream-o-skipped-ship.execution.json"] = "3d03bcd1",
    ["dream-shrine-pending.execution.json"] = "a4e8c8a4",
    ["dream-start-n-opening.execution.json"] = "d48a5ae6",
    ["f-opening.execution.json"] = "704d5489",
    ["fg-anomaly-roster.execution.json"] = "c31e2960",
    ["fg-anomaly.execution.json"] = "cb8aed00",
    ["fg-ixion-chaos.execution.json"] = "945b1ecd",
    ["fg-npc-shopping-protection.execution.json"] = "5032d413",
    ["fg.execution.json"] = "8e54ff98",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "2b1d4551",
    ["fresh-file-fghi.execution.json"] = "a371d464",
    ["run-modifiers.execution.json"] = "ec379e22",
    ["surface-generated-precombat.execution.json"] = "6e15dd49",
    ["surface-n-opening-composition.execution.json"] = "8604d970",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "cc62b692",
    ["surface-n.execution.json"] = "19a36bd7",
    ["surface-nopq.execution.json"] = "12313066",
    ["surface-q-shop-correlation.execution.json"] = "95884945",
    ["surface-scheduled-lifecycle.execution.json"] = "2036ef7a",
    ["surface-selene-hex-path.execution.json"] = "98a89e85",
    ["surface-shrine-deliveries.execution.json"] = "a2656e78",
    ["surface-shrine-rushed-unranked.execution.json"] = "bb3aacb9",
    ["surface-start-q-opening.execution.json"] = "974413dd",
    ["surface-trait-fences.execution.json"] = "8e708527",
    ["surface-travel-deal-refill-anvil.execution.json"] = "05f35a96",
    ["underworld-arachne-cocoons.execution.json"] = "ba66a302",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "24a614e2",
    ["underworld-fgh.execution.json"] = "b45fe424",
    ["underworld-fghi-empty-shop-group.execution.json"] = "940d690a",
    ["underworld-fghi.execution.json"] = "962205d7",
    ["underworld-fog-emitter-reservation.execution.json"] = "4eaac0b7",
    ["underworld-generated-composition.execution.json"] = "5651328c",
    ["underworld-start-g-rivals-boss.execution.json"] = "417e9d36",
    ["underworld-start-i-preboss.execution.json"] = "dd7e2adb",
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
