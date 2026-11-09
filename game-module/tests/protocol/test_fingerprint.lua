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
    ["automatic-boss.execution.json"] = "e023c204",
    ["dream-mixed-prefix.execution.json"] = "359e3314",
    ["dream-o-skipped-ship.execution.json"] = "1517fd57",
    ["dream-shrine-pending.execution.json"] = "87aa445c",
    ["dream-start-n-opening.execution.json"] = "fd0bb303",
    ["f-opening.execution.json"] = "e2ecae83",
    ["fg-anomaly-roster.execution.json"] = "b2916d1b",
    ["fg-anomaly.execution.json"] = "f05be59d",
    ["fg-ixion-chaos.execution.json"] = "591a8686",
    ["fg-npc-shopping-protection.execution.json"] = "ad04f809",
    ["fg.execution.json"] = "e6646cf1",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "0ef18a7f",
    ["fresh-file-fghi.execution.json"] = "ba87fdf3",
    ["run-modifiers.execution.json"] = "b72414a3",
    ["surface-generated-precombat.execution.json"] = "01b887d5",
    ["surface-n-opening-composition.execution.json"] = "abda0ca0",
    ["surface-n-partial-hub.execution.json"] = "3b5123a7",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "27a3317f",
    ["surface-n.execution.json"] = "8906759a",
    ["surface-no-rerolls.execution.json"] = "0862af3b",
    ["surface-nopq.execution.json"] = "1822ce76",
    ["surface-p-elite-switch.execution.json"] = "53161d5b",
    ["surface-q-shop-correlation.execution.json"] = "b74690b6",
    ["surface-scheduled-lifecycle.execution.json"] = "9daade6b",
    ["surface-selene-hex-path.execution.json"] = "5361c527",
    ["surface-shrine-deliveries.execution.json"] = "135bdad7",
    ["surface-shrine-rushed-unranked.execution.json"] = "35f60b9b",
    ["surface-start-q-opening.execution.json"] = "3a770b99",
    ["surface-trait-fences.execution.json"] = "7777f265",
    ["surface-travel-deal-refill-anvil.execution.json"] = "9bfb52da",
    ["underworld-arachne-cocoons.execution.json"] = "71bd2dfc",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "7ea58057",
    ["underworld-f-cut-end.execution.json"] = "d4237ffc",
    ["underworld-f-cut-end-rerolls.execution.json"] = "cbe85d9a",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "e61814b9",
    ["underworld-f-rerolls.execution.json"] = "b81a47c3",
    ["underworld-f-switches-failed-left.execution.json"] = "e91d2b8e",
    ["underworld-f-switches.execution.json"] = "0bcf59a0",
    ["underworld-g-locked-doors.execution.json"] = "e5ba2372",
    ["underworld-fgh.execution.json"] = "6835f7aa",
    ["underworld-fghi-empty-shop-group.execution.json"] = "c3d14ae1",
    ["underworld-fghi.execution.json"] = "2806deec",
    ["underworld-fog-emitter-reservation.execution.json"] = "87a40c96",
    ["underworld-generated-composition.execution.json"] = "e567d73a",
    ["underworld-start-g-rivals-boss.execution.json"] = "abffa333",
    ["underworld-start-i-preboss.execution.json"] = "ae8e1371",
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
