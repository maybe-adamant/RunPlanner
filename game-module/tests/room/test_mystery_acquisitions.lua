-- luacheck: globals TestMysteryAcquisitions
local lu = require("luaunit")
local mystery = require("mods.room.timeline.acquisitions.mystery.hooks")
local coordinator = require("mods.room.coordinator")
local readers = require("mods.room.conformance.readers")
local traitAcquisitions = require("mods.room.timeline.acquisitions.traits.hooks")
local rowOptions = require("mods.room.timeline.acquisitions.traits.row_options")
local worldItems = require("mods.room.features.inventory.world_item_hooks")
local nativeGame = require("tests.harness.native_game")
local composing = require("tests.harness.hook_composition").capture

TestMysteryAcquisitions = {}

function TestMysteryAcquisitions:setUp()
    self.restoreNative = nativeGame.install({
        TraitData = nativeGame.anyTraitDeclarations(),
        IsTraitEligible = nativeGame.alwaysEligible,
        GetAllUpgradeableGodTraits = nativeGame.currentUpgradeableTraits,
        CurrentRun = { Hero = { Traits = {} } },
    })
end

function TestMysteryAcquisitions:tearDown()
    self.restoreNative()
end

local function capture()
    local callbacks = {}
    local module = { hooks = { wrap = function(name, _, callback) callbacks[name] = callback end } }
    return module, callbacks
end

local function nativeCreateLoot(args)
    return { Name = args.Name }
end

local function harness()
    local module, callbacks = capture()
    local state, item, provider = {}, { Name = "BlindBoxLoot" }, { Name = "HeraUpgrade" }
    local boxHandle = {}
    local node = {
        owner = "mystery", kind = "acquisition",
        roles = {
            { role = "box", lifecyclePoint = "roomRewardPickup", kind = "consumable",
                gameName = item.Name, disposition = "normal" },
            { role = "hiddenSource", lifecyclePoint = "afterUnwrap", kind = "trait",
                gameName = provider.Name, disposition = "normal" },
        },
    }
    local boxPayload = { transaction = node, detail = node.roles[1] }
    local bound, payloads = {}, { [boxHandle] = boxPayload }
    local active = { occurrence = { overview = {} } }
    local room = {
        current = function() return active end,
        bound = function(_, _, native) return bound[native] end,
        peek = function(_, handle) return payloads[handle] end,
        begin = function(_, handle) return payloads[handle] end,
        claimReady = function(_, _, contact, native, compatible)
            local role = compatible(node, contact)
            if role == nil then return nil end
            bound[native] = boxHandle
            return boxHandle, boxPayload
        end,
        bind = function(_, _, handle, native) bound[native] = handle; return handle end,
        nextPooledOwner = function() return node.owner end,
    }
    local session = { complete = function() error("Mystery box must not complete at unwrap") end }
    mystery.attach(module, session, function() return state end, function() end, room)
    return callbacks, state, item, provider, boxHandle, bound
end

function TestMysteryAcquisitions.testMysteryBoxClaimsAndBindsForcedProviderAtNativeUnwrap()
    local callbacks, _, item, provider, boxHandle, bound = harness()
    lu.assertNil(bound[item])
    callbacks.UnwrapRandomLoot(nil, {}, function()
        callbacks.GiveLoot(nil, {}, function(args)
            lu.assertEquals(args.ForceLootName, provider.Name)
            return provider
        end, {})
    end, item)
    lu.assertEquals(bound[item], boxHandle)
    lu.assertEquals(bound[provider], boxHandle)
end

