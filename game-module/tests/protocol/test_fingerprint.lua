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
    ["automatic-boss.execution.json"] = "3cfb424a",
    ["dream-mixed-prefix.execution.json"] = "81fb66a0",
    ["dream-o-skipped-ship.execution.json"] = "12ab6ee6",
    ["dream-shrine-pending.execution.json"] = "a165123c",
    ["dream-start-n-opening.execution.json"] = "9ed24641",
    ["f-opening.execution.json"] = "2a0de0b4",
    ["fg-anomaly-roster.execution.json"] = "f0966320",
    ["fg-anomaly.execution.json"] = "4d1cc11a",
    ["fg-ixion-chaos.execution.json"] = "d65e2d64",
    ["fg-npc-shopping-protection.execution.json"] = "95075539",
    ["fg.execution.json"] = "9c3990e5",
    ["fingerprint-vectors.json"] = "1f83acce",
    ["fresh-file-f-native.execution.json"] = "28c07234",
    ["fresh-file-fghi.execution.json"] = "0f81e1da",
    ["run-modifiers.execution.json"] = "24a25288",
    ["surface-generated-precombat.execution.json"] = "eb031448",
    ["surface-n-opening-composition.execution.json"] = "1ef70ff3",
    ["surface-n-phial-intermediate-fountain.execution.json"] = "5d4377b4",
    ["surface-n.execution.json"] = "567a1718",
    ["surface-no.execution.json"] = "d2d2f897",
    ["surface-nop.execution.json"] = "e3396f35",
    ["surface-nopq.execution.json"] = "69e20ca4",
    ["surface-q-shop-correlation.execution.json"] = "00adff86",
    ["surface-scheduled-lifecycle.execution.json"] = "dbc720fc",
    ["surface-selene-hex-path.execution.json"] = "e41f006e",
    ["surface-shrine-deliveries.execution.json"] = "d3394bdc",
    ["surface-shrine-rushed-unranked.execution.json"] = "acb39bd1",
    ["surface-start-q-opening.execution.json"] = "44d0eaec",
    ["surface-trait-fences.execution.json"] = "07438137",
    ["surface-travel-deal-refill-anvil.execution.json"] = "7c578b9f",
    ["underworld-arachne-cocoons.execution.json"] = "3b763000",
    ["underworld-echo-gold-anvil-duplicate.execution.json"] = "815ed04a",
    ["underworld-fgh.execution.json"] = "0faf8bb4",
    ["underworld-fghi-empty-shop-group.execution.json"] = "c1f17721",
    ["underworld-fghi.execution.json"] = "505c7503",
    ["underworld-fog-emitter-reservation.execution.json"] = "5845f4fa",
    ["underworld-generated-composition.execution.json"] = "dac723bd",
    ["underworld-start-g-rivals-boss.execution.json"] = "e75c92ca",
    ["underworld-start-i-preboss.execution.json"] = "17bc592e",
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
