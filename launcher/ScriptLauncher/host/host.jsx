// Script Launcher host functions (ExtendScript, ES3)
function sl_esc(s) {
    s = String(s);
    var out = '';
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), code = s.charCodeAt(i);
        if (c === '\\') out += '\\\\';
        else if (c === '"') out += '\\"';
        else if (c === '\n') out += '\\n';
        else if (c === '\r') out += '\\r';
        else if (c === '\t') out += '\\t';
        else if (code < 32) out += '\\u' + ('0000' + code.toString(16)).slice(-4);
        else out += c;
    }
    return '"' + out + '"';
}

function sl_listScripts(folderPath) {
    try {
        var f = new Folder(folderPath);
        if (!f.exists) return '{"ok":false,"error":' + sl_esc('Folder not found: ' + folderPath) + '}';
        var files = f.getFiles();
        var items = [];
        for (var i = 0; i < files.length; i++) {
            var it = files[i];
            if (!(it instanceof File)) continue; // top level only, no subfolders
            var name = decodeURI(it.name);
            if (name.charAt(0) === '_' || name.charAt(0) === '.') continue;
            if (!/\.(jsx|js|jsxbin)$/i.test(name)) continue;
            items.push('{"name":' + sl_esc(name) + ',"path":' + sl_esc(it.fsName) + '}');
        }
        return '{"ok":true,"folder":' + sl_esc(f.fsName) + ',"items":[' + items.join(',') + ']}';
    } catch (e) {
        return '{"ok":false,"error":' + sl_esc(String(e)) + '}';
    }
}

function sl_runScript(filePath) {
    try {
        var f = new File(filePath);
        if (!f.exists) return '{"ok":false,"error":' + sl_esc('File not found: ' + filePath) + '}';
        $.evalFile(f);
        return '{"ok":true}';
    } catch (e) {
        var msg = String(e.message || e);
        if (e.line) msg += ' (line ' + e.line + ')';
        return '{"ok":false,"error":' + sl_esc(msg) + '}';
    }
}

function sl_pickFolder(current) {
    try {
        var start = new Folder(current);
        var picked = start.exists ? start.selectDlg('Choose your scripts folder') : Folder.selectDialog('Choose your scripts folder');
        if (!picked) return '{"ok":false,"cancelled":true}';
        return '{"ok":true,"folder":' + sl_esc(picked.fsName) + '}';
    } catch (e) {
        return '{"ok":false,"error":' + sl_esc(String(e)) + '}';
    }
}
