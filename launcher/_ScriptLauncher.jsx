#target illustrator
#targetengine 'scriptLauncher'
// Quick Script Launcher - floating palette listing the .jsx/.js scripts in this script's folder.
// Files starting with "_" and subfolders are ignored. Run via File > Scripts > Other Script.

(function () {
    if (typeof $.global.__scriptLauncherWin !== 'undefined' && $.global.__scriptLauncherWin) {
        try { $.global.__scriptLauncherWin.show(); $.global.__scriptLauncherWin.active = true; return; } catch (e) {}
    }

    var folder = File($.fileName).parent;

    function displayName(file) {
        var n = file.replace(/\.(jsx|js|jsxbin)$/i, '');
        n = n.replace(/[_\-]+/g, ' ');
        n = n.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
        return n.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
    }

    function listScripts() {
        var out = [];
        var files = folder.getFiles();
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (!(f instanceof File)) continue;
            var name = decodeURI(f.name);
            if (name.charAt(0) === '_' || name.charAt(0) === '.') continue;
            if (!/\.(jsx|js|jsxbin)$/i.test(name)) continue;
            out.push({ file: f, label: displayName(name) });
        }
        out.sort(function (a, b) { return a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1; });
        return out;
    }

    var win = new Window('palette', 'Script Launcher', undefined, { resizeable: true });
    win.orientation = 'column';
    win.alignChildren = ['fill', 'top'];
    win.spacing = 4;
    win.margins = 8;

    var listGroup = win.add('group');
    listGroup.orientation = 'column';
    listGroup.alignChildren = ['fill', 'top'];
    listGroup.spacing = 3;

    var bottom = win.add('group');
    bottom.orientation = 'row';
    bottom.alignChildren = ['fill', 'center'];
    var refreshBtn = bottom.add('button', undefined, 'Refresh');
    var closeBtn = bottom.add('button', undefined, 'Close');
    var statusTxt = win.add('statictext', undefined, '', { truncate: 'end' });
    statusTxt.preferredSize.width = 200;

    function makeRunner(item) {
        return function () {
            try {
                statusTxt.text = 'Running ' + item.label + '...';
                $.evalFile(item.file);
                statusTxt.text = 'Ran ' + item.label;
            } catch (e) {
                var msg = String(e.message || e);
                if (e.line) msg += ' (line ' + e.line + ')';
                statusTxt.text = item.label + ' failed';
                alert(item.label + ' failed:\n' + msg);
            }
        };
    }

    function build() {
        while (listGroup.children.length) listGroup.remove(listGroup.children[0]);
        var items = listScripts();
        if (!items.length) {
            listGroup.add('statictext', undefined, 'No scripts found in ' + folder.fsName);
        }
        for (var i = 0; i < items.length; i++) {
            var b = listGroup.add('button', undefined, items[i].label);
            b.helpTip = items[i].file.fsName;
            b.preferredSize.width = 200;
            b.onClick = makeRunner(items[i]);
        }
        statusTxt.text = items.length + ' script' + (items.length === 1 ? '' : 's');
        win.layout.layout(true);
    }

    refreshBtn.onClick = build;
    closeBtn.onClick = function () { win.close(); };
    win.onClose = function () { $.global.__scriptLauncherWin = null; };
    win.onResizing = win.onResize = function () { this.layout.resize(); };

    build();
    $.global.__scriptLauncherWin = win;
    win.show();
})();
