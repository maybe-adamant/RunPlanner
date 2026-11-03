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
    ["automatic-boss.execution.json"] = "37c20f61",
    ["dream-mixed-prefix.execution.json"] = "1be28c03",
    ["dream-o-skipped-ship.execution.json"] = "3431e3e8",
    ["dream-shrine-pending.execution.json"] = "395f4c77",
    ["dream-start-n-opening.execution.json"] = "dc19451b",
    ["f-opening.execution.json"] = "a12765f8",
    ["fg-anomaly-roster.execution.json"] = "4637d5f0",
    ["fg-anomaly.execution.json"] = "ecf53054",
    ["fg-ixion-chaos.execution.json"] = "84e507ba",
    ["fg-npc-shopping-protection.execution.json"] = "42f38d37",
    ["fg.execution.json"] = "e924d904",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "758f89af",
    ["fresh-file-fghi.execution.json"] = "73938024",
    ["run-modifiers.execution.json"] = "2b0f6b6c",
    ["surface-generated-precombat.execution.json"] = "5f9e1d3d",
    ["surface-n-opening-composition.execution.json"] = "936e2002",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "857b6334",
    ["surface-n.execution.json"] = "e8005473",
    ["surface-no-rerolls.execution.json"] = "46e4e4fa",
    ["surface-nopq.execution.json"] = "d75655a7",
    ["surface-q-shop-correlation.execution.json"] = "2c8e257d",
    ["surface-scheduled-lifecycle.execution.json"] = "eb33b6a1",
    ["surface-selene-hex-path.execution.json"] = "75ad6114",
    ["surface-shrine-deliveries.execution.json"] = "5879b263",
    ["surface-shrine-rushed-unranked.execution.json"] = "e8c57d09",
    ["surface-start-q-opening.execution.json"] = "9909b207",
    ["surface-trait-fences.execution.json"] = "228d9559",
    ["surface-travel-deal-refill-anvil.execution.json"] = "d84b208d",
    ["underworld-arachne-cocoons.execution.json"] = "84c0a54b",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "47086314",
    ["underworld-fgh.execution.json"] = "77d4559a",
    ["underworld-fghi-empty-shop-group.execution.json"] = "5e617d82",
    ["underworld-fghi.execution.json"] = "eac05437",
    ["underworld-fog-emitter-reservation.execution.json"] = "dd5b8241",
    ["underworld-f-rerolls.execution.json"] = "30e4f1b0",
    ["underworld-generated-composition.execution.json"] = "733413b2",
    ["underworld-start-g-rivals-boss.execution.json"] = "74c7b722",
    ["underworld-start-i-preboss.execution.json"] = "3e0e9a48",
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
