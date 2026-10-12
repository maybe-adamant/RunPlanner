-- luacheck: globals TestPresentationBoundary
-- Static scan of the fenced presentation layer under src/mods/presentation/,
-- which the module build identity excludes. Execution reaches it only through
-- the composition root, and presentation draws from injected views without
-- writing execution or game state.
local lu = require("luaunit")
local lfs = require("lfs")

local PRESENTATION_ROOT = "mods/presentation/"
-- The only execution file that may import presentation modules.
local COMPOSITION_ROOTS = { ["main.lua"] = true }
-- Execution modules presentation may import: the JSON codec, the inbox's
-- slot-file naming constants, and the build-covered hook boundary.
local EXECUTION_IMPORTS = {
    ["mods/protocol/json.lua"] = true, ["mods/host/inbox.lua"] = true,
    ["mods/host/presentation_hooks.lua"] = true,
}
-- Native drawing and display-text entry points presentation may reach through _G.
local GAME_GLOBALS = {
    AddDoorInfoIcon = true, Attach = true, CreateScreenComponent = true, Destroy = true,
    GetDisplayName = true, ScreenData = true,
}
local ROM_MEMBERS = { log = true, path = true }
local IO_MEMBERS = { open = true }
local OS_MEMBERS = { clock = true, date = true, time = true }
-- Execution state a presentation module may hold as an injected view but never write.
local STATE_ROOTS = {
    state = true, executionState = true, snapshot = true, plan = true, occurrence = true, route = true,
    routeState = true, room = true, session = true, inbox = true, activeSlotFile = true, runtime = true,
    _G = true, game = true, rom = true, modutil = true, public = true, reload = true, lib = true,
}
-- Names that are never presentation locals, so even rebinding them is a write.
local SHARED_NAMES = {
    executionState = true, _G = true, game = true, rom = true, modutil = true, public = true, reload = true,
    lib = true,
}
-- Path segments that hold execution state; no write may go through them.
local STATE_SEGMENTS = {
    state = true, executionState = true, snapshot = true, plan = true, routeState = true, session = true,
    inbox = true, activeSlotFile = true,
}
-- Environment tables and the members presentation may reach on them.
local ENVIRONMENT_NAMES = {
    _G = GAME_GLOBALS, rom = ROM_MEMBERS, game = {}, modutil = {}, lib = {}, public = {}, reload = {},
    _ENV = {}, getfenv = {}, setfenv = {}, rawset = {}, rawget = {},
}
local TABLE_MUTATORS = { insert = true, remove = true, sort = true }
-- Receivers whose calls are reads only, by allowed member.
local READ_RECEIVERS = {
    inbox = { activeSlot = true, status = true, plan = true, slotFileName = true },
    activeSlotFile = { read = true },
}
-- Receivers presentation never calls: execution session, route and room owners.
local FORBIDDEN_RECEIVERS = {
    session = true, routeSession = true, roomSession = true, room = true, route = true,
    coordinator = true, executionState = true,
}
-- Presentation registers native hooks and overlay callbacks only through the
-- build-covered mods/host/presentation_hooks.lua (bound as `safeHooks`), which
-- runs native base unchanged and contains presentation failures.
local HOOK_REGISTRATIONS = { wrap = true, onCommit = true, onInterval = true, afterHook = true, override = true }
-- The status window's slot picker is a user action: it writes active-slot.json
-- and loads the picked slot through capabilities the composition root injects.
local CAPABILITY_CALLS = {
    ["mods/presentation/status_ui.lua"] = { "activeSlotFile.write(", "inbox.load(", "field:write(" },
}
-- Keywords after which a new statement, and so a new assignment target list, starts.
local STATEMENT_KEYWORDS = {
    "break", "do", "else", "elseif", "end", "for", "function", "goto", "if", "local", "repeat",
    "return", "then", "until", "while",
}

