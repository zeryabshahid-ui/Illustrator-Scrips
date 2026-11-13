#target photoshop
/*
 * Photoshop Script Launcher
 * ---------------------------------------------------------------
 * Lists every .jsx / .js file in this script's folder and lets you
 * search, select, and run one. Files whose names start with "_" are
 * hidden (including this launcher). The last script you ran is
 * remembered and re-selected the next time you open the dialog.
 *
 * Install (pick one):
 *   1. In Photoshop: File > Scripts > Browse... and choose this file.
 *   2. Copy this file into Photoshop's Presets/Scripts folder, then
 *      restart Photoshop so it appears under File > Scripts. You can
 *      assign a keyboard shortcut via:
 *      Edit > Keyboard Shortcuts > Application Menus > File > Scripts
 *
 * Keep your other Photoshop scripts in the same folder as this file.
 * The list is that folder (the parent of this script, from $.fileName),
 * not a fixed drive path.
 *
 * Built by Zeryab Shahid with the help of AI
 */
(function () {
    var TITLE = 'Photoshop Script Launcher';
    var scriptFile = File($.fileName);
    var folder = (scriptFile && scriptFile.exists) ? scriptFile.parent : Folder.current;
    var prefFile = new File(folder + '/_PSScriptLauncher_last.txt');
    var visibleItems = [];
    var pendingFile = null;

    function trim(s) {
        return String(s).replace(/^\s+|\s+$/g, '');
    }

    function displayName(fileName) {
        var n = fileName.replace(/\.(jsx|js)$/i, '');
        n = n.replace(/[_\-]+/g, ' ');
        n = n.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
        n = n.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
        return trim(n).replace(/\s+/g, ' ');
    }

    function fileNameOf(f) {
        var name = f.name;
        try { name = decodeURI(name); } catch (e) {}
        return name;
    }

    function listScripts() {
        var out = [];
        if (!folder || !folder.exists) return out;
        var files = folder.getFiles();
        if (!files) return out;
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (!f || (f instanceof Folder)) continue;
            var name = fileNameOf(f);
            if (!name || name.charAt(0) === '_' || name.charAt(0) === '.') continue;
            if (!/\.(jsx|js)$/i.test(name)) continue;
            out.push({ file: f, name: name, label: displayName(name) });
        }
        out.sort(function (a, b) {
            var al = a.label.toLowerCase();
            var bl = b.label.toLowerCase();
            if (al < bl) return -1;
            if (al > bl) return 1;
            return 0;
        });
        return out;
    }

    function loadLastRun() {
        if (!prefFile.exists) return '';
        try {
            prefFile.encoding = 'UTF-8';
            if (prefFile.open('r')) {
                var s = trim(prefFile.read());
                prefFile.close();
                return s;
            }
        } catch (e) {
            try { prefFile.close(); } catch (e2) {}
        }
        return '';
    }

    function saveLastRun(item) {
        try {
            prefFile.encoding = 'UTF-8';
            if (prefFile.open('w')) {
                prefFile.write(item.name);
                prefFile.close();
            }
        } catch (e) {
            try { prefFile.close(); } catch (e2) {}
        }
    }

    var lastRunName = loadLastRun();

    var win = new Window('dialog', TITLE, undefined, { resizeable: true });
    win.orientation = 'column';
    win.alignChildren = ['fill', 'top'];
    win.spacing = 8;
    win.margins = 12;
    win.minimumSize = [380, 340];

    var searchRow = win.add('group');
    searchRow.orientation = 'row';
    searchRow.alignChildren = ['fill', 'center'];
    searchRow.add('statictext', undefined, 'Search:');
    var searchBox = searchRow.add('edittext', undefined, '');
    searchBox.alignment = ['fill', 'center'];
    searchBox.active = true;

    var list = win.add('listbox', undefined, [], { multiselect: false });
    list.preferredSize = [380, 240];
    list.alignment = ['fill', 'fill'];

    var btnRow = win.add('group');
    btnRow.orientation = 'row';
    btnRow.alignChildren = ['fill', 'center'];
    btnRow.alignment = ['fill', 'bottom'];
    var runBtn = btnRow.add('button', undefined, 'Run');
    var refreshBtn = btnRow.add('button', undefined, 'Refresh');
    var openBtn = btnRow.add('button', undefined, 'Open Folder');
    var closeBtn = btnRow.add('button', undefined, 'Close');

    var statusTxt = win.add('statictext', undefined, '', { truncate: 'end' });
    statusTxt.alignment = ['fill', 'bottom'];

    win.defaultElement = runBtn;
    win.cancelElement = closeBtn;

    function filterText() {
        return trim(searchBox.text).toLowerCase();
    }

    function itemMatches(item, q) {
        if (!q) return true;
        return item.label.toLowerCase().indexOf(q) !== -1 ||
            item.name.toLowerCase().indexOf(q) !== -1;
    }

    function populate() {
        var q = filterText();
        var items = listScripts();
        var shown = 0;
        var selectIdx = -1;
        visibleItems = [];
        list.removeAll();

        for (var i = 0; i < items.length; i++) {
            if (!itemMatches(items[i], q)) continue;
            list.add('item', items[i].label);
            visibleItems.push(items[i]);
            if (lastRunName && items[i].name === lastRunName) {
                selectIdx = visibleItems.length - 1;
            }
            shown++;
        }

        if (shown === 0) {
            if (items.length === 0) {
                statusTxt.text = 'No scripts found in ' + (folder ? folder.fsName : '(unknown folder)');
            } else {
                statusTxt.text = 'No scripts match "' + searchBox.text + '"';
            }
            list.selection = null;
            return;
        }

        if (selectIdx < 0) selectIdx = 0;
        list.selection = selectIdx;

        var msg = shown + ' script' + (shown === 1 ? '' : 's');
        if (q) msg += ' matching "' + searchBox.text + '"';
        if (lastRunName) msg += '  -  Last run: ' + displayName(lastRunName);
        statusTxt.text = msg;
    }

    function selectedItem() {
        if (!list.selection) return null;
        var idx = list.selection.index;
        if (idx < 0 || idx >= visibleItems.length) return null;
        return visibleItems[idx];
    }

    function runSelected() {
        var item = selectedItem();
        if (!item) {
            alert('Select a script to run.', TITLE);
            return;
        }
        if (!item.file.exists) {
            alert(item.label + ' is no longer in this folder.\nRefresh and try again.', TITLE);
            return;
        }
        lastRunName = item.name;
        saveLastRun(item);
        pendingFile = item.file;
        win.close();
    }

    function openFolder() {
        if (!folder || !folder.exists) {
            alert('The scripts folder could not be found.', TITLE);
            return;
        }
        try {
            folder.execute();
        } catch (e) {
            try {
                app.system('explorer "' + folder.fsName + '"');
            } catch (e2) {
                alert('Could not open folder:\n' + folder.fsName, TITLE);
            }
        }
    }

    searchBox.onChanging = populate;
    searchBox.onChange = populate;
    list.onDoubleClick = runSelected;
    runBtn.onClick = runSelected;
    refreshBtn.onClick = function () {
        lastRunName = loadLastRun() || lastRunName;
        populate();
    };
    openBtn.onClick = openFolder;
    closeBtn.onClick = function () { win.close(); };

    win.onResizing = win.onResize = function () { this.layout.resize(); };

    populate();
    win.center();
    win.show();

    if (pendingFile) {
        try {
            $.evalFile(pendingFile);
        } catch (e) {
            var msg = String(e.message || e);
            if (e.line) msg += ' (line ' + e.line + ')';
            alert('Failed to run ' + fileNameOf(pendingFile) + ':\n' + msg, TITLE);
        }
    }
})();
