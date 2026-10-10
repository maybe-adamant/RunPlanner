-- Read-only self-check of a Practice mode start room. It derives only the
-- bounded expected entry state and delegates observation to ordinary native
-- readers.
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

function admission.verify(occurrence)
    local expected, projectionError = conformance.admissionExpected(
        occurrence and occurrence.diagnostics
    )
    if not expected then return nil, projectionError end

    local currentRun, gameState = _G.CurrentRun, _G.GameState
    for _, kind in ipairs(families) do
        local observed = readers.read(kind, currentRun, gameState, expected[kind])
        local compare = kind == "keepsakeEffects" and proof.compareKeepsakes or proof.compare
        local ok, mismatch = compare(
            "practice-start:" .. kind,
            expected[kind],
            observed
        )
        if not ok then return nil, mismatch end
    end
    return true
end

return admission
