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
    ["automatic-boss.execution.json"] = "7234123b",
    ["dream-mixed-prefix.execution.json"] = "4c549c82",
    ["dream-o-skipped-ship.execution.json"] = "1517fd57",
    ["dream-shrine-pending.execution.json"] = "87aa445c",
    ["dream-start-n-opening.execution.json"] = "427f7f40",
    ["f-opening.execution.json"] = "d95006bd",
    ["fg-anomaly-roster.execution.json"] = "4ca1e206",
    ["fg-anomaly.execution.json"] = "28baf3b9",
    ["fg-ixion-chaos.execution.json"] = "2b59a312",
    ["fg-npc-shopping-protection.execution.json"] = "a30f29b3",
    ["fg.execution.json"] = "8c79385f",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "55fa8a7f",
    ["fresh-file-fghi.execution.json"] = "7de34d3c",
    ["run-modifiers.execution.json"] = "e7f08b7e",
    ["surface-generated-precombat.execution.json"] = "01b887d5",
    ["surface-n-opening-composition.execution.json"] = "abda0ca0",
    ["surface-n-partial-hub.execution.json"] = "3b5123a7",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "27a3317f",
    ["surface-n.execution.json"] = "8906759a",
    ["surface-no-rerolls.execution.json"] = "0862af3b",
    ["surface-nopq.execution.json"] = "1822ce76",
    ["surface-p-elite-switch.execution.json"] = "4f73d2aa",
    ["surface-q-shop-correlation.execution.json"] = "b74690b6",
    ["surface-scheduled-lifecycle.execution.json"] = "9daade6b",
    ["surface-selene-hex-path.execution.json"] = "5361c527",
    ["surface-shrine-deliveries.execution.json"] = "135bdad7",
    ["surface-shrine-rushed-unranked.execution.json"] = "35f60b9b",
    ["surface-start-q-opening.execution.json"] = "3a770b99",
    ["surface-trait-fences.execution.json"] = "7777f265",
    ["surface-travel-deal-refill-anvil.execution.json"] = "9bfb52da",
    ["underworld-arachne-cocoons.execution.json"] = "8a30ba68",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "0103b39e",
    ["underworld-f-cut-end.execution.json"] = "aef55e11",
    ["underworld-f-cut-end-rerolls.execution.json"] = "cbe85d9a",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "04ab0c3b",
    ["underworld-f-rerolls.execution.json"] = "f34a8f7b",
    ["underworld-f-switches-failed-left.execution.json"] = "5589a62c",
    ["underworld-f-switches.execution.json"] = "c82d8bf3",
    ["underworld-g-locked-doors.execution.json"] = "1b158a41",
    ["underworld-fgh.execution.json"] = "6e3d3f64",
    ["underworld-fghi-empty-shop-group.execution.json"] = "7172e1c3",
    ["underworld-fghi.execution.json"] = "75dba551",
    ["underworld-fog-emitter-reservation.execution.json"] = "95a49ccf",
    ["underworld-generated-composition.execution.json"] = "246d1086",
    ["underworld-start-g-rivals-boss.execution.json"] = "ebb91ae2",
    ["underworld-start-i-preboss.execution.json"] = "a2729a57",
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
