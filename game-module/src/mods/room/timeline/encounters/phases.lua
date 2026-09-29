-- Factory for declaration-driven encounter phases and native encounter binding.
-- The native encounter table is the carrier identity; its declaration name is
-- a structural fact proven exactly or through lifecycle compatibility.
local compatibility = type(import) == "function" and import("mods/room/timeline/encounters/compatibility.lua")
    or require("mods.room.timeline.encounters.compatibility")

local phases = {}

local function nativePhases(room)
    local result = {}
    local multiple = 0
    if type(room.Encounters) == "table" and #room.Encounters > 0 then
        for _, encounter in ipairs(room.Encounters) do result[#result + 1] = encounter end
        multiple = #result
    elseif room.Encounter ~= nil then
        result[1] = room.Encounter
    end
    -- Fields keeps the passive encounter on the room and each required cage
    -- encounter on its reward, not in the multiple-encounter array.
    for _, reward in ipairs(room.CageRewards or {}) do
        result[#result + 1] = reward.Encounter or false
    end
    return result, multiple
end

local function phaseAt(occurrence, slotKey)
    for _, phase in ipairs(occurrence.overview.encounterPhases or {}) do
        if phase.slotKey == slotKey then return phase end
    end
    return nil
end

function phases.create()
    local instance = {}
    local nativeBindings = setmetatable({}, { __mode = "k" })
    local substitutes = setmetatable({}, { __mode = "k" })
    local reportedSubstitutions = {}
    local boundSlots = {}

    local function slotId(occurrence, slotKey)
        return tostring(occurrence.id) .. "\0" .. tostring(slotKey)
    end

    -- A substituted native carries the phase's lifecycle identity but never
    -- another declaration's customization.
    local function substitute(phase)
        local view = substitutes[phase]
        if view == nil then
            view = {}
            for key, value in pairs(phase) do
                if key ~= "customization" then view[key] = value end
            end
            substitutes[phase] = view
        end
        return view
    end

    function instance.at(occurrence, index)
        return occurrence and occurrence.overview and occurrence.overview.encounterPhases
            and occurrence.overview.encounterPhases[index] or nil
    end

    local nativeName = compatibility.nativeName

    function instance.choose(occurrence, slotKey)
        local phase = phaseAt(occurrence, slotKey)
        return phase and phase.encounterKey or nil
    end

    function instance.bind(occurrence, nativeEncounter, slotKey, substituted)
        if type(nativeEncounter) ~= "table" then
            return nil, {
                outcome = "fault", checkpoint = "encounter-binding",
                expected = "native encounter object", observed = nativeEncounter,
            }
        end
        local phase = phaseAt(occurrence, slotKey)
        if phase == nil then
            return nil, {
                outcome = "fault", checkpoint = "encounter-binding",
                expected = "published encounter phase", observed = slotKey,
            }
        end
        local prior = nativeBindings[nativeEncounter]
        if prior ~= nil then
            if prior.occurrenceId ~= occurrence.id or prior.phase.slotKey ~= phase.slotKey then
                return nil, {
                    outcome = "fault", checkpoint = "encounter-binding",
                    expected = "one phase per native encounter object",
                    observed = slotKey,
                }
            end
            return prior.phase
        end
        local bound = substituted and substitute(phase) or phase
        nativeBindings[nativeEncounter] = { occurrenceId = occurrence.id, phase = bound }
        boundSlots[slotId(occurrence, phase.slotKey)] = true
        return bound
    end

    function instance.isBound(occurrence, slotKey)
        return boundSlots[slotId(occurrence, slotKey)] == true
    end

    -- True only the first time one occurrence phase is substituted by a name.
    function instance.noteSubstitution(occurrence, slotKey, observed)
        local key = slotId(occurrence, slotKey)
        if reportedSubstitutions[key] == observed then return false end
        reportedSubstitutions[key] = observed
        return true
    end

    function instance.forNative(nativeEncounter)
        return type(nativeEncounter) == "table" and nativeBindings[nativeEncounter] or nil
    end

    function instance.isFinal(occurrence, phase)
        local expected = occurrence and occurrence.overview and occurrence.overview.encounterPhases or {}
        return #expected > 0 and phase ~= nil and expected[#expected].slotKey == phase.slotKey
    end

    -- Room-entry proof over the native carriers. Published phases accept an
    -- exact name or a lifecycle-compatible native in the same role; unmodeled
    -- carriers remain exact. Returns the compatible substitutions it bound.
    function instance.prove(occurrence, nativeRoom, declarations)
        local published = occurrence.overview.encounterPhases or {}
        local unmodeled = occurrence.overview.unmodeledEncounterKeys
        local actual, multiple = nativePhases(nativeRoom)
        local expectedCount = unmodeled and #unmodeled or #published
        if #actual ~= expectedCount then
            return nil, { kind = "encounterCount", expected = expectedCount, observed = #actual }
        end
        if unmodeled then
            for index, expectedKey in ipairs(unmodeled) do
                if nativeName(actual[index]) ~= expectedKey then
                    return nil, { kind = "encounter", expected = expectedKey, observed = nativeName(actual[index]) }
                end
            end
            return true, {}
        end
        local substitutions = {}
        for index, phase in ipairs(published) do
            local observed = nativeName(actual[index])
            if observed ~= phase.encounterKey then
                local compatible, conflict = false, { "declaration" }
                if type(actual[index]) == "table" then
                    compatible, conflict = compatibility.compare(declarations, phase.encounterKey, observed,
                        compatibility.role(index, index <= multiple, actual[1]))
                end
                if not compatible then
                    return nil, {
                        kind = "encounter", expected = phase.encounterKey, observed = observed, conflict = conflict,
                    }
                end
                substitutions[#substitutions + 1] = { phase = phase, observed = observed }
            end
        end
        -- A destination encounter may be chosen before the map transition.
        -- The game's save/load boundary reconstructs that table, so bind the
        -- canonical room-entry carrier after its published identity is proven.
        for index, phase in ipairs(published) do
            local _, errorValue = instance.bind(occurrence, actual[index], phase.slotKey,
                nativeName(actual[index]) ~= phase.encounterKey)
            if errorValue ~= nil then return nil, errorValue end
        end
        return true, substitutions
    end

    return instance
end

return phases
