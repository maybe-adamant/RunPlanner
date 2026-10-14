local lu = require("luaunit")
local json = require("mods/protocol/json")

TestJson = {}

function TestJson.testDecodesTaggedObjectsArraysAndScalars()
    local value = assert(json.decode('{"a":[true,null,{"n":2}],"s":"ok"}'))
    lu.assertTrue(json.isObject(value))
    lu.assertTrue(json.isArray(value.a))
    lu.assertTrue(value.a[1])
    lu.assertTrue(json.isNull(value.a[2]))
    lu.assertEquals(value.a[3].n, 2)
end

function TestJson.testRecognizesNullFromAnotherDecoderInstanceByTag()
    local foreignNull = setmetatable({}, { __json_null = true })
    lu.assertTrue(json.isNull(foreignNull))
    lu.assertFalse(json.isNull({}))
end

function TestJson.testRejectsDuplicateKeysTrailingDataAndBadEscape()
    lu.assertNil(json.decode('{"a":1,"a":2}'))
    lu.assertNil(json.decode('{"a":1} trailing'))
    lu.assertNil(json.decode('{"a":"\\q"}'))
end

function TestJson.testNumbersEscapesAndUnicodeEdges()
    local value = assert(json.decode(' [ -0, -12.5e-3, 1E+2, 6.02e23, 0.000001, -9007199254740993 ] '))
    lu.assertEquals({ value[1], value[2], value[3], value[4], value[5] }, { 0, -0.0125, 100, 6.02e23, 0.000001 })
    lu.assertEquals(value[6], -9007199254740993)
    lu.assertEquals(json.decode('"q\\"b\\\\s\\/n\\nt\\tr\\rb\\bf\\f"'), 'q"b\\s/n\nt\tr\rb\bf\f')
    lu.assertEquals(json.decode('"\\u0041\\u007e\\u0000z"'), "A~\0z")
    lu.assertEquals(json.decode('"Melino\195\171 \226\128\148 run"'), "Melino\195\171 \226\128\148 run")
    lu.assertEquals(json.decode('{"k\\u0031":"v"}')["k1"], "v")
    lu.assertEquals(json.decode('""'), "")
    for source, message in pairs({
        ['"\\u00e9"'] = "non-ascii unicode escapes are unsupported",
        ['"\\u00g0"'] = "invalid unicode escape",
        ['"\\x"'] = "invalid string escape",
        ['"a\1b"'] = "unescaped control character",
        ['"a\0b"'] = "unescaped control character",
        ['"open'] = "unterminated string",
        ['"esc\\'] = "invalid string escape",
        ["1e"] = "invalid number", ["-"] = "invalid number", ["1.e5"] = "invalid number",
        ["1e400"] = "invalid number", ["tru"] = "unexpected JSON value",
    }) do
        local decoded, errorMessage = json.decode(source)
        lu.assertNil(decoded, source)
        lu.assertEquals(errorMessage, message, source)
    end
    lu.assertEquals(json.decode('"a\127b"'), "a\127b")
end

function TestJson.testRejectsNonJsonNumberForms()
    for _, value in ipairs({ "01", "-01", "1.", ".1", "1e", "1e+", "+1" }) do
        lu.assertNil(json.decode(value))
    end
end

return TestJson
