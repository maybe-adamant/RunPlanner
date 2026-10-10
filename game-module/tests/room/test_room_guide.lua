-- luacheck: globals TestRoomGuide
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local guide = require("mods.room.guide")
local names = require("mods.room.names")
local json = require("mods.protocol.json")
local protocol = require("mods.protocol.decoder")
local route = require("mods.route.session")

TestRoomGuide = {}

function TestRoomGuide.tearDown()
    _G.GetDisplayName = nil
end

local function row(kind, owner, extra)
    local value = { key = kind, description = { kind = kind } }
    if owner ~= nil then value.transactionOwner = owner end
    for key, nested in pairs(extra or {}) do value.description[key] = nested end
    return value
end

local function room(rows, completed, nextOccurrence)
    return {
        kind = "room",
        occurrence = { gameName = "N_Combat01", roomGuide = rows },
        isCompleted = function(owner) return completed and completed[owner] == true end,
        navigation = nextOccurrence and { kind = "next", occurrence = nextOccurrence } or nil,
    }
end

function TestRoomGuide.testConversionsDescribeTheSourceAndKeepReplacementSeparate()
    for _, kind in ipairs({ "interactIncomingReward", "interactLocalReward", "interactWheelReward",
        "interactAcquisitionEntry" }) do
        local snapshot = room({
            row(kind, "convert", { reward = { rewardType = "MetaCardPointsCommonDrop" } }),
            row("interactAcquisitionEntry", "replacement", { reward = { rewardType = "WeaponUpgrade" } }),
            row(kind, nil, { conversion = "timePiece", reward = { rewardType = "StackUpgrade" } }),
        })
        snapshot.occurrence.transactionsByOwner = {
            convert = { kind = "acquisition", roles = { { disposition = "artificer" } } },
            replacement = { kind = "acquisition", roles = { { disposition = "normal",
                producer = { kind = "artificerReplacement" } } } },
        }
        lu.assertEquals(guide.project(snapshot).rows, {
            { instruction = "Artificer: Ashes" },
            { instruction = "Collect Hammer" },
            { instruction = "Time Piece: Pom" },
        })
    end
end

function TestRoomGuide.testTrialRowsNameTheirOwnAcquisitionGod()
    local reward = { rewardType = "Devotion", source = "AresUpgrade", spurnedSource = "HephaestusUpgrade" }
    local snapshot = room({ row("interactIncomingReward", "chosen", { reward = reward }),
        row("interactIncomingReward", "spurned", { reward = reward }) })
    snapshot.occurrence.transactionsByOwner = {
        chosen = { kind = "acquisition", roles = { { gameName = "AresUpgrade" } } },
        spurned = { kind = "acquisition", roles = { { gameName = "HephaestusUpgrade" } } },
    }
    lu.assertEquals(guide.project(snapshot).rows, {
        { instruction = "Collect Ares" }, { instruction = "Collect Hephaestus" },
    })
end

function TestRoomGuide.testShopLabelsUseResolvedGodWithoutDuplicatingCarrierName()
    for _, case in ipairs({
        { "BlindBoxLoot", "DemeterUpgrade", "RandomLootGiftItem", "Shop: Mystery Demeter" },
        { "RandomLoot", "HeraUpgrade", "BoostedRandomLoot", "Shop: Boosted Hera" },
        { "StackUpgradeBig", nil, "StackUpgradeBig", "Shop: Pom x2" },
    }) do
        local snapshot = room({ row("interactShopOffer", "buy", { offerKey = "slot" }) })
        snapshot.occurrence.overview = { shop = { offers = {
            { offerKey = "slot", optionKey = case[3], rewardType = case[1], source = "BlindBoxLoot" },
        } } }
        snapshot.occurrence.transactionsByOwner = { buy = {
            kind = "acquisition", reward = { rewardType = case[1], source = case[2] }, roles = {},
        } }
        lu.assertEquals(guide.project(snapshot).rows[1].instruction, case[4])
    end
    local snapshot = room({ row("interactShopOffer", nil, { offerKey = "slot", conversion = "timePiece" }) })
    snapshot.occurrence.overview = { shop = { offers = {
        { offerKey = "slot", rewardType = "StackUpgrade" },
    } } }
    lu.assertEquals(guide.project(snapshot).rows[1].instruction, "Time Piece: Pom")
end

function TestRoomGuide.testNativeMarkupIsRemovedFromRowsAndNavigation()
    _G.GetDisplayName = function(args)
        return ({ GiftDrop = "{!Icons.Gift} {!Format.Bold}Nectar{!Format.Reset}",
            ExampleWellItem = "{!Icons.Health} Well Item",
            ExampleRoom = "{!Format.Bold}Next Room{!Format.Reset}" })[args.Text]
    end
    local snapshot = room({
        row("interactLocalReward", nil, { reward = { rewardType = "GiftDrop" } }),
        row("purchaseStygianWellOffer", nil, { itemKey = "ExampleWellItem" }),
    }, nil, { gameName = "ExampleRoom", overview = { incomingReward = { rewardType = "GiftDrop" } } })
    snapshot.navigation.reward = { rewardType = "GiftDrop" }
    local projection = guide.project(snapshot)
    lu.assertEquals(projection.rows[1].instruction, "Collect Nectar")
    lu.assertEquals(projection.rows[2].instruction, "Well: Well Item")
    lu.assertEquals(projection.footer, "Next: Nectar")
end

