-- Read-only admission projection for a Postboss resume or a Practice mode
-- start. It derives only the bounded expected entry state and delegates
-- observation to ordinary native readers.
local native = type(import) == "function" and import("mods/loadout/native.lua")
    or require("mods.loadout.native")
local conformance = type(import) == "function" and import("mods/protocol/conformance.lua")
    or require("mods.protocol.conformance")
local readers = type(import) == "function" and import("mods/room/conformance/readers.lua")
    or require("mods.room.conformance.readers")
local proof = type(import) == "function" and import("mods/room/conformance/proof.lua")
    or require("mods.room.conformance.proof")

local admission = {}
local families = {
    "traitInventory", "elementCounts", "steadyGrowth", "chaos", "keepsakeEffects",
    "rewardPriorities", "pathOfStars", "forfeit", "stygianWell",
}

-- The checkpoint prefix names the admission: a Postboss resume or a Practice
-- mode start.
function admission.verify(occurrence, startingLoadout, prefix)
    prefix = prefix or "postboss-admission"
    local expected, projectionError = conformance.admissionExpected(
        occurrence and occurrence.diagnostics
    )
    if not expected then return nil, projectionError end

    local observedLoadout = native.readLoadout()
    if observedLoadout.weaponKey ~= startingLoadout.weaponKey then
        return proof.compare(
            prefix .. ":weapon",
            startingLoadout.weaponKey,
            observedLoadout.weaponKey
        )
    end
    if not native.aspectAgrees(startingLoadout.aspectKey, observedLoadout.aspectKey) then
        return nil, {
            checkpoint = prefix .. ":aspect",
            expected = startingLoadout.aspectKey,
            -- An expected aspect that is recorded but not held is observed as none.
            observed = (startingLoadout.aspectKey == nil or native.hasTrait(observedLoadout.aspectKey))
                and observedLoadout.aspectKey or nil,
        }
    end

    local currentRun, gameState = _G.CurrentRun, _G.GameState
    for _, kind in ipairs(families) do
        local observed = readers.read(kind, currentRun, gameState, expected[kind])
        local compare = kind == "keepsakeEffects" and proof.compareKeepsakes or proof.compare
        local ok, mismatch = compare(
            prefix .. ":" .. kind,
            expected[kind],
            observed
        )
        if not ok then return nil, mismatch end
    end
    return true
end

return admission
