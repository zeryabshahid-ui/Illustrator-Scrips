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

KEYBOARD SHORTCUTS (one click, nothing prebuilt)

Keep this folder next to the scripts. PasteToReplace.jsx and RepeatAction.jsx
live one folder up. RepeatActionRun.jsx lives in this folder. The helper finds
those files from its own folder. There is no fixed drive path, and this
download does not include RepeatActionHotkey.exe.

Double-click Install-Shortcuts.bat. It compiles RepeatActionHotkey.cs on your
PC with Windows' .NET Framework csc.exe, adds the current-user startup entry
ZeryabIllustratorShortcuts, and starts the helper. No administrator rights.
Windows SmartScreen may ask you to confirm a downloaded .bat (More info, then
Run anyway).

Ctrl+Alt+R runs Repeat Action. Ctrl+Alt+V runs Paste to Replace. Both are
registered only while Illustrator is the active window. The helper starts
again when you sign in. Tray icon > Exit shortcut helper stops it for this
session.

Double-click Uninstall-Shortcuts.bat to stop the helper, remove the startup
entry, and delete the compiled exe. The scripts stay.

You can also use the panel's Repeat on selection button. Shortcut status shows
whether the helper is alive and reports shortcut conflicts or errors.

For a function key with no helper, use Illustrator's Actions panel: Window >
Actions, new action, Insert Menu Item, File > Scripts > your script, stop,
then double-click the action and assign a function key. That works for any
script copied into Illustrator's Scripts folder.

Keep the _RepeatAction folder alongside RepeatAction.jsx. The underscore keeps
helper files out of Script Launcher. Helper source is included for review.
