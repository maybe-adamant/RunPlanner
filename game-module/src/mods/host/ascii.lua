-- The fallback window's ImGui font draws ASCII only. Text bound for it folds
-- accented Latin letters to their base letters and common punctuation to ASCII;
-- anything else becomes "?". Game-drawn overlays keep their text unfolded.
local ascii = {}

local LETTERS = "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüý"
    .. "þÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİıĴĵĶķĹĺĻļĽľ"
    .. "ŁłŃńŅņŇňŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽž"
local BASES = "A A A A A A AE C E E E E I I I I D N O O O O O O U U U U Y Th ss a a a a a a ae c e e e e i i "
    .. "i i d n o o o o o o u u u u y th y A a A a A a C c C c C c C c D d D d E e E e E e E e E e "
    .. "G g G g G g G g H h I i I i I i I i I i J j K k L l L l L l L l N n N n N n O o O o O o OE "
    .. "oe R r R r R r S s S s S s S s T t T t U u U u U u U u U u U u W w Y y Y Z z Z z Z z"

local CHARACTER = "[%z\1-\127\194-\244][\128-\191]*"

local folds = {
    ["·"] = "-", ["•"] = "-", ["–"] = "-", ["—"] = "-", ["→"] = "->", ["←"] = "<-", ["…"] = "...",
    ["‘"] = "'", ["’"] = "'", ["“"] = '"', ["”"] = '"', ["\194\160"] = " ",
}
do
    local bases = {}
    for base in BASES:gmatch("%S+") do bases[#bases + 1] = base end
    local index = 0
    for letter in LETTERS:gmatch(CHARACTER) do
        index = index + 1
        folds[letter] = bases[index]
    end
    assert(index == #bases, "ascii fold tables must align " .. index .. " " .. #bases)
end

function ascii.fold(text)
    text = tostring(text)
    if not text:find("[\128-\255]") then return text end
    text = text:gsub(CHARACTER, function(character)
        if #character == 1 and character:byte() < 128 then return character end
        return folds[character] or "?"
    end)
    return (text:gsub("[\128-\255]", "?"))
end

return ascii
