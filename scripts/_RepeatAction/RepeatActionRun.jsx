// Shared command for the panel and Windows Ctrl+Alt+R helper. ES3.
(function () {
    try {
        if (!app.documents.length) { return 'ERROR|Open a document and select artwork first.'; }
        var selection = app.activeDocument.selection;
        if (selection && selection.typename === 'TextRange') { return 'ERROR|Leave text editing and select whole objects first.'; }
        if (!selection || !selection.length) { return 'ERROR|Select the object(s) to repeat on first.'; }
        var mode = 'transform';
        var f = new File(Folder.userData + '/ZeryabRepeatAction/mode.txt');
        if (f.exists) {
            if (!f.open('r')) { return 'ERROR|Cannot read the selected repeat mode.'; }
            var saved = f.read().replace(/^\s+|\s+$/g, ''); f.close();
            if (saved !== 'transform' && saved !== 'pathfinder' && saved !== 'clipping') { return 'ERROR|Choose Transform, Pathfinder or Clipping mask in Repeat Action again.'; }
            mode = saved;
        }
        if (mode === 'clipping') {
            if (selection.length < 2) { return 'ERROR|Select the mask shape (on top) and the artwork to clip, then try again.'; }
            app.executeMenuCommand('makeMask');
            return 'OK|Clipping mask made. The topmost object is the mask.';
        }
        app.executeMenuCommand(mode === 'pathfinder' ? 'repeatPathfinder' : 'transformagain');
        return 'OK|' + (mode === 'pathfinder' ? 'Repeat Pathfinder' : 'Transform Again') + ' sent to Illustrator.';
    } catch (e) {
        return 'ERROR|' + String(e.message || e).replace(/[|\r\n]/g, ' ') + (e.line ? ' (line ' + e.line + ')' : '');
    }
})();