function TestMysteryAcquisitions.testMysteryUnwrapRetiresConstructionScopeBeforeNativePresentationWait()
    local callbacks, _, item, provider, boxHandle, bound = harness()
    local native = coroutine.create(function()
        callbacks.UnwrapRandomLoot(nil, {}, function()
            local result = callbacks.GiveLoot(nil, {}, function(args)
                lu.assertEquals(args.ForceLootName, provider.Name)
                return provider
            end, {})
            lu.assertEquals(result, provider)
            coroutine.yield("unwrap-presentation")
        end, item)
    end)
    local resumed, yielded = coroutine.resume(native)
    lu.assertTrue(resumed)
    lu.assertEquals(yielded, "unwrap-presentation")
    lu.assertEquals(bound[provider], boxHandle)

    local unrelated = { Name = "ZeusUpgrade" }
    callbacks.GiveLoot(nil, {}, function(args)
        lu.assertNil(args.ForceLootName)
        return unrelated
    end, {})
    local sameName = nativeCreateLoot({ Name = provider.Name })
    lu.assertNil(bound[unrelated])
    lu.assertNil(bound[sameName])

    resumed = coroutine.resume(native)
    lu.assertTrue(resumed)
    lu.assertEquals(coroutine.status(native), "dead")
    lu.assertEquals(bound[provider], boxHandle)
end

function TestMysteryAcquisitions.testMysteryUnwrapErrorDoesNotLeakConstructionScope()
    local callbacks, _, item, provider, _, bound = harness()
    local ok = pcall(callbacks.UnwrapRandomLoot, nil, {}, function()
        callbacks.GiveLoot(nil, {}, function()
            error("native provider failure")
        end, {})
    end, item)
    lu.assertFalse(ok)

    local sameName = { Name = provider.Name }
    callbacks.GiveLoot(nil, {}, function(args)
        lu.assertNil(args.ForceLootName)
        return sameName
    end, {})
    lu.assertNil(bound[sameName])
end

local carrierItems = {
    shop = function(owner) return { Name = "BlindBoxLoot", __runPlannerWorldShop = true,
        __runPlannerTransactionOwner = owner } end,
    contract = function(owner) return { Name = "BlindBoxLoot", __runPlannerContractSourceOwner = owner .. "-source" } end,
    shrine = function(owner) return { Name = "BlindBoxLoot", __runPlannerShrine = true,
        __runPlannerShrineSourceKey = owner .. "-source" } end,
}

local function traitOffer(god)
    return { kind = "traits", giver = god, selected = "option1", options = {
        { key = god .. "WeaponBoon", rarity = "Common", effectiveLevel = 1 },
        { key = god .. "SpecialBoon", rarity = "Common", effectiveLevel = 1 },
        { key = god .. "CastBoon", rarity = "Common", effectiveLevel = 1 },
    } }
end

local function mysteryNode(spec)
    local node = {
        owner = spec.owner, kind = "acquisition", window = { kind = "standard", phase = "beforeCombat" },
        reward = { rewardType = "BlindBoxLoot", source = spec.god .. "Upgrade" },
        roles = {
            { role = "box", lifecyclePoint = spec.carrier == "shop" and "purchase" or "roomRewardPickup",
                kind = "consumable", gameName = "BlindBoxLoot", disposition = spec.disposition or "normal" },
            { role = "hiddenSource", lifecyclePoint = "afterUnwrap", kind = "trait",
                gameName = spec.god .. "Upgrade", disposition = "normal", traitOffer = traitOffer(spec.god) },
        },
    }
    if spec.carrier == "contract" then node.sourceOwner = spec.owner .. "-source" end
    if spec.carrier == "shrine" then node.hermesShrineSourceKey = spec.owner .. "-source" end
    return node
end

