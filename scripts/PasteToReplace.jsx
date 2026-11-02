#target illustrator
/*
 * PasteToReplace.jsx  -  "Paste to Replace" for Adobe Illustrator
 * ---------------------------------------------------------------
 * HOW TO USE
 *   Clipboard mode (default):
 *     1. Copy the replacement artwork (Ctrl+C).
 *     2. Select the object(s) you want to replace.
 *     3. File > Scripts > Other Script... > PasteToReplace.jsx (or run it from your Scripts menu).
 *   Topmost-object mode:
 *     1. Select the replacement artwork AND the objects to replace.
 *        The frontmost (top of the stacking order) selected object is used as the source.
 *     2. Run the script and choose "Topmost selected object" as the source.
 *
 *   Each target is replaced by a copy of the source, placed in the target's layer/group
 *   just above it (stacking order kept), aligned on the chosen reference point and sized
 *   with the chosen size mode. Locked or hidden targets are skipped.
 *   Settings can be remembered in PasteToReplace_settings.json next to this script.
 *
 * ExtendScript (ES3). Tested for syntax only; behaviour can vary slightly by Illustrator version.
 */
(function () {
    var SCRIPT_NAME = 'Paste to Replace';
    var SETTINGS_FILE_NAME = 'PasteToReplace_settings.json';

    var SIZE_MODES = ['Keep original size', 'Match target width', 'Match target height',
                      'Fit inside target (proportional)', 'Stretch to target bounds'];

    var DEFAULTS = {
        source: 'clipboard',      // 'clipboard' | 'topmost'
        anchor: 4,                // 0..8, 3x3 grid read left-to-right, top-to-bottom (4 = center)
        sizeMode: 0,              // index into SIZE_MODES
        visibleBounds: false,     // true = include stroke width (visibleBounds)
        scaleStrokes: false,      // scale stroke weights / effects when resizing
        deleteTargets: true,      // false = hide targets instead
        copyStyle: false,         // copy target fill & stroke onto simple-path replacements
        keepName: true,           // give replacement the target's name
        keepSource: true,         // topmost mode: keep the source object
        rememberSettings: false
    };

    // ------------------------------------------------------------------
    // Generic helpers
    // ------------------------------------------------------------------
    function copyObj(o) { var r = {}; for (var k in o) { if (o.hasOwnProperty(k)) { r[k] = o[k]; } } return r; }
    function num(v) { var n = Math.round(Number(v) * 10000) / 10000; return isNaN(n) ? '0' : String(n); }

    function serialize(o) {
        var parts = [];
        for (var k in o) {
            if (!o.hasOwnProperty(k)) { continue; }
            var v = o[k], s;
            if (typeof v === 'string') { s = '"' + v.replace(/["\\]/g, '') + '"'; }
            else if (typeof v === 'boolean') { s = v ? 'true' : 'false'; }
            else { s = num(v); }
            parts.push('  "' + k + '": ' + s);
        }
        return '{\n' + parts.join(',\n') + '\n}\n';
    }

    function parseSettings(text, template) {
        var out = {};
        var re = /"(\w+)"\s*:\s*("[^"]*"|true|false|-?\d+(?:\.\d+)?)/g;
        var m;
        while ((m = re.exec(text)) !== null) {
            var k = m[1], raw = m[2];
            if (!template.hasOwnProperty(k)) { continue; }
            var t = typeof template[k];
            if (t === 'boolean') { out[k] = (raw === 'true'); }
            else if (t === 'number') { var n = parseFloat(raw); if (!isNaN(n)) { out[k] = n; } }
            else if (t === 'string' && raw.charAt(0) === '"') { out[k] = raw.substring(1, raw.length - 1); }
        }
        return out;
    }

    function settingsFiles() {
        var list = [];
        try { list.push(new File(File($.fileName).parent.fsName + '/' + SETTINGS_FILE_NAME)); } catch (e) { }
        try { list.push(new File(Folder.userData + '/' + SETTINGS_FILE_NAME)); } catch (e2) { }
        return list;
    }

    function loadSettings() {
        var S = copyObj(DEFAULTS);
        var files = settingsFiles();
        for (var i = 0; i < files.length; i++) {
            try {
                var f = files[i];
                if (!f.exists) { continue; }
                f.encoding = 'UTF-8';
                if (!f.open('r')) { continue; }
                var txt = f.read();
                f.close();
                var saved = parseSettings(txt, DEFAULTS);
                if (saved.rememberSettings !== true) { return S; }
                for (var k in saved) { if (saved.hasOwnProperty(k)) { S[k] = saved[k]; } }
                if (S.source !== 'topmost') { S.source = 'clipboard'; }
                S.anchor = Math.max(0, Math.min(8, Math.round(S.anchor)));
                S.sizeMode = Math.max(0, Math.min(SIZE_MODES.length - 1, Math.round(S.sizeMode)));
                return S;
            } catch (e) { }
        }
        return S;
    }

    function saveSettings(S) {
        var data = S.rememberSettings ? copyObj(S) : { rememberSettings: false };
        var files = settingsFiles();
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            // Only overwrite the fallback file if it exists or the first location failed.
            try {
                f.encoding = 'UTF-8';
                if (f.open('w')) {
                    f.write(serialize(data));
                    f.close();
                    return;
                }
            } catch (e) { }
        }
    }

    // ------------------------------------------------------------------
    // Illustrator helpers
    // ------------------------------------------------------------------
    function sameItem(a, b) {
        if (a === b) { return true; }
        try { if (a.uuid && b.uuid) { return a.uuid === b.uuid; } } catch (e) { }
        return false;
    }

    function isEditable(item) {
        // Walk up the parent chain: item, groups, layers, sublayers
        var p = item, guard = 0;
        while (p && guard < 200) {
            guard++;
            var t = '';
            try { t = p.typename; } catch (e) { return false; }
            if (t === 'Document') { return true; }
            if (t === 'Layer') {
                try { if (p.locked || !p.visible) { return false; } } catch (e1) { }
            } else {
                try { if (p.locked) { return false; } } catch (e2) { }
                try { if (p.hidden) { return false; } } catch (e3) { }
            }
            try { p = p.parent; } catch (e4) { return true; }
        }
        return true;
    }

    function isAncestor(anc, item) {
        var p, guard = 0;
        try { p = item.parent; } catch (e) { return false; }
        while (p && guard < 200) {
            guard++;
            if (sameItem(p, anc)) { return true; }
            try { if (p.typename === 'Document') { return false; } p = p.parent; } catch (e2) { return false; }
        }
        return false;
    }

    // A path inside a compound path cannot be replaced on its own: use the compound path.
    function normalizeTarget(item) {
        try {
            if (item.parent && item.parent.typename === 'CompoundPathItem') { return item.parent; }
        } catch (e) { }
        return item;
    }

    // Bounds [left, top, right, bottom]; clip groups use their clipping path.
    function getBounds(item, useVisible) {
        try {
            if (item.typename === 'GroupItem' && item.clipped) {
                for (var i = 0; i < item.pageItems.length; i++) {
                    var c = item.pageItems[i];
                    var isClip = false;
                    try {
                        if (c.typename === 'PathItem' && c.clipping) { isClip = true; }
                        else if (c.typename === 'CompoundPathItem' && c.pathItems.length && c.pathItems[0].clipping) { isClip = true; }
                    } catch (eC) { }
                    if (isClip) { return useVisible ? c.visibleBounds : c.geometricBounds; }
                }
            }
        } catch (e) { }
        return useVisible ? item.visibleBounds : item.geometricBounds;
    }

    function zOf(item) {
        try { var z = item.absoluteZOrderPosition; return (typeof z === 'number') ? z : null; } catch (e) { return null; }
    }

    function pickTopmost(items) {
        var best = null, bestZ = null, allZ = true;
        for (var i = 0; i < items.length; i++) {
            var z = zOf(items[i]);
            if (z === null) { allZ = false; break; }
            if (bestZ === null || z > bestZ) { bestZ = z; best = items[i]; }
        }
        // Illustrator lists the selection front-to-back, so [0] is the fallback.
        return (allZ && best) ? best : items[0];
    }

    // --- fill/stroke copy for simple paths ---
    function styleSourceOf(item) {
        if (item.typename === 'PathItem') { return item; }
        if (item.typename === 'CompoundPathItem' && item.pathItems.length) { return item.pathItems[0]; }
        return null;
    }

    function styleTargetsOf(item) {
        if (item.typename === 'PathItem') { return [item]; }
        if (item.typename === 'CompoundPathItem') {
            var r = [];
            for (var i = 0; i < item.pathItems.length; i++) { r.push(item.pathItems[i]); }
            return r;
        }
        return null;
    }

    function copyStyle(fromItem, toItem) {
        var src = styleSourceOf(fromItem);
        var dests = styleTargetsOf(toItem);
        if (!src || !dests) { return false; }
        for (var i = 0; i < dests.length; i++) {
            var d = dests[i];
            try { d.filled = src.filled; if (src.filled) { d.fillColor = src.fillColor; } } catch (e1) { }
            try {
                d.stroked = src.stroked;
                if (src.stroked) {
                    d.strokeColor = src.strokeColor;
                    d.strokeWidth = src.strokeWidth;
                    try { d.strokeCap = src.strokeCap; } catch (e2) { }
                    try { d.strokeJoin = src.strokeJoin; } catch (e3) { }
                    try { d.strokeMiterLimit = src.strokeMiterLimit; } catch (e4) { }
                    try { d.strokeDashes = src.strokeDashes; d.strokeDashOffset = src.strokeDashOffset; } catch (e5) { }
                }
            } catch (e6) { }
        }
        return true;
    }

    // --- sizing & alignment ---
    function resizeTo(item, tb, S) {
        if (S.sizeMode === 0) { return; }
        // Two passes so visible-bounds (stroke) differences converge.
        for (var pass = 0; pass < 2; pass++) {
            var sb = getBounds(item, S.visibleBounds);
            var sw = sb[2] - sb[0], sh = sb[1] - sb[3];
            var tw = tb[2] - tb[0], th = tb[1] - tb[3];
            var sx = 1, sy = 1;
            var okW = sw > 0.0001 && tw > 0.0001, okH = sh > 0.0001 && th > 0.0001;
            switch (S.sizeMode) {
                case 1: if (okW) { sx = sy = tw / sw; } break;
                case 2: if (okH) { sx = sy = th / sh; } break;
                case 3:
                    if (okW && okH) { sx = sy = Math.min(tw / sw, th / sh); }
                    else if (okW) { sx = sy = tw / sw; }
                    else if (okH) { sx = sy = th / sh; }
                    break;
                case 4: if (okW) { sx = tw / sw; } if (okH) { sy = th / sh; } break;
            }
            if (Math.abs(sx - 1) < 0.0001 && Math.abs(sy - 1) < 0.0001) { return; }
            var lw = S.scaleStrokes ? Math.sqrt(sx * sy) * 100 : 100;
            item.resize(sx * 100, sy * 100, true, true, true, true, lw, Transformation.CENTER);
            if (!S.visibleBounds) { return; }
        }
    }

    function anchorPoint(b, anchor) {
        var ax = (anchor % 3) / 2;              // 0, .5, 1 (left -> right)
        var ay = Math.floor(anchor / 3) / 2;    // 0, .5, 1 (top -> bottom)
        return [b[0] + ax * (b[2] - b[0]), b[1] - ay * (b[1] - b[3])];
    }

    function alignTo(item, tb, S) {
        var sb = getBounds(item, S.visibleBounds);
        var tp = anchorPoint(tb, S.anchor), sp = anchorPoint(sb, S.anchor);
        var dx = tp[0] - sp[0], dy = tp[1] - sp[1];
        if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) { item.translate(dx, dy); }
    }

    // ------------------------------------------------------------------
    // Dialog
    // ------------------------------------------------------------------
    function showDialog(S, selCount) {
        var w = new Window('dialog', SCRIPT_NAME + '  (' + selCount + ' selected)');
        w.orientation = 'column';
        w.alignChildren = ['fill', 'top'];

        var pSrc = w.add('panel', undefined, 'Source');
        pSrc.orientation = 'column'; pSrc.alignChildren = ['left', 'top'];
        var rClip = pSrc.add('radiobutton', undefined, 'Clipboard (copy with Ctrl+C first)');
        var rTop = pSrc.add('radiobutton', undefined, 'Topmost selected object (rest are targets)');
        var cKeepSrc = pSrc.add('checkbox', undefined, 'Keep the source object');
        rClip.value = (S.source !== 'topmost'); rTop.value = (S.source === 'topmost');
        cKeepSrc.value = S.keepSource;
        function syncSrc() { cKeepSrc.enabled = rTop.value; }
        rClip.onClick = syncSrc; rTop.onClick = syncSrc; syncSrc();

        var row = w.add('group'); row.orientation = 'row'; row.alignChildren = ['fill', 'top'];

        var pAl = row.add('panel', undefined, 'Alignment');
        pAl.orientation = 'column'; pAl.alignChildren = ['center', 'top'];
        var grid = [];
        function pickAnchor(idx) { for (var j = 0; j < grid.length; j++) { grid[j].value = (j === idx); } }
        for (var r = 0; r < 3; r++) {
            var g = pAl.add('group'); g.spacing = 10;
            for (var c = 0; c < 3; c++) {
                var rb = g.add('radiobutton', undefined, '');
                rb.idx = r * 3 + c;
                rb.onClick = function () { pickAnchor(this.idx); };
                grid.push(rb);
            }
        }
        pickAnchor(S.anchor);
        var stAl = pAl.add('statictext', undefined, 'Reference point');
        stAl.justify = 'center';

        var pSz = row.add('panel', undefined, 'Size');
        pSz.orientation = 'column'; pSz.alignChildren = ['fill', 'top'];
        var ddSize = pSz.add('dropdownlist', undefined, SIZE_MODES);
        ddSize.selection = S.sizeMode;
        var cVis = pSz.add('checkbox', undefined, 'Include stroke width in bounds');
        cVis.value = S.visibleBounds;
        var cScl = pSz.add('checkbox', undefined, 'Scale strokes && effects');
        cScl.value = S.scaleStrokes;

        var pT = w.add('panel', undefined, 'Targets');
        pT.orientation = 'column'; pT.alignChildren = ['left', 'top'];
        var gT = pT.add('group');
        var rDel = gT.add('radiobutton', undefined, 'Delete targets');
        var rHide = gT.add('radiobutton', undefined, 'Hide targets');
        rDel.value = S.deleteTargets; rHide.value = !S.deleteTargets;
        var cStyle = pT.add('checkbox', undefined, 'Copy target fill && stroke (simple paths only)');
        cStyle.value = S.copyStyle;
        var cName = pT.add('checkbox', undefined, 'Keep target name');
        cName.value = S.keepName;

        var cRem = w.add('checkbox', undefined, 'Remember my settings');
        cRem.value = S.rememberSettings;

        var gB = w.add('group'); gB.alignment = ['right', 'top'];
        gB.add('button', undefined, 'Cancel', { name: 'cancel' });
        gB.add('button', undefined, 'Replace', { name: 'ok' });

        if (w.show() !== 1) { return null; }

        var R = copyObj(S);
        R.source = rTop.value ? 'topmost' : 'clipboard';
        R.keepSource = cKeepSrc.value;
        R.anchor = 4;
        for (var k = 0; k < grid.length; k++) { if (grid[k].value) { R.anchor = k; } }
        R.sizeMode = ddSize.selection ? ddSize.selection.index : 0;
        R.visibleBounds = cVis.value;
        R.scaleStrokes = cScl.value;
        R.deleteTargets = rDel.value;
        R.copyStyle = cStyle.value;
        R.keepName = cName.value;
        R.rememberSettings = cRem.value;
        return R;
    }

    // ------------------------------------------------------------------
    // Main
    // ------------------------------------------------------------------
    function getSelectionArray(doc) {
        var sel = doc.selection;
        if (!sel) { return []; }
        if (sel.typename === 'TextRange') { return null; }
        if (!(sel instanceof Array)) { try { if (typeof sel.length !== 'number') { return [sel]; } } catch (e) { return [sel]; } }
        var out = [];
        for (var i = 0; i < sel.length; i++) { out.push(sel[i]); }
        return out;
    }

    function cleanTargets(items) {
        var t = [], i, j, skipped = 0;
        for (i = 0; i < items.length; i++) {
            var it = normalizeTarget(items[i]);
            var dup = false;
            for (j = 0; j < t.length; j++) { if (sameItem(t[j], it)) { dup = true; break; } }
            if (dup) { continue; }
            if (!isEditable(it)) { skipped++; continue; }
            t.push(it);
        }
        // Drop items whose ancestor is also a target.
        var out = [];
        for (i = 0; i < t.length; i++) {
            var nested = false;
            for (j = 0; j < t.length; j++) { if (i !== j && isAncestor(t[j], t[i])) { nested = true; break; } }
            if (!nested) { out.push(t[i]); }
        }
        return { items: out, skipped: skipped };
    }

    function pasteFromClipboard(doc, refTarget) {
        // Make sure the active layer can receive the paste.
        try {
            var lay = refTarget.layer;
            if (lay && !lay.locked && lay.visible) { doc.activeLayer = lay; }
        } catch (e) { }
        doc.selection = null;
        try { app.paste(); } catch (eP) { return { error: 'Paste failed: ' + eP }; }
        var pasted = getSelectionArray(doc);
        if (!pasted || !pasted.length) { return { error: 'The clipboard is empty or holds nothing Illustrator can paste.\nCopy the replacement artwork with Ctrl+C first.' }; }
        if (pasted.length === 1) { return { item: pasted[0], temp: pasted[0] }; }
        // Several pasted objects: group them (keeps their stacking order).
        var parent = pasted[0].parent;
        var grp;
        try { grp = parent.groupItems.add(); } catch (eG) { grp = pasted[0].layer.groupItems.add(); }
        grp.move(pasted[0], ElementPlacement.PLACEBEFORE);
        for (var i = 0; i < pasted.length; i++) { pasted[i].move(grp, ElementPlacement.PLACEATEND); }
        return { item: grp, temp: grp };
    }

    function main() {
        if (app.documents.length === 0) { alert('Open a document first.', SCRIPT_NAME); return; }
        var doc = app.activeDocument;
        var sel = getSelectionArray(doc);
        if (sel === null) { alert('You are editing text. Press Esc to leave text editing, select the objects to replace, and run again.', SCRIPT_NAME); return; }
        if (!sel.length) { alert('Select the object(s) you want to replace first.', SCRIPT_NAME); return; }

        var S = showDialog(loadSettings(), sel.length);
        if (!S) { return; }
        saveSettings(S);

        var source = null, tempSource = null, candidates = sel;
        if (S.source === 'topmost') {
            if (sel.length < 2) { alert('Topmost mode needs at least two selected objects: the source on top and one or more targets.', SCRIPT_NAME); return; }
            source = normalizeTarget(pickTopmost(sel));
            candidates = [];
            for (var i = 0; i < sel.length; i++) {
                var c = normalizeTarget(sel[i]);
                if (sameItem(c, source) || isAncestor(source, c) || isAncestor(c, source)) { continue; }
                candidates.push(c);
            }
        }

        var ct = cleanTargets(candidates);
        var targets = ct.items;
        if (!targets.length) {
            alert('No usable targets found' + (ct.skipped ? ' (' + ct.skipped + ' locked or hidden item(s) skipped).' : '.'), SCRIPT_NAME);
            return;
        }

        if (S.source === 'clipboard') {
            var p = pasteFromClipboard(doc, targets[0]);
            if (p.error) { doc.selection = null; try { doc.selection = targets; } catch (eS) { } alert(p.error, SCRIPT_NAME); return; }
            source = p.item; tempSource = p.temp;
        }

        var made = [], errors = 0, firstErr = '';
        for (var t = 0; t < targets.length; t++) {
            var tg = targets[t];
            try {
                var tb = getBounds(tg, S.visibleBounds);
                var tName = ''; try { tName = tg.name; } catch (eN) { }
                var dupItem = source.duplicate(tg, ElementPlacement.PLACEBEFORE);
                resizeTo(dupItem, tb, S);
                alignTo(dupItem, tb, S);
                if (S.copyStyle) { copyStyle(tg, dupItem); }
                if (S.keepName && tName) { try { dupItem.name = tName; } catch (eNm) { } }
                try { dupItem.hidden = false; } catch (eH) { }
                if (S.deleteTargets) { tg.remove(); } else { tg.hidden = true; }
                made.push(dupItem);
            } catch (e) {
                errors++;
                if (!firstErr) { firstErr = String(e) + (e.line ? ' (line ' + e.line + ')' : ''); }
            }
        }

        if (tempSource) { try { tempSource.remove(); } catch (eR) { } }
        if (S.source === 'topmost' && !S.keepSource) { try { source.remove(); } catch (eR2) { } }

        doc.selection = null;
        if (made.length) { try { doc.selection = made; } catch (eSel) { } }
        app.redraw();

        var msg = 'Replaced ' + made.length + ' object' + (made.length === 1 ? '' : 's') + '.';
        if (ct.skipped) { msg += '\nSkipped ' + ct.skipped + ' locked or hidden item(s).'; }
        if (errors) { msg += '\n' + errors + ' item(s) failed: ' + firstErr; }
        alert(msg, SCRIPT_NAME);
    }

    try { main(); }
    catch (err) { alert('Error: ' + err + (err.line ? '\n(line ' + err.line + ')' : ''), SCRIPT_NAME); }
})();
