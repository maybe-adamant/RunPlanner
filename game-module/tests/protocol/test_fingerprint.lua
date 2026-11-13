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
    ["automatic-boss.execution.json"] = "b51fb09b",
    ["dream-mixed-prefix.execution.json"] = "99d1acea",
    ["dream-o-skipped-ship.execution.json"] = "fb38d41d",
    ["dream-shrine-pending.execution.json"] = "2fa367ad",
    ["dream-start-n-opening.execution.json"] = "8973ab3f",
    ["f-opening.execution.json"] = "142870c5",
    ["fg-anomaly-roster.execution.json"] = "b7ad1572",
    ["fg-anomaly.execution.json"] = "55edb787",
    ["fg-ixion-chaos.execution.json"] = "a4363e15",
    ["fg-npc-shopping-protection.execution.json"] = "5fe5b125",
    ["fg.execution.json"] = "d0a63152",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "ca3f1557",
    ["fresh-file-fghi.execution.json"] = "a91e77aa",
    ["run-modifiers.execution.json"] = "4c06ce07",
    ["surface-generated-precombat.execution.json"] = "fd522f36",
    ["surface-n-opening-composition.execution.json"] = "9772037f",
    ["surface-n-partial-hub.execution.json"] = "45aa9919",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "7ffb4b7c",
    ["surface-n.execution.json"] = "4df807ba",
    ["surface-no-rerolls.execution.json"] = "cdc02ad7",
    ["surface-nopq.execution.json"] = "5f3e0f01",
    ["surface-p-elite-switch.execution.json"] = "a2a6264e",
    ["surface-q-shop-correlation.execution.json"] = "3e572216",
    ["surface-scheduled-lifecycle.execution.json"] = "d0a9abd1",
    ["surface-selene-hex-path.execution.json"] = "a59ab7cd",
    ["surface-shrine-deliveries.execution.json"] = "2e17919c",
    ["surface-shrine-rushed-unranked.execution.json"] = "47749c3d",
    ["surface-start-q-opening.execution.json"] = "ccde5200",
    ["surface-trait-fences.execution.json"] = "9490c1f3",
    ["surface-travel-deal-refill-anvil.execution.json"] = "97e56b5e",
    ["underworld-arachne-cocoons.execution.json"] = "db0d65e4",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "e104a16a",
    ["underworld-f-cut-end.execution.json"] = "ecbfc03a",
    ["underworld-f-cut-end-rerolls.execution.json"] = "163d4261",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "4cf80fe2",
    ["underworld-f-rerolls.execution.json"] = "17ec4e99",
    ["underworld-f-switches-failed-left.execution.json"] = "bd5ba8cd",
    ["underworld-f-switches.execution.json"] = "a6a2a712",
    ["underworld-g-locked-doors.execution.json"] = "0caae1e9",
    ["underworld-fgh.execution.json"] = "b01f7152",
    ["underworld-fghi-empty-shop-group.execution.json"] = "520457a6",
    ["underworld-fghi.execution.json"] = "2546b7ed",
    ["underworld-fog-emitter-reservation.execution.json"] = "4a9b7d92",
    ["underworld-generated-composition.execution.json"] = "39bb85e1",
    ["underworld-start-g-rivals-boss.execution.json"] = "742044af",
    ["underworld-start-i-preboss.execution.json"] = "9461a60f",
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
