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
    ["automatic-boss.execution.json"] = "8362035b",
    ["dream-mixed-prefix.execution.json"] = "3ee33b6d",
    ["dream-o-skipped-ship.execution.json"] = "c738f7a7",
    ["dream-shrine-pending.execution.json"] = "92a759c5",
    ["dream-start-n-opening.execution.json"] = "e769e469",
    ["f-opening.execution.json"] = "326b42b5",
    ["fg-anomaly-roster.execution.json"] = "316f52c2",
    ["fg-anomaly.execution.json"] = "2f80adc5",
    ["fg-ixion-chaos.execution.json"] = "424a136a",
    ["fg-npc-shopping-protection.execution.json"] = "92022e47",
    ["fg.execution.json"] = "6680e33b",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "747144f2",
    ["fresh-file-fghi.execution.json"] = "5215a664",
    ["run-modifiers.execution.json"] = "25efffba",
    ["surface-generated-precombat.execution.json"] = "35c31c2e",
    ["surface-n-opening-composition.execution.json"] = "1b4295d9",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "fb0a0548",
    ["surface-n.execution.json"] = "5cdec2fd",
    ["surface-no.execution.json"] = "bd1aae6e",
    ["surface-nop.execution.json"] = "febd9ca5",
    ["surface-nopq.execution.json"] = "272a98ee",
    ["surface-q-shop-correlation.execution.json"] = "c1f31464",
    ["surface-scheduled-lifecycle.execution.json"] = "76ac31ad",
    ["surface-selene-hex-path.execution.json"] = "6734f19b",
    ["surface-shrine-deliveries.execution.json"] = "89cc9b3c",
    ["surface-shrine-rushed-unranked.execution.json"] = "b90a4e19",
    ["surface-start-q-opening.execution.json"] = "90872840",
    ["surface-trait-fences.execution.json"] = "e7be5488",
    ["surface-travel-deal-refill-anvil.execution.json"] = "15d1b242",
    ["underworld-arachne-cocoons.execution.json"] = "3d9a558b",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "1cc0886b",
    ["underworld-fgh.execution.json"] = "314b7081",
    ["underworld-fghi-empty-shop-group.execution.json"] = "10a5fb3c",
    ["underworld-fghi.execution.json"] = "43e2c66e",
    ["underworld-fog-emitter-reservation.execution.json"] = "61665821",
    ["underworld-generated-composition.execution.json"] = "750252b4",
    ["underworld-start-g-rivals-boss.execution.json"] = "9ee4a92e",
    ["underworld-start-i-preboss.execution.json"] = "19265a11",
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
