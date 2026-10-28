-- Read-only room-guide projection. It presents the frozen execution guide and
-- existing completion hints; it never starts, claims, or completes timeline work.
local guide = {}

local MAX_ROWS = 6
-- One character budget shared by the header, every row and the footer.
local ROW_LIMIT = 24
guide.ROW_LIMIT = ROW_LIMIT
guide.MAX_ROWS = MAX_ROWS

local safeHooks = type(import) == "function" and import("mods/host/presentation_hooks.lua")
    or require("mods.host.presentation_hooks")
local names = type(import) == "function" and import("mods/presentation/names.lua")
    or require("mods.presentation.names")
local rerolls = type(import) == "function" and import("mods/navigation/rerolls.lua")
    or require("mods.navigation.rerolls")
local mysteryPool = type(import) == "function" and import("mods/room/timeline/acquisitions/mystery/pool.lua")
    or require("mods.room.timeline.acquisitions.mystery.pool")
local roomName, displayName, roomOccupants = names.room, names.display, names.occupants

-- UTF-8 character count; continuation bytes do not start a character.
local function length(text)
    local _, continuation = text:gsub("[\128-\191]", "")
    return #text - continuation
end
guide.length = length

-- Safety net for unknown native names only; every catalog name fits.
local function fit(text)
    if text == nil or length(text) <= ROW_LIMIT then return text end
    local kept, count = {}, 0
    for character in text:gmatch("[%z\1-\127\192-\253][\128-\191]*") do
        if count == ROW_LIMIT - 1 then break end
        kept[#kept + 1] = character
        count = count + 1
    end
    return table.concat(kept) .. "…"
end

local gods = { Aphrodite = true, Apollo = true, Ares = true, Demeter = true,
    Hephaestus = true, Hera = true, Hestia = true, Poseidon = true, Zeus = true, Hermes = true }

local function sourceName(source)
    if type(source) ~= "string" then return nil end
    local god = source:match("^(.-)Upgrade$")
    return gods[god] and god or nil
end

-- Guide-owned names for every catalog reward type; native names are not used
-- for rewards because many reward keys have no text entry.
local rewardNames = {
    StackUpgrade = "Pom", StackUpgradeBig = "Pom x2", StackUpgradeTriple = "Pom x3",
    StoreRewardRandomStack = "Pom Slice", WeaponUpgrade = "Hammer", WeaponUpgradeDrop = "Hammer",
    SpellDrop = "Hex", TalentDrop = "Path of Stars", TalentBigDrop = "Gleaming Stars",
    MinorTalentDrop = "Faint Stars", ChaosWeaponUpgrade = "Anvil of Fates",
    MaxHealthDrop = "Max Health", MaxHealthDropSmall = "Max Health", MaxHealthDropBig = "Big Max Health",
    EmptyMaxHealthDrop = "Centaur Soul", EmptyMaxHealthSmallDrop = "Centaur Soul",
    MaxManaDrop = "Max Magick", MaxManaDropSmall = "Max Magick", MaxManaDropBig = "Big Max Magick",
    Currency = "Gold", RoomMoneyDrop = "Gold", RoomMoneySmallDrop = "Gold", RoomMoneyTinyDrop = "Gold",
    RoomMoneyTripleDrop = "Gold x3",
    RoomRewardHealDrop = "Heal", HealDrop = "Heal", HealDropMinor = "Minor Heal", HealBigDrop = "Big Heal",
    RoomRewardConsolationPrize = "Red Onion", ArmorBoost = "Armor", ArmorBigBoost = "Big Armor",
    AirBoost = "Air Essence", EarthBoost = "Earth Essence", FireBoost = "Fire Essence",
    WaterBoost = "Water Essence", ElementalBoost = "All Essences",
    LastStandDrop = "Death Defiance", InfernalContractBoon = "Champion", TrialUpgrade = "Chaos",
    GiftDrop = "Nectar", ManaDrop = "Magick",
    MetaCurrencyDrop = "Bones", MetaCurrencyBigDrop = "Big Bones",
    MetaCardPointsCommonDrop = "Ashes", MetaCardPointsCommonBigDrop = "Big Ashes",
    MemPointsCommonDrop = "Psyche", WeaponPointsRareDrop = "Nightmare",
    CardUpgradePointsDrop = "Moon Dust", CharonPointsDrop = "Obol Points",
    ShopHermesUpgrade = "Hermes", Devotion = "Trial", Boon = "Boon", RandomLoot = "Boon",
    BlindBoxLoot = "Mystery Boon", RandomLootGiftItem = "Mystery Boon",
    Story = "Story", Shop = "Shop", ClockworkGoal = "Clockwork Goal",
}
guide.rewardNames = rewardNames

-- Short forms for god boons whose native names exceed the Sell and Phial rows.
local traitNames = {
    HealthRewardBonusBoon = "Affirmation", SelfCastBoon = "Hostile Env.",
    HighHealthOffenseBoon = "Shameless", CharmCrowdBoon = "Obsession",
    DoubleExManaBoon = "Exceptional", MissingHealthCritBoon = "Mutual Destr.",
    KeepsakeLevelBoon = "Heirloom",
}
local keepsakeNames = { RandomBlessingKeepsake = "Embryo", TempHammerKeepsake = "Exp. Hammer" }

local function shortName(table_, key)
    return type(key) == "string" and table_[key] or displayName(key, nil)
end

local function isMystery(reward)
    return reward.rewardType == "BlindBoxLoot" or reward.rewardType == "RandomLootGiftItem"
end

local function rewardName(reward, boosted)
    if type(reward) ~= "table" then return "reward" end
    local god = sourceName(reward.source) or sourceName(reward.rewardType)
    if isMystery(reward) then return "Mystery Boon" end
    if boosted then return "Boosted Boon" end
    if god then return god end
    return rewardNames[reward.rewardType] or displayName(reward.rewardType, "reward")
end

local function shopOffer(occurrence, offerKey)
    for _, offer in ipairs(occurrence and occurrence.overview and occurrence.overview.shop
        and occurrence.overview.shop.offers or {}) do
        if offer.offerKey == offerKey then return offer end
    end
end

local function cageLabel(phaseKey)
    local index = type(phaseKey) == "string" and phaseKey:match("^Cage(%d+)$") or nil
    return index and ("Cage " .. tonumber(index)) or "Cage"
end

-- A rushed purchase's own pickup is collected at the Shrine; any other Shrine
-- delivery pickup arrives in a later room.
local function rushedHere(occurrence, sourceKey)
    if sourceKey == nil then return false end
    for _, offer in ipairs(occurrence.overview and occurrence.overview.hermesShrine
        and occurrence.overview.hermesShrine.offers or {}) do
        if offer.deliverySourceKey == sourceKey then return offer.purchase and offer.purchase.rushed == true end
    end
    for _, transaction in ipairs(occurrence.timeline and occurrence.timeline.transactions or {}) do
        local replacement = transaction.kind == "travelDealRefill" and transaction.refill
            and transaction.refill.replacement
        if replacement and replacement.deliverySourceKey == sourceKey then
            return replacement.purchase and replacement.purchase.rushed == true
        end
    end
    return false
end

local function instruction(description, occurrence, transaction)
    if type(description) ~= "table" then return "Planned action" end
    local kind = description.kind
    local reward = description.reward or (transaction and transaction.reward)
    if reward and reward.rewardType == "Devotion" and transaction and transaction.kind == "acquisition" then
        local role = transaction.roles and transaction.roles[1]
        if role then
            reward = { rewardType = "Boon", source = role.gameName }
        end
    end
    if transaction and transaction.kind == "acquisition" then
        for _, role in ipairs(transaction.roles or {}) do
            if role.disposition == "artificer" then return "Artificer: " .. rewardName(reward) end
        end
        -- Pooled Mystery gods follow plan order whichever box is opened, so
        -- the row names its god rather than its carrier.
        local _, hidden = mysteryPool.roles(transaction)
        local god = hidden and sourceName(hidden.gameName) or nil
        if god then return "Mystery: " .. god end
    end
    if kind == "collectRequiredReward" then return "Boss reward" end
    if kind == "completeFieldsCage" then
        local label = cageLabel(description.phaseKey)
        return reward ~= nil and (label .. ": " .. rewardName(reward)) or label
    end
    if kind == "interactIncomingReward" or kind == "interactLocalReward" or kind == "interactWheelReward" then
        if description.conversion == "timePiece" then return "Time Piece: " .. rewardName(reward) end
        return "Collect " .. rewardName(reward)
    end
    if kind == "chooseRewardWheel" then
        for _, wheel in ipairs(occurrence.overview and occurrence.overview.rewardWheels or {}) do
            if wheel.wheelKey == description.wheelKey then
                for _, offer in ipairs(wheel.offers or {}) do
                    if offer.offerKey == wheel.pickedOfferKey then
                        return "Wheel: " .. rewardName(rerolls.wheelOfferReward(occurrence, wheel.wheelKey, offer))
                    end
                end
            end
        end
        return "Wheel"
    end
    if kind == "interactShopOffer" then
        if description.conversion == "anvilOfFates" then return "Anvil of Fates" end
        local offer = shopOffer(occurrence, description.offerKey)
        local target = reward or offer or { rewardType = description.rewardType }
        local boosted = offer ~= nil and offer.optionKey == "BoostedRandomLoot"
        if description.conversion == "timePiece" then return "Time Piece: " .. rewardName(target, boosted) end
        local god = sourceName(target.source)
        if god and boosted then return "Shop: Boosted " .. god end
        return "Shop: " .. rewardName(target, boosted)
    end
    if kind == "interactInfernalContractPedestal" then
        local target = reward or { rewardType = description.rewardType }
        if description.conversion == "timePiece" then return "Time Piece: " .. rewardName(target) end
        return "Contract: " .. rewardName(target)
    end
    if kind == "purchaseStygianWellOffer" then
        if description.itemKey == nil then return "Stygian Well" end
        return "Well: " .. displayName(description.itemKey, "planned item")
    end
    if kind == "sellPurgingPoolTrait" then
        local trait = shortName(traitNames, description.traitKey)
        return trait and ("Sell: " .. trait) or "Sell trait"
    end
    if kind == "rerollStygianWell" then return "Reroll Well" end
    if kind == "rerollPurgingPool" then return "Reroll Pool" end
    if kind == "interactGorgon" then return "Talk to Athena" end
    if kind == "interactEris" then return "Talk to Eris" end
    if kind == "interactEncounter" then
        local resolution = transaction and transaction.resolution
        local giver = resolution and resolution.offer and resolution.offer.giver
        local givers = { "Arachne", "Narcissus", "Echo", "Hades", "Medea", "Circe",
            "Dionysus", "Icarus", "Artemis", "Athena", "Nemesis", "Heracles" }
        for _, name in ipairs(givers) do
            if giver == name or (resolution and resolution.kind == "nemesisRandomEvent" and name == "Nemesis")
                or (type(description.encounterKey) == "string"
                    and (description.encounterKey:match("^" .. name)
                        or description.encounterKey:match("^Story_" .. name .. "_"))) then
                return "Talk to " .. name
            end
        end
        return "Encounter"
    end
    if kind == "interactAcquisitionEntry" then
        if description.conversion == "timePiece" then return "Time Piece: " .. rewardName(reward) end
        if description.conversion == "anvilOfFates" then return "Anvil of Fates" end
        if reward and reward.producerLifecycleKey == "HermesShrineDelivery"
            and not rushedHere(occurrence, transaction and transaction.hermesShrineSourceKey) then
            return "Delivery: " .. rewardName(reward)
        end
        return "Collect " .. rewardName(reward)
    end
    if kind == "useFountain" then
        local target = description.aromaticPhialTarget
        if target == nil then return "Fountain" end
        return "Phial: " .. (shortName(traitNames, target) or "planned trait")
    end
    if kind == "interactKeepsakeRack" then
        return "Rack: " .. (shortName(keepsakeNames, description.keepsakeKey) or "planned keepsake")
    end
    return "Planned action"
end

-- Footer forms for door rewards when the full names do not fit.
local compactRewardNames = { Hephaestus = "Heph", Aphrodite = "Aphro",
    ["Gleaming Stars"] = "Stars", ["Faint Stars"] = "Stars", ["Path of Stars"] = "Stars" }

local function doorRewardName(reward, compact)
    local name
    if isMystery(reward) then
        name = rewardName(reward)
    else
        name = sourceName(reward.source) or sourceName(reward.rewardType) or rewardName(reward)
    end
    return compact and compactRewardNames[name] or name
end

-- Two or more doors: full names, then compact names, then tighter separators,
-- then the first door with a count of the rest.
local function doorsFooter(rewards)
    local full, compact = {}, {}
    for index, reward in ipairs(rewards) do
        full[index], compact[index] = doorRewardName(reward), doorRewardName(reward, true)
    end
    for _, attempt in ipairs({ { full, " / " }, { compact, " / " }, { compact, "/" } }) do
        local text = "Next: " .. table.concat(attempt[1], attempt[2])
        if length(text) <= ROW_LIMIT then return text end
    end
    return "Next: " .. compact[1] .. " +" .. tostring(#compact - 1)
end
guide.doorsFooter = doorsFooter

local function navigationFooter(navigation, currentGameName)
    if type(navigation) ~= "table" then return nil end
    -- A destination in the current biome omits the biome.
    local function destinationName(destination)
        local localName = names.localRoom(destination)
        if localName and names.biome(destination) == names.biome(currentGameName) then return localName end
        return roomName(destination)
    end
    if navigation.kind == "return" and navigation.gameName ~= nil then
        if navigation.gameName == "N_Hub" then return "Back to Hub" end
        return "Back to " .. destinationName(navigation.gameName)
    end
    local nextOccurrence = navigation.occurrence
    if navigation.kind ~= "next" or type(nextOccurrence) ~= "table" then return nil end
    local gameName = nextOccurrence.gameName or ""
    local overview = nextOccurrence.overview
    local reward = navigation.reward
    if reward and reward.rewardType == "ClockworkGoal" then reward = nil end
    if roomOccupants[gameName] then
        -- A fresh profile's Bridge holds a shop rather than its story occupant.
        if overview and overview.shop then return "Next: Shop" end
        -- A miniboss door's reward distinguishes it; bosses have no door reward.
        if reward ~= nil and gameName:match("_MiniBoss%d+$") then
            local occupant = names.compactOccupants[gameName] or roomOccupants[gameName]
            return occupant .. ": " .. doorRewardName(reward, true)
        end
        return "Next: " .. roomOccupants[gameName]
    end
    if navigation.hubVisit then
        local number = gameName:match("^N_Combat(%d+)$")
        if number and reward then return "Room " .. tonumber(number) .. ": " .. doorRewardName(reward) end
        if number then return "Next: Room " .. tonumber(number) end
    end
    if gameName:match("^Chaos_") then return "Next: Chaos" end
    if overview and overview.shop then return "Next: Shop" end
    if gameName:match("_Reprieve") then return "Next: Fountain" end
    if reward ~= nil then return "Next: " .. doorRewardName(reward) end
    if navigation.cageRewards and #navigation.cageRewards > 0 then return doorsFooter(navigation.cageRewards) end
    return "Next: " .. destinationName(gameName)
end

-- What a reroll's target offers before this press: its first draw, then each earlier press.
local function rerollFrom(occurrence, target, pressed)
    local key = table.concat({ target.kind, tostring(target.exitKey or target.wheelKey),
        tostring(target.cageIndex or target.offerKey) }, "\0")
    local from = pressed[key]
    if from == nil and target.kind == "wheelOffer" then
        for _, wheel in ipairs(occurrence.overview and occurrence.overview.rewardWheels or {}) do
            for _, offer in ipairs(wheel.wheelKey == target.wheelKey and wheel.offers or {}) do
                if offer.offerKey == target.offerKey then from = offer.reward end
            end
        end
    elseif from == nil then
        local batch = occurrence.doors
        for _, door in ipairs(batch and batch.kind == "batch" and batch.targets or {}) do
            if door.exitKey == target.exitKey then
                from = target.kind == "cage" and door.cageRewards and door.cageRewards[target.cageIndex]
                    or target.kind == "door" and door.reward or nil
            end
        end
    end
    return from, key
end

local function rerollInstruction(description, occurrence, pressed)
    local from, key = rerollFrom(occurrence, description.target, pressed)
    pressed[key] = description.reward
    local reward = type(description.reward) == "table" and description.reward or {}
    -- Naming the replaced reward identifies the door; the new reward is kept when both don't fit.
    for _, compact in ipairs({ false, true }) do
        local to = doorRewardName(reward, compact)
        local text = from and ("Reroll " .. doorRewardName(from, true) .. ": " .. to) or ("Reroll: " .. to)
        if length(text) <= ROW_LIMIT then return text end
    end
    return "Reroll: " .. doorRewardName(reward, true)
end

-- Expands published rows into display entries. A Shrine purchase shows its
-- purchase and, when planned, its rush; native Shrine state hides each step.
local function visibleEntries(snapshot)
    local entries = {}
    local occurrence = snapshot.occurrence
    local pressed = {}
    for _, row in ipairs(occurrence.roomGuide or {}) do
        local description = row.description
        if type(description) == "table" and description.kind == "reroll" then
            entries[#entries + 1] = { text = rerollInstruction(description, occurrence, pressed) }
        elseif type(description) == "table" and description.kind == "purchaseHermesShrineOffer" then
            local progress = type(snapshot.shrineProgress) == "function"
                and snapshot.shrineProgress(description.generationKey) or "pending"
            local name = rewardName({ rewardType = description.rewardType })
            if progress == "pending" then
                entries[#entries + 1] = { text = "Shrine: " .. name, actionable = true }
            end
            if description.rushed == true and progress ~= "rushed" then
                entries[#entries + 1] = { text = "Rush: " .. name, actionable = true }
            end
        else
            local completed = row.transactionOwner ~= nil and snapshot.isCompleted(row.transactionOwner) == true
            if not completed then
                entries[#entries + 1] = {
                    text = instruction(description, occurrence,
                        occurrence.transactionsByOwner and occurrence.transactionsByOwner[row.transactionOwner]),
                    actionable = row.transactionOwner ~= nil,
                }
            end
        end
    end
    return entries
end

-- Overflow keeps five rows and spends the sixth on a "+N more" marker.
local function window(entries)
    if #entries <= MAX_ROWS then return entries end
    local anchor = 1
    for index, entry in ipairs(entries) do
        if entry.actionable then anchor = index; break end
    end
    -- Keep one immediately preceding informational reminder adjacent to the
    -- first still-pending action without letting old reminders pin it.
    local start = anchor
    if start > 1 and not entries[start - 1].actionable then start = start - 1 end
    start = math.max(1, math.min(start, #entries - (MAX_ROWS - 1) + 1))
    local displayed = {}
    for index = start, start + MAX_ROWS - 2 do displayed[#displayed + 1] = entries[index] end
    displayed[#displayed + 1] = { text = "+" .. tostring(#entries - (MAX_ROWS - 1)) .. " more" }
    return displayed
end

local function rowsOf(entries)
    local rows = {}
    for _, entry in ipairs(entries) do rows[#rows + 1] = { instruction = fit(entry.text) } end
    return rows
end

function guide.project(snapshot)
    if type(snapshot) ~= "table" then return nil end
    if snapshot.kind == "navigation" then
        -- The Hub fountain use precedes the next visit or final handoff it is due before.
        local hubFountain = type(snapshot.navigation) == "table" and snapshot.navigation.hubFountain or nil
        local entries = {}
        if hubFountain ~= nil then
            entries[1] = { text = instruction({
                kind = "useFountain", aromaticPhialTarget = hubFountain.aromaticPhialTarget,
            }) }
        end
        return {
            header = fit(roomName(snapshot.nativeRoomName)),
            rows = rowsOf(entries),
            footer = fit(navigationFooter(snapshot.navigation, snapshot.nativeRoomName)),
        }
    end
    if snapshot.kind ~= "room" or type(snapshot.occurrence) ~= "table"
        or type(snapshot.isCompleted) ~= "function" then return nil end
    local gameName = snapshot.occurrence.gameName
    return {
        header = fit(roomName(gameName)),
        rows = rowsOf(window(visibleEntries(snapshot))),
        footer = fit(navigationFooter(snapshot.navigation, gameName)),
    }
end

local function fingerprint(projection)
    if projection == nil then return "hidden" end
    local values = { projection.header or "", projection.footer or "" }
    for _, row in ipairs(projection.rows or {}) do
        values[#values + 1] = row.instruction
    end
    return table.concat(values, "\30")
end

function guide.attach(module, inspect)
    assert(type(module) == "table" and type(module.overlays) == "table", "guide overlay module is required")
    assert(type(inspect) == "function", "guide inspection is required")
    local visible = { guide = false, footer = false }
    local lastFingerprint = nil
    module.overlays.createLine("room-guide-header", {
        hudVisibility = "independent",
        region = "middleRightStack", order = module.overlays.order.module,
        columns = { { key = "text", minWidth = 240 } },
        visible = function() return visible.guide end,
    })
    module.overlays.createTable("room-guide-rows", {
        hudVisibility = "independent",
        region = "middleRightStack", order = module.overlays.order.module + 1,
        maxRows = MAX_ROWS,
        columns = { { key = "instruction", minWidth = 240 } },
        visible = function() return visible.guide end,
    })
    module.overlays.createLine("room-guide-footer", {
        hudVisibility = "independent",
        region = "middleRightStack", order = module.overlays.order.module + MAX_ROWS + 1,
        columns = { { key = "text", minWidth = 240 } },
        visible = function() return visible.footer end,
    })

    local function refresh(_, runtime, overlay)
        local projection = nil
        if runtime.data.read("ShowRoomGuide") == true then
            local ok, value = pcall(function() return guide.project(inspect()) end)
            if ok then projection = value end
        end
        local value = fingerprint(projection)
        if value == lastFingerprint then return end
        lastFingerprint = value
        visible.guide = projection ~= nil
        visible.footer = projection ~= nil and projection.footer ~= nil
        overlay.setLine("room-guide-header", { text = projection and projection.header or "" })
        overlay.setTable("room-guide-rows", projection and projection.rows or {})
        overlay.setLine("room-guide-footer", { text = projection and projection.footer or "" })
        overlay.refreshOwned()
    end

    safeHooks.onCommit(module, "room-guide-commit", refresh)
    safeHooks.onInterval(module, "room-guide-refresh", 0.25, refresh)
end

return guide
