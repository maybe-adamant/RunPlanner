-- Strict execution-protocol composition. Fact-family modules validate closed wire
-- shapes; this root owns only the execution-plan envelope and derived indexes.
local p = type(import) == "function" and import("mods/protocol/primitives.lua")
    or require("mods.protocol.primitives")
local rewards = type(import) == "function" and import("mods/protocol/rewards.lua")
    or require("mods.protocol.rewards")
local occurrences = type(import) == "function" and import("mods/protocol/occurrences.lua")
    or require("mods.protocol.occurrences")
local loadout = type(import) == "function" and import("mods/protocol/loadout.lua")
    or require("mods.protocol.loadout")
local resources = type(import) == "function" and import("mods/protocol/resources.lua")
    or require("mods.protocol.resources")
local aetos = type(import) == "function" and import("mods/protocol/aetos.lua")
    or require("mods.protocol.aetos")

local protocol = {
    FORMAT = "run-planner-execution",
    CATALOG_VERSION = "0.55.0-anvil-of-fates",
    MAX_ITEMS = p.MAX_ITEMS,
    MAX_STRING = p.MAX_STRING,
    fingerprint = p.fingerprint,
}

local function extent(value)
    local record, errorMessage = p.exact(
        value,
        { "kind", "biomeKeys", "terminalBiomeKey" },
        {},
        "execution plan.extent"
    )
    if not record then return nil, errorMessage end
    local biomeKeys, biomeError = p.strings(
        record.biomeKeys,
        "execution plan.extent.biomeKeys",
        4
    )
    if not biomeKeys then return nil, biomeError end
    local known = { F = true, G = true, H = true, I = true, N = true, O = true, P = true, Q = true }
    local dream, selected = #biomeKeys >= 1 and #biomeKeys <= 4, {}
    for _, biomeKey in ipairs(biomeKeys) do
        if not known[biomeKey] or selected[biomeKey] then
            dream = false
        end
        selected[biomeKey] = true
    end
    if record.kind ~= "configuredPrefix" or not dream
        or record.terminalBiomeKey ~= biomeKeys[#biomeKeys] then
        return p.fail("execution plan.extent is unsupported")
    end
    return record
end

local function startingKeepsake(value)
    local record, errorMessage = p.exact(
        value,
        {},
        { "keepsakeKey", "equipResults" },
        "execution plan.startingKeepsake"
    )
    if not record then return nil, errorMessage end
    if record.keepsakeKey == nil then
        if record.equipResults ~= nil then
            return p.fail("execution plan.startingKeepsake.equipResults requires keepsakeKey")
        end
        return record
    end
    if not p.str(record.keepsakeKey, "execution plan.startingKeepsake.keepsakeKey") then
        return p.fail("execution plan has invalid starting keepsake")
    end
    if record.equipResults ~= nil then
        local _, equipError = rewards.equip(
            record.equipResults,
            "execution plan.startingKeepsake.equipResults"
        )
        if equipError then return nil, equipError end
    end
    return record
end

-- Only the modifiers this module implements are read; other wire keys are inert
-- here and remain part of the fingerprinted contents.
local function runModifiers(value)
    local label = "execution plan.runModifiers"
    local record, errorMessage = p.obj(value, label)
    if not record then return nil, errorMessage end
    -- Each percentage is absent while native, otherwise enabled within 0..100.
    local result = {}
    for _, key in ipairs({ "enemyGoldDropChance", "encounterGoldRange" }) do
        local percent = record[key]
        if percent ~= nil then
            if not p.num(percent, label .. "." .. key, 0) or percent > 100 then
                return p.fail(label .. " contains invalid values")
            end
            result[key] = percent
        end
    end
    return result
end

local function fingerprintBody(plan, decodedOccurrences)
    return {
        format = plan.format,
        catalogVersion = plan.catalogVersion,
        projectId = plan.projectId,
        routeKey = plan.routeKey,
        startingLoadout = plan.startingLoadout,
        runModifiers = plan.runModifiers,
        startingKeepsake = plan.startingKeepsake,
        extent = plan.extent,
        selectedOccurrenceIds = plan.selectedOccurrenceIds,
        resources = plan.resources,
        olympusAetos = plan.olympusAetos,
        occurrences = decodedOccurrences,
    }
end

local function validateResources(resourcePolicy, selected, occurrenceIds)
    local rows = resourcePolicy.occurrences
    if #rows ~= #selected then
        return p.fail("execution plan.resources must follow selectedOccurrenceIds exactly")
    end
    for index, row in ipairs(rows) do
        if row.occurrenceId ~= selected[index] or occurrenceIds[row.occurrenceId] == nil then
            return p.fail("execution plan.resources has an unresolved or misordered occurrence")
        end
    end
    return true
end

local function detachDerived(rows)
    local derived = {}
    for index, row in ipairs(rows) do
        derived[index] = {
            transactionsByOwner = row.transactionsByOwner,
            conformanceExpected = row.conformanceExpected,
        }
        row.transactionsByOwner = nil
        row.conformanceExpected = nil
    end
    return derived
end

local function attachDerived(rows, derived)
    for index, row in ipairs(rows) do
        row.transactionsByOwner = derived[index].transactionsByOwner
        row.conformanceExpected = derived[index].conformanceExpected
    end
end

function protocol.decode(value)
    local plan, errorMessage = p.exact(
        value,
        {
            "format", "catalogVersion", "projectId", "planFingerprint",
            "routeKey", "startingLoadout", "startingKeepsake", "extent", "selectedOccurrenceIds", "resources",
            "occurrences",
        },
        { "displayName", "olympusAetos", "runModifiers" },
        "execution plan"
    )
    if not plan then return nil, errorMessage end
    if plan.format ~= protocol.FORMAT
        or plan.catalogVersion ~= protocol.CATALOG_VERSION
        or (plan.routeKey ~= "Underworld" and plan.routeKey ~= "FreshFile"
            and plan.routeKey ~= "Surface" and plan.routeKey ~= "Dream")
        or not p.str(plan.projectId, "execution plan.projectId")
        or type(plan.planFingerprint) ~= "string"
        or not plan.planFingerprint:match("^[0-9a-f]+$")
        or #plan.planFingerprint ~= 8 then
        return p.fail("execution plan has unsupported identity")
    end
    -- The presentation-only plan name is at most 200 code points, so at most 800 UTF-8 bytes;
    -- it is validated and only logged.
    if plan.displayName ~= nil and not p.str(plan.displayName, "execution plan.displayName", 800) then
        return p.fail("execution plan has an invalid display name")
    end
    local _, extentError = extent(plan.extent)
    if extentError then return nil, extentError end
    local keys = plan.extent.biomeKeys
    local underworld = (#keys == 1 and keys[1] == "F")
        or (#keys == 2 and keys[1] == "F" and keys[2] == "G")
        or (#keys == 3 and keys[1] == "F" and keys[2] == "G" and keys[3] == "H")
        or (#keys == 4 and keys[1] == "F" and keys[2] == "G" and keys[3] == "H" and keys[4] == "I")
    local surface = (#keys == 1 and keys[1] == "N")
        or (#keys == 2 and keys[1] == "N" and keys[2] == "O")
        or (#keys == 3 and keys[1] == "N" and keys[2] == "O" and keys[3] == "P")
        or (#keys == 4 and keys[1] == "N" and keys[2] == "O" and keys[3] == "P" and keys[4] == "Q")
    if ((plan.routeKey == "Underworld" or plan.routeKey == "FreshFile") and not underworld)
        or (plan.routeKey == "Surface" and not surface) then
        return p.fail("execution plan.routeKey disagrees with extent")
    end
    local modifiers
    if plan.runModifiers ~= nil then
        local modifiersError
        modifiers, modifiersError = runModifiers(plan.runModifiers)
        if modifiersError then return nil, modifiersError end
    end
    local _, loadoutError = loadout.decode(plan.startingLoadout)
    if loadoutError then return nil, loadoutError end
    local _, keepsakeError = startingKeepsake(plan.startingKeepsake)
    if keepsakeError then return nil, keepsakeError end
    local selected, selectedError = p.strings(
        plan.selectedOccurrenceIds,
        "execution plan.selectedOccurrenceIds"
    )
    if not selected then return nil, selectedError end
    local decoded, idsOrError = occurrences.decode(
        plan.occurrences,
        selected,
        "execution plan.occurrences"
    )
    if not decoded then return nil, idsOrError end
    for _, occurrence in ipairs(decoded) do
        local included = false
        for _, biomeKey in ipairs(plan.extent.biomeKeys) do
            if occurrence.biomeKey == biomeKey then included = true break end
        end
        if not included then return p.fail("execution plan.occurrences contains a biome outside extent") end
    end
    local resourcePolicy, resourceError = resources.decode(plan.resources, "execution plan.resources")
    if not resourcePolicy then return nil, resourceError end
    local resourcesValid, resourcesValidationError = validateResources(
        resourcePolicy, selected, idsOrError
    )
    if not resourcesValid then return nil, resourcesValidationError end
    local aetosValid, aetosError = aetos.validate(plan.olympusAetos, keys, selected, idsOrError)
    if not aetosValid then return nil, aetosError end
    local derived = detachDerived(decoded)
    if p.fingerprint(fingerprintBody(plan, decoded)) ~= plan.planFingerprint then
        return p.fail("execution plan fingerprint does not match contents")
    end
    attachDerived(decoded, derived)
    plan.runModifiers = modifiers
    plan.resources = resourcePolicy
    plan.occurrences = decoded
    plan.occurrencesById = idsOrError
    plan.kind = "ready"
    return plan
end

return protocol
