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

-- Each admission family whose live reading differs from one complete run-state
-- frame, as its comparison failure; nil and the reason when the frame is incomplete.
function admission.differences(frame, label)
    local expected, projectionError = conformance.admissionExpected(frame)
    if not expected then return nil, projectionError end

    local currentRun, gameState, found = _G.CurrentRun, _G.GameState, {}
    for _, kind in ipairs(conformance.admissionKinds) do
        local observed = readers.read(kind, currentRun, gameState, expected[kind])
        local compare = kind == "keepsakeEffects" and proof.compareKeepsakes or proof.compare
        local ok, mismatch = compare((label or "practice-start") .. ":" .. kind, expected[kind], observed)
        if not ok then
            mismatch.family = kind
            found[#found + 1] = mismatch
        end
    end
    return found
end

-- Every admission family read from the live run against one complete run-state frame.
function admission.verifyFrame(frame, label)
    local found, projectionError = admission.differences(frame, label)
    if not found then return nil, projectionError end
    if found[1] ~= nil then return nil, found[1] end
    return true
end

function admission.verify(occurrence)
    local diagnostics = occurrence and occurrence.diagnostics
    return admission.verifyFrame(diagnostics and diagnostics.roomEntered)
end

return admission
