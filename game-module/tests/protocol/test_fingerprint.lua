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
    ["automatic-boss.execution.json"] = "f3c781b6",
    ["dream-mixed-prefix.execution.json"] = "ca571941",
    ["dream-o-skipped-ship.execution.json"] = "eb0d0ddc",
    ["dream-shrine-pending.execution.json"] = "cf81626c",
    ["dream-start-n-opening.execution.json"] = "6fd26104",
    ["f-opening.execution.json"] = "9d3a9551",
    ["fg-anomaly-roster.execution.json"] = "fcae73d1",
    ["fg-anomaly.execution.json"] = "fae8b4e4",
    ["fg-ixion-chaos.execution.json"] = "9271d7c0",
    ["fg-npc-shopping-protection.execution.json"] = "f5b7358a",
    ["fg.execution.json"] = "eea87041",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "2cd4b420",
    ["fresh-file-fghi.execution.json"] = "5905dbb1",
    ["run-modifiers.execution.json"] = "d46955fa",
    ["surface-generated-precombat.execution.json"] = "49293feb",
    ["surface-n-opening-composition.execution.json"] = "66d54954",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "a2a5b982",
    ["surface-n.execution.json"] = "528b4387",
    ["surface-no.execution.json"] = "65079a21",
    ["surface-nop.execution.json"] = "fd8dac17",
    ["surface-nopq.execution.json"] = "f2425ca1",
    ["surface-q-shop-correlation.execution.json"] = "609fd9a6",
    ["surface-scheduled-lifecycle.execution.json"] = "a5c39eda",
    ["surface-selene-hex-path.execution.json"] = "ea2bcaff",
    ["surface-shrine-deliveries.execution.json"] = "d207ec5e",
    ["surface-shrine-rushed-unranked.execution.json"] = "0ab53f34",
    ["surface-start-q-opening.execution.json"] = "79a0d995",
    ["surface-trait-fences.execution.json"] = "7f410e0c",
    ["surface-travel-deal-refill-anvil.execution.json"] = "737018fa",
    ["underworld-arachne-cocoons.execution.json"] = "302f32fc",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "549ff985",
    ["underworld-fgh.execution.json"] = "4af620f5",
    ["underworld-fghi-empty-shop-group.execution.json"] = "ba00b0c1",
    ["underworld-fghi.execution.json"] = "5b583747",
    ["underworld-fog-emitter-reservation.execution.json"] = "2ba8a682",
    ["underworld-generated-composition.execution.json"] = "094f9c10",
    ["underworld-start-g-rivals-boss.execution.json"] = "fad3527c",
    ["underworld-start-i-preboss.execution.json"] = "52ab1344",
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
