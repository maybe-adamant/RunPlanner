-- Jeweled Pom's Fated state as the native Keepsake Rack close settles it.
local fate = {}

-- Native UpdateFateStatus would mark this Fated run Unfated: its slotted
-- keepsake is a FatedDisableKeepsakes member (KeepsakeLogic.lua:1371-1386).
function fate.unfating(gameState)
    local disabled = _G.FatedDisableKeepsakes
    return type(gameState) == "table" and gameState.FatedStatus == "Fated"
        and type(disabled) == "table" and gameState.LastAwardTrait ~= nil
        and disabled[gameState.LastAwardTrait] == true
end

-- KeepsakeScreenClose after a swap: an unfating run loses the Jeweled Pom's
-- granted boon (KeepsakeLogic.lua:1222-1253), then UpdateFateStatus (1285).
-- `spent` removes the grant whatever the status.
function fate.close(hero, spent)
    if spent or fate.unfating(_G.GameState) then
        for _, trait in ipairs(hero.Traits) do
            if trait.GrantedTrait then
                _G.RemoveTrait(hero, trait.Name)
                break
            end
        end
    end
    _G.UpdateFateStatus()
end

return fate
