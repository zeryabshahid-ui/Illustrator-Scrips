#target photoshop
/*
 * Export Selected Artboards - Adobe Photoshop script (ES3)
 * ---------------------------------------------------------------
 * Exports artboards from the active document as PDF, TIFF, PSB, PNG
 * and/or JPG. The dialog lists every artboard; those selected in the
 * Layers panel are pre-checked. If none are selected, all are
 * pre-checked. If the document has no artboards, the script tells
 * you and stops.
 *
 * v3 dialog: two columns. Left = artboard list with a filter box,
 * Select All/None, Reset Names and an editable name per artboard (the
 * edited name becomes the file name; optionally the artboard is renamed
 * in the document too). Right = formats, output folder, options that
 * only appear for the formats you tick, a file name preview, and an
 * Export button that shows how many files will be written.
 *
 * For each artboard the script duplicates the document, deletes the
 * other top-level layers and artboards, crops to the artboard bounds,
 * saves each chosen format, then closes the duplicate without saving.
 * The original document is left untouched.
 *
 * Install (pick one):
 *   1. In Photoshop: File > Scripts > Browse... and choose this file.
 *   2. Copy this file into Photoshop's Presets/Scripts folder, then
 *      restart Photoshop so it appears under File > Scripts. You can
 *      assign a keyboard shortcut via:
 *      Edit > Keyboard Shortcuts > Application Menus > File > Scripts
 *   3. Or keep it in the same folder as _PSScriptLauncher.jsx and run
 *      it from the launcher.
 *
 * Free to use.
 * Built by Zeryab Shahid with the help of AI
 */
