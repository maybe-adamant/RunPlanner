-- luacheck: globals TestStoreScreenGuidance
local lu = require("luaunit")
local storeScreens = require("mods.presentation.highlights.store_screens")
local buttonHooks = require("mods.room.features.inventory.button_hooks")
local poolHooks = require("mods.room.features.inventory.purging_pool_hooks")

TestStoreScreenGuidance = {}

local GLOBALS = { "CreateScreenComponent", "Attach", "Destroy", "ScreenData", "GameState", "CurrentRun" }

function TestStoreScreenGuidance:setUp()
    self.prior = {}
    for _, name in ipairs(GLOBALS) do self.prior[name] = _G[name] end
    self.created, self.attached, self.destroyed = {}, {}, {}
    _G.CreateScreenComponent = function(args)
        local result = { Id = #self.created + 501, Animation = args.Animation }
        self.created[#self.created + 1] = result
        return result
    end
    _G.Attach = function(args) self.attached[#self.attached + 1] = args end
    _G.Destroy = function(args) self.destroyed[#self.destroyed + 1] = args.Ids[1] end
    _G.ScreenData = { UpgradeChoice = { PinOffsetX = 800, PinOffsetY = -75, ButtonOffsetX = 350 } }
    _G.GameState = { StoreItemPins = {} }
    self.runtime = { data = { read = function() return true end } }
    self.state = { state = "synchronized", route = {} }
    self.completed, self.progress, self.rows = {}, {}, {}
    self.guide = {
        occurrence = { roomGuide = self.rows },
        isCompleted = function(owner) return self.completed[owner] == true end,
        shrineProgress = function(key) return self.progress[key] or "pending" end,
    }
    self.stores = storeScreens.create(function() return self.guide end)
    self.callbacks = {}
    self.stores.attach({ hooks = { wrap = function(name, _, callback) self.callbacks[name] = callback end } },
        function() return self.state end)
end

function TestStoreScreenGuidance:tearDown()
    for _, name in ipairs(GLOBALS) do _G[name] = self.prior[name] end
end

function TestStoreScreenGuidance:call(name, base, ...)
    return self.callbacks[name](nil, self.runtime, base, ...)
end

local function wellButton(id, key) return { Id = id, Data = { __runPlannerGenerationKey = key } } end

local function guideRow(owner, description) return { key = owner, transactionOwner = owner, description = description } end

function TestStoreScreenGuidance:testWellMarksOnlyOpenPlannedRowsAtTheNativePinCorner()
    self.rows[1] = guideRow("buy-left", { kind = "purchaseStygianWellOffer", generationKey = "initial:secondLeft" })
    self.rows[2] = guideRow("buy-heal", { kind = "purchaseStygianWellOffer", generationKey = "initial:healing" })
    self.completed["buy-heal"] = true
    local screen = { Components = {
        PurchaseButton1 = wellButton(10, "initial:healing"),
        PurchaseButton2 = wellButton(11, "initial:secondLeft"),
        PurchaseButton3 = wellButton(12, "initial:secondRight"),
    } }
    self.stores.present(self.runtime, self.state, screen, "well")
    lu.assertEquals(self.attached, { { Id = 501, DestinationId = 11, OffsetX = 426, OffsetY = -75 } })
    lu.assertEquals(self.created[1].Animation, "StoreItemPin")
    lu.assertIs(screen.Components.RunPlannerPlannedStoreMarker11, self.created[1])
    self.stores.refresh(self.runtime, self.state)
    lu.assertEquals(#self.created, 1)
    lu.assertEquals(_G.GameState.StoreItemPins, {})
end

function TestStoreScreenGuidance:testWellPurchaseRetiresTheBoughtRowAndCloseRetiresTheRest()
    self.rows[1] = guideRow("buy-left", { kind = "purchaseStygianWellOffer", generationKey = "initial:secondLeft" })
    self.rows[2] = guideRow("buy-right", { kind = "purchaseStygianWellOffer", generationKey = "initial:secondRight" })
    local screen = { Components = {
        PurchaseButton2 = wellButton(11, "initial:secondLeft"),
        PurchaseButton3 = wellButton(12, "initial:secondRight"),
    } }
    self.stores.present(self.runtime, self.state, screen, "well")
    lu.assertEquals(#self.created, 2)
    self:call("HandleStorePurchase", function(currentScreen)
        lu.assertEquals(#self.destroyed, 2)
        currentScreen.Components.PurchaseButton2 = nil
        self.completed["buy-left"] = true
    end, screen, screen.Components.PurchaseButton2)
    lu.assertEquals(self.attached[3].DestinationId, 12)
    lu.assertEquals(#self.created, 3)
    self:call("CloseStoreScreen", function() end, screen)
    lu.assertEquals(self.destroyed[3], 503)
    self.stores.refresh(self.runtime, self.state)
    lu.assertEquals(#self.created, 3)
end

function TestStoreScreenGuidance:testWellRerollAwayFromThePlannedRowLeavesNoMarker()
    self.rows[1] = guideRow("buy-left", { kind = "purchaseStygianWellOffer", generationKey = "initial:secondLeft" })
    local screen = { Components = { PurchaseButton1 = wellButton(11, "initial:secondLeft") } }
    self.stores.present(self.runtime, self.state, screen, "well")
    self:call("DestroyStoreButtons", function() end, screen)
    lu.assertEquals(self.destroyed, { 501 })
    self.stores.refresh(self.runtime, self.state)
    lu.assertEquals(#self.created, 1)
    screen.Components.PurchaseButton1 = { Id = 21, Data = { Name = "Rerolled" } }
    self.stores.present(self.runtime, self.state, screen, "well")
    lu.assertEquals(#self.created, 1)
end

local function shrineButton(id, key)
    return { Id = id, Data = { __runPlannerShrine = true, __runPlannerGenerationKey = key } }
end

function TestStoreScreenGuidance:testShrineKeepsAPlannedRushAndRetiresAnUnrushedPurchase()
    self.rows[1] = { key = "a", description = { kind = "purchaseHermesShrineOffer",
        generationKey = "initial:first", rewardType = "Boon", rushed = true } }
    self.rows[2] = { key = "b", description = { kind = "purchaseHermesShrineOffer",
        generationKey = "initial:secondLeft", rewardType = "MaxHealthDrop", rushed = false } }
    local screen = { Components = {
        PurchaseButton1 = shrineButton(31, "initial:first"),
        PurchaseButton2 = shrineButton(32, "initial:secondLeft"),
        PurchaseButton3 = shrineButton(33, "initial:secondRight"),
    } }
    self.stores.present(self.runtime, self.state, screen, "shrine")
    lu.assertEquals(#self.attached, 2)
    for _, args in ipairs(self.attached) do lu.assertEquals({ args.OffsetX, args.OffsetY }, { -580, -75 }) end
    for _, key in ipairs({ "initial:first", "initial:secondLeft" }) do
        self:call("HandleSurfaceShopAction", function() self.progress[key] = "purchased" end, screen, {})
    end
    lu.assertNotNil(screen.Components.RunPlannerPlannedStoreMarker31)
    lu.assertNil(screen.Components.RunPlannerPlannedStoreMarker32)

    local reopened = { Components = { PurchaseButton1 = shrineButton(41, "initial:first") } }
    self.stores.present(self.runtime, self.state, reopened, "shrine")
    lu.assertNotNil(reopened.Components.RunPlannerPlannedStoreMarker41)
    self.progress["initial:first"] = "rushed"
    self.stores.refresh(self.runtime, self.state)
    lu.assertNil(reopened.Components.RunPlannerPlannedStoreMarker41)
end

function TestStoreScreenGuidance:testPoolMatchesTheTraitWhateverItsRowAndRetiresTheSale()
    self.rows[1] = guideRow("sell", { kind = "sellPurgingPoolTrait", slotKey = "left", traitKey = "Target" })
    local screen = { Components = {
        PurchaseButton1 = { Id = 51, UpgradeName = "Other", OnPressedFunctionName = "HandleSellChoiceSelection" },
        PurchaseButton2 = { Id = 52, UpgradeName = "Target", OnPressedFunctionName = "HandleSellChoiceSelection" },
    } }
    self.stores.present(self.runtime, self.state, screen, "pool")
    lu.assertEquals(self.attached[1].DestinationId, 52)
    self:call("HandleSellChoiceSelection", function(_, button) button.OnPressedFunctionName = nil end,
        screen, screen.Components.PurchaseButton2)
    lu.assertEquals(self.destroyed, { 501 })
    lu.assertEquals(#self.created, 1)
    self:call("SellTraitScreenDestroyButtons", function() end, screen)
    lu.assertEquals(#self.created, 1)
end

function TestStoreScreenGuidance:testDisabledSettingWithholdsMarkersUntilRefresh()
    self.rows[1] = guideRow("buy", { kind = "purchaseStygianWellOffer", generationKey = "initial:healing" })
    local screen = { Components = { PurchaseButton1 = wellButton(10, "initial:healing") } }
    self.runtime.data.read = function() return false end
    self.stores.present(self.runtime, self.state, screen, "well")
    lu.assertEquals(#self.created, 0)
    self.runtime.data.read = function() return true end
    self.stores.refresh(self.runtime, self.state)
    lu.assertEquals(#self.created, 1)
    self.stores.refresh(self.runtime, { state = "synchronized", route = {} })
    lu.assertEquals(self.destroyed, { 501 })
end

-- Execution contacts: bindings are restored before the Well notification;
-- the Pool notifies after its native rows exist.
function TestStoreScreenGuidance:testInventoryHooksNotifyAfterBindingAndConstruction()
    local wraps, notified = {}, {}
    local module = { hooks = { wrap = function(name, _, callback) wraps[name] = callback end } }
    local highlights = { store = function(_, _, screen, kind)
        local button = screen.Components.PurchaseButton1
        notified[#notified + 1] = { kind = kind, key = button and (button.UpgradeName
            or button.Data.__runPlannerGenerationKey) }
    end }
    _G.CurrentRun = { CurrentRoom = { Store = { StoreOptions = {
        { Name = "Item", __runPlannerGenerationKey = "initial:healing" },
    } } } }
    buttonHooks.attach(module, nil, function() return self.state end, function() end, {}, nil, highlights)
    poolHooks.attach(module, {}, function() return self.state end, function() end, {}, highlights)
    local screen = { Components = {} }
    wraps.CreateStoreButtons(nil, self.runtime, function(currentScreen)
        currentScreen.Components.PurchaseButton1 = { Id = 1, Data = { Name = "Item" } }
    end, screen, false)
    local pool = { Components = {} }
    wraps.CreateSellButtons(nil, self.runtime, function(currentScreen)
        currentScreen.Components.PurchaseButton1 = { Id = 2, UpgradeName = "Target" }
    end, pool)
    lu.assertEquals(notified, { { kind = "well", key = "initial:healing" }, { kind = "pool", key = "Target" } })
end
