-- Run-start, loadout-install and keepsake native contacts.  Room hooks are
-- deliberately absent.
local hooks = {}

function hooks.attach(module, loadoutRuntime, getState, report, room, hexTree)
    assert(type(loadoutRuntime) == "table" and loadoutRuntime.inbox and loadoutRuntime.session
        and type(loadoutRuntime.session.beginNewRun) == "function"
        and type(loadoutRuntime.activePlanSlot) == "function",
        "loadout runtime dependencies are required")
    assert(type(hexTree) == "table", "loadout Hex Tree instance is required")
    local nativeBindings = import("mods/native_bindings.lua")
    local practice = import("mods/practice/install.lua")
    local install = import("mods/loadout/install.lua")
    local session = loadoutRuntime.session
    local roomCoordinator = room
    local startDepth, startingHexScope, restoreError = 0, nil, nil

    -- The loadout is installed, not observed: the run synchronizes once
    -- native StartNewRun reaches its first room.
    local function synchronizeStartingRoom(runtime, args)
        local state = getState(runtime)
        if state == nil or state.state ~= "starting" then return false end
        -- Dream_Intro is a native prologue. It starts before the first planned
        -- biome and must leave the route cursor untouched until its native
        -- selector reaches ChooseStartingRoom.
        local current = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local name = type(current) == "table" and (current.GenusName or current.Name) or nil
        if state.plan and state.plan.routeKey == "Dream" and name == "Dream_Intro"
            and (type(args) ~= "table" or args.StartingBiome == nil) then return false end
        state.state, state.reason = "synchronized", "ready"
        report(runtime)
        return true
    end

    local equipResults = import("mods/keepsakes/equip_results.lua").attach(module, {
        contacts = nativeBindings.keepsakeEffects.equipContacts,
        enforcing = function(runtime)
            local state = getState(runtime)
            return state ~= nil and (state.state == "synchronized"
                or (startDepth > 0 and state.state == "starting"))
        end,
        state = getState,
        diagnostic = session.diagnostic,
    })

    local function expectedEquip(state, keepsakeKey, args)
        local current = roomCoordinator.current(state)
        local replay = type(args) == "table"
            and args.ForceRarity == "Common"
            and args.FromLoot == true
            and args.OverwriteSlot == true
        local contact = replay
            and { kind = "keepsakeReplay", keepsakeKey = keepsakeKey }
            or { kind = "keepsake", keepsakeKey = keepsakeKey }
        local handle = current and roomCoordinator.resolve(state, current,
            contact)
        local payload = handle and roomCoordinator.begin(state, handle) or nil
        return payload and payload.transaction.equipResults, handle, payload, replay
    end

    local function installFault(state, errorValue, checkpoint)
        if type(errorValue) ~= "table" then
            errorValue = { outcome = "fault", checkpoint = checkpoint, observed = tostring(errorValue) }
        end
        session.fault(state, errorValue)
    end

    -- A run that still carries an install restores the profile before the
    -- next run backs it up; a failed restore refuses the next install.
    local function safetyRestore(run)
        local ok, errorValue = pcall(install.restore, run)
        if not ok then restoreError = errorValue end
    end

    module.hooks.wrap("StartNewRun", "run-planner-start", function(_, runtime, base, previousRun, args)
        if startDepth == 0 then
            restoreError = nil
            safetyRestore(previousRun)
            session.beginNewRun(getState(runtime))
        end
        startDepth = startDepth + 1
        local ok, result = pcall(base, previousRun, args)
        startDepth = startDepth - 1
        if startDepth == 0 and startingHexScope ~= nil then
            hexTree.clear(startingHexScope)
            startingHexScope = nil
        end
        if not ok then error(result, 0) end
        local state = getState(runtime)
        if state ~= nil and state.state == "starting" then synchronizeStartingRoom(runtime) end
        report(runtime)
        return result
    end)

    -- Native StartNewRun has replaced CurrentRun and extracted the profile's
    -- Vows (RunLogic.lua:445-455); CreateNewHero reads the EnemyDamage Vow
    -- (RunLogic.lua:25-29), so the install precedes base.
    module.hooks.wrap("CreateNewHero", "run-planner-session-start", function(_, runtime, base, previousRun, args)
        if startDepth <= 0 then return base(previousRun, args) end
        local state = getState(runtime)
        local run = _G.CurrentRun
        if not state.initialized then
            session.start(state, loadoutRuntime.inbox, "starting", loadoutRuntime.activePlanSlot(runtime), {
                -- StartNewGame passes no previous run (RunLogic.lua:321-322).
                freshSave = previousRun == nil,
                chaosTrial = (type(args) == "table" and args.ActiveBounty ~= nil) or _G.StoredGameState ~= nil,
                restoreError = restoreError,
            })
        end
        local plan = state.state == "starting" and state.plan or nil
        if plan ~= nil and plan.routeKey ~= "FreshFile" then
            local installed, errorValue = pcall(install.apply, plan, run)
            if not installed then installFault(state, errorValue, "loadout-install") end
        end
        local startingHex = state.state == "starting" and plan and plan.startingLoadout.startingHex or nil
        if startingHex ~= nil then
            startingHexScope = hexTree.prepare(startingHex, startingHex.spellTraitKey,
                function(checkpoint, _, observed)
                session.diagnostic(state, checkpoint, observed)
            end)
        end
        local ok, hero = pcall(base, previousRun, args)
        if not ok then
            safetyRestore(run)
            error(hero, 0)
        end
        local equipped, errorValue = pcall(install.equipHero, run, hero)
        if not equipped then
            safetyRestore(run)
            installFault(state, errorValue, "loadout-install:hero")
        end
        return hero
    end)

    module.hooks.wrap("EquipKeepsake", "run-planner-equip-keepsake", function(_, runtime, base, hero,
        keepsakeKey, args)
        local state = getState(runtime)
        if state == nil then return base(hero, keepsakeKey, args) end
        local key = keepsakeKey or (_G.GameState and _G.GameState.LastAwardTrait)
        if startDepth > 0 then
            if state.state ~= "starting" then
                local result = base(hero, keepsakeKey, args)
                report(runtime)
                return result
            end
            local start = state.plan.startState
            local result
            if start ~= nil then
                -- A Practice mode start equips its slotted keepsake at its rank,
                -- without the acquire effect the planner already counted.
                local row = practice.slottedKeepsake(start)
                result = row and base(hero, row.name, practice.keepsakeEquipArgs(args, row)) or nil
            else
                -- The installed keepsake at its planned rank (RunLogic.lua:481).
                local equipArgs = {}
                for field, value in pairs(args or {}) do equipArgs[field] = value end
                equipArgs.ForceRarity = state.plan.startingKeepsake.rarity
                result = equipResults.run(runtime, state.plan.startingKeepsake.equipResults, function()
                    return base(hero, keepsakeKey, equipArgs)
                end, false)
            end
            report(runtime)
            return result
        end
        local expected, handle, payload, replay = expectedEquip(state, key, args)
        local deferReplay = replay and expected ~= nil
        local result = equipResults.run(runtime, expected, function()
            return base(hero, keepsakeKey, args)
        end, deferReplay, function(terminalRuntime)
            local terminalState = getState(terminalRuntime)
            if terminalState ~= nil and handle ~= nil and payload ~= nil then
                session.complete(terminalState, handle)
            end
            report(terminalRuntime)
        end)
        if not deferReplay and handle ~= nil and payload ~= nil then
            session.complete(state, handle)
        end
        if not deferReplay then report(runtime) end
        return result
    end)

    -- Rank overrides read the saved run, so they hold after Save & Quit and
    -- while execution is passive.
    module.hooks.wrap("GetWeaponUpgradeLevel", "run-planner-installed-aspect", function(_, _, base, traitName)
        local rank = install.weaponUpgradeLevel(_G.CurrentRun, traitName)
        if rank ~= nil then return rank end
        return base(traitName)
    end)
    module.hooks.wrap("GetMetaUpgradeLevel", "run-planner-installed-arcana", function(_, _, base, name)
        local rank = install.metaUpgradeLevel(_G.CurrentRun, name)
        if rank ~= nil then return rank end
        return base(name)
    end)
    module.hooks.wrap("GetFamiliarTraitStacks", "run-planner-installed-familiar", function(_, _, base, traitName)
        local stacks = install.familiarTraitStacks(_G.CurrentRun, traitName)
        if stacks ~= nil then return stacks end
        return base(traitName)
    end)
    module.hooks.wrap("GetKeepsakeLevel", "run-planner-installed-keepsake", function(_, _, base, traitName,
        unmodified)
        return install.withKeepsakeChambers(_G.CurrentRun, traitName, function()
            return base(traitName, unmodified)
        end)
    end)
    module.hooks.wrap("AddRandomMetaUpgrades", "run-planner-installed-arcana-draw", function(_, _, base, count,
        args)
        return install.withUnlockedCards(_G.CurrentRun, function() return base(count, args) end)
    end)

    -- The profile comes back once the ended run is recorded, before KillHero
    -- saves it (DeathLoopLogic.lua:65-67, 238). A death restores after
    -- RecordRunStats. A clear is recorded in the boss room (RecordRunCleared,
    -- RunLogic.lua:2037-2081) but the run continues through linked rooms that
    -- re-equip from the run, so it restores when KillHero ends it.
    module.hooks.wrap("RecordRunStats", "run-planner-loadout-restore", function(_, _, base, ...)
        local result = base(...)
        local run = _G.CurrentRun
        if not (type(run) == "table" and run.Cleared) then safetyRestore(run) end
        return result
    end)
    module.hooks.wrap("KillHero", "run-planner-loadout-restore-clear", function(_, _, base, ...)
        local run = _G.CurrentRun
        if type(run) == "table" and run.Cleared then safetyRestore(run) end
        return base(...)
    end)
    -- Every hub load sets up the hero from the run (DeathLoopLogic.lua:342-470).
    for _, name in ipairs({ "DeathAreaRoomTransition", "HubPostBountyLoad", "HubPostDreamLoad" }) do
        module.hooks.wrap(name, "run-planner-loadout-restore-hub", function(_, _, base, ...)
            safetyRestore(_G.CurrentRun)
            return base(...)
        end)
    end

    return {
        synchronizeStartingRoom = synchronizeStartingRoom,
        -- Whether native StartNewRun is on the stack.
        startingRun = function() return startDepth > 0 end,
        -- Whether a loaded run still carries an install.
        installedRun = function(run) return type(run) == "table" and run[install.marker] ~= nil end,
    }
end

return hooks
