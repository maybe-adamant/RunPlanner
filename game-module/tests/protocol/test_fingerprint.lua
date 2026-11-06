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
    ["automatic-boss.execution.json"] = "529c59b4",
    ["dream-mixed-prefix.execution.json"] = "a21310d8",
    ["dream-o-skipped-ship.execution.json"] = "31340dc9",
    ["dream-shrine-pending.execution.json"] = "836b46cc",
    ["dream-start-n-opening.execution.json"] = "88c69736",
    ["f-opening.execution.json"] = "85b5b2cd",
    ["fg-anomaly-roster.execution.json"] = "8e6a6932",
    ["fg-anomaly.execution.json"] = "6a65aeab",
    ["fg-ixion-chaos.execution.json"] = "ae36a37d",
    ["fg-npc-shopping-protection.execution.json"] = "885bb899",
    ["fg.execution.json"] = "ab50f278",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "af97990f",
    ["fresh-file-fghi.execution.json"] = "9c8eb646",
    ["run-modifiers.execution.json"] = "a4566c98",
    ["surface-generated-precombat.execution.json"] = "f29ea6e0",
    ["surface-n-opening-composition.execution.json"] = "481a1ef1",
    ["surface-n-partial-hub.execution.json"] = "51ead0f8",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "fddd9d90",
    ["surface-n.execution.json"] = "2964351f",
    ["surface-no-rerolls.execution.json"] = "c4d3e115",
    ["surface-nopq.execution.json"] = "299f2885",
    ["surface-p-elite-switch.execution.json"] = "ca05b449",
    ["surface-q-shop-correlation.execution.json"] = "b388dd1a",
    ["surface-scheduled-lifecycle.execution.json"] = "8c1a8efa",
    ["surface-selene-hex-path.execution.json"] = "a795e8de",
    ["surface-shrine-deliveries.execution.json"] = "b8406498",
    ["surface-shrine-rushed-unranked.execution.json"] = "cb2e84d4",
    ["surface-start-q-opening.execution.json"] = "727f309c",
    ["surface-trait-fences.execution.json"] = "4d86c726",
    ["surface-travel-deal-refill-anvil.execution.json"] = "2c7ecf39",
    ["underworld-arachne-cocoons.execution.json"] = "7a29323e",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "0012bf46",
    ["underworld-f-cut-end.execution.json"] = "c66445bd",
    ["underworld-f-cut-end-rerolls.execution.json"] = "3a02888c",
    ["underworld-f-rarified-screen-reroll.execution.json"] = "f1191163",
    ["underworld-f-rerolls.execution.json"] = "c6fa0899",
    ["underworld-f-switches-failed-left.execution.json"] = "b4a0931c",
    ["underworld-f-switches.execution.json"] = "886ce089",
    ["underworld-g-locked-doors.execution.json"] = "267ad53e",
    ["underworld-fgh.execution.json"] = "989a8779",
    ["underworld-fghi-empty-shop-group.execution.json"] = "911c37fd",
    ["underworld-fghi.execution.json"] = "52e6ba03",
    ["underworld-fog-emitter-reservation.execution.json"] = "3524e51f",
    ["underworld-generated-composition.execution.json"] = "2c29722f",
    ["underworld-start-g-rivals-boss.execution.json"] = "464d9021",
    ["underworld-start-i-preboss.execution.json"] = "daa730ea",
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
