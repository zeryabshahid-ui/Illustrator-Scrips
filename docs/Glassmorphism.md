# Glassmorphism for Adobe Illustrator

`Glassmorphism.jsx` turns the selected shapes into frosted-glass cards. Each card gets a blurred copy of the artwork behind it, a translucent fill, a light border, a soft shadow, and optional rounded corners. A settings dialog controls every part of the effect.

## Install

**Quick, no install:** in Illustrator choose **File > Scripts > Other Script...** (Ctrl+F12 on Windows, Cmd+F12 on Mac) and pick `Glassmorphism.jsx`.

**Show it in the File > Scripts menu:** copy `Glassmorphism.jsx` into Illustrator's Scripts folder, then restart Illustrator.

- **Windows:** `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\<locale>\Scripts\`
  (for example `...\Adobe Illustrator 2025\Presets\en_US\Scripts\`). Copying there needs administrator rights.
- **Mac:** `/Applications/Adobe Illustrator <version>/Presets.localized/<locale>/Scripts/`
  (for example `.../Adobe Illustrator 2025/Presets.localized/en_US/Scripts/`).

After you restart, the script shows up as **File > Scripts > Glassmorphism**.

## Use

1. Put some colourful artwork on the artboard, such as a gradient blob, a photo, or shapes.
2. Draw a shape on top of it, such as a rectangle, and select it. Paths, compound paths, and groups of them all work. Other objects in the selection are skipped, and the script tells you which ones.
3. Run the script, adjust the settings, and click **Apply**.

Each shape becomes a group named **Glass**, placed where the shape was:

```
Glass
  Glass Border                  thin translucent stroke
  Glass Fill                    translucent fill (solid or fade gradient)
  Glass Background (blurred)    clip group: copies of the art behind the shape, Gaussian-blurred
  Glass Shadow                  blurred, offset copy (only with the "Separate layer" shadow method)
```

Every part stays a live effect or normal object, so you can still edit it afterwards in the Appearance and Layers panels.

## Controls

| Section | Settings |
|---|---|
| Fill | Colour (hex or Pick...), Opacity %, Subtle gradient on/off, Gradient end opacity %, Gradient angle |
| Background blur | On/off, Blur radius (pt), Include locked artwork |
| Corners | Round corners on/off, Corner radius (pt) |
| Border | On/off, Width (pt), Colour, Opacity %, Light-edge gradient (fades along the gradient angle) |
| Drop shadow | On/off, Method (separate blurred layer, or Illustrator's live Drop Shadow), Colour, Opacity %, X/Y offset (pt), Blur (pt) |
| Presets | Light Glass, Dark Glass, Frosted Heavy, Clear Minimal, Reset to defaults |
| Options | Replace original, Remember my settings, Live preview |

- Each slider has a number box next to it, and the two stay in sync. You can type an exact value and press Enter or Tab.
- **Replace original** deletes your original shape. If you turn it off, the original is kept but hidden, just under the Glass group.
- **Remember my settings** saves your last values to `Glassmorphism_settings.json` in your user data folder, and the dialog reopens with them next time.
  - Windows: `%APPDATA%`
  - Mac: `~/Library/Application Support`
- **Live preview** rebuilds the effect on the artboard each time you change a setting, after you release a slider or press Enter in a box. On a complex background it can be slow, so it starts turned off. Cancel removes the preview completely.

## Tips and limitations

- The blur is "fake" background blur. Illustrator has no real backdrop blur, so the script copies the overlapping, visible artwork beneath the shape. The copies are frozen: if you change the background later, run the script again on a fresh shape.
- Blur quality depends on **Effect > Document Raster Effects Settings**. Use 150 to 300 ppi for good results.
- Only artwork that is beneath the shape and overlaps it gets copied. Hidden items, items on hidden layers, and guides are ignored. Locked items are ignored unless you tick **Include locked artwork**.
- With the **Live "Drop Shadow"** method, Illustrator lowers the shadow's strength to match the fill's low opacity. The script compensates, but the shadow can't be stronger than the fill opacity. Use **Separate blurred layer**, the default, for full control.
- Rounded corners are applied as a live Round Corners effect and then expanded, so the blurred background can be clipped to the rounded shape. If expanding fails, the background keeps square corners and the script warns you.
- Fill gradients are added to your Swatches panel as "Glass Gradient ..." swatches.
- Undo: after Apply, you may need to press Ctrl/Cmd+Z several times to undo everything.
- No noise or grain texture is included, because it can't be applied reliably from a script.
