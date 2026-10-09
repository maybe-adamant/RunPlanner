-- Strict decoder for the bounded run-start contract.
local p = type(import) == "function" and import("mods/protocol/primitives.lua")
    or require("mods.protocol.primitives")

local protocol = {}

local function ranks(value, label)
    local record, errorMessage = p.obj(value, label)
    if not record then return nil, errorMessage end
    for key, rank in pairs(record) do
        if type(key) ~= "string" or key == "" or type(rank) ~= "number" or rank < 0 or rank % 1 ~= 0 then
            return p.fail(label .. " has invalid rank")
        end
    end
    return record
end

function protocol.decode(value)
    local record, errorMessage = p.exact(value,
        { "weaponKey", "arcana", "fear" }, { "aspectKey", "startingHex" },
        "execution plan.startingLoadout")
    if not record then return nil, errorMessage end
    if not p.str(record.weaponKey, "execution plan.startingLoadout.weaponKey")
        or (record.aspectKey ~= nil
            and not p.str(record.aspectKey, "execution plan.startingLoadout.aspectKey")) then
        return p.fail("execution plan has invalid starting loadout")
    end
    if record.aspectKey == "SuitHexAspect" and record.startingHex == nil then
        return p.fail("execution plan.startingHex is required for SuitHexAspect")
    end
    local arcana, arcanaError = p.arr(record.arcana, "execution plan.startingLoadout.arcana")
    if not arcana then return nil, arcanaError end
    local seen = {}
    for index, entry in ipairs(arcana) do
        local row, rowError = p.exact(entry, { "key", "origin", "rarity" }, {},
            "execution plan.startingLoadout.arcana[" .. index .. "]")
        if not row then return nil, rowError end
        if not p.str(row.key, "execution plan.startingLoadout.arcana[" .. index .. "].key")
            or (row.origin ~= "manual" and row.origin ~= "automatic")
            or (row.rarity ~= "Common" and row.rarity ~= "Rare" and row.rarity ~= "Epic" and row.rarity ~= "Heroic")
            or seen[row.key] then
            return p.fail("execution plan has invalid starting Arcana")
        end
        seen[row.key] = true
    end
    local fear, fearError = p.exact(record.fear, { "configuredRanks", "effectiveRanks" }, {},
        "execution plan.startingLoadout.fear")
    if not fear then return nil, fearError end
    local _, configuredError = ranks(fear.configuredRanks, "execution plan.startingLoadout.fear.configuredRanks")
    if configuredError then return nil, configuredError end
    local _, effectiveError = ranks(fear.effectiveRanks, "execution plan.startingLoadout.fear.effectiveRanks")
    if effectiveError then return nil, effectiveError end
    if record.startingHex ~= nil then
        if record.aspectKey ~= "SuitHexAspect" then return p.fail("execution plan.startingHex requires SuitHexAspect") end
        local hex, hexError = p.hexTree(record.startingHex, "execution plan.startingLoadout.startingHex",
            { "spellTraitKey", "layoutKey", "nodes" })
        if not hex then return nil, hexError end
        if hex.spellTraitKey ~= "SpellMoonBeamTrait" then
            return p.fail("execution plan has invalid starting Hex")
        end
    end
    return record
end

return protocol
