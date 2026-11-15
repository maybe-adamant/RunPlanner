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
    ["automatic-boss.execution.json"] = "9b36f405",
    ["dream-mixed-prefix.execution.json"] = "2bb504ba",
    ["dream-o-skipped-ship.execution.json"] = "37f07aaa",
    ["dream-shrine-pending.execution.json"] = "b1e3dcc1",
    ["dream-start-n-opening.execution.json"] = "c8d7e781",
    ["f-opening.execution.json"] = "96309e0d",
    ["fg-anomaly-roster.execution.json"] = "e58649da",
    ["fg-ixion-chaos.execution.json"] = "8e2648ec",
    ["fg-npc-shopping-protection.execution.json"] = "c64d0e3a",
    ["fg.execution.json"] = "d577957a",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-fghi.execution.json"] = "b5faa0c9",
    ["run-modifiers.execution.json"] = "c6b386a6",
    ["surface-generated-precombat.execution.json"] = "f37a3d4e",
    ["surface-n-partial-hub.execution.json"] = "0da23fca",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "1077e85a",
    ["surface-n.execution.json"] = "549e4b72",
    ["surface-nopq.execution.json"] = "899a2501",
    ["surface-p-elite-switch.execution.json"] = "85326249",
    ["surface-q-shop-correlation.execution.json"] = "5a83071a",
    ["surface-scheduled-lifecycle.execution.json"] = "fda9b37c",
    ["surface-selene-hex-path.execution.json"] = "61014eac",
    ["surface-shrine-deliveries.execution.json"] = "bf19f771",
    ["surface-shrine-rushed-unranked.execution.json"] = "4850e096",
    ["surface-start-q-opening.execution.json"] = "9efee275",
    ["surface-trait-fences.execution.json"] = "5441b71e",
    ["surface-travel-deal-refill-anvil.execution.json"] = "86661fb0",
    ["underworld-arachne-cocoons.execution.json"] = "0751fd63",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "0e559b60",
    ["underworld-f-cut-end.execution.json"] = "4a1426e0",
    ["underworld-f-cut-end-rerolls.execution.json"] = "a5e0eaaa",
    ["underworld-f-switches-failed-left.execution.json"] = "3523edbf",
    ["underworld-f-switches.execution.json"] = "d7d924d9",
    ["underworld-g-locked-doors.execution.json"] = "9a90c1d3",
    ["underworld-fgh.execution.json"] = "b39919b6",
    ["underworld-fghi-empty-shop-group.execution.json"] = "a9f15b71",
    ["underworld-fghi.execution.json"] = "b5e7a6ac",
    ["underworld-generated-composition.execution.json"] = "4792edfd",
    ["underworld-start-g-rivals-boss.execution.json"] = "bd72a41c",
    ["underworld-start-i-preboss.execution.json"] = "f6fc90e3",
}

function TestFingerprint.testEveryExecutionFixtureKeepsItsFingerprint()
    local count = 0
    for name, expected in pairs(CORPUS) do
        local file = assert(io.open(fixtures.path(name), "rb"))
        local source = file:read("*a"); file:close()
        lu.assertEquals(p.fingerprint(assert(p.json.decode(source))), expected, name)
        count = count + 1
    end
    lu.assertEquals(count, 40)
end

function TestFingerprint.testAsciiAndMultibyteStringsHashTheirBytes()
    lu.assertEquals(p.canonicalFingerprintInput(assert(p.json.decode('"A\\u0000~"'))), "s41007e;")
    lu.assertEquals(p.canonicalFingerprintInput("Melino\195\171"), "s4d656c696e6fc3ab;")
end

return TestFingerprint
