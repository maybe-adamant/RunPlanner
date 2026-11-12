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
    ["automatic-boss.execution.json"] = "bc34bcf2",
    ["dream-mixed-prefix.execution.json"] = "cfd4a352",
    ["dream-o-skipped-ship.execution.json"] = "cf951887",
    ["dream-shrine-pending.execution.json"] = "6a165477",
    ["dream-start-n-opening.execution.json"] = "fcc181c7",
    ["f-opening.execution.json"] = "495b5e8b",
    ["fg-anomaly-roster.execution.json"] = "e8e226b6",
    ["fg-anomaly.execution.json"] = "acb8885e",
    ["fg-ixion-chaos.execution.json"] = "73470235",
    ["fg-npc-shopping-protection.execution.json"] = "e15023b7",
    ["fg.execution.json"] = "8cb6153c",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "8283f545",
    ["fresh-file-fghi.execution.json"] = "942ea446",
    ["run-modifiers.execution.json"] = "3217257f",
    ["surface-generated-precombat.execution.json"] = "3152c25b",
    ["surface-n-opening-composition.execution.json"] = "bee99bb5",
    ["surface-n-partial-hub.execution.json"] = "d5bd72dd",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "ab8ccfbd",
    ["surface-n.execution.json"] = "c818d48a",
    ["surface-no-rerolls.execution.json"] = "3ec3c5f6",
    ["surface-nopq.execution.json"] = "c555c264",
    ["surface-p-elite-switch.execution.json"] = "2cf6a6db",
    ["surface-q-shop-correlation.execution.json"] = "96425f64",
    ["surface-scheduled-lifecycle.execution.json"] = "9099e64d",
    ["surface-selene-hex-path.execution.json"] = "e2cb310f",
    ["surface-shrine-deliveries.execution.json"] = "09e23867",
    ["surface-shrine-rushed-unranked.execution.json"] = "ba2dc8b0",
    ["surface-start-q-opening.execution.json"] = "55801005",
    ["surface-trait-fences.execution.json"] = "1c415c67",
    ["surface-travel-deal-refill-anvil.execution.json"] = "69390710",
    ["underworld-arachne-cocoons.execution.json"] = "b4c78ac2",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "bc502e4a",
    ["underworld-f-cut-end.execution.json"] = "53016de7",
    ["underworld-f-cut-end-rerolls.execution.json"] = "a6035e9b",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "8469d111",
    ["underworld-f-rerolls.execution.json"] = "dc63e65a",
    ["underworld-f-switches-failed-left.execution.json"] = "ddda2a3d",
    ["underworld-f-switches.execution.json"] = "84d07cee",
    ["underworld-g-locked-doors.execution.json"] = "a4860300",
    ["underworld-fgh.execution.json"] = "808492c4",
    ["underworld-fghi-empty-shop-group.execution.json"] = "ace5b01e",
    ["underworld-fghi.execution.json"] = "f47853b4",
    ["underworld-fog-emitter-reservation.execution.json"] = "f18b6c00",
    ["underworld-generated-composition.execution.json"] = "cdc5624f",
    ["underworld-start-g-rivals-boss.execution.json"] = "f1875d73",
    ["underworld-start-i-preboss.execution.json"] = "01cd0555",
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