function TestRoomGuide.testWheelChoiceUsesThePublishedPickedReward()
    local snapshot = room({ row("chooseRewardWheel", "wheel", { wheelKey = "wheel2" }) })
    snapshot.occurrence.overview = { rewardWheels = {
        { wheelKey = "wheel2", pickedOfferKey = "offer2", offers = {
            { offerKey = "offer1", reward = { rewardType = "WeaponUpgrade" } },
            { offerKey = "offer2", reward = { rewardType = "Boon", source = "ZeusUpgrade" } },
        } },
    } }
    lu.assertEquals(guide.project(snapshot).rows[1].instruction, "Wheel: Zeus")
end

function TestRoomGuide.testHidesOutOfOrderCompletedOwnersWithoutCompletingInformation()
    local projection = guide.project(room({
        row("completeFieldsCage", nil, { phaseKey = "Cage01" }),
        row("interactLocalReward", "first"),
        row("completeFieldsCage", nil, { phaseKey = "Cage02" }),
        row("interactLocalReward", "later"),
    }, { later = true }))
    lu.assertEquals(projection.rows, {
        { instruction = "Cage 1" },
        { instruction = "Collect reward" },
        { instruction = "Cage 2" },
    })
end

function TestRoomGuide.testLongWindowAnchorsTheFirstPendingOwnerAndCountsOnlyOmittedReminders()
    local rows = {
        row("completeFieldsCage", nil, { phaseKey = "Cage01" }),
        row("completeFieldsCage", nil, { phaseKey = "Cage02" }),
        row("completeFieldsCage", nil, { phaseKey = "Cage03" }),
        row("completeFieldsCage", nil, { phaseKey = "Cage04" }),
        row("interactLocalReward", "pending"),
        row("completeFieldsCage", nil, { phaseKey = "Cage05" }),
        row("interactLocalReward", "later"),
        row("completeFieldsCage", nil, { phaseKey = "Cage06" }),
        row("interactLocalReward", "latest"),
    }
    local projection = guide.project(room(rows))
    lu.assertEquals(projection.rows[1].instruction, "Cage 4")
    lu.assertEquals(projection.rows[2], { instruction = "Collect reward" })
    lu.assertEquals(#projection.rows, 6)
    lu.assertEquals(projection.rows[6], { instruction = "+4 more" })
    lu.assertNil(projection.footer)
end

function TestRoomGuide.testTimePieceWordingAndGenericFallbackNeverExposeOpaqueKeys()
    local projection = guide.project(room({
        row("interactIncomingReward", nil, { conversion = "timePiece", reward = { source = "Opaque" } }),
        row("sellPurgingPoolTrait", nil, { traitKey = "OpaqueTrait" }),
    }))
    lu.assertEquals(projection.rows, {
        { instruction = "Time Piece: reward" },
        { instruction = "Sell trait" },
    })
    local shop = guide.project({
        kind = "room",
        occurrence = {
            gameName = "N_PreBoss01",
            roomGuide = { row("interactShopOffer", "shop", { offerKey = "MixedProgress2" }) },
            overview = { shop = { offers = {
                { offerKey = "MixedProgress2", optionKey = "BoostedRandomLoot", rewardType = "RandomLoot", source = "ApolloUpgrade" },
            } } },
        },
        isCompleted = function() return false end,
    })
    lu.assertEquals(shop.rows, { { instruction = "Shop: Boosted Apollo" } })
end

function TestRoomGuide.testRoomReplacementNavigationAndSessionLossReplaceRatherThanReplayRows()
    local first = guide.project(room({ row("interactIncomingReward", "one") }, nil, {
        gameName = "N_Combat02", overview = { incomingReward = { rewardType = "Boon" } },
    }))
    local replacement = guide.project(room({ row("useFountain", "two") }))
    local restored = guide.project({
        kind = "navigation", nativeRoomName = "N_Hub",
        navigation = { kind = "next", occurrence = { gameName = "N_Combat02", overview = {} } },
    })
    lu.assertEquals(first.rows[1].instruction, "Collect reward")
    lu.assertEquals(first.header, "Ephyra Combat 1")
    lu.assertEquals(first.footer, "Next: Combat 2")
    lu.assertEquals(replacement.rows, { { instruction = "Fountain" } })
    lu.assertEquals(restored.rows, {})
    lu.assertEquals(restored.footer, "Next: Combat 2")
    lu.assertNil(guide.project(nil))
end

function TestRoomGuide.testRouteOwnedNavigationUsesPublishedHubAndSideRelationships()
    local side = { id = "side", gameName = "N_Sub01", overview = {} }
    local secondSide = { id = "second-side", gameName = "N_Sub02", overview = {} }
    local parent = {
        id = "parent", gameName = "N_Combat05",
        overview = { localSlots = { { room = { id = "side" } }, { room = { id = "second-side" } } } },
    }
    local nextMain = { id = "next-main", gameName = "N_Combat02", overview = {} }
    local preboss = { id = "preboss", gameName = "N_PreBoss01", overview = {} }
    local hub = {
        id = "prehub", gameName = "N_PreHub01",
        overview = { hub = { room = { gameName = "N_Hub" },
            slots = { { room = { id = "parent" } }, { room = { id = "next-main" } } },
            finalHandoff = { id = "preboss" },
        } },
    }
    local state = route.new({
        selectedOccurrenceIds = { "parent", "side", "second-side", "next-main", "preboss" },
        occurrencesById = {
            side = side, ["second-side"] = secondSide, parent = parent,
            prehub = hub, ["next-main"] = nextMain, preboss = preboss,
        },
    })
    assert(route.enter(state, "parent", "N_Combat05"))
    lu.assertEquals(route.guideNavigation(state), { kind = "next", occurrence = side })
    assert(route.exit(state))
    assert(route.enter(state, "side", "N_Sub01"))
    lu.assertEquals(route.guideNavigation(state), { kind = "return", gameName = "N_Combat05" })
    assert(route.exit(state))
    state.transparentNativeRoom = "N_Combat05"
    lu.assertEquals(route.guideNavigation(state), { kind = "next", occurrence = secondSide })
    assert(route.enter(state, "second-side", "N_Sub02"))
    assert(route.exit(state))
    state.transparentNativeRoom = "N_Combat05"
    lu.assertEquals(route.guideNavigation(state), { kind = "return", gameName = "N_Hub" })
    state.transparentNativeRoom = "N_Hub"
    lu.assertEquals(route.guideNavigation(state), { kind = "next", occurrence = nextMain, hubVisit = true })
    assert(route.enter(state, "next-main", "N_Combat02"))
    lu.assertEquals(route.guideNavigation(state), { kind = "return", gameName = "N_Hub" })
    assert(route.exit(state))
    state.transparentNativeRoom = "N_Hub"
    lu.assertEquals(route.guideNavigation(state), { kind = "next", occurrence = preboss })
end

function TestRoomGuide.testOPhaseProgressKeepsOneGuideAndTerminalPrefixHasNoFooter()
    local snapshot = room({
        row("chooseRewardWheel", "choice"),
        row("interactWheelReward", "reward"),
        row("interactEncounter", "encounter"),
    })
    local first = guide.project(snapshot)
    snapshot.isCompleted = function(owner) return owner == "choice" end
    local later = guide.project(snapshot)
    lu.assertEquals(first.header, later.header)
    lu.assertEquals(later.rows, {
        { instruction = "Collect reward" },
        { instruction = "Encounter" },
    })
    lu.assertNil(later.footer)
end

function TestRoomGuide.testRealFieldsSixRowGuideFitsTheCompactWindow()
    local file = assert(io.open(fixtures.path("underworld-fgh.execution.json"), "rb"))
    local raw = file:read("*a")
    file:close()
    local plan = assert(protocol.decode(assert(json.decode(raw))))
    local fields
    for _, occurrence in ipairs(plan.occurrences) do
        if occurrence.id == "golden-h-combat05" then fields = occurrence; break end
    end
    local projection = guide.project({
        kind = "room", occurrence = assert(fields), isCompleted = function() return false end,
    })
    lu.assertEquals(#projection.rows, 6)
    lu.assertNil(projection.footer)
    local reversed = assert(plan.occurrencesById["golden-h-combat02"])
    local reversedProjection = guide.project({
        kind = "room", occurrence = reversed, isCompleted = function() return false end,
    })
    lu.assertEquals(reversedProjection.rows[1].instruction, "Cage 2: Max Magick")
    lu.assertEquals(reversedProjection.rows[3].instruction, "Cage 1: Max Health")
end

function TestRoomGuide.testCageRewardNamesDoNotDependOnPickupTransactions()
    local snapshot = room({
        row("completeFieldsCage", nil, { phaseKey = "Cage01", reward = { rewardType = "Boon", source = "HeraUpgrade" } }),
        row("completeFieldsCage", nil, { phaseKey = "Cage02", reward = { rewardType = "StackUpgrade" } }),
        row("interactLocalReward", nil, { conversion = "timePiece", reward = { rewardType = "StackUpgrade" } }),
    })
    lu.assertEquals(guide.project(snapshot).rows, {
        { instruction = "Cage 1: Hera" },
        { instruction = "Cage 2: Pom" },
        { instruction = "Time Piece: Pom" },
    })
end

function TestRoomGuide.testNpcNamesUsePublishedGiverAndGorgonDoesNotBorrowTheRoomEncounter()
    local snapshot = room({
        row("interactEncounter", "story"),
        row("interactEncounter", nil, { encounterKey = "IcarusCombatO" }),
        row("interactGorgon", nil, { encounterKey = "GeneratedH" }),
        row("interactEncounter", nil, { encounterKey = "UnknownInternalEncounter" }),
    })
    snapshot.occurrence.transactionsByOwner = {
        story = { kind = "encounterInteraction",
            resolution = { kind = "traitOffer", offer = { giver = "Narcissus" } } },
    }
    lu.assertEquals(guide.project(snapshot).rows, {
        { instruction = "Talk to Narcissus" },
        { instruction = "Talk to Icarus" },
        { instruction = "Talk to Athena" },
        { instruction = "Encounter" },
    })
end

function TestRoomGuide.testEquipmentPoolAndPhialCopyUsesDisplayNamesWithoutInternalKeyFallbacks()
    _G.GetDisplayName = function(args)
        return ({ KeepsakeKey = "Aromatic Phial", TraitKey = "{#BoldFormat}Nova Strike{#Prev}",
            TemporaryForcedSecretDoorTrait = "Spark of Ixion" })[args.Text] or args.Text
    end
    lu.assertEquals(guide.project(room({
        row("interactKeepsakeRack", nil, { keepsakeKey = "KeepsakeKey" }),
        row("sellPurgingPoolTrait", nil, { traitKey = "TraitKey" }),
        row("useFountain", nil, { aromaticPhialTarget = "TraitKey" }),
        row("purchaseStygianWellOffer", nil, { itemKey = "TemporaryForcedSecretDoorTrait" }),
        row("purchaseStygianWellOffer", nil, { itemKey = "UnknownInternalItem" }),
        row("interactKeepsakeRack", nil, { keepsakeKey = "UnknownInternalKeepsake" }),
    })).rows, {
        { instruction = "Rack: Aromatic Phial" },
        { instruction = "Sell: Nova Strike" },
        { instruction = "Phial: Nova Strike" },
        { instruction = "Well: Spark of Ixion" },
        { instruction = "Well: planned item" },
        { instruction = "Rack: planned keepsake" },
    })
end

function TestRoomGuide.testConciseRoomAndRewardLabelsKeepMeaningfulDistinctions()
    local snapshot = room({
        row("interactIncomingReward", nil, { reward = { rewardType = "Boon", source = "HeraUpgrade" } }),
        row("interactLocalReward", nil, { reward = { rewardType = "MaxManaDropSmall" } }),
        row("collectRequiredReward"),
    })
    snapshot.occurrence.gameName = "H_Combat15"
    local projection = guide.project(snapshot)
    lu.assertEquals(projection.header, "Fields Combat 15")
    for name, expected in pairs({
        Chaos_01 = "Chaos 1", Dream_PostBoss02 = "Dream Postboss 2",
        N_Sub03 = "Ephyra Side room 3", UnknownInternalRoom = "Current room",
        G_Boss01 = "Oceanus Scylla", P_Boss01 = "Olympus Prometheus", C_Boss01 = "Zagreus",
    }) do
        lu.assertEquals(guide.project({ kind = "navigation", nativeRoomName = name }).header, expected)
    end
    lu.assertEquals(projection.rows, {
        { instruction = "Collect Hera" },
        { instruction = "Collect Max Magick" },
        { instruction = "Boss reward" },
    })
    lu.assertEquals(guide.project({
        kind = "navigation", nativeRoomName = "N_Combat05",
        navigation = { kind = "return", gameName = "N_Hub" },
    }).footer, "Back to Hub")
end

function TestRoomGuide.testNextDoorUsesSelectedDoorPreviewNotTheDestinationAcquisition()
    local target = { id = "picked", gameName = "F_Combat04",
        overview = { incomingReward = { rewardType = "WeaponUpgrade" } } }
    local current = { id = "current", gameName = "F_Combat01", overview = {},
        doors = { kind = "batch", targets = {
            { room = { id = "other" }, reward = { rewardType = "MetaCurrencyDrop" } },
            { room = { id = "picked" }, reward = { rewardType = "MetaCardPointsCommonDrop" } },
        } } }
    local state = route.new({ selectedOccurrenceIds = { "current", "picked" },
        occurrencesById = { current = current, picked = target } })
    assert(route.enter(state, "current", "F_Combat01"))
    local snapshot = { kind = "room", occurrence = current, isCompleted = function() return false end,
        navigation = route.guideNavigation(state) }
    lu.assertEquals(guide.project(snapshot).footer, "Next: Ashes")
    lu.assertEquals(state.index, 1)
end

function TestRoomGuide.testHubVisitUsesBoardRewardAndSpecialDestinationsKeepTheirNames()
    local target = { id = "picked", gameName = "N_Combat12", overview = {} }
    local state = route.new({ selectedOccurrenceIds = { "picked" }, occurrencesById = {
        picked = target, prehub = { id = "prehub", overview = { hub = {
            room = { gameName = "N_Hub" }, slots = {
                { room = { id = "picked" }, reward = { rewardType = "Boon", source = "HeraUpgrade" } },
            },
        } } },
    } })
    state.transparentNativeRoom = "N_Hub"
    local snapshot = { kind = "navigation", nativeRoomName = "N_Hub", navigation = route.guideNavigation(state) }
    lu.assertEquals(guide.project(snapshot).footer, "Room 12: Hera")
    for _, case in ipairs({
        { "F_Shop01", { shop = {} }, "Next: Shop" },
        { "F_Reprieve01", {}, "Next: Fountain" },
        { "Chaos_01", {}, "Next: Chaos" },
        { "C_Boss01", {}, "Next: Zagreus" },
    }) do
        snapshot.navigation = { kind = "next", occurrence = { gameName = case[1], overview = case[2] } }
        lu.assertEquals(guide.project(snapshot).footer, case[3])
    end
end

function TestRoomGuide.testStoryAndMinibossTitlesNameTheirOccupants()
    local expected = {
        F_Story01 = "Erebus Arachne", G_Story01 = "Oceanus Narcissus",
        H_Bridge01 = "Fields Echo", I_Story01 = "Tartarus Hades",
        N_Story01 = "Ephyra Medea", O_Story01 = "Thessaly Circe", P_Story01 = "Olympus Dionysus",
        F_MiniBoss01 = "Erebus Root-Stalker", F_MiniBoss02 = "Erebus Shadow-Spiller",
        F_MiniBoss03 = "Erebus Master-Slicer", G_MiniBoss01 = "Oceanus Deep Serpent",
        G_MiniBoss02 = "Oceanus King Vermin", G_MiniBoss03 = "Oceanus Hellifish",
        H_MiniBoss01 = "Fields Phantom", H_MiniBoss02 = "Fields Queen Lamia",
        I_MiniBoss01 = "Tartarus The Verminancer", I_MiniBoss02 = "Tartarus Goldwrath",
        N_MiniBoss01 = "Ephyra Satyr Champion", N_MiniBoss02 = "Ephyra Erymanthian Boar",
        O_MiniBoss01 = "Thessaly Charybdis", O_MiniBoss02 = "Thessaly The Yargonaut",
        P_MiniBoss01 = "Olympus Talos", P_MiniBoss02 = "Olympus Mega-Dracon",
        Q_MiniBoss02 = "Summit Brute", Q_MiniBoss03 = "Summit Tail",
        Q_MiniBoss04 = "Summit Eye", Q_MiniBoss05 = "Summit Stalker",
    }
    for name, title in pairs(expected) do
        lu.assertEquals(guide.project({ kind = "navigation", nativeRoomName = name }).header, title)
    end
    for name, footer in pairs({ F_MiniBoss01 = "Root-Stalker: Hera", N_MiniBoss02 = "Boar: Hera" }) do
        local projection = guide.project({ kind = "navigation", nativeRoomName = "N_Hub",
            navigation = { kind = "next", hubVisit = name == "N_MiniBoss02",
                occurrence = { gameName = name }, reward = { rewardType = "Boon", source = "HeraUpgrade" } } })
        lu.assertEquals(projection.footer, footer)
    end
end

local function nextFooter(name, reward, cages)
    return guide.project({ kind = "navigation", nativeRoomName = "H_Combat02",
        navigation = { kind = "next", occurrence = { gameName = name },
            reward = reward, cageRewards = cages } }).footer
end

function TestRoomGuide.testSingleMinibossDoorNamesTheMinibossAndItsCompactReward()
    lu.assertEquals(nextFooter("Q_MiniBoss02", { rewardType = "Boon", source = "HephaestusUpgrade" }), "Brute: Heph")
    lu.assertEquals(nextFooter("Q_MiniBoss05", { rewardType = "TalentBigDrop" }), "Stalker: Stars")
    lu.assertEquals(nextFooter("N_MiniBoss02", { rewardType = "Boon", source = "AphroditeUpgrade" }), "Boar: Aphro")
    lu.assertEquals(nextFooter("N_MiniBoss01", { rewardType = "Boon", source = "PoseidonUpgrade" }), "Satyr: Poseidon")
    lu.assertEquals(nextFooter("O_MiniBoss02", { rewardType = "Boon", source = "ZeusUpgrade" }), "Yargonaut: Zeus")
    lu.assertEquals(nextFooter("I_MiniBoss01", { rewardType = "WeaponUpgrade" }), "Verminancer: Hammer")
    -- Miniboss doors offer god boons; Tartarus and Summit stores add Gold x3,
    -- Pom x3, Hammer, Gleaming Stars and Trial.
    for gameName in pairs(names.occupants) do
        if gameName:match("_MiniBoss%d+$") then
            for _, rewardKey in ipairs({ "PoseidonUpgrade", "HermesUpgrade" }) do
                local footer = nextFooter(gameName, { rewardType = "Boon", source = rewardKey })
                lu.assertTrue(guide.length(footer) <= guide.ROW_LIMIT, footer)
            end
            for _, rewardType in ipairs({ "RoomMoneyTripleDrop", "StackUpgradeTriple", "WeaponUpgrade",
                "TalentBigDrop", "Devotion" }) do
                local footer = nextFooter(gameName, { rewardType = rewardType })
                lu.assertTrue(guide.length(footer) <= guide.ROW_LIMIT, footer)
            end
        end
    end
    lu.assertEquals(nextFooter("F_MiniBoss02", { rewardType = "Boon", source = "PoseidonUpgrade" }),
        "Shadow-Spiller: Poseidon")
end

function TestRoomGuide.testBossAndRewardlessMinibossFootersNameTheOccupant()
    lu.assertEquals(nextFooter("Q_Boss01"), "Next: Typhon")
    lu.assertEquals(nextFooter("I_Boss01"), "Next: Chronos")
    lu.assertEquals(nextFooter("N_MiniBoss02"), "Next: Erymanthian Boar")
end

function TestRoomGuide.testMultiDoorFooterTriesFullThenCompactThenFallbacks()
    local function boon(god) return { rewardType = "Boon", source = god .. "Upgrade" } end
    lu.assertEquals(guide.doorsFooter({ boon("Hephaestus"), { rewardType = "TalentBigDrop" } }),
        "Next: Heph / Stars")
    lu.assertEquals(guide.doorsFooter({ boon("Hephaestus"), boon("Hera") }), "Next: Hephaestus / Hera")
    lu.assertEquals(guide.doorsFooter({ boon("Aphrodite"), { rewardType = "WeaponUpgrade" } }),
        "Next: Aphrodite / Hammer")
    lu.assertEquals(guide.doorsFooter({ boon("Aphrodite"), { rewardType = "MinorTalentDrop" } }),
        "Next: Aphro / Stars")
    lu.assertEquals(guide.doorsFooter({ boon("Poseidon"), boon("Hephaestus") }), "Next: Poseidon / Heph")
    lu.assertEquals(guide.doorsFooter({ boon("Hephaestus"), boon("Aphrodite"), boon("Zeus") }),
        "Next: Heph/Aphro/Zeus")
    lu.assertEquals(guide.doorsFooter({ boon("Hera"), boon("Hephaestus"), boon("Zeus") }),
        "Next: Hera / Heph / Zeus")
    lu.assertEquals(guide.doorsFooter({ boon("Poseidon"), boon("Hephaestus"), { rewardType = "MaxHealthDrop" } }),
        "Next: Poseidon +2")
    -- Fields cage doors use the same chain.
    lu.assertEquals(nextFooter("H_Combat02", nil, { boon("Hephaestus"), boon("Aphrodite") }),
        "Next: Heph / Aphro")
end

function TestRoomGuide.testFooterNamesStoryAndRewardlessDestinationsAndShortensCages()
    local function footer(name, reward, cages)
        return guide.project({ kind = "navigation", nativeRoomName = "H_Combat02",
            navigation = { kind = "next", occurrence = { gameName = name },
                reward = reward, cageRewards = cages } }).footer
    end
    for name, npc in pairs({ F_Story01 = "Arachne", G_Story01 = "Narcissus", H_Bridge01 = "Echo",
        I_Story01 = "Hades", N_Story01 = "Medea", O_Story01 = "Circe", P_Story01 = "Dionysus" }) do
        lu.assertEquals(footer(name, { rewardType = "Story" }), "Next: " .. npc)
        lu.assertEquals(footer(name), "Next: " .. npc)
    end
    lu.assertEquals(guide.project({ kind = "navigation", nativeRoomName = "H_Combat02",
        navigation = { kind = "next", occurrence = { gameName = "H_Bridge01", overview = { shop = {} } } } }).footer,
        "Next: Shop")
    lu.assertEquals(footer("I_Combat05", { rewardType = "ClockworkGoal" }), "Next: Tartarus Combat 5")
    lu.assertEquals(footer("O_Combat04"), "Next: Thessaly Combat 4")
    lu.assertEquals(footer("Q_Combat11"), "Next: Summit Combat 11")
    lu.assertEquals(footer("H_Combat02", nil, {
        { rewardType = "Boon", source = "DemeterUpgrade" },
        { rewardType = "Boon", source = "HeraUpgrade" },
        { rewardType = "Boon", source = "AphroditeUpgrade" },
    }), "Next: Demeter/Hera/Aphro")
    lu.assertEquals(footer("H_Combat02", nil, {
        { rewardType = "Boon", source = "ApolloUpgrade" },
        { rewardType = "Boon", source = "HeraUpgrade" },
        { rewardType = "Boon", source = "ZeusUpgrade" },
    }), "Next: Apollo/Hera/Zeus")
    lu.assertEquals(footer("H_Combat02", nil, {
        { rewardType = "Boon", source = "HeraUpgrade" },
        { rewardType = "Boon", source = "ZeusUpgrade" },
        { rewardType = "Boon", source = "AresUpgrade" },
    }), "Next: Hera / Zeus / Ares")
    lu.assertEquals(footer("H_Combat02", nil, {
        { rewardType = "WeaponUpgrade" }, { rewardType = "StackUpgrade" }, { rewardType = "MaxHealthDrop" },
    }), "Next: Hammer +2")
end

function TestRoomGuide.testOverlayRefreshesOnlyOnProjectionChangesAndClearsOnToggle()
    local callbacks, lines, tables, refreshes = {}, {}, {}, 0
    local enabled, snapshot, failInspection = true, room({ row("interactIncomingReward", "one") }), false
    local module = {
        overlays = {
            order = { module = 30 },
            createLine = function(name, spec) lines[name] = spec end,
            createTable = function(name, spec) tables[name] = spec end,
            onCommit = function(callback) callbacks.commit = callback end,
            onInterval = function(_, seconds, callback)
                callbacks.interval, callbacks.seconds = callback, seconds
            end,
        },
    }
    guide.attach(module, function()
        if failInspection then error("presentation failure") end
        return snapshot
    end)
    lu.assertNotNil(lines["room-guide-header"])
    lu.assertEquals(lines["room-guide-header"].hudVisibility, "independent")
    lu.assertEquals(lines["room-guide-footer"].hudVisibility, "independent")
    lu.assertEquals(tables["room-guide-rows"].hudVisibility, "independent")
    lu.assertEquals(tables["room-guide-rows"].columns, { { key = "instruction", minWidth = 240 } })
    local overlay = {
        setLine = function(name, value) lines[name].value = value end,
        setTable = function(name, value) tables[name].value = value end,
        refreshOwned = function() refreshes = refreshes + 1 end,
    }
    local runtime = { data = { read = function() return enabled end } }
    callbacks.commit(nil, runtime, overlay)
    callbacks.interval(nil, runtime, overlay)
    lu.assertEquals(callbacks.seconds, 0.25)
    lu.assertEquals(refreshes, 1)
    lu.assertEquals(tables["room-guide-rows"].value, {
        { instruction = "Collect reward" },
    })
    enabled = false
    callbacks.interval(nil, runtime, overlay)
    lu.assertEquals(refreshes, 2)
    lu.assertEquals(tables["room-guide-rows"].value, {})
    snapshot = nil
    enabled = true
    callbacks.interval(nil, runtime, overlay)
    lu.assertEquals(refreshes, 2)
    failInspection = true
    lu.assertTrue(pcall(callbacks.interval, nil, runtime, overlay))
    lu.assertEquals(refreshes, 2)
end

local function assertFits(text, context)
    if text == nil then return end
    lu.assertTrue(guide.length(text) <= guide.ROW_LIMIT, context .. ": " .. text)
    lu.assertNil(text:find("…", 1, true), context .. " needed the safety cut: " .. text)
end

local seenPrefixes = {}

local function assertProjectionFits(projection, context)
    if projection == nil then return end
    for _, value in ipairs(projection.rows) do
        seenPrefixes[value.instruction:match("^[^:]+:") or value.instruction] = true
    end
    assertFits(projection.header, context .. " header")
    assertFits(projection.footer, context .. " footer")
    for index, value in ipairs(projection.rows) do
        assertFits(value.instruction, context .. " row " .. index)
        if value.instruction ~= "Boss reward" then
            lu.assertNil(value.instruction:find("reward$"), context .. " unnamed reward: " .. value.instruction)
        end
        lu.assertNotEquals(value.instruction, "Planned action", context)
    end
end

function TestRoomGuide.testEveryTemplateAtItsLongestInstantiationFits()
    local rewards, boons = {}, { "Boon", "Mystery Boon", "Boosted Boon" }
    for _, name in pairs(guide.rewardNames) do rewards[#rewards + 1] = name end
    for _, god in ipairs({ "Aphrodite", "Apollo", "Ares", "Demeter", "Hephaestus", "Hera", "Hestia",
        "Poseidon", "Zeus", "Hermes" }) do
        rewards[#rewards + 1] = god
        boons[#boons + 1] = god
    end
    local templates = {
        { rewards, { "Collect %s", "Shop: %s", "Shrine: %s", "Rush: %s", "Delivery: %s", "Wheel: %s",
            "Cage 3: %s", "Next: %s", "Room 23: %s" } },
        { boons, { "Time Piece: %s" } },
        { { "Hephaestus", "Aphrodite" }, { "Shop: Mystery %s", "Shop: Boosted %s" } },
        { { "Path of Stars", "Nectar", "Bones", "Big Bones", "Ashes", "Big Ashes", "Psyche" },
            { "Artificer: %s" } },
        { { "Affirmation", "Hostile Env.", "Shameless Attitude", "Glorious Disaster" }, { "Sell: %s" } },
        { { "Affirmation", "Hostile Env.", "Obsession", "Exceptional", "Mutual Destr.", "Heirloom",
            "Glorious Disaster" }, { "Phial: %s" } },
        { { "Embryo", "Exp. Hammer", "Everlasting Ember", "planned keepsake" }, { "Rack: %s" } },
        { { "Sacrificial Hymn", "planned item" }, { "Well: %s" } },
        { { "Narcissus", "Heracles", "Dionysus" }, { "Talk to %s" } },
        { { "Combat 23", "Side room 15", "Hub entrance" }, { "Back to %s" } },
        { { "Ephyra Combat 23" }, { "Back to %s" } },
        { { "Ephyra Combat 23", "Tartarus Combat 24", "Side room 15", "Hub entrance" }, { "Next: %s" } },
        { { "+99 more", "Next: Room 23", "Boss reward", "Anvil of Fates", "Stygian Well",
            "Keepsake Rack", "Encounter", "Fountain", "Sell trait", "Wheel" }, { "%s" } },
    }
    for _, group in ipairs(templates) do
        for _, template in ipairs(group[2]) do
            for _, name in ipairs(group[1]) do assertFits(template:format(name), template) end
        end
    end
    for gameName in pairs(names.occupants) do
        assertFits(names.room(gameName), "header")
        assertFits("Next: " .. names.occupants[gameName], "footer")
    end
    for _, biome in ipairs({ "F", "G", "H", "I", "N", "O", "P", "Q" }) do
        assertFits(names.room(biome .. "_Sub15"), "header")
        assertFits(names.room(biome .. "_Combat24"), "header")
        assertFits(names.room(biome .. "_PreHub01"), "header")
    end
end

function TestRoomGuide.testEveryFixtureGuideFitsWithoutTheSafetyCut()
    local listing = assert(io.popen('ls "' .. fixtures.root .. '"'))
    local checked = 0
    for fileName in listing:lines() do
        if fileName:match("%.execution%.json$") then
            local file = assert(io.open(fixtures.path(fileName), "rb"))
            local raw = file:read("*a")
            file:close()
            local plan = assert(protocol.decode(assert(json.decode(raw))))
            local state = route.new(plan)
            local index = plan.startState and plan.startState.occurrenceIndex or nil
            if type(index) == "number" then state.index = index end
            for _ = state.index, #plan.selectedOccurrenceIds do
                local occurrence = route.expected(state)
                if occurrence == nil or not route.enter(state, occurrence.id, occurrence.gameName) then break end
                for _, progress in ipairs({ "pending", "purchased" }) do
                    assertProjectionFits(guide.project({
                        kind = "room", occurrence = occurrence, isCompleted = function() return false end,
                        shrineProgress = function() return progress end,
                        navigation = route.guideNavigation(state),
                    }), fileName .. " " .. occurrence.id)
                end
                checked = checked + 1
                if not route.exit(state) then break end
                for _, native in ipairs({ "N_Hub", occurrence.gameName }) do
                    state.transparentNativeRoom = native
                    assertProjectionFits(guide.project({ kind = "navigation", nativeRoomName = native,
                        navigation = route.guideNavigation(state) }), fileName .. " after " .. occurrence.id)
                end
                state.transparentNativeRoom = nil
            end
        end
    end
    listing:close()
    lu.assertTrue(checked > 100)
    for _, prefix in ipairs({ "Shrine:", "Rush:", "Delivery:", "Cage 1:", "Shop:", "Wheel:", "Phial:" }) do
        lu.assertTrue(seenPrefixes[prefix], prefix)
    end
end

function TestRoomGuide.testShrinePurchaseAndRushRowsFollowNativeProgress()
    local progress = { ["initial:first"] = "pending", travelDealRefill = "pending" }
    local snapshot = room({
        row("purchaseHermesShrineOffer", nil, { generationKey = "initial:first",
            rewardType = "LastStandDrop", rushed = true }),
        row("purchaseHermesShrineOffer", nil, { generationKey = "travelDealRefill",
            rewardType = "ArmorBoost", rushed = false }),
    })
    snapshot.occurrence.roomGuide[2].key = "refill"
    snapshot.shrineProgress = function(generationKey) return progress[generationKey] end
    lu.assertEquals(guide.project(snapshot).rows, {
        { instruction = "Shrine: Death Defiance" }, { instruction = "Rush: Death Defiance" },
        { instruction = "Shrine: Armor" },
    })
    progress["initial:first"] = "purchased"
    lu.assertEquals(guide.project(snapshot).rows, {
        { instruction = "Rush: Death Defiance" }, { instruction = "Shrine: Armor" },
    })
    progress["initial:first"], progress.travelDealRefill = "rushed", "purchased"
    lu.assertEquals(guide.project(snapshot).rows, {})
end

function TestRoomGuide.testDeliveryPickupIsARemindedDeliveryUnlessRushedHere()
    local delivery = { rewardType = "MaxHealthDropBig", producerLifecycleKey = "HermesShrineDelivery" }
    local snapshot = room({
        row("interactAcquisitionEntry", "later", { reward = delivery }),
        row("interactAcquisitionEntry", "rushed", { reward = { rewardType = "HealBigDrop",
            producerLifecycleKey = "HermesShrineDelivery" } }),
    })
    snapshot.occurrence.roomGuide[2].key = "second"
    snapshot.occurrence.overview = { hermesShrine = { offers = {
        { generationKey = "initial:first", deliverySourceKey = "here", purchase = { roomDelay = 2, rushed = true } },
    } } }
    snapshot.occurrence.transactionsByOwner = {
        later = { kind = "acquisition", hermesShrineSourceKey = "elsewhere", roles = {} },
        rushed = { kind = "acquisition", hermesShrineSourceKey = "here", roles = {} },
    }
    lu.assertEquals(guide.project(snapshot).rows, {
        { instruction = "Delivery: Big Max Health" }, { instruction = "Collect Big Heal" },
    })
    snapshot.isCompleted = function(owner) return owner == "later" end
    lu.assertEquals(guide.project(snapshot).rows, { { instruction = "Collect Big Heal" } })
end

function TestRoomGuide.testOverflowSpendsTheLastRowOnTheOmittedCount()
    local rows = {}
    for index = 1, 8 do
        rows[index] = row("interactLocalReward", "owner" .. index, { reward = { rewardType = "StackUpgrade" } })
        rows[index].key = "row" .. index
    end
    local snapshot = room(rows, nil, { gameName = "N_Combat02", overview = {} })
    local projection = guide.project(snapshot)
    lu.assertEquals(#projection.rows, guide.MAX_ROWS)
    lu.assertEquals(projection.rows[6], { instruction = "+3 more" })
    lu.assertEquals(projection.footer, "Next: Combat 2")
    snapshot.isCompleted = function(owner) return owner == "owner1" or owner == "owner2" end
    projection = guide.project(snapshot)
    lu.assertEquals(#projection.rows, 6)
    lu.assertEquals(projection.rows[6], { instruction = "Collect Pom" })
end

function TestRoomGuide.testBackToDropsTheCurrentBiomeAndHubFootersUseRoomNumbers()
    local function back(current, destination)
        return guide.project({ kind = "navigation", nativeRoomName = current,
            navigation = { kind = "return", gameName = destination } }).footer
    end
    lu.assertEquals(back("N_Sub02", "N_Combat23"), "Back to Combat 23")
    lu.assertEquals(back("N_Sub02", "N_Hub"), "Back to Hub")
    lu.assertEquals(back("F_Combat03", "N_Combat07"), "Back to Ephyra Combat 7")
    local function hub(gameName, reward)
        return guide.project({ kind = "navigation", nativeRoomName = "N_Hub", navigation = {
            kind = "next", hubVisit = true, occurrence = { gameName = gameName, overview = {} }, reward = reward,
        } }).footer
    end
    lu.assertEquals(hub("N_Combat03", { rewardType = "MaxHealthDropBig" }), "Room 3: Big Max Health")
    lu.assertEquals(hub("N_Combat03"), "Next: Room 3")
    lu.assertEquals(hub("N_MiniBoss02", { rewardType = "StackUpgrade" }), "Boar: Pom")
end

function TestRoomGuide.testEveryCatalogRewardHasAGuideName()
    _G.GetDisplayName = function(args) return args.Text end
    for _, rewardType in ipairs({ "ShopHermesUpgrade", "Devotion", "RandomLoot", "WeaponUpgradeDrop",
        "RoomRewardHealDrop", "HealBigDrop", "ArmorBoost", "ArmorBigBoost", "AirBoost", "EarthBoost",
        "FireBoost", "WaterBoost", "ElementalBoost", "EmptyMaxHealthSmallDrop", "WeaponPointsRareDrop",
        "CardUpgradePointsDrop", "CharonPointsDrop", "StackUpgradeBig", "RoomMoneyTripleDrop" }) do
        local text = guide.project(room({ row("interactLocalReward", nil, {
            reward = { rewardType = rewardType } }) })).rows[1].instruction
        lu.assertNotEquals(text, "Collect reward", rewardType)
        lu.assertNotEquals(text, "Collect " .. rewardType, rewardType)
    end
    lu.assertEquals(guide.project(room({ row("interactLocalReward", nil, {
        reward = { rewardType = "RoomMoneyTripleDrop" } }) })).rows[1].instruction, "Collect Gold x3")
end