-- Returns the source without comments, and that text with string contents blanked.
local function lex(source)
    local code, bare, index, length = {}, {}, 1, #source
    local function longBracket(at)
        local equals = source:match("^%[(=*)%[", at)
        if not equals then return nil end
        local close = "]" .. equals .. "]"
        local finish = select(2, source:find(close, at + #equals + 2, true))
        return finish or length
    end
    while index <= length do
        local char = source:sub(index, index)
        if source:sub(index, index + 1) == "--" then
            local finish = longBracket(index + 2) or (source:find("\n", index, true) or length + 1) - 1
            index = finish + 1
        elseif char == '"' or char == "'" then
            local finish = index + 1
            while finish <= length do
                local nextChar = source:sub(finish, finish)
                if nextChar == "\\" then finish = finish + 1
                elseif nextChar == char then break end
                finish = finish + 1
            end
            code[#code + 1] = source:sub(index, finish)
            bare[#bare + 1] = char .. string.rep(" ", finish - index - 1) .. char
            index = finish + 1
        elseif char == "[" and longBracket(index) then
            local finish = longBracket(index)
            code[#code + 1] = source:sub(index, finish)
            bare[#bare + 1] = '""'
            index = finish + 1
        else
            code[#code + 1] = char
            bare[#bare + 1] = char
            index = index + 1
        end
    end
    return table.concat(code), table.concat(bare)
end

local function modulePath(target)
    if target:match("%.lua$") then return target end
    return target:gsub("%.", "/") .. ".lua"
end

local function isPresentation(path)
    return path:sub(1, #PRESENTATION_ROOT) == PRESENTATION_ROOT
end

-- path is relative to src/. Returns a list of violation messages.
local function executionViolations(path, source)
    if COMPOSITION_ROOTS[path] then return {} end
    local code = lex(source)
    if code:find("mods[/.]presentation") then
        return { path .. " imports the presentation layer outside the composition root" }
    end
    return {}
end

local function lhsTargets(bare)
    local targets = {}
    for statement in bare:gmatch("[^;\n]+") do
        local position = 1
        while true do
            local at = statement:find("=", position, true)
            if not at then break end
            local before, after = statement:sub(at - 1, at - 1), statement:sub(at + 1, at + 1)
            if after == "=" then
                position = at + 2
            elseif before == "=" or before == "~" or before == "<" or before == ">" then
                position = at + 1
            else
                local lhs = statement:sub(1, at - 1):match("([%w_%.%[%]%s,:\"']+)$") or ""
                local cut, keyword = 1, nil
                for _, word in ipairs(STATEMENT_KEYWORDS) do
                    for finish in lhs:gmatch("%f[%w_]" .. word .. "%f[^%w_]()") do
                        if finish > cut then cut, keyword = finish, word end
                    end
                end
                local list = lhs:sub(cut)
                -- After another `=` with no keyword between, the text before the last
                -- comma is that field's value: `{ a = x.y, b = 1 }`.
                if keyword == nil and statement:sub(at - #lhs - 1, at - #lhs - 1) == "=" then
                    list = list:match("([^,]*)$")
                end
                if keyword ~= "local" then
                    for target in list:gmatch("[^,]+") do
                        target = target:match("^%s*(.-)%s*$")
                        if target ~= "" then targets[#targets + 1] = target end
                    end
                end
                position = at + 1
            end
        end
    end
    return targets
end

local function presentationViolations(path, source)
    local violations = {}
    local function fail(message) violations[#violations + 1] = path .. ": " .. message end
    local code, bare = lex(source)
    -- Locals bound directly to execution state: `local o = snapshot.current`.
    local aliases = {}
    for name, root in bare:gmatch("%f[%w_]local%s+([%a_][%w_]*)%s*=%s*([%a_][%w_]*)") do
        if STATE_ROOTS[root] and not SHARED_NAMES[root] and name ~= root then aliases[name] = true end
    end
    for _, allowed in ipairs(CAPABILITY_CALLS[path] or {}) do
        local pattern = allowed:gsub("%p", "%%%0")
        bare = bare:gsub("%f[%w_]" .. pattern, "capability(")
        code = code:gsub("%f[%w_]" .. pattern, "capability(")
    end

    for loader, opening in code:gmatch("%f[%w_](%a+)%s*%(%s*(.)") do
        if loader == "import" or loader == "require" then
            if opening ~= '"' and opening ~= "'" then fail(loader .. " without a literal module path") end
        elseif loader == "loadfile" or loader == "dofile" or loader == "load" or loader == "loadstring" then
            fail("dynamic code loading with " .. loader)
        end
    end
    for loader, target in code:gmatch("%f[%w_](%a+)%s*%(%s*[\"']([^\"']+)[\"']") do
        if loader == "import" or loader == "require" then
            local module = modulePath(target)
            if not isPresentation(module) and not EXECUTION_IMPORTS[module] then
                fail("imports execution module " .. module)
            end
        end
    end

    for name in bare:gmatch("%f[%w_]_G%s*%.%s*([%a_][%w_]*)") do
        if not GAME_GLOBALS[name] then fail("reaches game global " .. name) end
    end
    if bare:find("%f[%w_]_G%s*%[") then fail("indexes _G dynamically") end
    for _, name in ipairs({ "rawset", "setfenv", "setmetatable%s*%(%s*_G", "debug%s*%.", "game%s*[%.%[]",
        "modutil%s*[%.%[]", "public%s*[%.%[]", "reload%s*[%.%[]", "import_as_fallback" }) do
        if bare:find("%f[%w_]" .. name) then fail("uses " .. name:gsub("%%s%*", "")) end
    end
    for library, members in pairs({ rom = ROM_MEMBERS, io = IO_MEMBERS, os = OS_MEMBERS }) do
        for member in bare:gmatch("%f[%w_]" .. library .. "%s*%.%s*([%a_][%w_]*)") do
            if not members[member] then fail("uses " .. library .. "." .. member) end
        end
    end
    for mode in code:gmatch("[\"']([rwa]%+?b?)[\"']") do
        if mode ~= "r" and mode ~= "rb" then fail("opens a file for writing (" .. mode .. ")") end
    end

    for receiver, member in bare:gmatch("%f[%w_]([%a_][%w_]*)%s*[%.:]%s*([%a_][%w_]*)%s*%(") do
        if FORBIDDEN_RECEIVERS[receiver] then
            fail("calls " .. receiver .. "." .. member)
        elseif READ_RECEIVERS[receiver] and not READ_RECEIVERS[receiver][member] then
            fail("calls " .. receiver .. "." .. member)
        end
        if member == "write" or member == "set" then fail("writes through " .. receiver .. "." .. member) end
    end

    if bare:find("%f[%w_]hooks%s*[%.:%[]") then fail("reaches module hooks directly") end
    for receiver, member in bare:gmatch("%f[%w_]([%a_][%w_]*)%s*[%.:]%s*([%a_][%w_]*)%s*%(") do
        if HOOK_REGISTRATIONS[member] and receiver ~= "safeHooks" then
            fail("registers " .. receiver .. "." .. member .. " outside presentation_hooks")
        end
    end

    -- Environment tables are reachable only as `name.allowedMember`.
    for start, name, finish in bare:gmatch("()%f[%w_]([%a_][%w_]*)()") do
        local members = ENVIRONMENT_NAMES[name]
        local preceding = bare:sub(1, start - 1):match("([%.:])%s*$")
        if members ~= nil and preceding == nil then
            local member = bare:match("^%s*%.%s*([%a_][%w_]*)", finish)
            -- `rom and rom.log` only tests that the table exists.
            local tested = bare:match("^%s+and%f[^%w_]", finish) ~= nil
            if not tested and (member == nil or not members[member]) then
                fail("reaches " .. name .. (member and "." .. member or " as a value"))
            end
        end
    end
    if bare:find("%[%s*[\"'][^%]]*%]%s*[%(\"'{]") then fail("calls a string-named member") end
    for root in bare:gmatch("%f[%w_]([%a_][%w_]*)%s*%b[]%s*[%(\"'{]") do
        if STATE_ROOTS[root] or aliases[root] then fail("calls a computed member of " .. root) end
    end
    for operation, root in bare:gmatch("%f[%w_]table%s*%.%s*([%a_]+)%s*%(%s*([%a_][%w_]*)") do
        if TABLE_MUTATORS[operation] and (STATE_ROOTS[root] or root == "context" or aliases[root]) then
            fail("table." .. operation .. " on " .. root)
        end
    end

    for _, target in ipairs(lhsTargets(bare)) do
        local root = target:match("^([%a_][%w_]*)")
        local segments = {}
        for segment in target:gsub("%b[]", ".[]"):gmatch("[^%.:]+") do segments[#segments + 1] = segment end
        for index = 1, #segments - 1 do
            if STATE_SEGMENTS[segments[index]:match("^%s*(.-)%s*$")] then
                fail("assigns through " .. target)
            end
        end
        local qualified = root ~= nil and target:sub(#root + 1):match("^%s*[%.%[:]") ~= nil
        if aliases[root] and qualified then fail("assigns " .. target .. " through an alias of execution state") end
        local lowered = target:lower()
        if root and STATE_ROOTS[root] and (qualified or SHARED_NAMES[root])
            or lowered:find("currentrun") or lowered:find("gamestate") then
            fail("assigns " .. target)
        end
    end
    return violations
end

local function luaFiles(directory, prefix, out)
    out = out or {}
    local entries = {}
    for name in lfs.dir(directory) do
        if name ~= "." and name ~= ".." then entries[#entries + 1] = name end
    end
    table.sort(entries)
    for _, name in ipairs(entries) do
        local full = directory .. "/" .. name
        if lfs.attributes(full, "mode") == "directory" then
            luaFiles(full, prefix .. name .. "/", out)
        elseif name:match("%.lua$") then
            out[#out + 1] = prefix .. name
        end
    end
    return out
end

local function read(path)
    local file = assert(io.open("src/" .. path, "rb"))
    local source = file:read("*a")
    file:close()
    return source
end

TestPresentationBoundary = {}

function TestPresentationBoundary.testExecutionImportsPresentationOnlyFromTheCompositionRoot()
    local violations, presentation, wired = {}, 0, false
    for _, path in ipairs(luaFiles("src", "")) do
        if isPresentation(path) then
            presentation = presentation + 1
        else
            for _, message in ipairs(executionViolations(path, read(path))) do violations[#violations + 1] = message end
            if COMPOSITION_ROOTS[path] and lex(read(path)):find("mods/presentation/") then wired = true end
        end
    end
    lu.assertTrue(presentation > 0)
    lu.assertTrue(wired)
    lu.assertEquals(violations, {})
end

function TestPresentationBoundary.testPresentationNeverWritesExecutionOrGameState()
    local violations = {}
    for _, path in ipairs(luaFiles("src/" .. PRESENTATION_ROOT, PRESENTATION_ROOT)) do
        for _, message in ipairs(presentationViolations(path, read(path))) do violations[#violations + 1] = message end
    end
    lu.assertEquals(violations, {})
end

function TestPresentationBoundary.testScannerRejectsPlantedExecutionImports()
    for _, source in ipairs({
        'local ui = import("mods/presentation/status_ui.lua")',
        "local ui = require('mods.presentation.status_ui')",
        'local path = "mods/presentation/" .. name',
    }) do
        lu.assertEquals(#executionViolations("mods/runtime/composition.lua", source), 1, source)
    end
    lu.assertEquals(executionViolations("mods/runtime/composition.lua",
        '-- see mods/presentation/status_ui.lua\nlocal x = "mods/protocol/json.lua"'), {})
    lu.assertEquals(executionViolations("main.lua", 'import("mods/presentation/status_ui.lua")'), {})
end

function TestPresentationBoundary.testScannerRejectsPlantedPresentationMutations()
    local path = "mods/presentation/planted.lua"
    for _, source in ipairs({
        'local session = import("mods/runtime/session.lua")',
        "local room = require('mods.room.coordinator')",
        "local module = import(name)",
        'local chunk = loadfile("x.lua")',
        "_G.CurrentRun.Money = 0",
        "local run = _G.CurrentRun",
        "_G[name] = value",
        "rawset(_G, 'X', 1)",
        "game.CurrentRun = nil",
        "rom.mods.x = 1",
        "local currentRun = view.run\ncurrentRun.Hero.Health = 0",
        "if ready then state.firstMismatch = nil end",
        "snapshot.plan, other = nil, 1",
        "plan.occurrencesById[id] = nil",
        "executionState = nil",
        "session.complete(state, handle)",
        "room.begin(state, handle)",
        "route.enter(routeState, id)",
        "inbox.load(2)",
        "inbox.select(2)",
        "activeSlotFile.write(3)",
        "field:write(3)",
        'module.hooks.wrap("StartRoom", "key", function(_, _, base, ...) return base(...) end)',
        "local wrap = module.hooks.wrap",
        'modutil.mod.Path.Wrap("LeaveRoom", function(base, ...) return base(...) end)',
        "module.overlays.onCommit(refresh)",
        'module.overlays.onInterval("name", 1, refresh)',
        'module.overlays.afterHook("OnScreenOpened", refresh)',
        "hooks.wrap('StartRoom', 'key', handler)",
        "local g = _G",
        "local g = _G\ng.CurrentRun = nil",
        "local env = _ENV",
        "local env = getfenv(1)",
        "local library = lib",
        "local mods = rom.mods",
        "local game_ = game",
        "table.insert(state.diagnostics, entry)",
        "table.remove(context.markers, 1)",
        "table.sort(snapshot.plan.selectedOccurrenceIds)",
        'screen["Destroy"](screen)',
        "state[name](state)",
        "local o = snapshot.plan\no[key](o)",
        'screen [ "Destroy" ] { Ids = {} }',
        "context.state.firstMismatch = nil",
        "local o = snapshot.current\no.id = nil",
        "local o = state\ntable.insert(o, 1)",
        "marker.plan.occurrencesById = nil",
        'local file = io.open(target, "wb")',
        "io.write('x')",
        "os.remove(target)",
    }) do
        lu.assertTrue(#presentationViolations(path, source) > 0, source)
    end
end

function TestPresentationBoundary.testScannerAcceptsDrawingAndInjectedCapabilities()
    local source = table.concat({
        'local names = import("mods/presentation/names.lua")',
        'local json = require("mods.protocol.json")',
        "-- state.firstMismatch = nil is never written",
        'local text = "state.plan = nil"',
        "local context = { state = state, route = state.route, source = screen.Source }",
        "context.marker, desired.route = marker, state.route",
        "screen.Components.Marker = _G.CreateScreenComponent({ Name = 'BlankObstacle' })",
        "if a == b and c ~= d and e <= f then local x = inbox.status() end",
        'local file = io.open(target, "rb")',
        "local entries = activeSlotFile.read()",
        'safeHooks.wrap(module, "StartRoom", "key", { before = function() end })',
        'safeHooks.onInterval(module, "name", 1, refresh)',
        "module.overlays.createTable(name, spec)",
        "local labels = {}\ntable.insert(labels, text)\ntable.sort(labels)",
        "local current = snapshot.current\nlocal room = current and names.room(current.gameName)",
        "local ok = pcall(_G.Destroy, { Ids = { marker } })",
        "if rom and rom.log and rom.log.info then rom.log.info(text) end",
        "local items = screen.Components[key]",
        "return FORMATTERS[kind](expected, observed)",
        "context.marker, desired.route = marker, state.route",
    }, "\n")
    lu.assertEquals(presentationViolations("mods/presentation/planted.lua", source), {})
    lu.assertEquals(presentationViolations("mods/presentation/status_ui.lua",
        "if picked then activeSlotFile.write(slot); inbox.load(slot); field:write(slot) end"), {})
end
