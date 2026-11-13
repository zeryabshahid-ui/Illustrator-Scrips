// PS Script Launcher host functions (Photoshop ExtendScript, ES3)
function psl_esc(s) {
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

function psl_listScripts(folderPath) {
    try {
        var f = new Folder(folderPath);
        if (!f.exists) return '{"ok":false,"error":' + psl_esc('Folder not found: ' + folderPath) + '}';
        var files = f.getFiles();
        var items = [];
        for (var i = 0; i < files.length; i++) {
            var it = files[i];
            if (!(it instanceof File)) continue;
            var name = decodeURI(it.name);
            if (name.charAt(0) === '_' || name.charAt(0) === '.') continue;
            if (!/\.(jsx|js)$/i.test(name)) continue;
            items.push('{"name":' + psl_esc(name) + ',"path":' + psl_esc(it.fsName) + '}');
        }
        return '{"ok":true,"folder":' + psl_esc(f.fsName) + ',"items":[' + items.join(',') + ']}';
    } catch (e) {
        return '{"ok":false,"error":' + psl_esc(String(e.message || e)) + '}';
    }
}

function psl_resolveFolder(preferred) {
    try {
        if (!preferred) return '{"ok":false}';
        var f = new Folder(preferred);
        if (f.exists) return '{"ok":true,"folder":' + psl_esc(f.fsName) + '}';
        return '{"ok":false}';
    } catch (e) {
        return '{"ok":false,"error":' + psl_esc(String(e.message || e)) + '}';
    }
}

function psl_pickFolder(current) {
    try {
        var picked = null;
        if (current) {
            var start = new Folder(current);
            picked = start.exists ? start.selectDlg('Choose your Photoshop scripts folder') : Folder.selectDialog('Choose your Photoshop scripts folder');
        } else {
            picked = Folder.selectDialog('Choose your Photoshop scripts folder');
        }
        if (!picked) return '{"ok":false,"cancelled":true}';
        return '{"ok":true,"folder":' + psl_esc(picked.fsName) + '}';
    } catch (e) {
        return '{"ok":false,"error":' + psl_esc(String(e.message || e)) + '}';
    }
}

function psl_openFolder(folderPath) {
    try {
        var f = new Folder(folderPath);
        if (!f.exists) return '{"ok":false,"error":' + psl_esc('Folder not found: ' + folderPath) + '}';
        f.execute();
        return '{"ok":true}';
    } catch (e) {
        return '{"ok":false,"error":' + psl_esc(String(e.message || e)) + '}';
    }
}