-- One room with plan-ordered transactions: Mystery specs carry a carrier and
-- god; a plain spec is an ordinary trait acquisition. Without explicit `after`
-- owners each spec depends on the one before it, as the engine's in-room trait
-- mutation chain does.
local function pooledRoom(specs)
    local module, _, callbacks = composing()
    local transactions, byOwner, dependencies, obligations, present = {}, {}, {}, {}, {}
    for index, spec in ipairs(specs) do
        local node = spec.carrier and mysteryNode(spec) or {
            owner = spec.owner, kind = "acquisition", window = { kind = "standard", phase = "beforeCombat" },
            roles = { { role = "loot", lifecyclePoint = "roomRewardPickup", kind = "trait",
                gameName = spec.god .. "Upgrade", disposition = "normal", traitOffer = traitOffer(spec.god) } },
        }
        transactions[index], byOwner[spec.owner] = node, node
        obligations[index] = { checkpoint = "roomExit", owner = spec.owner }
        present[index] = { traitKey = spec.god .. "WeaponBoon" }
        local after = spec.after or (index > 1 and { specs[index - 1].owner } or {})
        for _, afterOwner in ipairs(after) do
            dependencies[#dependencies + 1] = { owner = spec.owner, afterOwner = afterOwner }
        end
    end
    table.sort(present, function(left, right) return left.traitKey < right.traitKey end)
    local occurrence = {
        id = "preboss", gameName = "O_PreBoss01", overview = {}, transactionsByOwner = byOwner,
        timeline = { transactions = transactions, dependencies = dependencies, obligations = obligations },
        roomExitConformance = { facts = { { kind = "traitInventory" } } },
        conformanceExpected = { traitInventory = { present = present, absent = {} } },
    }
    local mismatches, diagnostics = {}, {}
    local plan = { occurrencesById = { [occurrence.id] = occurrence } }
    local state = { state = "synchronized", plan = plan }
    state.room = coordinator.new(plan, function(errorValue)
        mismatches[#mismatches + 1] = errorValue
    end, { readConformance = readers.read })
    local active = assert(coordinator.enter(state, occurrence))
    local session = {
        current = coordinator.current, peek = coordinator.peek, bind = coordinator.bind,
        bound = coordinator.bound, begin = coordinator.begin, resolve = coordinator.resolve,
        claimReady = coordinator.claimReady, complete = coordinator.complete,
        mismatch = function() end,
        diagnostic = function(_, checkpoint, observed)
            diagnostics[#diagnostics + 1] = { checkpoint = checkpoint, observed = observed }
        end,
    }
    local function getState() return state end
    worldItems.attach(module, session, getState, function() end, coordinator, nil, { worldShopRefills = {} })
    mystery.attach(module, session, getState, function() end, coordinator)
    traitAcquisitions.attach(module, session, getState, function() end, coordinator,
        require("mods.room.timeline.acquisitions.sea_star").create(), nil, rowOptions)

    local api = { state = state, active = active, mismatches = mismatches, diagnostics = diagnostics }
    function api.spawn(owner, carrier)
        return callbacks.SpawnStoreItemInWorld(nil, {}, function(itemData)
            return { Name = itemData.Name }
        end, carrierItems[carrier](owner), 1)
    end
    function api.owner(native)
        local handle = coordinator.bound(state, active, native)
        return handle and coordinator.peek(state, handle).transaction.owner or nil
    end
    function api.unwrap(box)
        local loot
        callbacks.UnwrapRandomLoot(nil, {}, function()
            loot = callbacks.GiveLoot(nil, {}, function(args)
                return { Name = args.ForceLootName or "ZeusUpgrade", GodLoot = true, forced = args.ForceLootName }
            end, {})
        end, box)
        return loot
    end
    function api.pick(loot)
        callbacks.HandleLootPickup(nil, {}, function(_, nativeLoot)
            return callbacks.CreateBoonLootButtons(nil, {}, function() return true end, {}, nativeLoot, false, {})
        end, _G.CurrentRun, loot, {})
        local god = loot.Name:match("^(.-)Upgrade$")
        local traits = _G.CurrentRun.Hero.Traits
        traits[#traits + 1] = { Name = god .. "WeaponBoon", Rarity = "Common" }
        callbacks.HandleUpgradeChoiceSelection(nil, {}, function() return true end,
            {}, { LootData = loot, Data = { Name = god .. "WeaponBoon" } }, {})
    end
    function api.completed(owner)
        return state.room.current._timeline.completedOwners[owner] == true
    end
    return api
end

local prebossSpecs = {
    { owner = "contract", carrier = "contract", god = "Poseidon" },
    { owner = "shop", carrier = "shop", god = "Hera" },
}

function TestMysteryAcquisitions.testPooledGodsFollowPlanOrderWhicheverBoxOpensFirst()
    local room = pooledRoom(prebossSpecs)
    local shopBox, contractBox = room.spawn("shop", "shop"), room.spawn("contract", "contract")
    lu.assertEquals({ room.owner(shopBox), room.owner(contractBox) }, { "shop", "contract" })

    local first = room.unwrap(shopBox)
    lu.assertEquals(first.forced, "PoseidonUpgrade")
    lu.assertEquals(room.owner(first), "contract")
    local handle = coordinator.bound(room.state, room.active, first)
    lu.assertEquals(coordinator.peek(room.state, handle).detail.role, "hiddenSource")
    room.pick(first)
    lu.assertTrue(room.completed("contract"))
    lu.assertFalse(room.completed("shop"))

    local second = room.unwrap(contractBox)
    lu.assertEquals(second.forced, "HeraUpgrade")
    lu.assertEquals(room.owner(second), "shop")
    room.pick(second)
    lu.assertTrue(room.completed("shop"))
    -- Each box stays bound to its own transaction for carrier bookkeeping.
    lu.assertEquals({ room.owner(shopBox), room.owner(contractBox) }, { "shop", "contract" })
    lu.assertEquals(room.diagnostics, {
        { checkpoint = "mystery-pool", observed = { boxOwner = "shop", servedOwner = "contract" } },
        { checkpoint = "mystery-pool", observed = { boxOwner = "contract", servedOwner = "shop" } },
    })
    lu.assertEquals(room.mismatches, {})
    lu.assertTrue(coordinator.close(room.state, _G.CurrentRun, {}))
    lu.assertEquals(room.mismatches, {})
end

function TestMysteryAcquisitions.testPlannedBoxOrderKeepsEachBoxOnItsOwnGod()
    local room = pooledRoom(prebossSpecs)
    local shopBox, contractBox = room.spawn("shop", "shop"), room.spawn("contract", "contract")
    local first = room.unwrap(contractBox)
    lu.assertEquals({ first.forced, room.owner(first) }, { "PoseidonUpgrade", "contract" })
    room.pick(first)
    local second = room.unwrap(shopBox)
    lu.assertEquals({ second.forced, room.owner(second) }, { "HeraUpgrade", "shop" })
    room.pick(second)
    lu.assertTrue(coordinator.close(room.state, _G.CurrentRun, {}))
    lu.assertEquals(room.mismatches, {})
    lu.assertEquals(room.diagnostics, {})
end

function TestMysteryAcquisitions.testShrineDeliveredAndShopBoxesShareThePool()
    local room = pooledRoom({
        { owner = "delivery", carrier = "shrine", god = "Zeus" },
        { owner = "shop", carrier = "shop", god = "Hera" },
    })
    local delivered, shopBox = room.spawn("delivery", "shrine"), room.spawn("shop", "shop")
    lu.assertEquals(room.owner(delivered), "delivery")
    local first = room.unwrap(shopBox)
    lu.assertEquals({ first.forced, room.owner(first) }, { "ZeusUpgrade", "delivery" })
    room.pick(first)
    local second = room.unwrap(delivered)
    lu.assertEquals({ second.forced, room.owner(second) }, { "HeraUpgrade", "shop" })
    room.pick(second)
    lu.assertTrue(coordinator.close(room.state, _G.CurrentRun, {}))
    lu.assertEquals(room.mismatches, {})
end

function TestMysteryAcquisitions.testConversionDispositionIsNotPooled()
    local room = pooledRoom({
        { owner = "convert", carrier = "contract", god = "Poseidon", disposition = "artificer" },
        { owner = "shop", carrier = "shop", god = "Hera" },
    })
    room.spawn("convert", "contract")
    local shopBox = room.spawn("shop", "shop")
    room.unwrap(shopBox)
    lu.assertEquals(room.mismatches, { {
        checkpoint = "transaction-prerequisite", expected = "convert", observed = "shop",
    } })
end

function TestMysteryAcquisitions.testBoxBeforeANonMysteryPrerequisiteStillMismatches()
    local room = pooledRoom({
        { owner = "zeus", god = "Zeus" },
        { owner = "shop", carrier = "shop", god = "Hera" },
    })
    room.unwrap(room.spawn("shop", "shop"))
    lu.assertEquals(room.mismatches, { {
        checkpoint = "transaction-prerequisite", expected = "zeus", observed = "shop",
    } })
end

function TestMysteryAcquisitions.testSecondBoxBeforeTheFirstPooledGodIsTakenMismatches()
    local room = pooledRoom(prebossSpecs)
    local shopBox, contractBox = room.spawn("shop", "shop"), room.spawn("contract", "contract")
    lu.assertEquals(room.unwrap(shopBox).forced, "PoseidonUpgrade")
    room.unwrap(contractBox)
    lu.assertEquals(room.mismatches, { {
        checkpoint = "transaction-prerequisite", expected = "contract", observed = "shop",
    } })
end

function TestMysteryAcquisitions.testUnboundNativeBoxKeepsTheUnboundPath()
    local room = pooledRoom(prebossSpecs)
    room.spawn("shop", "shop")
    room.spawn("contract", "contract")
    local native = { Name = "BlindBoxLoot" }
    local loot = room.unwrap(native)
    lu.assertNil(loot.forced)
    lu.assertNil(room.owner(native))
    lu.assertNil(room.owner(loot))
    lu.assertEquals(room.mismatches, {})
end

function TestMysteryAcquisitions.testLaterReadyPoolMemberServesBeforeAnEarlierBlockedOne()
    local room = pooledRoom({
        { owner = "apollo", god = "Apollo" },
        { owner = "contract", carrier = "contract", god = "Poseidon", after = { "apollo" } },
        { owner = "shop", carrier = "shop", god = "Hera", after = {} },
    })
    room.spawn("shop", "shop")
    local contractBox = room.spawn("contract", "contract")
    local loot = room.unwrap(contractBox)
    lu.assertEquals({ loot.forced, room.owner(loot) }, { "HeraUpgrade", "shop" })
    room.pick(loot)
    lu.assertTrue(room.completed("shop"))
    lu.assertEquals(room.mismatches, {})
end

function TestMysteryAcquisitions.testThreeBoxesOpenedInReverseServeGodsInPlanOrder()
    local room = pooledRoom({
        { owner = "contract", carrier = "contract", god = "Poseidon" },
        { owner = "shop", carrier = "shop", god = "Hera" },
        { owner = "delivery", carrier = "shrine", god = "Zeus" },
    })
    local contractBox, shopBox = room.spawn("contract", "contract"), room.spawn("shop", "shop")
    local delivered = room.spawn("delivery", "shrine")
    for _, case in ipairs({
        { delivered, "PoseidonUpgrade", "contract" },
        { shopBox, "HeraUpgrade", "shop" },
        { contractBox, "ZeusUpgrade", "delivery" },
    }) do
        local loot = room.unwrap(case[1])
        lu.assertEquals({ loot.forced, room.owner(loot) }, { case[2], case[3] })
        room.pick(loot)
    end
    lu.assertTrue(coordinator.close(room.state, _G.CurrentRun, {}))
    lu.assertEquals(room.mismatches, {})
end

function TestMysteryAcquisitions.testBoxWhoseOwnerIsCompleteServesTheNextBlockedMemberAndMismatches()
    local room = pooledRoom({
        { owner = "contract", carrier = "contract", god = "Poseidon" },
        { owner = "zeus", god = "Zeus" },
        { owner = "shop", carrier = "shop", god = "Hera" },
    })
    local shopBox, contractBox = room.spawn("shop", "shop"), room.spawn("contract", "contract")
    room.pick(room.unwrap(shopBox))
    lu.assertTrue(room.completed("contract"))
    room.unwrap(contractBox)
    lu.assertEquals(room.mismatches, { {
        checkpoint = "transaction-prerequisite", expected = "zeus", observed = "shop",
    } })
end
