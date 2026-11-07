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
    ["automatic-boss.execution.json"] = "15f82415",
    ["dream-mixed-prefix.execution.json"] = "6931935f",
    ["dream-o-skipped-ship.execution.json"] = "b2361e1b",
    ["dream-shrine-pending.execution.json"] = "a1259330",
    ["dream-start-n-opening.execution.json"] = "2694c96f",
    ["f-opening.execution.json"] = "50b8b6d4",
    ["fg-anomaly-roster.execution.json"] = "ddef8583",
    ["fg-anomaly.execution.json"] = "e4d9b68b",
    ["fg-ixion-chaos.execution.json"] = "8711702a",
    ["fg-npc-shopping-protection.execution.json"] = "e0c60a8a",
    ["fg.execution.json"] = "311d8194",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "bb679577",
    ["fresh-file-fghi.execution.json"] = "89c007c0",
    ["run-modifiers.execution.json"] = "0da2b76e",
    ["surface-generated-precombat.execution.json"] = "900c2a95",
    ["surface-n-opening-composition.execution.json"] = "a6b92921",
    ["surface-n-partial-hub.execution.json"] = "dca59526",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "a5f6dc4e",
    ["surface-n.execution.json"] = "b9c5067b",
    ["surface-no-rerolls.execution.json"] = "da5145dc",
    ["surface-nopq.execution.json"] = "e9a6e94c",
    ["surface-p-elite-switch.execution.json"] = "01e38fcd",
    ["surface-q-shop-correlation.execution.json"] = "d66d769b",
    ["surface-scheduled-lifecycle.execution.json"] = "9b3a67da",
    ["surface-selene-hex-path.execution.json"] = "7fac0580",
    ["surface-shrine-deliveries.execution.json"] = "b52c4732",
    ["surface-shrine-rushed-unranked.execution.json"] = "4a57dd76",
    ["surface-start-q-opening.execution.json"] = "041d9aa1",
    ["surface-trait-fences.execution.json"] = "9cdfee86",
    ["surface-travel-deal-refill-anvil.execution.json"] = "8b2db44b",
    ["underworld-arachne-cocoons.execution.json"] = "1cacff9d",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "ba2e7ecb",
    ["underworld-f-cut-end.execution.json"] = "12abb2d1",
    ["underworld-f-cut-end-rerolls.execution.json"] = "b1deb504",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "e1084cfb",
    ["underworld-f-rerolls.execution.json"] = "e6fc6f3b",
    ["underworld-f-switches-failed-left.execution.json"] = "51b9fdc9",
    ["underworld-f-switches.execution.json"] = "f5c49cb3",
    ["underworld-g-locked-doors.execution.json"] = "8d3c5e97",
    ["underworld-fgh.execution.json"] = "d6b0208e",
    ["underworld-fghi-empty-shop-group.execution.json"] = "11dbea56",
    ["underworld-fghi.execution.json"] = "8d7bda2f",
    ["underworld-fog-emitter-reservation.execution.json"] = "68b3191c",
    ["underworld-generated-composition.execution.json"] = "668a31d5",
    ["underworld-start-g-rivals-boss.execution.json"] = "e8177ed0",
    ["underworld-start-i-preboss.execution.json"] = "69c1100f",
}

function TestFingerprint.testEveryExecutionFixtureKeepsItsFingerprint()
    local count = 0
    for name, expected in pairs(CORPUS) do
        local file = assert(io.open(fixtures.path(name), "rb"))
        local source = file:read("*a"); file:close()
        lu.assertEquals(p.fingerprint(assert(p.json.decode(source))), expected, name)
        count = count + 1
    end
    lu.assertEquals(count, 47)
end

function TestFingerprint.testAsciiAndMultibyteStringsHashTheirBytes()
    lu.assertEquals(p.canonicalFingerprintInput(assert(p.json.decode('"A\\u0000~"'))), "s41007e;")
    lu.assertEquals(p.canonicalFingerprintInput("Melino\195\171"), "s4d656c696e6fc3ab;")
end

return TestFingerprint