(function () {
    var TITLE = 'Export Selected Artboards';
    var SETTINGS_DIR_NAME = 'ZeryabExportArtboards';
    var SETTINGS_FILE_NAME = 'settings.json';

    if (!app.documents.length) {
        alert('Open a document first.', TITLE);
        return;
    }

    var originalDoc = app.activeDocument;

    function s2t(id) { return stringIDToTypeID(id); }
    function c2t(id) { return charIDToTypeID(id); }

    function trim(s) {
        return String(s).replace(/^\s+|\s+$/g, '');
    }

    function hasOwn(obj, key) {
        return obj && typeof obj === 'object' && obj.hasOwnProperty(key);
    }

    function jsonEscape(str) {
        var s = String(str);
        var out = '"';
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i);
            var n = s.charCodeAt(i);
            if (c === '"') out += '\\"';
            else if (c === '\\') out += '\\\\';
            else if (c === '\n') out += '\\n';
            else if (c === '\r') out += '\\r';
            else if (c === '\t') out += '\\t';
            else if (n < 32) {
                var hex = n.toString(16);
                while (hex.length < 4) hex = '0' + hex;
                out += '\\u' + hex;
            } else out += c;
        }
        return out + '"';
    }

    function toJSON(v) {
        if (v === null) return 'null';
        var t = typeof v;
        if (t === 'number') return isFinite(v) ? String(v) : 'null';
        if (t === 'boolean') return v ? 'true' : 'false';
        if (t === 'string') return jsonEscape(v);
        if (t === 'object') {
            var i, parts;
            if (v instanceof Array) {
                parts = [];
                for (i = 0; i < v.length; i++) parts.push(toJSON(v[i]));
                return '[' + parts.join(',') + ']';
            }
            parts = [];
            for (var k in v) {
                if (!hasOwn(v, k)) continue;
                if (typeof v[k] === 'undefined' || typeof v[k] === 'function') continue;
                parts.push(jsonEscape(k) + ':' + toJSON(v[k]));
            }
            return '{' + parts.join(',') + '}';
        }
        return 'null';
    }

    function parseJSON(text) {
        var s = String(text);
        var i = 0;
        function eatWs() {
            while (i < s.length && ' \t\r\n'.indexOf(s.charAt(i)) !== -1) i++;
        }
        function fail(msg) {
            throw new Error('Settings JSON: ' + msg);
        }
        function parseString() {
            if (s.charAt(i) !== '"') fail('expected string');
            i++;
            var out = '';
            while (i < s.length) {
                var c = s.charAt(i++);
                if (c === '"') return out;
                if (c === '\\') {
                    var e = s.charAt(i++);
                    if (e === '"' || e === '\\' || e === '/') out += e;
                    else if (e === 'b') out += '\b';
                    else if (e === 'f') out += '\f';
                    else if (e === 'n') out += '\n';
                    else if (e === 'r') out += '\r';
                    else if (e === 't') out += '\t';
                    else if (e === 'u') {
                        var hex = s.substring(i, i + 4);
                        i += 4;
                        out += String.fromCharCode(parseInt(hex, 16));
                    } else out += e;
                } else out += c;
            }
            fail('unterminated string');
        }
        function parseNumber() {
            var start = i;
            if (s.charAt(i) === '-') i++;
            while (i < s.length && s.charAt(i) >= '0' && s.charAt(i) <= '9') i++;
            if (s.charAt(i) === '.') {
                i++;
                while (i < s.length && s.charAt(i) >= '0' && s.charAt(i) <= '9') i++;
            }
            if (s.charAt(i) === 'e' || s.charAt(i) === 'E') {
                i++;
                if (s.charAt(i) === '+' || s.charAt(i) === '-') i++;
                while (i < s.length && s.charAt(i) >= '0' && s.charAt(i) <= '9') i++;
            }
            var n = Number(s.substring(start, i));
            if (isNaN(n)) fail('number');
            return n;
        }
        function parseArray() {
            i++;
            var arr = [];
            eatWs();
            if (s.charAt(i) === ']') { i++; return arr; }
            while (i < s.length) {
                arr.push(parseValue());
                eatWs();
                if (s.charAt(i) === ',') { i++; eatWs(); continue; }
                if (s.charAt(i) === ']') { i++; return arr; }
                fail('array');
            }
            fail('unterminated array');
        }
        function parseObject() {
            i++;
            var obj = {};
            eatWs();
            if (s.charAt(i) === '}') { i++; return obj; }
            while (i < s.length) {
                eatWs();
                var key = parseString();
                eatWs();
                if (s.charAt(i) !== ':') fail('colon');
                i++;
                obj[key] = parseValue();
                eatWs();
                if (s.charAt(i) === ',') { i++; continue; }
                if (s.charAt(i) === '}') { i++; return obj; }
                fail('object');
            }
            fail('unterminated object');
        }
        function parseValue() {
            eatWs();
            var c = s.charAt(i);
            if (c === '"') return parseString();
            if (c === '{') return parseObject();
            if (c === '[') return parseArray();
            if (c === 't' && s.substring(i, i + 4) === 'true') { i += 4; return true; }
            if (c === 'f' && s.substring(i, i + 5) === 'false') { i += 5; return false; }
            if (c === 'n' && s.substring(i, i + 4) === 'null') { i += 4; return null; }
            if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
            fail('value');
        }
        var result = parseValue();
        eatWs();
        return result;
    }

    function settingsFolder() {
        return new Folder(Folder.userData + '/' + SETTINGS_DIR_NAME);
    }

    function settingsFile() {
        return new File(settingsFolder() + '/' + SETTINGS_FILE_NAME);
    }

    function defaultSettings() {
        return {
            pdf: true,
            tiff: false,
            psb: false,
            png: false,
            jpg: false,
            outFolder: '',
            pdfPreset: 'High Quality Print',
            tiffCompression: 'LZW',
            tiffKeepLayers: true,
            jpgQuality: 10,
            prefix: '',
            overwrite: false,
            renameInDoc: false
        };
    }

    function loadSettings() {
        var defs = defaultSettings();
        var f = settingsFile();
        if (!f.exists) return defs;
        try {
            f.encoding = 'UTF-8';
            if (!f.open('r')) return defs;
            var raw = f.read();
            f.close();
            var parsed = parseJSON(raw);
            if (!parsed || typeof parsed !== 'object') return defs;
            for (var k in defs) {
                if (!hasOwn(defs, k)) continue;
                if (hasOwn(parsed, k) && typeof parsed[k] !== 'undefined') defs[k] = parsed[k];
            }
        } catch (e) {
            try { f.close(); } catch (e2) {}
        }
        return defs;
    }

    function saveSettings(cfg) {
        try {
            var dir = settingsFolder();
            if (!dir.exists) dir.create();
            var f = settingsFile();
            f.encoding = 'UTF-8';
            if (f.open('w')) {
                f.write(toJSON(cfg));
                f.close();
            }
        } catch (e) {
            try { settingsFile().close(); } catch (e2) {}
        }
    }

    function hasBackgroundLayer(doc) {
        try {
            return !!doc.backgroundLayer;
        } catch (e) {
            return false;
        }
    }

    function getLayerIdFromDOM(layer) {
        try {
            if (typeof layer.id === 'number') return layer.id;
        } catch (e) {}
        var ref = new ActionReference();
        ref.putProperty(s2t('property'), s2t('layerID'));
        ref.putIndex(s2t('layer'), layer.itemIndex);
        return executeActionGet(ref).getInteger(s2t('layerID'));
    }

    function getLayerDesc(id) {
        var ref = new ActionReference();
        ref.putIdentifier(s2t('layer'), id);
        return executeActionGet(ref);
    }

    function descHasTrue(desc, key) {
        var k = s2t(key);
        return desc.hasKey(k) && desc.getBoolean(k);
    }

    function getDescNumber(desc, sid, cid) {
        var k = s2t(sid);
        if (desc.hasKey(k)) {
            var t = desc.getType(k);
            if (t === DescValueType.DOUBLETYPE) return desc.getDouble(k);
            if (t === DescValueType.INTEGERTYPE) return desc.getInteger(k);
            if (t === DescValueType.UNITDOUBLE) return desc.getUnitDoubleValue(k);
        }
        if (cid) {
            k = c2t(cid);
            if (desc.hasKey(k)) {
                t = desc.getType(k);
                if (t === DescValueType.DOUBLETYPE) return desc.getDouble(k);
                if (t === DescValueType.INTEGERTYPE) return desc.getInteger(k);
                if (t === DescValueType.UNITDOUBLE) return desc.getUnitDoubleValue(k);
            }
        }
        return null;
    }

    function rectFromArtboardDesc(desc) {
        if (!desc.hasKey(s2t('artboard'))) return null;
        var ab = desc.getObjectValue(s2t('artboard'));
        if (!ab.hasKey(s2t('artboardRect'))) return null;
        var rec = ab.getObjectValue(s2t('artboardRect'));
        var left = getDescNumber(rec, 'left', 'Left');
        var top = getDescNumber(rec, 'top', 'Top ');
        var right = getDescNumber(rec, 'right', 'Rght');
        var bottom = getDescNumber(rec, 'bottom', 'Btom');
        if (left === null || top === null || right === null || bottom === null) return null;
        return { left: left, top: top, right: right, bottom: bottom };
    }

    function rectFromLayerBounds(layer) {
        var b = layer.bounds;
        return {
            left: b[0].as('px'),
            top: b[1].as('px'),
            right: b[2].as('px'),
            bottom: b[3].as('px')
        };
    }

    function rectsClose(a, b) {
        if (!a || !b) return false;
        var keys = ['left', 'top', 'right', 'bottom'];
        for (var i = 0; i < keys.length; i++) {
            if (Math.abs(a[keys[i]] - b[keys[i]]) > 0.6) return false;
        }
        return true;
    }

    function validRect(r) {
        return r && (r.right - r.left) > 0.5 && (r.bottom - r.top) > 0.5;
    }

    function infoFromId(id) {
        var desc = getLayerDesc(id);
        var name = desc.hasKey(s2t('name')) ? desc.getString(s2t('name')) : 'Artboard';
        var isAB = descHasTrue(desc, 'artboardEnabled');
        var rect = isAB ? rectFromArtboardDesc(desc) : null;
        var parentId = null;
        if (desc.hasKey(s2t('parentLayerID'))) {
            parentId = desc.getInteger(s2t('parentLayerID'));
        }
        return { id: id, name: name, isArtboard: isAB, rect: rect, parentId: parentId };
    }

    function enclosingArtboard(id) {
        var guard = 0;
        var cur = id;
        var seen = {};
        while (cur && guard++ < 250) {
            if (seen[String(cur)]) break;
            seen[String(cur)] = true;
            var info = infoFromId(cur);
            if (info.isArtboard) return info;
            if (info.parentId === null || info.parentId === cur) break;
            cur = info.parentId;
        }
        return null;
    }

    function getSelectedLayerIDs() {
        var ids = [];
        try {
            var r = new ActionReference();
            r.putProperty(s2t('property'), s2t('targetLayersIDs'));
            r.putEnumerated(s2t('document'), s2t('ordinal'), s2t('targetEnum'));
            var desc = executeActionGet(r);
            if (desc.hasKey(s2t('targetLayersIDs'))) {
                var list = desc.getList(s2t('targetLayersIDs'));
                for (var i = 0; i < list.count; i++) {
                    ids.push(list.getReference(i).getIdentifier());
                }
                return ids;
            }
        } catch (e) {}

        try {
            var r2 = new ActionReference();
            r2.putProperty(s2t('property'), s2t('targetLayers'));
            r2.putEnumerated(s2t('document'), s2t('ordinal'), s2t('targetEnum'));
            var desc2 = executeActionGet(r2);
            if (!desc2.hasKey(s2t('targetLayers'))) return ids;
            var list2 = desc2.getList(s2t('targetLayers'));
            var bg = hasBackgroundLayer(app.activeDocument);
            for (var j = 0; j < list2.count; j++) {
                var idx = list2.getReference(j).getIndex();
                if (!bg) idx = idx + 1;
                var r3 = new ActionReference();
                r3.putProperty(s2t('property'), s2t('layerID'));
                r3.putIndex(s2t('layer'), idx);
                ids.push(executeActionGet(r3).getInteger(s2t('layerID')));
            }
        } catch (e2) {}
        return ids;
    }

    function uniqueArtboards(list) {
        var out = [];
        var seen = {};
        for (var i = 0; i < list.length; i++) {
            if (!list[i]) continue;
            var key = String(list[i].id);
            if (seen[key]) continue;
            seen[key] = true;
            if (!list[i].rect) {
                try {
                    var layer = findLayerById(app.activeDocument, list[i].id);
                    if (layer) list[i].rect = rectFromLayerBounds(layer);
                } catch (e) {}
            }
            out.push(list[i]);
        }
        return out;
    }

    function findLayerById(doc, id) {
        function walk(layers) {
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                var lid = null;
                try { lid = getLayerIdFromDOM(layer); } catch (e) { lid = null; }
                if (lid === id) return layer;
                if (layer.typename === 'LayerSet') {
                    var found = walk(layer.layers);
                    if (found) return found;
                }
            }
            return null;
        }
        return walk(doc.layers);
    }

    function getSelectedArtboards() {
        var ids = getSelectedLayerIDs();
        var found = [];
        for (var i = 0; i < ids.length; i++) {
            var info = infoFromId(ids[i]);
            if (info.isArtboard) found.push(info);
            else {
                var parentAB = enclosingArtboard(ids[i]);
                if (parentAB) found.push(parentAB);
            }
        }
        return uniqueArtboards(found);
    }

    function getAllArtboards(doc) {
        var found = [];
        var layers = doc.layers;
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var id;
            try { id = getLayerIdFromDOM(layer); } catch (e) { continue; }
            var info = infoFromId(id);
            if (!info.isArtboard) continue;
            if (!info.rect) {
                try { info.rect = rectFromLayerBounds(layer); } catch (e2) {}
            }
            found.push(info);
        }
        return found;
    }

    function defaultOutFolder(doc) {
        try {
            if (doc.fullName && doc.fullName.parent && doc.fullName.parent.exists) {
                return doc.fullName.parent;
            }
        } catch (e) {}
        try {
            var p = Folder(doc.path);
            if (p && p.exists) return p;
        } catch (e2) {}
        return Folder.desktop;
    }

    function sanitizeName(name) {
        var s = String(name);
        s = s.replace(/[<>:"\/\\|?*\x00-\x1f]/g, '_');
        s = s.replace(/[. ]+$/g, '');
        s = trim(s);
        if (!s) s = 'Artboard';
        if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(s)) s = s + '_';
        return s;
    }

    function applyPrefix(prefix, base) {
        prefix = trim(prefix);
        if (!prefix) return base;
        if (/[-_\s]$/.test(prefix)) return sanitizeName(prefix + base);
        return sanitizeName(prefix + '_' + base);
    }

    function uniqueFile(folder, base, ext, overwrite, used) {
        var n = 0;
        while (n < 10000) {
            var name = base + (n === 0 ? '' : '-' + n) + ext;
            var key = name.toLowerCase();
            var f = new File(folder.fsName + '/' + name);
            var taken = used[key] || (!overwrite && f.exists);
            if (!taken) {
                used[key] = true;
                return f;
            }
            if (overwrite && n === 0 && !used[key]) {
                used[key] = true;
                return f;
            }
            n++;
        }
        throw new Error('Could not build a unique file name for ' + base + ext);
    }

    function errText(e) {
        var msg = String((e && e.message) ? e.message : e);
        if (e && e.line) msg += ' (line ' + e.line + ')';
        return msg;
    }

    var allArtboards = getAllArtboards(originalDoc);
    if (!allArtboards.length) {
        alert('This document has no artboards to export.', TITLE);
        return;
    }
    var selectedArtboards = getSelectedArtboards();

    function showDialog(allBoards, selectedBoards, cfg) {
        var result = { go: false, settings: null, artboards: [], names: {}, renames: [] };
        var win = new Window('dialog', TITLE);
        win.orientation = 'column';
        win.alignChildren = ['fill', 'top'];
        win.spacing = 10;
        win.margins = 14;

        var shown = false;
        var bi;
        var selectedIds = {};
        for (bi = 0; bi < selectedBoards.length; bi++) {
            selectedIds[String(selectedBoards[bi].id)] = true;
        }
        var precheckAll = selectedBoards.length === 0;

        // Data model: one item per artboard. The list UI below is a fixed
        // pool of row "slots" that display a window into this model, so it
        // stays fast and tidy with 30+ (or 300+) artboards.
        var items = [];
        var nameEdits = {}; // layer ID (string) -> edited artboard name
        for (bi = 0; bi < allBoards.length; bi++) {
            items.push({
                board: allBoards[bi],
                checked: precheckAll ? true : !!selectedIds[String(allBoards[bi].id)],
                name: String(allBoards[bi].name)
            });
        }
        var filtered = [];
        for (bi = 0; bi < items.length; bi++) filtered.push(bi);

        var cols = win.add('group');
        cols.orientation = 'row';
        cols.alignChildren = ['fill', 'fill'];
        cols.spacing = 12;

        // ---------------- LEFT: artboards ----------------
        var abPanel = cols.add('panel', undefined, 'Artboards');
        abPanel.orientation = 'column';
        abPanel.alignChildren = ['fill', 'top'];
        abPanel.spacing = 6;
        abPanel.margins = [12, 16, 12, 10];

        var filterRow = abPanel.add('group');
        filterRow.orientation = 'row';
        filterRow.alignChildren = ['fill', 'center'];
        filterRow.add('statictext', undefined, 'Filter:');
        var filterBox = filterRow.add('edittext', undefined, '');
        filterBox.alignment = ['fill', 'center'];
        filterBox.preferredSize.width = 220;
        filterBox.helpTip = 'Type part of a name to show only matching artboards';
        var clearFilterBtn = filterRow.add('button', undefined, 'Clear');
        clearFilterBtn.preferredSize.width = 60;

        var abHead = abPanel.add('group');
        abHead.orientation = 'row';
        abHead.alignChildren = ['left', 'center'];
        var selAllBtn = abHead.add('button', undefined, 'Select All');
        var selNoneBtn = abHead.add('button', undefined, 'Select None');
        var resetNamesBtn = abHead.add('button', undefined, 'Reset Names');
        selAllBtn.helpTip = 'Tick every artboard shown in the list';
        selNoneBtn.helpTip = 'Untick every artboard shown in the list';
        resetNamesBtn.helpTip = 'Put every name back to the artboard\'s current name';

        var countLbl = abPanel.add('statictext', undefined, '0 of 0 selected');
        countLbl.alignment = ['fill', 'top'];
        countLbl.preferredSize.width = 300;

        var hintLbl = abPanel.add('statictext', undefined, 'Tick to export. Edit a name to set its file name.');
        hintLbl.alignment = ['fill', 'top'];

        var ROW_H = 26;
        var SLOTS = items.length;
        if (SLOTS < 6) SLOTS = 6;
        if (SLOTS > 14) SLOTS = 14;
        var listH = SLOTS * ROW_H;

        var listRow = abPanel.add('group');
        listRow.orientation = 'row';
        listRow.alignChildren = ['fill', 'top'];
        listRow.spacing = 4;

        var listFrame = listRow.add('panel');
        listFrame.orientation = 'column';
        listFrame.alignChildren = ['fill', 'top'];
        listFrame.alignment = ['fill', 'top'];
        listFrame.margins = [6, 6, 6, 6];
        listFrame.spacing = 2;
        listFrame.minimumSize.height = listH + 12;
        listFrame.preferredSize.height = listH + 12;

        var slots = [];
        var si;
        for (si = 0; si < SLOTS; si++) {
            var g = listFrame.add('group');
            g.orientation = 'row';
            g.alignChildren = ['left', 'center'];
            g.alignment = ['fill', 'top'];
            g.spacing = 6;
            g.margins = 0;
            g.preferredSize.height = ROW_H - 2;
            var cb = g.add('checkbox', undefined, '');
            cb.preferredSize.width = 20;
            var et = g.add('edittext', undefined, '');
            et.preferredSize.width = 230;
            var sz = g.add('statictext', undefined, '');
            sz.preferredSize.width = 90;
            var slot = { group: g, cb: cb, et: et, sz: sz, index: -1 };
            wireSlot(slot);
            slots.push(slot);
        }

        var scroll = listRow.add('scrollbar', undefined, 0, 0, 1);
        scroll.alignment = ['right', 'fill'];
        scroll.preferredSize = [16, listH + 12];
        scroll.stepdelta = 1;
        scroll.jumpdelta = SLOTS > 1 ? SLOTS - 1 : 1;
        scroll.onChanging = function () { renderRows(); };
        scroll.onChange = scroll.onChanging;

        var renameDocCb = abPanel.add('checkbox', undefined, 'Also rename artboards in the document');
        renameDocCb.value = !!cfg.renameInDoc;
        renameDocCb.helpTip = 'After exporting, rename the edited artboards in this document too.';

        // ---------------- RIGHT: formats / folder / options ----------------
        var right = cols.add('group');
        right.orientation = 'column';
        right.alignChildren = ['fill', 'top'];
        right.alignment = ['fill', 'fill'];
        right.spacing = 10;

        var fmtPanel = right.add('panel', undefined, 'Formats');
        fmtPanel.orientation = 'row';
        fmtPanel.alignChildren = ['left', 'center'];
        fmtPanel.spacing = 12;
        fmtPanel.margins = [12, 16, 12, 10];
        var pdfCb = fmtPanel.add('checkbox', undefined, 'PDF');
        var tiffCb = fmtPanel.add('checkbox', undefined, 'TIFF');
        var psbCb = fmtPanel.add('checkbox', undefined, 'PSB');
        var pngCb = fmtPanel.add('checkbox', undefined, 'PNG');
        var jpgCb = fmtPanel.add('checkbox', undefined, 'JPG');
        pdfCb.value = !!cfg.pdf;
        tiffCb.value = !!cfg.tiff;
        psbCb.value = !!cfg.psb;
        pngCb.value = !!cfg.png;
        jpgCb.value = !!cfg.jpg;

        var folderPanel = right.add('panel', undefined, 'Output folder');
        folderPanel.orientation = 'row';
        folderPanel.alignChildren = ['fill', 'center'];
        folderPanel.margins = [12, 16, 12, 10];
        var folderBox = folderPanel.add('edittext', undefined, cfg.outFolder);
        folderBox.alignment = ['fill', 'center'];
        folderBox.preferredSize.width = 250;
        var browseBtn = folderPanel.add('button', undefined, 'Browse...');

        var opt = right.add('panel', undefined, 'Format options');
        opt.orientation = 'column';
        opt.alignChildren = ['fill', 'top'];
        opt.spacing = 6;
        opt.margins = [12, 16, 12, 10];
        opt.minimumSize.height = 140;

        var pdfGroup = opt.add('group');
        pdfGroup.orientation = 'row';
        pdfGroup.alignChildren = ['left', 'center'];
        pdfGroup.add('statictext', undefined, 'PDF preset:');
        var presetNames = ['High Quality Print', 'High Quality', 'Medium', 'Smallest File Size'];
        var pdfPreset = pdfGroup.add('dropdownlist', undefined, presetNames);
        pdfPreset.selection = 0;
        for (var p = 0; p < presetNames.length; p++) {
            if (cfg.pdfPreset === presetNames[p]) pdfPreset.selection = p;
        }
        pdfPreset.preferredSize.width = 170;

        var tiffGroup = opt.add('group');
        tiffGroup.orientation = 'row';
        tiffGroup.alignChildren = ['left', 'center'];
        tiffGroup.add('statictext', undefined, 'TIFF compression:');
        var tiffComp = tiffGroup.add('dropdownlist', undefined, ['None', 'LZW', 'ZIP']);
        tiffComp.selection = 1;
        if (cfg.tiffCompression === 'None') tiffComp.selection = 0;
        else if (cfg.tiffCompression === 'ZIP') tiffComp.selection = 2;
        var tiffLayers = tiffGroup.add('checkbox', undefined, 'Keep layers');
        tiffLayers.value = cfg.tiffKeepLayers !== false;

        var jpgGroup = opt.add('group');
        jpgGroup.orientation = 'row';
        jpgGroup.alignChildren = ['left', 'center'];
        jpgGroup.add('statictext', undefined, 'JPG quality (0-12):');
        var jq = cfg.jpgQuality;
        if (typeof jq !== 'number' || isNaN(jq)) jq = 10;
        jq = Math.round(jq);
        if (jq < 0) jq = 0;
        if (jq > 12) jq = 12;
        var jpgSlider = jpgGroup.add('slider', undefined, jq, 0, 12);
        jpgSlider.preferredSize.width = 130;
        var jpgVal = jpgGroup.add('edittext', undefined, String(jq));
        jpgVal.preferredSize.width = 36;

        var noOptsLbl = opt.add('statictext', undefined, 'PNG and PSB need no extra options.');

        var namePanel = right.add('panel', undefined, 'File names');
        namePanel.orientation = 'column';
        namePanel.alignChildren = ['fill', 'top'];
        namePanel.spacing = 6;
        namePanel.margins = [12, 16, 12, 10];

        var prefixRow = namePanel.add('group');
        prefixRow.orientation = 'row';
        prefixRow.alignChildren = ['left', 'center'];
        prefixRow.add('statictext', undefined, 'Prefix (optional):');
        var prefixBox = prefixRow.add('edittext', undefined, cfg.prefix ? String(cfg.prefix) : '');
        prefixBox.alignment = ['fill', 'center'];
        prefixBox.preferredSize.width = 180;

        var overRow = namePanel.add('group');
        overRow.orientation = 'column';
        overRow.alignChildren = ['left', 'top'];
        overRow.spacing = 2;
        var autoRadio = overRow.add('radiobutton', undefined, 'Auto-number if the file exists');
        var overRadio = overRow.add('radiobutton', undefined, 'Overwrite existing files');
        autoRadio.value = !cfg.overwrite;
        overRadio.value = !!cfg.overwrite;

        var previewLbl = namePanel.add('statictext', undefined, 'Preview:');
        previewLbl.alignment = ['fill', 'top'];
        previewLbl.preferredSize.width = 330;

        // ---------------- buttons ----------------
        var btnRow = win.add('group');
        btnRow.alignment = ['right', 'bottom'];
        var cancelBtn = btnRow.add('button', undefined, 'Cancel');
        var okBtn = btnRow.add('button', undefined, 'Export 0 files');
        okBtn.preferredSize.width = 140;
        win.cancelElement = cancelBtn;

        // ---------------- behaviour ----------------
        function wireSlot(s) {
            s.cb.onClick = function () {
                if (s.index < 0) return;
                items[s.index].checked = !!s.cb.value;
                refreshCounts();
            };
            s.et.onChanging = function () {
                if (s.index < 0) return;
                setItemName(s.index, s.et.text);
                updatePreview();
            };
            s.et.onChange = s.et.onChanging;
        }

        function setItemName(idx, text) {
            var it = items[idx];
            it.name = String(text);
            var key = String(it.board.id);
            var t = trim(it.name);
            if (t && t !== it.board.name) nameEdits[key] = t;
            else delete nameEdits[key];
        }

        function sizeText(board) {
            var r = board.rect;
            if (!r) return '';
            return Math.round(r.right - r.left) + ' x ' + Math.round(r.bottom - r.top) + ' px';
        }

        function renderRows() {
            var off = Math.round(scroll.value);
            if (isNaN(off) || off < 0) off = 0;
            for (var k = 0; k < slots.length; k++) {
                var s = slots[k];
                var fi = off + k;
                if (fi < filtered.length) {
                    var idx = filtered[fi];
                    var it = items[idx];
                    s.index = idx;
                    s.cb.value = !!it.checked;
                    s.et.text = it.name;
                    s.et.helpTip = 'Artboard: ' + it.board.name;
                    s.cb.helpTip = it.board.name;
                    s.sz.text = sizeText(it.board);
                    s.group.visible = true;
                } else {
                    s.index = -1;
                    s.group.visible = false;
                }
            }
        }

        function applyFilter() {
            var q = trim(filterBox.text).toLowerCase();
            filtered = [];
            for (var k = 0; k < items.length; k++) {
                if (!q ||
                    String(items[k].board.name).toLowerCase().indexOf(q) !== -1 ||
                    String(items[k].name).toLowerCase().indexOf(q) !== -1) {
                    filtered.push(k);
                }
            }
            var maxOff = filtered.length - SLOTS;
            if (maxOff < 0) maxOff = 0;
            scroll.value = 0;
            scroll.maxvalue = maxOff > 0 ? maxOff : 1;
            scroll.enabled = maxOff > 0;
            renderRows();
            refreshCounts();
        }

        function currentFormats() {
            var list = [];
            if (pdfCb.value) list.push('PDF');
            if (tiffCb.value) list.push('TIFF');
            if (psbCb.value) list.push('PSB');
            if (pngCb.value) list.push('PNG');
            if (jpgCb.value) list.push('JPG');
            return list;
        }

        function checkedCount() {
            var n = 0;
            for (var k = 0; k < items.length; k++) if (items[k].checked) n++;
            return n;
        }

        function exportNameFor(it) {
            var t = trim(it.name);
            return t ? t : String(it.board.name);
        }

        function updatePreview() {
            var fmts = currentFormats();
            var first = null;
            for (var k = 0; k < items.length; k++) {
                if (items[k].checked) { first = items[k]; break; }
            }
            var text;
            if (!first) text = 'Preview: tick at least one artboard';
            else if (!fmts.length) text = 'Preview: choose at least one format';
            else {
                var base = applyPrefix(prefixBox.text, sanitizeName(exportNameFor(first)));
                var exts = [];
                for (var f = 0; f < fmts.length; f++) exts.push(extensionFor(fmts[f]));
                text = 'Preview: ' + base + exts[0];
                if (exts.length > 1) text += ', ' + exts.slice(1).join(', ');
            }
            previewLbl.text = text;
            previewLbl.helpTip = text;
        }

        function refreshCounts() {
            var n = checkedCount();
            var files = n * currentFormats().length;
            var txt = n + ' of ' + items.length + ' selected';
            if (filtered.length < items.length) txt += '  (' + filtered.length + ' shown)';
            countLbl.text = txt;
            okBtn.text = 'Export ' + files + ' file' + (files === 1 ? '' : 's');
            okBtn.enabled = files > 0;
            updatePreview();
        }

        function showEl(el, on) {
            el.visible = !!on;
            try { el.maximumSize.height = on ? 1000 : 0; } catch (eMs) {}
        }

        function syncOptions() {
            showEl(pdfGroup, pdfCb.value);
            showEl(tiffGroup, tiffCb.value);
            showEl(jpgGroup, jpgCb.value);
            showEl(noOptsLbl, !(pdfCb.value || tiffCb.value || jpgCb.value));
            if (shown) {
                try { win.layout.layout(true); } catch (eLay) {}
                renderRows();
            }
            refreshCounts();
        }

        pdfCb.onClick = tiffCb.onClick = psbCb.onClick = pngCb.onClick = jpgCb.onClick = syncOptions;

        filterBox.onChanging = applyFilter;
        filterBox.onChange = applyFilter;
        clearFilterBtn.onClick = function () {
            filterBox.text = '';
            applyFilter();
        };

        selAllBtn.onClick = function () {
            for (var k = 0; k < filtered.length; k++) items[filtered[k]].checked = true;
            renderRows();
            refreshCounts();
        };
        selNoneBtn.onClick = function () {
            for (var k = 0; k < filtered.length; k++) items[filtered[k]].checked = false;
            renderRows();
            refreshCounts();
        };
        resetNamesBtn.onClick = function () {
            for (var k = 0; k < items.length; k++) setItemName(k, items[k].board.name);
            renderRows();
            refreshCounts();
        };

        prefixBox.onChanging = updatePreview;
        prefixBox.onChange = updatePreview;

        jpgSlider.onChanging = function () {
            var v = Math.round(jpgSlider.value);
            jpgSlider.value = v;
            jpgVal.text = String(v);
        };
        jpgSlider.onChange = jpgSlider.onChanging;
        jpgVal.onChange = function () {
            var v = parseInt(jpgVal.text, 10);
            if (isNaN(v)) v = 10;
            if (v < 0) v = 0;
            if (v > 12) v = 12;
            jpgVal.text = String(v);
            jpgSlider.value = v;
        };

        browseBtn.onClick = function () {
            var start = Folder(folderBox.text);
            var picked;
            if (start && start.exists) picked = start.selectDlg('Choose export folder');
            else picked = Folder.selectDialog('Choose export folder');
            if (picked) folderBox.text = picked.fsName;
        };

        function gather() {
            var jpgQuality = parseInt(jpgVal.text, 10);
            if (isNaN(jpgQuality)) jpgQuality = Math.round(jpgSlider.value);
            if (jpgQuality < 0) jpgQuality = 0;
            if (jpgQuality > 12) jpgQuality = 12;
            return {
                pdf: !!pdfCb.value,
                tiff: !!tiffCb.value,
                psb: !!psbCb.value,
                png: !!pngCb.value,
                jpg: !!jpgCb.value,
                outFolder: trim(folderBox.text),
                pdfPreset: pdfPreset.selection ? pdfPreset.selection.text : 'High Quality Print',
                tiffCompression: tiffComp.selection ? tiffComp.selection.text : 'LZW',
                tiffKeepLayers: !!tiffLayers.value,
                jpgQuality: jpgQuality,
                prefix: prefixBox.text,
                overwrite: !!overRadio.value,
                renameInDoc: !!renameDocCb.value
            };
        }

        okBtn.onClick = function () {
            var chosen = [];
            var names = {};
            for (var k = 0; k < items.length; k++) {
                if (!items[k].checked) continue;
                chosen.push(items[k].board);
                names[String(items[k].board.id)] = exportNameFor(items[k]);
            }
            if (!chosen.length) {
                alert('Select at least one artboard.', TITLE);
                return;
            }
            var s = gather();
            if (!s.pdf && !s.tiff && !s.psb && !s.png && !s.jpg) {
                alert('Choose at least one format.', TITLE);
                return;
            }
            if (!s.outFolder) {
                alert('Choose an output folder.', TITLE);
                return;
            }
            var folder = Folder(s.outFolder);
            if (!folder.exists) {
                var created = folder.create();
                if (!created || !folder.exists) {
                    alert('The output folder does not exist and could not be created:\n' + s.outFolder, TITLE);
                    return;
                }
            }
            var renames = [];
            for (var m = 0; m < items.length; m++) {
                var key = String(items[m].board.id);
                if (hasOwn(nameEdits, key)) {
                    renames.push({ id: items[m].board.id, from: String(items[m].board.name), to: nameEdits[key] });
                }
            }
            result.go = true;
            result.settings = s;
            result.artboards = chosen;
            result.names = names;
            result.renames = renames;
            win.close();
        };
        cancelBtn.onClick = function () { win.close(); };

        win.onShow = function () {
            shown = true;
            try { win.layout.layout(true); } catch (eShow) {}
            renderRows();
        };

        syncOptions();
        applyFilter();
        win.center();
        win.show();
        return result;
    }

    var savedCfg = loadSettings();
    if (!savedCfg.outFolder) {
        savedCfg.outFolder = defaultOutFolder(originalDoc).fsName;
    } else {
        var remembered = Folder(savedCfg.outFolder);
        if (!remembered || !remembered.exists) {
            savedCfg.outFolder = defaultOutFolder(originalDoc).fsName;
        }
    }

    var decision = showDialog(allArtboards, selectedArtboards, savedCfg);
    if (!decision.go) return;
    var settings = decision.settings;
    var artboards = decision.artboards;
    if (!artboards || !artboards.length) return;
    saveSettings(settings);

    function chosenFormats(s) {
        var list = [];
        if (s.pdf) list.push('PDF');
        if (s.tiff) list.push('TIFF');
        if (s.psb) list.push('PSB');
        if (s.png) list.push('PNG');
        if (s.jpg) list.push('JPG');
        return list;
    }

    function unlockAndRemove(layer) {
        try {
            if (layer.isBackgroundLayer) layer.isBackgroundLayer = false;
        } catch (e) {}
        try { layer.allLocked = false; } catch (e2) {}
        try { layer.pixelsLocked = false; } catch (e3) {}
        try { layer.positionLocked = false; } catch (e4) {}
        try { layer.transparentPixelsLocked = false; } catch (e5) {}
        try { layer.visible = true; } catch (e6) {}
        layer.remove();
    }

    function findArtboardInDoc(doc, wanted) {
        var named = [];
        var layers = doc.layers;
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var id;
            try { id = getLayerIdFromDOM(layer); } catch (e) { continue; }
            var info = infoFromId(id);
            if (!info.isArtboard) continue;
            if (!info.rect) {
                try { info.rect = rectFromLayerBounds(layer); } catch (e2) {}
            }
            info.layer = layer;
            if (layer.name === wanted.name) named.push(info);
        }
        if (!named.length) {
            for (var j = 0; j < layers.length; j++) {
                var layer2 = layers[j];
                var id2;
                try { id2 = getLayerIdFromDOM(layer2); } catch (e3) { continue; }
                var info2 = infoFromId(id2);
                if (!info2.isArtboard) continue;
                if (!info2.rect) {
                    try { info2.rect = rectFromLayerBounds(layer2); } catch (e4) {}
                }
                if (rectsClose(info2.rect, wanted.rect)) {
                    info2.layer = layer2;
                    return info2;
                }
            }
            return null;
        }
        if (named.length === 1) return named[0];
        for (var k = 0; k < named.length; k++) {
            if (rectsClose(named[k].rect, wanted.rect)) return named[k];
        }
        return named[0];
    }

    function isolateArtboard(doc, wanted) {
        var keep = findArtboardInDoc(doc, wanted);
        if (!keep || !keep.layer) {
            throw new Error('Could not find artboard "' + wanted.name + '" in the duplicate.');
        }
        var keepLayer = keep.layer;
        var layers = doc.layers;
        for (var i = layers.length - 1; i >= 0; i--) {
            var layer = layers[i];
            if (layer === keepLayer) continue;
            try {
                if (typeof keepLayer.id === 'number' && typeof layer.id === 'number' && layer.id === keepLayer.id) continue;
            } catch (e) {}
            unlockAndRemove(layer);
        }
        keep = findArtboardInDoc(doc, wanted);
        if (!keep) {
            keep = { layer: doc.layers[0], rect: wanted.rect, name: wanted.name };
            try { keep.rect = rectFromArtboardDesc(getLayerDesc(getLayerIdFromDOM(keep.layer))) || keep.rect; } catch (e2) {}
            try { if (!validRect(keep.rect)) keep.rect = rectFromLayerBounds(keep.layer); } catch (e3) {}
        } else if (!validRect(keep.rect)) {
            try { keep.rect = rectFromLayerBounds(keep.layer); } catch (e4) {}
        }
        if (!validRect(keep.rect)) {
            throw new Error('Artboard "' + wanted.name + '" has no usable bounds.');
        }
        doc.crop([
            keep.rect.left,
            keep.rect.top,
            keep.rect.right,
            keep.rect.bottom
        ]);
    }

    function applyPdfPreset(opt, name) {
        opt.embedColorProfile = true;
        opt.view = false;
        try { opt.preserveEditing = false; } catch (e) {}
        try { opt.layers = false; } catch (e2) {}
        try { opt.compatibility = PDFCompatibility.PDF17; } catch (e3) {}
        if (name === 'Smallest File Size') {
            opt.encoding = PDFEncoding.JPEGLOW;
            try { opt.optimizeForWeb = true; } catch (e4) {}
        } else if (name === 'Medium') {
            opt.encoding = PDFEncoding.JPEGMEDIUM;
            try { opt.optimizeForWeb = false; } catch (e5) {}
        } else if (name === 'High Quality') {
            opt.encoding = PDFEncoding.JPEGHIGH;
            try { opt.optimizeForWeb = false; } catch (e6) {}
        } else {
            try { opt.encoding = PDFEncoding.PDFZIP; } catch (e7) {
                opt.encoding = PDFEncoding.JPEGHIGH;
            }
            try { opt.optimizeForWeb = false; } catch (e8) {}
        }
    }

    function tiffEncodingFor(name) {
        if (name === 'ZIP') return TIFFEncoding.TIFFZIP;
        if (name === 'None') return TIFFEncoding.NONE;
        return TIFFEncoding.TIFFLZW;
    }

    function prepareForJpeg(doc) {
        if (doc.mode === DocumentMode.BITMAP) {
            doc.changeMode(ChangeMode.GRAYSCALE);
        }
        if (doc.mode !== DocumentMode.RGB) {
            doc.changeMode(ChangeMode.RGB);
        }
        if (doc.bitsPerChannel !== BitsPerChannelType.EIGHT) {
            try {
                doc.bitsPerChannel = BitsPerChannelType.EIGHT;
            } catch (e) {
                try {
                    doc.bitsPerChannel = BitsPerChannelType.SIXTEEN;
                    doc.bitsPerChannel = BitsPerChannelType.EIGHT;
                } catch (e2) {
                    throw new Error('Could not convert the document to 8-bit RGB for JPG.');
                }
            }
        }
        try { doc.flatten(); } catch (e3) {}
    }

    function savePSB(doc, file) {
        var desc = new ActionDescriptor();
        var asDesc = new ActionDescriptor();
        try { asDesc.putBoolean(s2t('maximizeCompatibility'), true); } catch (e) {}
        desc.putObject(s2t('as'), s2t('largeDocumentFormat'), asDesc);
        desc.putPath(s2t('in'), file);
        desc.putBoolean(s2t('copy'), true);
        try { desc.putBoolean(s2t('lowerCase'), true); } catch (e2) {}
        executeAction(s2t('save'), desc, DialogModes.NO);
    }

    function saveFormat(doc, format, file, s) {
        if (format === 'PDF') {
            var pdf = new PDFSaveOptions();
            applyPdfPreset(pdf, s.pdfPreset);
            doc.saveAs(file, pdf, true, Extension.LOWERCASE);
            return;
        }
        if (format === 'TIFF') {
            var tiff = new TiffSaveOptions();
            tiff.imageCompression = tiffEncodingFor(s.tiffCompression);
            tiff.layers = !!s.tiffKeepLayers;
            tiff.embedColorProfile = true;
            try { tiff.byteOrder = ByteOrder.IBM; } catch (e) {}
            try { tiff.transparency = true; } catch (e2) {}
            try { tiff.alphaChannels = true; } catch (e3) {}
            doc.saveAs(file, tiff, true, Extension.LOWERCASE);
            return;
        }
        if (format === 'PSB') {
            savePSB(doc, file);
            return;
        }
        if (format === 'PNG') {
            var png = new PNGSaveOptions();
            png.interlaced = false;
            try { png.compression = 6; } catch (e4) {}
            doc.saveAs(file, png, true, Extension.LOWERCASE);
            return;
        }
        if (format === 'JPG') {
            prepareForJpeg(doc);
            var jpg = new JPEGSaveOptions();
            jpg.quality = s.jpgQuality;
            jpg.embedColorProfile = true;
            jpg.formatOptions = FormatOptions.STANDARDBASELINE;
            try { jpg.matte = MatteType.WHITE; } catch (e5) {}
            doc.saveAs(file, jpg, true, Extension.LOWERCASE);
            return;
        }
        throw new Error('Unknown format: ' + format);
    }

    function extensionFor(format) {
        if (format === 'PDF') return '.pdf';
        if (format === 'TIFF') return '.tif';
        if (format === 'PSB') return '.psb';
        if (format === 'PNG') return '.png';
        if (format === 'JPG') return '.jpg';
        return '';
    }

    var formats = chosenFormats(settings);
    var outFolder = Folder(settings.outFolder);
    var usedNames = {};
    var exported = [];
    var errors = [];
    var totalSteps = artboards.length * formats.length;
    var step = 0;

    var prog = new Window('palette', TITLE + ' - Exporting', undefined, { closeButton: false });
    prog.orientation = 'column';
    prog.alignChildren = ['fill', 'top'];
    prog.margins = 16;
    prog.spacing = 8;
    var progMsg = prog.add('statictext', undefined, 'Starting...');
    progMsg.preferredSize.width = 420;
    var progBar = prog.add('progressbar', undefined, 0, totalSteps > 0 ? totalSteps : 1);
    progBar.preferredSize = [420, 16];
    prog.show();
    try { prog.update(); } catch (eShow) {}

    var oldDialogs = app.displayDialogs;
    var oldUnits = app.preferences.rulerUnits;
    app.displayDialogs = DialogModes.NO;
    app.preferences.rulerUnits = Units.PIXELS;

    try {
        for (var a = 0; a < artboards.length; a++) {
            var board = artboards[a];
            var dup = null;
            var exportName = hasOwn(decision.names, String(board.id)) ? decision.names[String(board.id)] : board.name;
            var baseName = applyPrefix(settings.prefix, sanitizeName(exportName));
            try {
                progMsg.text = 'Duplicating "' + board.name + '"...';
                try { prog.update(); } catch (eP1) {}
                try { app.refresh(); } catch (eR1) {}

                app.activeDocument = originalDoc;
                dup = originalDoc.duplicate();
                app.activeDocument = dup;
                isolateArtboard(dup, board);

                for (var f = 0; f < formats.length; f++) {
                    var file = uniqueFile(outFolder, baseName, extensionFor(formats[f]), settings.overwrite, usedNames);
                    step++;
                    progBar.value = step;
                    progMsg.text = 'Exporting "' + board.name + '" as ' + formats[f] + ' (' + step + ' of ' + totalSteps + ')...';
                    try { prog.update(); } catch (eP2) {}
                    try { app.refresh(); } catch (eR2) {}
                    try {
                        saveFormat(dup, formats[f], file, settings);
                        exported.push(file.fsName);
                    } catch (fmtErr) {
                        errors.push(board.name + ' / ' + formats[f] + ': ' + errText(fmtErr));
                    }
                }
            } catch (boardErr) {
                errors.push(board.name + ': ' + errText(boardErr));
                step = (a + 1) * formats.length;
                progBar.value = step;
            } finally {
                if (dup) {
                    try { dup.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
                }
                try { app.activeDocument = originalDoc; } catch (eAct) {}
            }
        }
    } finally {
        app.displayDialogs = oldDialogs;
        app.preferences.rulerUnits = oldUnits;
        try { app.activeDocument = originalDoc; } catch (eFin) {}
        try { prog.close(); } catch (eProg) {}
    }

    // Optional: rename the edited artboards in the source document.
    // Done after exporting so the duplicate-matching above still sees the
    // original names.
    var renamed = [];
    function renameLayerById(id, newName) {
        try {
            var d = new ActionDescriptor();
            var r = new ActionReference();
            r.putIdentifier(s2t('layer'), id);
            d.putReference(s2t('null'), r);
            var nd = new ActionDescriptor();
            nd.putString(s2t('name'), newName);
            d.putObject(s2t('to'), s2t('layer'), nd);
            executeAction(s2t('set'), d, DialogModes.NO);
        } catch (eAM) {
            var lyr = findLayerById(originalDoc, id);
            if (!lyr) throw eAM;
            lyr.name = newName;
        }
    }
    if (settings.renameInDoc && decision.renames && decision.renames.length) {
        try { app.activeDocument = originalDoc; } catch (eRa) {}
        for (var rn = 0; rn < decision.renames.length; rn++) {
            var ren = decision.renames[rn];
            try {
                renameLayerById(ren.id, ren.to);
                renamed.push(ren.from + '  ->  ' + ren.to);
            } catch (renErr) {
                errors.push('Rename "' + ren.from + '": ' + errText(renErr));
            }
        }
    }

    function showSummary() {
        var lines = [];
        lines.push('Exported ' + exported.length + ' file' + (exported.length === 1 ? '' : 's') +
            (exported.length ? ' to:' : '.'));
        if (exported.length) lines.push(outFolder.fsName);
        lines.push('');
        var i;
        for (i = 0; i < exported.length; i++) lines.push(exported[i]);
        if (renamed.length) {
            lines.push('');
            lines.push('Renamed ' + renamed.length + ' artboard' + (renamed.length === 1 ? '' : 's') + ' in the document:');
            for (i = 0; i < renamed.length; i++) lines.push('- ' + renamed[i]);
        }
        if (errors.length) {
            lines.push('');
            lines.push('Errors (' + errors.length + '):');
            for (i = 0; i < errors.length; i++) lines.push('- ' + errors[i]);
        } else if (!exported.length) {
            lines.push('No files were exported.');
        }
        var text = lines.join('\n');
        var w = new Window('dialog', TITLE + ' - Done');
        w.orientation = 'column';
        w.alignChildren = ['fill', 'top'];
        w.margins = 14;
        var box = w.add('edittext', undefined, text, { multiline: true, readonly: true, scrolling: true });
        box.preferredSize = [520, 280];
        var row = w.add('group');
        row.alignment = 'right';
        row.add('button', undefined, 'OK');
        w.center();
        w.show();
    }

    showSummary();
})();
