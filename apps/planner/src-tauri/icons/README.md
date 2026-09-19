# Run Planner icons

The planner artwork is Odysseus with a gold exclamation mark on the right and a
transparent background. It uses the user's original-art composition with a mild
RGB midtone lift; preserve its geometry and alpha rather than regenerating the
portrait. The approved
source image is `../app-icon.png`; the platform assets are generated from it with
`tauri icon`. Generate the additional 16, 24, 48, 64, 256, and 512px PNG sizes with
the CLI's `--png` option into a separate directory, then copy them into this set.
Only desktop assets are retained; mobile output is not used.

`tauri.conf.json` lists the desktop icons, including the additional Linux PNG
sizes. The ICO contains the Windows size variants; the ICNS contains the macOS
artwork. The Square/Store PNGs are reserved for Windows Store packaging.
Portable builds remain unbundled.

Keep the 256px entry first in the ICO: Tauri uses its first entry as the Windows
runtime window icon. Retain the smaller, size-specific entries for Windows shell
icon selection.

The browser favicon uses the 16px and 32px PNGs directly through Vite.
The game companion retains its separate Odysseus-and-equations artwork; do not
replace its store icon when regenerating this desktop set.
