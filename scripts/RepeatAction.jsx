#target illustrator
#targetengine 'repeatAction'
/* Repeat Action: choose Transform, Pathfinder or Clipping mask, then use Ctrl+Alt+R.
 * Mode is saved immediately in Folder.userData/ZeryabRepeatAction/mode.txt.
 * Windows shortcut helper starts with this panel and has an Exit tray command.
 * No action is recorded: Illustrator's native last transform / last Pathfinder
 * is repeated on the current selection, just as its built-in commands behave.
 * Clipping mask mode runs Object > Clipping Mask > Make (Ctrl+7) on the selection;
 * the topmost selected object becomes the mask.
 */
(function () {
    var TITLE = 'Repeat Action';
    if ($.global.__repeatActionWin) {
        try { $.global.__repeatActionWin.show(); $.global.__repeatActionWin.active = true; return; } catch (e) { }
    }
    var root = File($.fileName).parent;
    var runner = new File(root.fsName + '/_RepeatAction/RepeatActionRun.jsx');
    var helper = new File(root.fsName + '/_RepeatAction/RepeatActionHotkey.exe');
    var settings = new Folder(Folder.userData + '/ZeryabRepeatAction');
    var modeFile = new File(settings.fsName + '/mode.txt');
    var mode = 'transform', pending = null;
    try {
        if (modeFile.exists && modeFile.open('r')) {
            var saved = modeFile.read().replace(/^\s+|\s+$/g, ''); modeFile.close();
            if (saved === 'pathfinder' || saved === 'clipping') { mode = saved; }
        }
    } catch (eRead) { }
    var win = new Window('palette', TITLE);
    win.orientation = 'column'; win.alignChildren = ['fill', 'top'];
    win.spacing = 8; win.margins = 12;
    var modes = win.add('panel', undefined, 'Repeat mode (remembered)');
    modes.alignChildren = ['left', 'top'];
    var transform = modes.add('radiobutton', undefined, 'Transform: last move, scale, rotate, reflect or shear');
    var pathfinder = modes.add('radiobutton', undefined, 'Pathfinder: last operation from the Pathfinder panel');
    var clipping = modes.add('radiobutton', undefined, 'Clipping mask: make a mask from the selection (Ctrl+7)');
    function syncRadios() { transform.value = mode === 'transform'; pathfinder.value = mode === 'pathfinder'; clipping.value = mode === 'clipping'; }
    syncRadios();
    var tip = win.add('statictext', undefined, '', { multiline: true });
    tip.preferredSize = [350, 58];
    var repeat = win.add('button', undefined, 'Repeat on selection  (Ctrl+Alt+R)');
    var status = win.add('statictext', undefined, 'Ready.', { multiline: true });
    status.preferredSize = [350, 48];
    var buttons = win.add('group');
    var enable = buttons.add('button', undefined, 'Enable shortcut');
    var check = buttons.add('button', undefined, 'Shortcut status');
    var close = buttons.add('button', undefined, 'Close');
    function updateTip() {
        tip.text = mode === 'transform' ?
            'Transform an object normally, select your next object(s),\nthen press Ctrl+Alt+R. Illustrator repeats that transform.\nSelecting objects does not change the remembered transform.' :
            mode === 'pathfinder' ?
            'Use a Pathfinder panel operation, select the next shapes\nor group, then press Ctrl+Alt+R. Each selection is processed\ntogether; select groups separately for separate results.' :
            'Put the mask shape on top of the artwork, select both,\nthen press Ctrl+Alt+R. The topmost object becomes the mask.\nRepeat for each new set of shape + artwork.';
    }
    function saveMode(next) {
        try {
            if (!settings.exists && !settings.create()) { throw new Error('Cannot create the settings folder.'); }
            modeFile.encoding = 'UTF-8';
            if (!modeFile.open('w')) { throw new Error('Cannot write the mode settings.'); }
            modeFile.write(next); modeFile.close();
            mode = next; updateTip(); status.text = (mode === 'transform' ? 'Transform' : mode === 'pathfinder' ? 'Pathfinder' : 'Clipping mask') + ' mode saved. Ready for Ctrl+Alt+R.';
        } catch (e) {
            syncRadios();
            alert('Could not remember the mode: ' + e.message, TITLE);
        }
    }
    function startHelper() {
        if ($.os.indexOf('Windows') < 0) { status.text = 'Ctrl+Alt+R helper requires Windows. Use the Repeat button.'; return; }
        if (!helper.exists) { status.text = 'Shortcut helper is missing from the _RepeatAction folder.'; return; }
        status.text = helper.execute() ? 'Shortcut helper started. Ctrl+Alt+R works in Illustrator.\nUse its tray icon to exit; reopen this panel after sign-in.' : 'Windows could not start the shortcut helper.';
    }
    function done(result) {
        pending = null; repeat.enabled = true;
        var parts = String(result || '').split('|');
        status.text = parts.length > 1 ? parts.slice(1).join('|') : String(result);
        if (parts[0] === 'ERROR') { alert(status.text, TITLE); }
    }
    transform.onClick = function () { saveMode('transform'); };
    pathfinder.onClick = function () { saveMode('pathfinder'); };
    clipping.onClick = function () { saveMode('clipping'); };
    repeat.onClick = function () {
        if (!runner.exists) { alert('RepeatActionRun.jsx is missing from _RepeatAction.', TITLE); return; }
        repeat.enabled = false; status.text = 'Repeating...';
        var path = runner.fsName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        var sent = false;
        try {
            pending = new BridgeTalk(); pending.target = 'illustrator';
            pending.body = '$.evalFile(new File("' + path + '"));';
            pending.onResult = function (r) { done(r.body); };
            pending.onError = function (r) { done('ERROR|' + String(r.body)); };
            sent = pending.send();
        } catch (e) { sent = false; }
        if (!sent) { try { done($.evalFile(runner)); } catch (eRun) { done('ERROR|' + eRun.message); } }
    };
    enable.onClick = startHelper;
    check.onClick = function () {
        var f = new File(settings.fsName + '/hotkey.txt');
        try {
            if (!f.exists || (new Date().getTime() - f.modified.getTime()) > 10000) { status.text = 'Shortcut helper is not running. Click Enable shortcut.'; return; }
            if (!f.open('r')) { throw new Error('Cannot read shortcut status.'); }
            status.text = f.read(); f.close();
        } catch (e) { status.text = 'Cannot read shortcut status: ' + e.message; }
    };
    close.onClick = function () { win.close(); };
    win.onClose = function () { if (pending) { return false; } $.global.__repeatActionWin = null; return true; };
    updateTip();
    if (!modeFile.exists) { saveMode(mode); }
    $.global.__repeatActionWin = win;
    win.show(); startHelper();
})();
