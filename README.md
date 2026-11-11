# Illustrator Scripts

A growing collection of ExtendScript tools for Adobe Illustrator, built to cut out repetitive clicks. Every script comes with its own control panel so you can fine-tune the result before applying it.

- Glassmorphism
- Select Same Color Text
- Select Same Color Lines
- Paste to Replace
- Extract Logo Colors
- Copy Appearance
- Copy Size
- Move To New Layer
- Repeat Action
- Script Launcher

## Contents

- [Glassmorphism](#glassmorphism)
- [Select Same Color Text](#select-same-color-text)
- [Select Same Color Lines](#select-same-color-lines)
- [Paste to Replace](#paste-to-replace)
- [Extract Logo Colors](#extract-logo-colors)
- [Copy Appearance](#copy-appearance)
- [Copy Size](#copy-size)
- [Move To New Layer](#move-to-new-layer)
- [Repeat Action](#repeat-action)
- [Script Launcher](#script-launcher)
- [Installation](#installation)
- [Adding a keyboard shortcut (no install needed)](#adding-a-keyboard-shortcut-no-install-needed)
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

Assign a function key with no extra install from [Adding a keyboard shortcut (no install needed)](#adding-a-keyboard-shortcut-no-install-needed). If you build and run the optional Windows helper described under [Repeat Action](#repeat-action), **Ctrl+Alt+V** runs Paste to Replace while Illustrator is the active window.

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

## Copy Appearance

`scripts/CopyAppearance.jsx` copies one object’s full Appearance panel — fills, strokes, effects, and opacity — through a floating panel, then applies that look to one selected object or all selected objects. It does not copy path shape, size, or contents.

- **Copy appearance** — stores the selected object’s appearance. If several objects are selected, the frontmost one is used.
- **Apply to selected** — applies the stored appearance to every object in the current selection.
- **Apply topmost to the rest** — with the source in front of the other selected objects, copies that frontmost appearance onto the rest in one click.

Locked or hidden objects, and placed or raster images, are skipped. The selection is restored after each action.

## Copy Size

`scripts/CopySize.jsx` copies the width and height of one object and applies them to other objects from a floating panel. Size is measured in points from the object bounds, excluding strokes and live effects. Targets keep their centres and their stroke weights. A clipping group is measured from its clipping path.

- **Copy dimensions** — select exactly one source object.
- **Width** and **Height** — apply both to stretch to the copied size, or just one axis and leave the other unchanged.
- **Apply to selected** — resize every selected target.

Locked or hidden objects, guides, and clipping paths are skipped. The copied size stays available until you close the panel, including when you switch documents.

## Move To New Layer

`scripts/MoveToNewLayer.jsx` moves the selected objects onto a layer it creates for you. The layer is named **Layer N** (the next free number) and sits directly above the layer of the frontmost selected object. Objects keep their stacking order and their place on the artboard.

Selecting a group, or a path inside a compound path, moves the whole group or compound path. Objects inside a selected group stay in that group. Locked or hidden objects are skipped and reported. The moved objects stay selected, and the new layer becomes the active layer.

## Repeat Action

`scripts/RepeatAction.jsx` is a floating palette with three modes. Choose one (it is saved immediately), do that operation once yourself in Illustrator, then repeat it on the next selection.

- **Transform** — Transform Again: the latest move, scale, rotation, reflection, or shear. If that transform made a copy, Illustrator may repeat the copy too.
- **Pathfinder** — the last operation from the Pathfinder panel, not the Effect menu. The current selection is processed together. For separate results, select each group on its own and repeat.
- **Clipping mask** — Object > Clipping Mask > Make. Put the mask shape on top and select it with the artwork (at least two objects). The topmost object becomes the mask.

**Repeat on selection** runs the chosen mode from the panel. The same action can take a function key with no extra software — see [Adding a keyboard shortcut (no install needed)](#adding-a-keyboard-shortcut-no-install-needed).

### Optional Windows shortcut helper

`scripts/_RepeatAction/` is an advanced, build-it-yourself option for **Ctrl+Alt+R** (Repeat Action) and **Ctrl+Alt+V** (Paste to Replace). The repository includes the source only.

Keep that folder next to `RepeatAction.jsx`. Its name starts with `_`, so Script Launcher leaves it off the list. After you build `RepeatActionHotkey.exe` into the folder, open Repeat Action and click **Enable shortcut**. The helper registers those two shortcuts only while Illustrator is the active window, and it does not change Illustrator’s own shortcuts. The tray menu’s **Exit shortcut helper** stops it for the session. Notes on what the helper remembers are in `scripts/_RepeatAction/README.txt`.

Build it on Windows from `scripts/_RepeatAction` with the .NET Framework compiler:

```
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll RepeatActionHotkey.cs
```

That writes `RepeatActionHotkey.exe` next to the `.cs` file, on your machine only.

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

## Adding a keyboard shortcut (no install needed)

This works for any script in the repo once it appears on Illustrator’s **File > Scripts** menu. Copy the `.jsx` file into Illustrator’s Scripts folder and restart Illustrator first (see [Installation](#installation)).

1. Open **Window > Actions**.
2. Create a new action.
3. From the Actions panel menu, choose **Insert Menu Item**.
4. Pick **File > Scripts > PasteToReplace**, or any other script you installed, such as CopyAppearance, CopySize, MoveToNewLayer, or RepeatAction.
5. Stop recording.
6. Double-click the action and assign a **Function Key**, for example F5, optionally with Shift or Ctrl.

**Ctrl+Alt+R** and **Ctrl+Alt+V** come from the optional Windows helper under [Repeat Action](#repeat-action), which you build yourself.

## Compatibility

Illustrator CC 2017 and later. The scripts and the panel were written with Illustrator 2026 as the tested target. The panel manifest asks for CSXS 9 or newer.

## License

This project is released under the [MIT License](LICENSE). Copyright 2026 zeryabshahid-ui.

`launcher/ScriptLauncher/js/CSInterface.js` is Adobe’s CSInterface library. It stays under the Adobe license notice at the top of that file, which is separate from the MIT license that covers the rest of this repository.
