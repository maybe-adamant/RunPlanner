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
    ["automatic-boss.execution.json"] = "dc02bfa1",
    ["dream-mixed-prefix.execution.json"] = "7e72c6f5",
    ["dream-o-skipped-ship.execution.json"] = "f0bcb04c",
    ["dream-shrine-pending.execution.json"] = "cad6e6d8",
    ["dream-start-n-opening.execution.json"] = "c64f6d38",
    ["f-opening.execution.json"] = "8b5e3250",
    ["fg-anomaly-roster.execution.json"] = "9f6b9408",
    ["fg-anomaly.execution.json"] = "3335ac97",
    ["fg-ixion-chaos.execution.json"] = "45c13c54",
    ["fg-npc-shopping-protection.execution.json"] = "bd74bbcb",
    ["fg.execution.json"] = "0bdaf184",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "d2e90ba9",
    ["fresh-file-fghi.execution.json"] = "e3ddc2b9",
    ["run-modifiers.execution.json"] = "b870517d",
    ["surface-generated-precombat.execution.json"] = "323dcbc6",
    ["surface-n-opening-composition.execution.json"] = "390802ae",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "afb377c5",
    ["surface-n.execution.json"] = "3fd92147",
    ["surface-no.execution.json"] = "7bc05f35",
    ["surface-nop.execution.json"] = "27f3ecf0",
    ["surface-nopq.execution.json"] = "40888932",
    ["surface-q-shop-correlation.execution.json"] = "7e20421f",
    ["surface-scheduled-lifecycle.execution.json"] = "cbc9aebc",
    ["surface-selene-hex-path.execution.json"] = "ed9f4dd6",
    ["surface-shrine-deliveries.execution.json"] = "f539bb1b",
    ["surface-shrine-rushed-unranked.execution.json"] = "67267a52",
    ["surface-start-q-opening.execution.json"] = "61ea5864",
    ["surface-travel-deal-refill-anvil.execution.json"] = "474d8346",
    ["underworld-arachne-cocoons.execution.json"] = "edf31563",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "596f70d3",
    ["underworld-fgh.execution.json"] = "34f28fb7",
    ["underworld-fghi-empty-shop-group.execution.json"] = "1a006c97",
    ["underworld-fghi.execution.json"] = "872000ac",
    ["underworld-fog-emitter-reservation.execution.json"] = "87d956cb",
    ["underworld-generated-composition.execution.json"] = "8d2ea46c",
    ["underworld-start-g-rivals-boss.execution.json"] = "0dfb6a0f",
    ["underworld-start-i-preboss.execution.json"] = "67e81950",
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
