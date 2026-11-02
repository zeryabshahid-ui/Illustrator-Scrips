# Illustrator Scripts

A growing collection of ExtendScript tools for Adobe Illustrator, built to cut out repetitive clicks. Every script comes with its own control panel so you can fine-tune the result before applying it.

- Glassmorphism
- Select Same Color Text
- Select Same Color Lines
- Paste to Replace
- Extract Logo Colors
- Script Launcher

## Contents

- [Glassmorphism](#glassmorphism)
- [Select Same Color Text](#select-same-color-text)
- [Select Same Color Lines](#select-same-color-lines)
- [Paste to Replace](#paste-to-replace)
- [Extract Logo Colors](#extract-logo-colors)
- [Script Launcher](#script-launcher)
- [Installation](#installation)
- [Compatibility](#compatibility)
- [License](#license)

## Glassmorphism

`scripts/Glassmorphism.jsx` turns each selected shape into a frosted-glass card. Behind the shape it places a clipped, Gaussian-blurred copy of the artwork, then a translucent fill, a thin border, a soft drop shadow, and optional rounded corners. The result is a group named **Glass**, sitting where the original shape was.

The dialog is split into:

- **Fill** — colour (hex or Pick…), opacity, a subtle two-tone fade, gradient end opacity, and gradient angle.
- **Background blur** — on or off, blur radius in points, and whether locked artwork behind the glass is included.
- **Corners** — round corners on or off, with a corner radius.
- **Border** — on or off, width, colour, opacity, and a light-edge gradient that fades along the gradient angle.
- **Drop shadow** — on or off, method (a separate blurred layer, or Illustrator’s live Drop Shadow), colour, opacity, X/Y offset, and blur.
- **Presets** — Light Glass, Dark Glass, Frosted Heavy, Clear Minimal, and Reset to defaults.
- **Options** — replace the original shape, remember settings between runs, and a live preview that rebuilds the card as you edit.

A longer walkthrough, including tips and limits, is in [docs/Glassmorphism.md](docs/Glassmorphism.md).

## Select Same Color Text

`scripts/SelectSameColorText.jsx` selects every text object that shares the colour of the text you picked. Select a text frame, or a few characters inside one, then run the script.

- **Fill color** or **Stroke color**.
- **Also select text that only partly uses this color** — match a run inside a frame, or require the whole frame to be that colour.
- **Tolerance** — `0` is an exact match; raise it to catch near colours.
- **Current artboard only**.

Locked and hidden text is skipped and reported.

## Select Same Color Lines

`scripts/SelectSameColorLines.jsx` selects every path that shares the stroke colour of the line you picked, and can set all of those stroke weights in one go. Select a stroked path first.

- **Color tolerance** — `0` is exact.
- **Only lines with the same stroke weight**.
- **Only open paths** — skip closed shapes.
- **Current artboard only**.
- **Set all matching lines to a new weight** — type a point size or drag the slider (0.1–20 pt).

Guides, clipping paths, and locked or hidden lines are left alone.

## Paste to Replace

`scripts/PasteToReplace.jsx` swaps each selected object for a copy of something else, keeping the target’s position, layer (or group), and stacking order. The copy lands just above the object it replaces. Locked and hidden targets are skipped.

**Source**

- **Clipboard** — copy the replacement with Ctrl+C (Cmd+C), then select the objects to replace.
- **Topmost selected object** — the frontmost selected item is the source; the rest are targets. **Keep the source object** leaves that original in place.

**Alignment** is a 3×3 reference-point grid (nine points, left to right and top to bottom). The chosen point on the replacement lines up with the same point on each target. Center is the default.

**Size**

- Keep original size
- Match target width
- Match target height
- Fit inside target (proportional)
- Stretch to target bounds

Also: include stroke width in the bounds, and scale strokes and effects when resizing.

**Targets** — delete them or hide them, optionally copy the target’s fill and stroke onto simple-path replacements, and keep the target’s name. **Remember my settings** stores the dialog choices for next time.

## Extract Logo Colors

**Note:** This script works on vector artwork only. It does not work on images (placed or embedded JPG/PNG/raster images are skipped).

`scripts/ExtractLogoColors.jsx` reads a selected logo and lists every colour it uses — fills, strokes, gradient stops, text, spot colours, and symbols. Each row shows HEX, RGB, CMYK, a usage count, and the source (fill, stroke, gradient, text, or a spot name), sorted with the most-used colours first.

**Options**

- **Include strokes**
- **Include gradient stops**
- **Include text**
- **Look inside symbols**
- **Merge similar colours (tolerance)** — a slider from exact (`0`) up to shades that are close enough to count as one colour

**Buttons**

- **Add to Swatches** — adds the colours as a named colour group. The name is editable (it starts from the selection’s name, or “Logo Colors”). Swatch names that already exist are skipped.
- **Make palette** — draws labelled squares (HEX, RGB, and CMYK) beside the logo, on a layer called **Color Palette**.
- **Copy HEX list** — opens the list as HEX only, HEX + RGB + CMYK, or CSS variables, ready to copy.
- **Close**

Select rows in the list to limit those actions to the colours you picked. With no rows selected, every colour is used.

Colours that exist only in the Appearance panel, or that come from live effects such as a drop shadow, are not read. The script looks at the fill and stroke on the objects themselves. Hidden objects are ignored, and meshes, plugin objects, and pattern fills are skipped and counted in the dialog.

## Script Launcher

The dockable panel in `launcher/ScriptLauncher/` lists your scripts and runs one with a click. It has a search box, star favourites that pin to the top, a refresh button, and a folder button that points the list at any scripts folder. The panel follows Illustrator’s light or dark theme.

Files whose names start with `_` or `.` stay off the list, and only the top level of the folder is shown (no subfolders).

`launcher/_ScriptLauncher.jsx` is a floating ScriptUI palette for when the CEP panel is not installed. Put it in the same folder as the scripts and run it from **File > Scripts**. It lists the same files (again hiding names that start with `_`) and has Refresh and Close.

## Installation

### 1. Running the scripts

**Once, with no install:** in Illustrator choose **File > Scripts > Other Script…** and pick the `.jsx` file.

**On the Scripts menu:** copy the files from `scripts/` into Illustrator’s Scripts folder, then restart Illustrator. They appear under **File > Scripts**.

- **Windows:** `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\<lang>\Scripts\`
- **macOS:** `/Applications/Adobe Illustrator <version>/Presets.localized/<lang>/Scripts/`

`<lang>` is the locale folder, such as `en_US`.

### 2. Dockable Script Launcher (Windows)

1. Copy the `launcher/ScriptLauncher` folder to:

   `%APPDATA%\Adobe\CEP\extensions\ScriptLauncher`

   The folder that contains `CSXS`, `index.html`, `css`, `js`, and `host` should be named `ScriptLauncher`.

2. Illustrator only loads unsigned CEP extensions when debug mode is on. Paste this into PowerShell. It sets the string value `PlayerDebugMode` to `1` under `HKCU\Software\Adobe\CSXS.9` through `CSXS.12`:

   ```powershell
   9..12 | ForEach-Object {
       $path = "HKCU:\Software\Adobe\CSXS.$_"
       if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
       New-ItemProperty -Path $path -Name PlayerDebugMode -Value "1" -PropertyType String -Force | Out-Null
   }
   ```

3. Restart Illustrator.
4. Open **Window > Extensions > Script Launcher**.
5. Click the folder button and point it at your `scripts` folder. Files whose names start with `_` are hidden from the list.

**macOS:** copy `launcher/ScriptLauncher` to `~/Library/Application Support/Adobe/CEP/extensions/ScriptLauncher`, then enable unsigned extensions with `defaults write com.adobe.CSXS.11 PlayerDebugMode 1` and restart Illustrator. The panel is in the same **Window > Extensions** menu.

## Compatibility

Illustrator CC 2017 and later. The scripts and the panel were written with Illustrator 2026 as the tested target. The panel manifest asks for CSXS 9 or newer.

## License

This project is released under the [MIT License](LICENSE). Copyright 2026 zeryabshahid-ui.

`launcher/ScriptLauncher/js/CSInterface.js` is Adobe’s CSInterface library. It stays under the Adobe license notice at the top of that file, which is separate from the MIT license that covers the rest of this repository.
