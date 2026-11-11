REPEAT ACTION - Illustrator (Windows)

1. Refresh Script Launcher and open Repeat Action.
2. Choose Transform, Pathfinder or Clipping mask. Your choice is saved immediately.
3. Perform the first operation normally in Illustrator.
4. Select the next target(s) and press Ctrl+Alt+R. Repeat as often as needed.

Transform uses Illustrator's Transform Again command. It repeats the latest
move, scale, rotation, reflection or shear, until another transform replaces it.
If the previous transform made a copy, Illustrator may repeat the copy too.
Clipping mask runs Object > Clipping Mask > Make (Ctrl+7) on the selection.
Put the mask shape on top, select it with the artwork, and press Ctrl+Alt+R.
Select at least two objects; the topmost one becomes the mask.
Pathfinder uses the last operation from the Pathfinder PANEL, not Effect menu.
It processes the current selection together. For separate results, select
each group separately and repeat. The command can do nothing when Illustrator
has no repeatable operation, or when the selection is unsuitable.

Your mode is remembered across Illustrator and Windows restarts in:
%APPDATA%\ZeryabRepeatAction\mode.txt
This remembers the MODE, not Illustrator's operation history across restarts.

The panel starts RepeatActionHotkey.exe, a small local .NET Framework helper.
No AutoHotkey installation is needed. The shortcut is active only with
Illustrator in front; your native Ctrl+D and Ctrl+4 shortcuts are not modified.
The helper also gives Ctrl+Alt+V = Paste to Replace (runs PasteToReplace.jsx
from the Illustrator Scripts folder). It starts automatically when you sign in to
Windows (HKCU Run value "ZeryabIllustratorShortcuts"), so both shortcuts work
without opening any panel. Use the tray icon > Exit shortcut helper to stop it
for this session. To stop auto-start, delete that Run value.

You can also use the panel's Repeat on selection button. Shortcut status shows
whether the helper is alive and reports shortcut conflicts or errors.

Keep the _RepeatAction folder alongside RepeatAction.jsx. The underscore keeps
helper files out of Script Launcher. Helper source is included for review.

Build the helper with Windows .NET Framework csc.exe:
csc.exe /nologo /target:winexe /out:RepeatActionHotkey.exe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll RepeatActionHotkey.cs
