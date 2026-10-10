-- Display-only room and key names matching the catalog; native map IDs are
-- not text keys. Shared by the room guide and the victory summary.
local names = {}

names.occupants = {
    F_Story01 = "Arachne", G_Story01 = "Narcissus", H_Bridge01 = "Echo", I_Story01 = "Hades",
    N_Story01 = "Medea", O_Story01 = "Circe", P_Story01 = "Dionysus",
    F_MiniBoss01 = "Root-Stalker", F_MiniBoss02 = "Shadow-Spiller", F_MiniBoss03 = "Master-Slicer",
    G_MiniBoss01 = "Deep Serpent", G_MiniBoss02 = "King Vermin", G_MiniBoss03 = "Hellifish",
    H_MiniBoss01 = "Phantom", H_MiniBoss02 = "Queen Lamia",
    I_MiniBoss01 = "The Verminancer", I_MiniBoss02 = "Goldwrath",
    N_MiniBoss01 = "Satyr Champion", N_MiniBoss02 = "Erymanthian Boar",
    O_MiniBoss01 = "Charybdis", O_MiniBoss02 = "The Yargonaut",
    P_MiniBoss01 = "Talos", P_MiniBoss02 = "Mega-Dracon",
    Q_MiniBoss02 = "Brute", Q_MiniBoss03 = "Tail", Q_MiniBoss04 = "Eye", Q_MiniBoss05 = "Stalker",
    -- "Scylla" shortens the catalog's "Scylla and the Sirens".
    F_Boss01 = "Hecate", F_Boss02 = "Hecate", G_Boss01 = "Scylla", G_Boss02 = "Scylla",
    H_Boss01 = "Cerberus", H_Boss02 = "Cerberus", I_Boss01 = "Chronos",
    N_Boss01 = "Polyphemus", N_Boss02 = "Polyphemus", O_Boss01 = "Eris", O_Boss02 = "Eris",
    P_Boss01 = "Prometheus", Q_Boss01 = "Typhon", Q_Boss02 = "Typhon", C_Boss01 = "Zagreus",
}

local biomes = { F = "Erebus", G = "Oceanus", H = "Fields", I = "Tartarus",
    N = "Ephyra", O = "Thessaly", P = "Olympus", Q = "Summit", B = "Anomaly", C = "Zagreus" }

local kinds = { Combat = "Combat", MiniBoss = "Miniboss", Boss = "Boss", Opening = "Opening",
    Intro = "Intro", PreHub = "Hub entrance", Hub = "Hub", PreBoss = "Preboss",
    PostBoss = "Postboss", Shop = "Shop", Story = "Story", Reprieve = "Fountain",
    Devotion = "Trial", Sub = "Side room" }

function names.display(key, fallback)
    if type(key) ~= "string" or key == "" then return fallback end
    local ok, label = pcall(function()
        return _G.GetDisplayName and _G.GetDisplayName({ Text = key }) or nil
    end)
    if ok and type(label) == "string" and label ~= "" and label ~= key then
        -- Native names may contain resource icons and formatting commands;
        -- overlays render plain text only.
        label = label:gsub("{[!#][^}]*}", ""):gsub("%s+", " "):match("^%s*(.-)%s*$")
        if label ~= "" then return label end
    end
    return fallback
end

function names.biome(gameName)
    local key = tostring(gameName):match("^(%u)_")
    return key and biomes[key] or nil
end

-- Room name without its biome, or nil when the room has no biome-relative form.
function names.localRoom(gameName)
    local biome, kind, number = tostring(gameName):match("^(%u)_([%a]+)(%d*)$")
    if not biomes[biome] then return nil end
    if names.occupants[gameName] then return names.occupants[gameName] end
    if not kinds[kind] then return nil end
    local suffix = (kind == "Combat" or kind == "Sub" or kind == "MiniBoss" or kind == "Opening")
        and number ~= "" and (" " .. tonumber(number)) or ""
    return kinds[kind] .. suffix
end

function names.room(gameName)
    local localized = names.display(gameName, nil)
    if localized then return localized end
    local chaos = tostring(gameName):match("^Chaos_(%d+)$")
    if chaos then return "Chaos " .. tonumber(chaos) end
    local dream = tostring(gameName):match("^Dream_PostBoss(%d+)$")
    if dream then return "Dream Postboss " .. tonumber(dream) end
    local biome, roomName = names.biome(gameName), names.localRoom(gameName)
    if biome and roomName then
        return biome == roomName and roomName or (biome .. " " .. roomName)
    end
    return "Current room"
end

return names
