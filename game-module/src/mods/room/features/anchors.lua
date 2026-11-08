-- Room object anchors. HandleSecretSpawns places the Well, Pool, Shrine,
-- challenge switch and Meta Reward Stand, in that order, each by one draw from
-- the room's ChallengeSwitchBase pool (a Well-pinned room's Well takes its pin
-- without a draw). A published anchorId replaces its object's draw; every other
-- draw stays native over the pool without the anchors still planned, so native
-- never takes a planned anchor.
local placement = type(import) == "function" and import("mods/room/features/placement.lua")
    or require("mods.room.features.placement")
local anchors = {}

local KINDS = { "stygianWell", "purgingPool", "hermesShrine", "challengeSwitch" }
-- The native room field each object's table is stored under.
local FIELDS = {
    stygianWell = "WellShop", purgingPool = "SellTraitShop", hermesShrine = "SurfaceShop",
    challengeSwitch = "ChallengeSwitch",
}
-- Each eligibility predicate directly precedes its object's draw.
local ELIGIBILITY = {
    IsWellShopEligible = "stygianWell", IsSellTraitShopEligible = "purgingPool",
    IsSurfaceShopEligible = "hermesShrine", IsMetaRewardStandEligible = "metaRewardStand",
}

local function wellPin(nativeRoom)
    local declared = _G.RoomData and _G.RoomData[nativeRoom.Name] or nativeRoom
    return type(declared) == "table" and declared.WellShopChallengeBaseId or nil
end

local function plannedAnchors(occurrence)
    local result, any = {}, false
    for _, kind in ipairs(KINDS) do
        local object = occurrence.overview[kind]
        if type(object) == "table" and object.anchorId ~= nil then
            result[kind] = object.anchorId
            any = true
        end
    end
    return any and result or nil
end

-- The object each anchor holds after spawning; differences are positional diagnostics.
local function observe(state, session, occurrence, nativeRoom)
    local differs = false
    for _, kind in ipairs(KINDS) do
        local object = occurrence.overview[kind]
        if type(object) == "table" and object.anchorId ~= nil then
            local native = nativeRoom[FIELDS[kind]]
            local observed = type(native) == "table" and native.ObjectId or nil
            if observed ~= object.anchorId then
                session.diagnostic(state, "room-anchor", { object = kind, expected = object.anchorId, observed = observed })
                differs = true
            end
        end
    end
    return differs
end

function anchors.attach(module, session, getState, report, room)
    local scope

    module.hooks.wrap("HandleSecretSpawns", "run-planner-room-anchors", function(_, runtime, base, currentRun, ...)
        local state = getState(runtime)
        local nativeRoom = type(currentRun) == "table" and currentRun.CurrentRoom or nil
        local occurrence = state and state.state == "synchronized" and type(nativeRoom) == "table"
            and room.occurrence(state, nativeRoom) or nil
        local planned = occurrence and plannedAnchors(occurrence)
        if planned == nil then return base(currentRun, ...) end
        -- A pinned Well takes its pin natively.
        if planned.stygianWell ~= nil and wellPin(nativeRoom) ~= nil then planned.stygianWell = nil end
        local prior = scope
        scope = {
            state = state, planned = planned, room = nativeRoom, drawn = {},
            points = placement.set(_G.GetIdsByType and _G.GetIdsByType({ Name = "ChallengeSwitchBase" })),
        }
        local ok, result = pcall(base, currentRun, ...)
        scope = prior
        if not ok then error(result, 0) end
        observe(state, session, occurrence, nativeRoom)
        report(runtime)
        return result
    end)

    for name, kind in pairs(ELIGIBILITY) do
        module.hooks.wrap(name, "run-planner-room-anchor-object", function(_, _, base, ...)
            local eligible = base(...)
            local current = scope
            if current ~= nil then
                local pinned = kind == "stygianWell" and wellPin(current.room) ~= nil
                current.pending = eligible and not pinned and kind or nil
            end
            return eligible
        end)
    end

    module.hooks.wrap("RemoveRandomValue", "run-planner-room-anchor-draw", function(_, _, base, values, ...)
        local current = scope
        if current == nil or type(values) ~= "table" then return base(values, ...) end
        if current.pool == nil then
            if not placement.within(values, current.points) then return base(values, ...) end
            current.pool = values
        elseif values ~= current.pool then
            return base(values, ...)
        end
        -- The switch is the one object drawing without an eligibility predicate of its own.
        local kind = current.pending
        current.pending = nil
        if kind == nil and not current.drawn.challengeSwitch then kind = "challengeSwitch" end
        if kind ~= nil then current.drawn[kind] = true end
        local wanted = kind and current.planned[kind]
        if wanted ~= nil then
            local taken = placement.take(values, wanted)
            if taken ~= nil then return taken end
            session.diagnostic(current.state, "room-anchor-unavailable", { object = kind, anchorId = wanted })
        end
        local reserved = {}
        for other, anchorId in pairs(current.planned) do
            if not current.drawn[other] then reserved[anchorId] = true end
        end
        return placement.drawExcluding(base, values, reserved, ...)
    end)
end

return anchors
