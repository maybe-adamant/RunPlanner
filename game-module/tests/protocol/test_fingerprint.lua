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
    ["automatic-boss.execution.json"] = "f63ac06b",
    ["dream-mixed-prefix.execution.json"] = "7647f046",
    ["dream-o-skipped-ship.execution.json"] = "d25d01b5",
    ["dream-shrine-pending.execution.json"] = "e77d5b21",
    ["dream-start-n-opening.execution.json"] = "27ed7f14",
    ["f-opening.execution.json"] = "5900bcce",
    ["fg-anomaly-roster.execution.json"] = "ea0c3ab6",
    ["fg-anomaly.execution.json"] = "c85eb587",
    ["fg-ixion-chaos.execution.json"] = "9e413b4c",
    ["fg-npc-shopping-protection.execution.json"] = "ca6d5364",
    ["fg.execution.json"] = "46e2bef1",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "8b8ec6e6",
    ["fresh-file-fghi.execution.json"] = "8f3ffe64",
    ["run-modifiers.execution.json"] = "731ffd35",
    ["surface-generated-precombat.execution.json"] = "8e95ab5f",
    ["surface-n-opening-composition.execution.json"] = "02669573",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "2ae0f30f",
    ["surface-n.execution.json"] = "8cf07f24",
    ["surface-no.execution.json"] = "dc83aa0f",
    ["surface-nop.execution.json"] = "72c1f01f",
    ["surface-nopq.execution.json"] = "735c7bc5",
    ["surface-q-shop-correlation.execution.json"] = "65a66ae1",
    ["surface-scheduled-lifecycle.execution.json"] = "dd8d1914",
    ["surface-selene-hex-path.execution.json"] = "3b79ef04",
    ["surface-shrine-deliveries.execution.json"] = "df0d4b2b",
    ["surface-shrine-rushed-unranked.execution.json"] = "6041dda4",
    ["surface-start-q-opening.execution.json"] = "5a6542ae",
    ["surface-trait-fences.execution.json"] = "f50298bb",
    ["surface-travel-deal-refill-anvil.execution.json"] = "9ee886fe",
    ["underworld-arachne-cocoons.execution.json"] = "c0bce365",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "11128de3",
    ["underworld-fgh.execution.json"] = "6ce74d5f",
    ["underworld-fghi-empty-shop-group.execution.json"] = "a62ac124",
    ["underworld-fghi.execution.json"] = "bc051949",
    ["underworld-fog-emitter-reservation.execution.json"] = "d9a84403",
    ["underworld-generated-composition.execution.json"] = "ee5da586",
    ["underworld-start-g-rivals-boss.execution.json"] = "6908f48c",
    ["underworld-start-i-preboss.execution.json"] = "cf317ff8",
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
