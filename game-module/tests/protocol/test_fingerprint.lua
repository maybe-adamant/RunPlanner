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
    ["automatic-boss.execution.json"] = "d5356401",
    ["dream-mixed-prefix.execution.json"] = "a1cbddb3",
    ["dream-o-skipped-ship.execution.json"] = "70d75714",
    ["dream-shrine-pending.execution.json"] = "09cf86bb",
    ["dream-start-n-opening.execution.json"] = "5403a913",
    ["f-opening.execution.json"] = "cdbfe237",
    ["fg-anomaly-roster.execution.json"] = "195887ad",
    ["fg-anomaly.execution.json"] = "f7f2b765",
    ["fg-ixion-chaos.execution.json"] = "1c7eee4c",
    ["fg-npc-shopping-protection.execution.json"] = "7e2f723c",
    ["fg.execution.json"] = "92ede1dd",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "b0d46268",
    ["fresh-file-fghi.execution.json"] = "5c746543",
    ["run-modifiers.execution.json"] = "f3a2ccfa",
    ["surface-generated-precombat.execution.json"] = "c8f332dc",
    ["surface-n-opening-composition.execution.json"] = "98f5aa8d",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "4f4dd956",
    ["surface-n.execution.json"] = "a97b3363",
    ["surface-nopq.execution.json"] = "2a5675e9",
    ["surface-q-shop-correlation.execution.json"] = "7b269d98",
    ["surface-scheduled-lifecycle.execution.json"] = "244d9dcf",
    ["surface-selene-hex-path.execution.json"] = "cb70f017",
    ["surface-shrine-deliveries.execution.json"] = "0412b995",
    ["surface-shrine-rushed-unranked.execution.json"] = "6ae501f2",
    ["surface-start-q-opening.execution.json"] = "9e1e4b4b",
    ["surface-trait-fences.execution.json"] = "6d84f464",
    ["surface-travel-deal-refill-anvil.execution.json"] = "dec774b9",
    ["underworld-arachne-cocoons.execution.json"] = "4ced1325",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "68247583",
    ["underworld-fgh.execution.json"] = "ad33294a",
    ["underworld-fghi-empty-shop-group.execution.json"] = "91a1315c",
    ["underworld-fghi.execution.json"] = "b3d88dfa",
    ["underworld-fog-emitter-reservation.execution.json"] = "fb07e9e7",
    ["underworld-generated-composition.execution.json"] = "f4e933b0",
    ["underworld-start-g-rivals-boss.execution.json"] = "b4ded381",
    ["underworld-start-i-preboss.execution.json"] = "fb09b634",
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
