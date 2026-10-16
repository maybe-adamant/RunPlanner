-- Mystery boxes are natively interchangeable: UnwrapRandomLoot builds the same
-- loot for every box and the god is chosen at unwrap. Normal box and hidden
-- god roles therefore form one pool whose gods follow plan order.
local pool = {}

-- Returns the box and hidden god roles of a pooled Mystery transaction.
function pool.roles(transaction)
    if type(transaction) ~= "table" or transaction.kind ~= "acquisition" then return nil end
    local box, hidden
    for _, role in ipairs(transaction.roles or {}) do
        if role.role == "box" then box = role end
        if role.role == "hiddenSource" and role.lifecyclePoint == "afterUnwrap" then hidden = role end
    end
    if box == nil or hidden == nil or box.gameName ~= "BlindBoxLoot" or hidden.gameName == nil
        or box.disposition ~= "normal" or hidden.disposition ~= "normal" then
        return nil
    end
    return box, hidden
end

return pool
