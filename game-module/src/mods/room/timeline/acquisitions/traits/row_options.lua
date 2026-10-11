-- How published offer rows meet native boon-row presentation.
local rowOptions = {}

-- The native row StackNum for a published effective level.
function rowOptions.rowLevel(effectiveLevel)
    return effectiveLevel
end

-- Whether published rows replace native rows at pickup, before button construction.
rowOptions.eagerInstall = false

return rowOptions
