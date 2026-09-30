local p = type(import) == "function" and import("mods/protocol/primitives.lua")
    or require("mods.protocol.primitives")
local aetos = {}

function aetos.validate(value, keys, selected, occurrences)
    local olympus = false
    for _, key in ipairs(keys) do if key == "P" then olympus = true end end
    if not olympus then
        if value ~= nil then return p.fail("execution plan.olympusAetos is outside extent") end
        return true
    end
    local fields = type(value) == "table" and value.kind == "none" and { "kind" }
        or { "kind", "occurrenceId", "phaseKey", "wave" }
    local record, err = p.exact(value, fields, {}, "execution plan.olympusAetos")
    if not record then return nil, err end
    if record.kind == "none" then return true end
    if record.kind ~= "target" or (record.wave ~= 2 and record.wave ~= 3)
        or not p.str(record.occurrenceId, "Aetos occurrence")
        or not p.str(record.phaseKey, "Aetos phase") then
        return p.fail("execution plan.olympusAetos target is invalid")
    end
    local room = occurrences[record.occurrenceId]
    local picked, phase = false, false
    for _, id in ipairs(selected) do if id == record.occurrenceId then picked = true end end
    for _, entry in ipairs(room and room.overview.encounterPhases or {}) do
        if entry.slotKey == record.phaseKey then phase = true end
    end
    if not picked or not phase or room.biomeKey ~= "P" then
        return p.fail("execution plan.olympusAetos target is unresolved")
    end
    return true
end

return aetos
