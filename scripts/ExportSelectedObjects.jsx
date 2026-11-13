#target illustrator
/*
 * Export Selected Objects - Adobe Illustrator script (ES3)
 * ---------------------------------------------------------------
 * Exports the objects you have selected as PNG, JPG, SVG, PDF, EPS
 * and/or AI. Each selected object (or group) is listed in the dialog
 * with a checkbox, an editable name (used as the file name) and its
 * size. Export each object as its own file, or all ticked objects
 * together as one file.
 *
 * Dialog: two columns. Left = object list with a filter box,
 * Select All/None, Reset Names. Right = export mode, formats, export
 * area (trim + padding, or the artboard the object sits on), output
 * folder, options that only appear for the formats you tick, file
 * name settings with a live preview, and an Export button that shows
 * how many files will be written. Settings are remembered between
 * runs (%APPDATA%\ZeryabExportObjects\settings.json).
 *
 * How it works: for every file it creates a temporary document with
 * the same colour mode, duplicates the object(s) into it, fits the
 * artboard to the export area, exports/saves each chosen format and
 * closes the temporary document without saving. Your document is
 * never changed and your selection is restored at the end.
 * Clipping groups are measured by their clipping path.
 *
 * Run from the Script Launcher, or File > Scripts > Other Script...
 *
 * Free to use.
 * Built by Zeryab Shahid with the help of AI
 */
(function () {
    var TITLE = 'Export Selected Objects';
    var SETTINGS_DIR_NAME = 'ZeryabExportObjects';
    var SETTINGS_FILE_NAME = 'settings.json';
    var MAX_EXPORT_SCALE = 776; // Illustrator's exportFile scale limit (%)

    if (!app.documents.length) {
        alert('Open a document first.', TITLE);
        return;
    }
    var srcDoc = app.activeDocument;
    var rawSel = srcDoc.selection;
    if (!rawSel || typeof rawSel.length !== 'number' || (rawSel.typename && rawSel.typename === 'TextRange')) {
        alert('Select one or more objects first.\n\nIf you are editing text, press Esc to leave text editing, then select the text frame.', TITLE);
        return;
    }
    if (rawSel.length === 0) {
        alert('Select one or more objects first.', TITLE);
        return;
    }
    var savedSelection = [];
    var si0;
    for (si0 = 0; si0 < rawSel.length; si0++) savedSelection.push(rawSel[si0]);

    // ---------------- utilities ----------------
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
            mode: 'each',          // 'each' | 'combined'
            png: true,
            jpg: false,
            svg: false,
            pdf: false,
            eps: false,
            ai: false,
            trim: true,
            padding: 0,
            outFolder: '',
            pngRes: 'screen',      // 'screen' | 'medium' | 'high' | 'other'
            pngPpi: 72,            // used when pngRes is 'other'
            pngTransparent: true,
            pngAntialias: true,
            jpgQuality: 90,
            jpgRes: 'high',
            jpgPpi: 300,
            svgOutlineText: false,
            svgMinimal: true,
            pdfPreset: '[High Quality Print]',
            epsVersion: '',
            aiVersion: '',
            aiPdfCompatible: true,
            prefix: '',
            combinedName: '',
            overwrite: false
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
                if (hasOwn(parsed, k) && typeof parsed[k] === typeof defs[k]) defs[k] = parsed[k];
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

    function defaultOutFolder(doc) {
        try {
            if (doc.saved !== undefined && doc.fullName && doc.fullName.parent && doc.fullName.parent.exists) {
                return doc.fullName.parent;
            }
        } catch (e) {}
        try {
            var p = Folder(doc.path);
            if (p && p.exists && String(doc.path) !== '') return p;
        } catch (e2) {}
        return Folder.desktop;
    }

    function docBaseName(doc) {
        var n = '';
        try { n = String(doc.name); } catch (e) {}
        n = n.replace(/\.[^.]+$/, '');
        return n || 'Selection';
    }

    function sanitizeName(name, fallback) {
        var s = String(name);
        s = s.replace(/[<>:"\/\\|?*\x00-\x1f]/g, '_');
        s = s.replace(/\s+/g, ' ');
        s = trim(s);
        s = s.replace(/[. ]+$/g, '');
        if (!s) s = fallback || 'Object';
        if (s.length > 120) s = s.substring(0, 120);
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
            if (!used[key] && (overwrite || !f.exists)) {
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

    function fmtNum(n) {
        var r = Math.round(n * 10) / 10;
        return String(r);
    }

    function toNumber(text, fallback, min, max) {
        var v = parseFloat(String(text).replace(',', '.'));
        if (isNaN(v)) v = fallback;
        if (typeof min === 'number' && v < min) v = min;
        if (typeof max === 'number' && v > max) v = max;
        return v;
    }

    // ---------------- geometry ----------------
    // Bounds are [left, top, right, bottom]; in Illustrator top > bottom.
    function clipPathBounds(group) {
        try {
            if (group.typename !== 'GroupItem' || !group.clipped) return null;
            var kids = group.pageItems;
            for (var i = 0; i < kids.length; i++) {
                var k = kids[i];
                if (k.typename === 'PathItem' && k.clipping) return k.geometricBounds;
                if (k.typename === 'CompoundPathItem') {
                    try {
                        if (k.pathItems.length && k.pathItems[0].clipping) return k.geometricBounds;
                    } catch (eCp) {}
                }
            }
        } catch (e) {}
        return null;
    }

    function itemBounds(item) {
        var cb = clipPathBounds(item);
        if (cb) return [cb[0], cb[1], cb[2], cb[3]];
        var b = item.visibleBounds;
        return [b[0], b[1], b[2], b[3]];
    }

    function unionBounds(list) {
        var u = null;
        for (var i = 0; i < list.length; i++) {
            var b = itemBounds(list[i]);
            if (!u) u = [b[0], b[1], b[2], b[3]];
            else {
                if (b[0] < u[0]) u[0] = b[0];
                if (b[1] > u[1]) u[1] = b[1];
                if (b[2] > u[2]) u[2] = b[2];
                if (b[3] < u[3]) u[3] = b[3];
            }
        }
        return u;
    }

    function containingArtboardRect(doc, b) {
        var cx = (b[0] + b[2]) / 2;
        var cy = (b[1] + b[3]) / 2;
        var best = null;
        var bestArea = -1;
        for (var i = 0; i < doc.artboards.length; i++) {
            var r = doc.artboards[i].artboardRect;
            if (cx >= r[0] && cx <= r[2] && cy <= r[1] && cy >= r[3]) return [r[0], r[1], r[2], r[3]];
            var ox = Math.min(r[2], b[2]) - Math.max(r[0], b[0]);
            var oy = Math.min(r[1], b[1]) - Math.max(r[3], b[3]);
            if (ox > 0 && oy > 0 && ox * oy > bestArea) {
                bestArea = ox * oy;
                best = [r[0], r[1], r[2], r[3]];
            }
        }
        return best;
    }

    // ---------------- object list ----------------
    function typeLabel(item) {
        var t = item.typename;
        if (t === 'GroupItem') {
            try { if (item.clipped) return 'Clip Group'; } catch (e) {}
            return 'Group';
        }
        if (t === 'PathItem') return 'Path';
        if (t === 'CompoundPathItem') return 'Compound Path';
        if (t === 'TextFrame') return 'Text';
        if (t === 'PlacedItem') return 'Linked Image';
        if (t === 'RasterItem') return 'Image';
        if (t === 'SymbolItem') return 'Symbol';
        if (t === 'MeshItem') return 'Mesh';
        if (t === 'PluginItem') return 'Object';
        if (t === 'GraphItem') return 'Graph';
        if (t === 'LegacyTextItem') return 'Legacy Text';
        return 'Object';
    }

    function displayName(item, counters) {
        var n = '';
        try { n = trim(item.name); } catch (e) {}
        if (n) return n;
        if (item.typename === 'TextFrame') {
            try {
                var c = trim(String(item.contents).replace(/[\r\n\t]+/g, ' '));
                if (c) return c.length > 30 ? c.substring(0, 30) : c;
            } catch (e2) {}
        }
        if (item.typename === 'SymbolItem') {
            try { if (item.symbol && item.symbol.name) return String(item.symbol.name); } catch (e3) {}
        }
        if (item.typename === 'PlacedItem') {
            try { return decodeURI(item.file.name).replace(/\.[^.]+$/, ''); } catch (e4) {}
        }
        var t = typeLabel(item);
        counters[t] = (counters[t] || 0) + 1;
        return t + ' ' + counters[t];
    }

    var objects = [];
    (function buildObjects() {
        var counters = {};
        for (var i = 0; i < savedSelection.length; i++) {
            var it = savedSelection[i];
            var b = null;
            try { b = itemBounds(it); } catch (eB) {}
            var nm = displayName(it, counters);
            objects.push({
                ref: it,
                label: nm,
                type: typeLabel(it),
                w: b ? Math.abs(b[2] - b[0]) : 0,
                h: b ? Math.abs(b[1] - b[3]) : 0
            });
        }
    })();

    // ---------------- format lists ----------------
    var FORMAT_ORDER = ['PNG', 'JPG', 'PDF', 'EPS', 'AI', 'SVG']; // SVG last: it may outline text
    var FORMAT_UI = ['PNG', 'JPG', 'SVG', 'PDF', 'EPS', 'AI'];

    function extensionFor(fmt) {
        if (fmt === 'PNG') return '.png';
        if (fmt === 'JPG') return '.jpg';
        if (fmt === 'SVG') return '.svg';
        if (fmt === 'PDF') return '.pdf';
        if (fmt === 'EPS') return '.eps';
        if (fmt === 'AI') return '.ai';
        return '';
    }

    function compatList(keys) {
        var out = [];
        for (var i = 0; i < keys.length; i++) {
            try {
                if (typeof Compatibility !== 'undefined' && typeof Compatibility[keys[i][0]] !== 'undefined') {
                    out.push({ key: keys[i][0], label: keys[i][1] });
                }
            } catch (e) {}
        }
        return out;
    }

    var AI_VERSIONS = compatList([
        ['ILLUSTRATOR24', 'Illustrator 2020+ (current)'],
        ['ILLUSTRATOR17', 'Illustrator CC (legacy)'],
        ['ILLUSTRATOR16', 'Illustrator CS6'],
        ['ILLUSTRATOR15', 'Illustrator CS5'],
        ['ILLUSTRATOR14', 'Illustrator CS4'],
        ['ILLUSTRATOR13', 'Illustrator CS3']
    ]);
    var EPS_VERSIONS = compatList([
        ['ILLUSTRATOR17', 'Illustrator CC EPS'],
        ['ILLUSTRATOR16', 'Illustrator CS6 EPS'],
        ['ILLUSTRATOR15', 'Illustrator CS5 EPS'],
        ['ILLUSTRATOR14', 'Illustrator CS4 EPS'],
        ['ILLUSTRATOR13', 'Illustrator CS3 EPS'],
        ['ILLUSTRATOR12', 'Illustrator CS2 EPS'],
        ['ILLUSTRATOR11', 'Illustrator CS EPS'],
        ['ILLUSTRATOR10', 'Illustrator 10 EPS'],
        ['ILLUSTRATOR8', 'Illustrator 8 EPS'],
        ['ILLUSTRATOR3', 'Illustrator 3 EPS']
    ]);

    function pdfPresetNames() {
        var out = [];
        try {
            var l = app.PDFPresetsList;
            for (var i = 0; i < l.length; i++) out.push(String(l[i]));
        } catch (e) {}
        if (!out.length) out = ['[High Quality Print]', '[Press Quality]', '[Smallest File Size]', '[Illustrator Default]'];
        return out;
    }

    // ---------------- dialog ----------------
    function showDialog(objs, cfg) {
        var result = { go: false, settings: null, chosen: [] };
        var win = new Window('dialog', TITLE);
        win.orientation = 'column';
        win.alignChildren = ['fill', 'top'];
        win.spacing = 10;
        win.margins = 14;

        var shown = false;
        var bi;
        var items = [];
        for (bi = 0; bi < objs.length; bi++) {
            items.push({ obj: objs[bi], checked: true, name: String(objs[bi].label) });
        }
        var filtered = [];
        for (bi = 0; bi < items.length; bi++) filtered.push(bi);

        var cols = win.add('group');
        cols.orientation = 'row';
        cols.alignChildren = ['fill', 'fill'];
        cols.spacing = 12;

        // ---------------- LEFT: objects ----------------
        var objPanel = cols.add('panel', undefined, 'Selected objects');
        objPanel.orientation = 'column';
        objPanel.alignChildren = ['fill', 'top'];
        objPanel.spacing = 6;
        objPanel.margins = [12, 16, 12, 10];

        var filterRow = objPanel.add('group');
        filterRow.orientation = 'row';
        filterRow.alignChildren = ['fill', 'center'];
        filterRow.add('statictext', undefined, 'Filter:');
        var filterBox = filterRow.add('edittext', undefined, '');
        filterBox.alignment = ['fill', 'center'];
        filterBox.preferredSize.width = 220;
        filterBox.helpTip = 'Type part of a name or type (e.g. "group") to show only matching objects';
        var clearFilterBtn = filterRow.add('button', undefined, 'Clear');
        clearFilterBtn.preferredSize.width = 60;

        var objHead = objPanel.add('group');
        objHead.orientation = 'row';
        objHead.alignChildren = ['left', 'center'];
        var selAllBtn = objHead.add('button', undefined, 'Select All');
        var selNoneBtn = objHead.add('button', undefined, 'Select None');
        var resetNamesBtn = objHead.add('button', undefined, 'Reset Names');
        selAllBtn.helpTip = 'Tick every object shown in the list';
        selNoneBtn.helpTip = 'Untick every object shown in the list';
        resetNamesBtn.helpTip = 'Put every name back to the object\'s layer name';

        var countLbl = objPanel.add('statictext', undefined, '0 of 0 selected');
        countLbl.alignment = ['fill', 'top'];
        countLbl.preferredSize.width = 300;

        var hintLbl = objPanel.add('statictext', undefined, 'Tick to export. Edit a name to set its file name.');
        hintLbl.alignment = ['fill', 'top'];
        hintLbl.preferredSize.width = 300;

        var ROW_H = 26;
        var SLOTS = items.length;
        if (SLOTS < 6) SLOTS = 6;
        if (SLOTS > 14) SLOTS = 14;
        var listH = SLOTS * ROW_H;

        var listRow = objPanel.add('group');
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
            et.preferredSize.width = 210;
            var sz = g.add('statictext', undefined, '');
            sz.preferredSize.width = 110;
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

        var sizeNote = objPanel.add('statictext', undefined, 'Sizes are in points (1 pt = 1 px at 100%).');
        sizeNote.alignment = ['fill', 'top'];

        // ---------------- RIGHT ----------------
        var right = cols.add('group');
        right.orientation = 'column';
        right.alignChildren = ['fill', 'top'];
        right.alignment = ['fill', 'fill'];
        right.spacing = 10;

        var modePanel = right.add('panel', undefined, 'Export as');
        modePanel.orientation = 'column';
        modePanel.alignChildren = ['left', 'top'];
        modePanel.spacing = 2;
        modePanel.margins = [12, 16, 12, 10];
        var eachRadio = modePanel.add('radiobutton', undefined, 'Each object as a separate file');
        var oneRadio = modePanel.add('radiobutton', undefined, 'All ticked objects as one file');
        eachRadio.value = cfg.mode !== 'combined';
        oneRadio.value = cfg.mode === 'combined';

        var fmtPanel = right.add('panel', undefined, 'Formats');
        fmtPanel.orientation = 'row';
        fmtPanel.alignChildren = ['left', 'center'];
        fmtPanel.spacing = 10;
        fmtPanel.margins = [12, 16, 12, 10];
        var fmtCbs = {};
        for (var fu = 0; fu < FORMAT_UI.length; fu++) {
            var fk = FORMAT_UI[fu];
            fmtCbs[fk] = fmtPanel.add('checkbox', undefined, fk);
            fmtCbs[fk].value = !!cfg[fk.toLowerCase()];
        }

        var areaPanel = right.add('panel', undefined, 'Export area');
        areaPanel.orientation = 'column';
        areaPanel.alignChildren = ['left', 'top'];
        areaPanel.spacing = 4;
        areaPanel.margins = [12, 16, 12, 10];
        var trimCb = areaPanel.add('checkbox', undefined, 'Trim to object bounds');
        trimCb.value = cfg.trim !== false;
        trimCb.helpTip = 'On: the file is cropped to the object (clipping groups use their clipping path).\nOff: the file is the size of the artboard the object sits on.';
        var padRow = areaPanel.add('group');
        padRow.orientation = 'row';
        padRow.alignChildren = ['left', 'center'];
        padRow.add('statictext', undefined, 'Padding:');
        var padBox = padRow.add('edittext', undefined, fmtNum(typeof cfg.padding === 'number' ? cfg.padding : 0));
        padBox.preferredSize.width = 50;
        padRow.add('statictext', undefined, 'pt around the object');
        var areaNote = areaPanel.add('statictext', undefined, 'Uses the artboard each object sits on.');

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

        // Resolution selector, same choices as Illustrator's own export dialogs.
        var RES_KEYS = ['screen', 'medium', 'high', 'other'];
        var RES_LABELS = ['Screen (72 ppi)', 'Medium (150 ppi)', 'High (300 ppi)', 'Other'];
        var RES_PPI = [72, 150, 300, 0];

        function resRow(parent, label, resKey, ppi) {
            var r = parent.add('group');
            r.orientation = 'row';
            r.alignChildren = ['left', 'center'];
            r.add('statictext', undefined, label);
            var dd = r.add('dropdownlist', undefined, RES_LABELS);
            dd.preferredSize.width = 140;
            var idx = 0;
            for (var i = 0; i < RES_KEYS.length; i++) if (RES_KEYS[i] === resKey) idx = i;
            dd.selection = idx;
            var other = r.add('group');
            other.orientation = 'row';
            other.alignChildren = ['left', 'center'];
            other.spacing = 4;
            var vb = other.add('edittext', undefined, fmtNum(typeof ppi === 'number' && ppi > 0 ? ppi : 300));
            vb.preferredSize.width = 50;
            vb.helpTip = 'Any resolution from 1 to 2400 ppi';
            other.add('statictext', undefined, 'ppi');
            var info = parent.add('statictext', undefined, '');
            info.preferredSize.width = 330;
            var res = { dd: dd, box: vb, other: other, info: info };
            dd.onChange = function () {
                if (dd.selection && dd.selection.index === 3 && RES_PPI[idx] > 0) {
                    // Start "Other" from the preset that was chosen before.
                    vb.text = fmtNum(RES_PPI[idx]);
                }
                idx = dd.selection ? dd.selection.index : 0;
                syncOptions();
            };
            vb.onChange = function () {
                vb.text = fmtNum(toNumber(vb.text, 300, 1, 2400));
                refreshCounts();
            };
            vb.onChanging = function () { refreshCounts(); };
            return res;
        }

        function resKeyOf(rr) {
            return RES_KEYS[rr.dd.selection ? rr.dd.selection.index : 0];
        }

        function ppiOf(rr) {
            var i = rr.dd.selection ? rr.dd.selection.index : 0;
            if (RES_PPI[i] > 0) return RES_PPI[i];
            return toNumber(rr.box.text, 300, 1, 2400);
        }

        // PNG
        var pngGroup = opt.add('group');
        pngGroup.orientation = 'column';
        pngGroup.alignChildren = ['left', 'top'];
        pngGroup.spacing = 4;
        var pngRes = resRow(pngGroup, 'Resolution:', cfg.pngRes, cfg.pngPpi);
        var pngFlags = pngGroup.add('group');
        pngFlags.orientation = 'row';
        var pngTransp = pngFlags.add('checkbox', undefined, 'Transparent background');
        pngTransp.value = cfg.pngTransparent !== false;
        var pngAA = pngFlags.add('checkbox', undefined, 'Anti-alias');
        pngAA.value = cfg.pngAntialias !== false;

        // JPG
        var jpgGroup = opt.add('group');
        jpgGroup.orientation = 'column';
        jpgGroup.alignChildren = ['left', 'top'];
        jpgGroup.spacing = 4;
        var jpgQRow = jpgGroup.add('group');
        jpgQRow.orientation = 'row';
        jpgQRow.alignChildren = ['left', 'center'];
        jpgQRow.add('statictext', undefined, 'JPG quality (0-100):');
        var jq = cfg.jpgQuality;
        if (typeof jq !== 'number' || isNaN(jq)) jq = 90;
        if (jq < 0) jq = 0;
        if (jq > 100) jq = 100;
        var jpgSlider = jpgQRow.add('slider', undefined, jq, 0, 100);
        jpgSlider.preferredSize.width = 120;
        var jpgVal = jpgQRow.add('edittext', undefined, String(jq));
        jpgVal.preferredSize.width = 40;
        var jpgRes = resRow(jpgGroup, 'Resolution:', cfg.jpgRes, cfg.jpgPpi);

        // SVG
        var svgGroup = opt.add('group');
        svgGroup.orientation = 'row';
        svgGroup.alignChildren = ['left', 'center'];
        svgGroup.add('statictext', undefined, 'SVG:');
        var svgOutline = svgGroup.add('checkbox', undefined, 'Text as outlines');
        svgOutline.value = !!cfg.svgOutlineText;
        var svgMinimal = svgGroup.add('checkbox', undefined, 'Minimal (smaller file)');
        svgMinimal.value = cfg.svgMinimal !== false;
        svgMinimal.helpTip = 'Leaves out Illustrator editing data, metadata and slices.';

        // PDF
        var pdfGroup = opt.add('group');
        pdfGroup.orientation = 'row';
        pdfGroup.alignChildren = ['left', 'center'];
        pdfGroup.add('statictext', undefined, 'PDF preset:');
        var presetNames = pdfPresetNames();
        var pdfPreset = pdfGroup.add('dropdownlist', undefined, presetNames);
        pdfPreset.selection = 0;
        for (var p = 0; p < presetNames.length; p++) {
            if (presetNames[p] === '[High Quality Print]') pdfPreset.selection = p;
        }
        for (p = 0; p < presetNames.length; p++) {
            if (cfg.pdfPreset === presetNames[p]) pdfPreset.selection = p;
        }
        pdfPreset.preferredSize.width = 200;

        function versionDropdown(parent, list, wanted) {
            var labels = [];
            for (var i = 0; i < list.length; i++) labels.push(list[i].label);
            if (!labels.length) labels.push('Default');
            var dd = parent.add('dropdownlist', undefined, labels);
            dd.selection = 0;
            for (i = 0; i < list.length; i++) if (list[i].key === wanted) dd.selection = i;
            dd.preferredSize.width = 200;
            return dd;
        }

        // EPS
        var epsGroup = opt.add('group');
        epsGroup.orientation = 'row';
        epsGroup.alignChildren = ['left', 'center'];
        epsGroup.add('statictext', undefined, 'EPS version:');
        var epsVer = versionDropdown(epsGroup, EPS_VERSIONS, cfg.epsVersion);

        // AI
        var aiGroup = opt.add('group');
        aiGroup.orientation = 'column';
        aiGroup.alignChildren = ['left', 'top'];
        aiGroup.spacing = 4;
        var aiRow = aiGroup.add('group');
        aiRow.orientation = 'row';
        aiRow.alignChildren = ['left', 'center'];
        aiRow.add('statictext', undefined, 'AI version:');
        var aiVer = versionDropdown(aiRow, AI_VERSIONS, cfg.aiVersion);
        var aiPdf = aiGroup.add('checkbox', undefined, 'Create PDF compatible file');
        aiPdf.value = cfg.aiPdfCompatible !== false;

        var noOptsLbl = opt.add('statictext', undefined, 'Tick a format to see its options.');

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

        var combRow = namePanel.add('group');
        combRow.orientation = 'row';
        combRow.alignChildren = ['left', 'center'];
        combRow.add('statictext', undefined, 'File name:');
        var combBox = combRow.add('edittext', undefined, cfg.combinedName ? String(cfg.combinedName) : docBaseName(srcDoc) + '_selection');
        combBox.alignment = ['fill', 'center'];
        combBox.preferredSize.width = 210;
        combBox.helpTip = 'Name for the single file when exporting all ticked objects together';

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
                items[s.index].name = String(s.et.text);
                updatePreview();
            };
            s.et.onChange = s.et.onChanging;
        }

        function isCombined() {
            return !!oneRadio.value;
        }

        function sizeText(o) {
            if (!o.w && !o.h) return o.type;
            return fmtNum(o.w) + ' x ' + fmtNum(o.h) + ' pt';
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
                    s.et.enabled = !isCombined();
                    s.et.helpTip = it.obj.type + ': ' + it.obj.label;
                    s.cb.helpTip = it.obj.label;
                    s.sz.text = sizeText(it.obj);
                    s.sz.helpTip = it.obj.type;
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
                    String(items[k].obj.label).toLowerCase().indexOf(q) !== -1 ||
                    String(items[k].obj.type).toLowerCase().indexOf(q) !== -1 ||
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
            for (var k = 0; k < FORMAT_UI.length; k++) {
                if (fmtCbs[FORMAT_UI[k]].value) list.push(FORMAT_UI[k]);
            }
            return list;
        }

        function checkedCount() {
            var n = 0;
            for (var k = 0; k < items.length; k++) if (items[k].checked) n++;
            return n;
        }

        function exportNameFor(it) {
            var t = trim(it.name);
            return t ? t : String(it.obj.label);
        }

        function fileCount() {
            var n = checkedCount();
            var f = currentFormats().length;
            if (!n) return 0;
            return isCombined() ? f : n * f;
        }

        function updatePreview() {
            var fmts = currentFormats();
            var first = null;
            for (var k = 0; k < items.length; k++) {
                if (items[k].checked) { first = items[k]; break; }
            }
            var text;
            if (!first) text = 'Preview: tick at least one object';
            else if (!fmts.length) text = 'Preview: choose at least one format';
            else {
                var raw = isCombined() ? combBox.text : exportNameFor(first);
                var base = applyPrefix(prefixBox.text, sanitizeName(raw, isCombined() ? 'Selection' : 'Object'));
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
            var files = fileCount();
            var txt = n + ' of ' + items.length + ' selected';
            if (filtered.length < items.length) txt += '  (' + filtered.length + ' shown)';
            countLbl.text = txt;
            okBtn.text = 'Export ' + files + ' file' + (files === 1 ? '' : 's');
            okBtn.enabled = files > 0;
            updatePixelInfo();
            updatePreview();
        }

        // "1 in = N ppi" -> pixel size of the first ticked object (or the combined set).
        function pixelText(rr, isJpg) {
            var ppi = ppiOf(rr);
            var w = 0, h = 0, k, first = true;
            for (k = 0; k < items.length; k++) {
                if (!items[k].checked) continue;
                if (isCombined()) {
                    w = Math.max(w, items[k].obj.w);
                    h = Math.max(h, items[k].obj.h);
                } else if (first) {
                    w = items[k].obj.w;
                    h = items[k].obj.h;
                }
                first = false;
            }
            var pct = ppi / 72 * 100;
            var txt = 'Scale ' + fmtNum(pct) + '%';
            if (!first && trimCb.value && !isCombined()) {
                var pad = toNumber(padBox.text, 0, 0, 5000) * 2;
                txt += '  -  first object about ' + Math.round((w + pad) * ppi / 72) + ' x ' +
                    Math.round((h + pad) * ppi / 72) + ' px';
            }
            if (pct > MAX_EXPORT_SCALE) {
                txt = isJpg ?
                    'Too high for JPG: max ' + Math.floor(MAX_EXPORT_SCALE * 72 / 100) + ' ppi (use PNG for more)' :
                    txt + '  (uses Image Capture)';
            }
            return txt;
        }

        function updatePixelInfo() {
            try {
                pngRes.info.text = pixelText(pngRes, false);
                jpgRes.info.text = pixelText(jpgRes, true);
            } catch (ePx) {}
        }

        function showEl(el, on) {
            el.visible = !!on;
            try { el.maximumSize.height = on ? 1000 : 0; } catch (eMs) {}
        }

        function syncOptions() {
            showEl(pngGroup, fmtCbs.PNG.value);
            showEl(jpgGroup, fmtCbs.JPG.value);
            showEl(svgGroup, fmtCbs.SVG.value);
            showEl(pdfGroup, fmtCbs.PDF.value);
            showEl(epsGroup, fmtCbs.EPS.value);
            showEl(aiGroup, fmtCbs.AI.value);
            showEl(noOptsLbl, !currentFormats().length);
            showEl(pngRes.other, pngRes.dd.selection && pngRes.dd.selection.index === 3);
            showEl(jpgRes.other, jpgRes.dd.selection && jpgRes.dd.selection.index === 3);
            showEl(opt, true);
            var combined = isCombined();
            showEl(combRow, combined);
            hintLbl.text = combined ?
                'Ticked objects go into one file (name set on the right).' :
                'Tick to export. Edit a name to set its file name.';
            padBox.enabled = !!trimCb.value;
            showEl(padRow, !!trimCb.value);
            showEl(areaNote, !trimCb.value);
            if (shown) {
                try { win.layout.layout(true); } catch (eLay) {}
            }
            renderRows();
            refreshCounts();
        }

        for (var fw = 0; fw < FORMAT_UI.length; fw++) fmtCbs[FORMAT_UI[fw]].onClick = syncOptions;
        eachRadio.onClick = oneRadio.onClick = syncOptions;
        trimCb.onClick = syncOptions;

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
            for (var k = 0; k < items.length; k++) items[k].name = String(items[k].obj.label);
            renderRows();
            refreshCounts();
        };

        prefixBox.onChanging = updatePreview;
        prefixBox.onChange = updatePreview;
        combBox.onChanging = updatePreview;
        combBox.onChange = updatePreview;

        jpgSlider.onChanging = function () {
            var v = Math.round(jpgSlider.value);
            jpgSlider.value = v;
            jpgVal.text = String(v);
        };
        jpgSlider.onChange = jpgSlider.onChanging;
        jpgVal.onChange = function () {
            var v = Math.round(toNumber(jpgVal.text, 90, 0, 100));
            jpgVal.text = String(v);
            jpgSlider.value = v;
        };
        padBox.onChange = function () {
            padBox.text = fmtNum(toNumber(padBox.text, 0, 0, 5000));
        };

        browseBtn.onClick = function () {
            var start = Folder(folderBox.text);
            var picked;
            if (start && start.exists) picked = start.selectDlg('Choose export folder');
            else picked = Folder.selectDialog('Choose export folder');
            if (picked) folderBox.text = picked.fsName;
        };

        function gather() {
            var epsKey = EPS_VERSIONS.length && epsVer.selection ? EPS_VERSIONS[epsVer.selection.index].key : '';
            var aiKey = AI_VERSIONS.length && aiVer.selection ? AI_VERSIONS[aiVer.selection.index].key : '';
            return {
                mode: isCombined() ? 'combined' : 'each',
                png: !!fmtCbs.PNG.value,
                jpg: !!fmtCbs.JPG.value,
                svg: !!fmtCbs.SVG.value,
                pdf: !!fmtCbs.PDF.value,
                eps: !!fmtCbs.EPS.value,
                ai: !!fmtCbs.AI.value,
                trim: !!trimCb.value,
                padding: toNumber(padBox.text, 0, 0, 5000),
                outFolder: trim(folderBox.text),
                pngRes: resKeyOf(pngRes),
                pngPpi: ppiOf(pngRes),
                pngTransparent: !!pngTransp.value,
                pngAntialias: !!pngAA.value,
                jpgQuality: Math.round(toNumber(jpgVal.text, 90, 0, 100)),
                jpgRes: resKeyOf(jpgRes),
                jpgPpi: ppiOf(jpgRes),
                svgOutlineText: !!svgOutline.value,
                svgMinimal: !!svgMinimal.value,
                pdfPreset: pdfPreset.selection ? String(pdfPreset.selection.text) : '[High Quality Print]',
                epsVersion: epsKey,
                aiVersion: aiKey,
                aiPdfCompatible: !!aiPdf.value,
                prefix: String(prefixBox.text),
                combinedName: String(combBox.text),
                overwrite: !!overRadio.value
            };
        }

        okBtn.onClick = function () {
            var chosen = [];
            for (var k = 0; k < items.length; k++) {
                if (!items[k].checked) continue;
                chosen.push({ obj: items[k].obj, name: exportNameFor(items[k]) });
            }
            if (!chosen.length) {
                alert('Tick at least one object.', TITLE);
                return;
            }
            var s = gather();
            if (!currentFormats().length) {
                alert('Choose at least one format.', TITLE);
                return;
            }
            if (s.jpg && ppiOf(jpgRes) / 72 * 100 > MAX_EXPORT_SCALE) {
                alert('JPG can be exported at up to ' + Math.floor(MAX_EXPORT_SCALE * 72 / 100) +
                    ' ppi from a script. Choose a lower JPG resolution, or use PNG (up to 2400 ppi).', TITLE);
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
            result.go = true;
            result.settings = s;
            result.chosen = chosen;
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
        savedCfg.outFolder = defaultOutFolder(srcDoc).fsName;
    } else {
        var remembered = Folder(savedCfg.outFolder);
        if (!remembered || !remembered.exists) savedCfg.outFolder = defaultOutFolder(srcDoc).fsName;
    }

    var decision = showDialog(objects, savedCfg);
    if (!decision.go) return;
    var settings = decision.settings;
    saveSettings(settings);

    var formats = [];
    (function () {
        for (var i = 0; i < FORMAT_ORDER.length; i++) {
            if (settings[FORMAT_ORDER[i].toLowerCase()]) formats.push(FORMAT_ORDER[i]);
        }
    })();

    // Build export units: one per object, or one for all.
    var units = [];
    (function () {
        var i;
        if (settings.mode === 'combined') {
            var refs = [];
            for (i = 0; i < decision.chosen.length; i++) refs.push(decision.chosen[i].obj.ref);
            units.push({
                refs: refs,
                label: decision.chosen.length + ' objects',
                base: applyPrefix(settings.prefix, sanitizeName(settings.combinedName, docBaseName(srcDoc) + '_selection'))
            });
        } else {
            for (i = 0; i < decision.chosen.length; i++) {
                units.push({
                    refs: [decision.chosen[i].obj.ref],
                    label: decision.chosen[i].obj.label,
                    base: applyPrefix(settings.prefix, sanitizeName(decision.chosen[i].name, decision.chosen[i].obj.type))
                });
            }
        }
    })();

    // ---------------- exporters ----------------
    // Illustrator exports at 72 ppi = 100%, so ppi maps to scale = ppi / 72 * 100.
    function presetPpi(key, custom) {
        if (key === 'screen') return 72;
        if (key === 'medium') return 150;
        if (key === 'high') return 300;
        var v = Number(custom);
        if (isNaN(v) || v < 1) v = 72;
        if (v > 2400) v = 2400;
        return v;
    }

    function exportPNG(doc, file, s, areaRect) {
        var ppi = presetPpi(s.pngRes, s.pngPpi);
        var pct = ppi / 72 * 100;
        if (pct > MAX_EXPORT_SCALE) {
            // Above Illustrator's export scale limit: use Image Capture (PNG at the chosen ppi).
            var ic = new ImageCaptureOptions();
            ic.resolution = ppi;
            ic.antiAliasing = !!s.pngAntialias;
            ic.transparency = !!s.pngTransparent;
            doc.imageCapture(file, areaRect, ic);
            return;
        }
        var o = new ExportOptionsPNG24();
        o.artBoardClipping = true;
        o.antiAliasing = !!s.pngAntialias;
        o.transparency = !!s.pngTransparent;
        o.horizontalScale = pct;
        o.verticalScale = pct;
        doc.exportFile(file, ExportType.PNG24, o);
    }

    function exportJPG(doc, file, s) {
        var ppi = presetPpi(s.jpgRes, s.jpgPpi);
        var pct = ppi / 72 * 100;
        if (pct > MAX_EXPORT_SCALE) {
            throw new Error(ppi + ' ppi is above the highest JPG resolution Illustrator can script (' +
                Math.floor(MAX_EXPORT_SCALE * 72 / 100) + ' ppi). Choose a lower resolution, or export PNG, which supports up to 2400 ppi.');
        }
        var o = new ExportOptionsJPEG();
        o.artBoardClipping = true;
        o.antiAliasing = true;
        o.qualitySetting = s.jpgQuality;
        o.horizontalScale = pct;
        o.verticalScale = pct;
        doc.exportFile(file, ExportType.JPEG, o);
    }

    function outlineAllText(doc) {
        for (var i = doc.textFrames.length - 1; i >= 0; i--) {
            try { doc.textFrames[i].createOutline(); } catch (e) {}
        }
    }

    function exportSVG(doc, file, s) {
        if (s.svgOutlineText) outlineAllText(doc);
        var o = new ExportOptionsSVG();
        o.embedRasterImages = true;
        o.fontSubsetting = SVGFontSubsetting.GLYPHSUSED;
        o.fontType = s.svgOutlineText ? SVGFontType.OUTLINEFONT : SVGFontType.SVGFONT;
        o.documentEncoding = SVGDocumentEncoding.UTF8;
        o.cssProperties = SVGCSSPropertyLocation.STYLEATTRIBUTES;
        o.coordinatePrecision = 3;
        try { o.saveMultipleArtboards = false; } catch (e1) {}
        if (s.svgMinimal) {
            o.preserveEditability = false;
            o.includeFileInfo = false;
            o.includeVariablesAndDatasets = false;
            o.slices = false;
            o.optimizeForSVGViewer = false;
            o.includeUnusedStyles = false;
        }
        doc.exportFile(file, ExportType.SVG, o);
    }

    function savePDF(doc, file, s) {
        var o = new PDFSaveOptions();
        try { o.pdfPreset = s.pdfPreset; } catch (eP) {}
        try { o.viewAfterSaving = false; } catch (eV) {}
        try { o.saveMultipleArtboards = false; } catch (eM) {}
        doc.saveAs(file, o);
    }

    function saveEPS(doc, file, s) {
        var o = new EPSSaveOptions();
        if (s.epsVersion && typeof Compatibility[s.epsVersion] !== 'undefined') o.compatibility = Compatibility[s.epsVersion];
        o.embedFonts = true;
        o.embedLinkedFiles = true;
        o.includeDocumentThumbnails = true;
        o.cmykPostScript = true;
        try { o.preview = EPSPreview.COLORTIFF; } catch (eP) {}
        try { o.saveMultipleArtboards = false; } catch (eM) {}
        doc.saveAs(file, o);
    }

    function saveAI(doc, file, s) {
        var o = new IllustratorSaveOptions();
        if (s.aiVersion && typeof Compatibility[s.aiVersion] !== 'undefined') o.compatibility = Compatibility[s.aiVersion];
        o.pdfCompatible = !!s.aiPdfCompatible;
        o.embedICCProfile = true;
        o.embedLinkedFiles = false;
        o.compressed = true;
        try { o.saveMultipleArtboards = false; } catch (eM) {}
        doc.saveAs(file, o);
    }

    function runFormat(doc, fmt, file, s, areaRect) {
        if (fmt === 'PNG') return exportPNG(doc, file, s, areaRect);
        if (fmt === 'JPG') return exportJPG(doc, file, s);
        if (fmt === 'SVG') return exportSVG(doc, file, s);
        if (fmt === 'PDF') return savePDF(doc, file, s);
        if (fmt === 'EPS') return saveEPS(doc, file, s);
        if (fmt === 'AI') return saveAI(doc, file, s);
        throw new Error('Unknown format ' + fmt);
    }

    // Work out the export rectangle in the SOURCE document.
    function sourceArea(refs, s) {
        var b = unionBounds(refs);
        if (!b) throw new Error('Could not measure the object.');
        if (!s.trim) {
            var ab = containingArtboardRect(srcDoc, b);
            if (ab) return { bounds: b, area: ab };
        }
        var pad = s.padding || 0;
        return { bounds: b, area: [b[0] - pad, b[1] + pad, b[2] + pad, b[3] - pad] };
    }

    // Create the temp document with the art laid out so the artboard
    // exactly covers the export area. Returns { doc, rect }.
    function buildTempDoc(refs, s) {
        var src = sourceArea(refs, s);
        var a = src.area;
        var w = a[2] - a[0];
        var h = a[1] - a[3];
        if (w < 1) w = 1;
        if (h < 1) h = 1;
        var temp = app.documents.add(srcDoc.documentColorSpace, w, h);
        try {
            var layer = temp.layers[0];
            var dupes = [];
            for (var i = 0; i < refs.length; i++) {
                dupes.push(refs[i].duplicate(layer, ElementPlacement.PLACEATEND));
            }
            // Duplicating across documents can shift coordinates; measure
            // the copies and move them so the area lands on the artboard.
            var db = unionBounds(dupes);
            var offX = db[0] - src.bounds[0];
            var offY = db[1] - src.bounds[1];
            var abr = temp.artboards[0].artboardRect;
            var dx = abr[0] - (a[0] + offX);
            var dy = abr[1] - (a[1] + offY);
            if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
                for (i = 0; i < dupes.length; i++) dupes[i].translate(dx, dy, true, true, true, true);
            }
            var rect = [abr[0], abr[1], abr[0] + w, abr[1] - h];
            temp.artboards[0].artboardRect = rect;
            try { temp.selection = null; } catch (eSel) {}
            return { doc: temp, rect: rect };
        } catch (e) {
            try { temp.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
            throw e;
        }
    }

    // ---------------- run ----------------
    var outFolder = Folder(settings.outFolder);
    var usedNames = {};
    var exported = [];
    var errors = [];
    var totalSteps = units.length * formats.length;
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

    var oldUIL = null;
    try { oldUIL = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (eU) {}
    var oldCoord = null;
    try { oldCoord = app.coordinateSystem; app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM; } catch (eC) {}

    try {
        for (var u = 0; u < units.length; u++) {
            var unit = units[u];
            var temp = null;
            try {
                progMsg.text = 'Preparing "' + unit.label + '"...';
                try { prog.update(); } catch (eP1) {}
                var built = buildTempDoc(unit.refs, settings);
                temp = built.doc;
                for (var f = 0; f < formats.length; f++) {
                    step++;
                    progBar.value = step;
                    progMsg.text = 'Exporting "' + unit.label + '" as ' + formats[f] + ' (' + step + ' of ' + totalSteps + ')...';
                    try { prog.update(); } catch (eP2) {}
                    try {
                        var file = uniqueFile(outFolder, unit.base, extensionFor(formats[f]), settings.overwrite, usedNames);
                        runFormat(temp, formats[f], file, settings, built.rect);
                        exported.push(decodeURI(file.name));
                    } catch (fmtErr) {
                        errors.push(unit.label + ' / ' + formats[f] + ': ' + errText(fmtErr));
                    }
                }
            } catch (unitErr) {
                errors.push(unit.label + ': ' + errText(unitErr));
                step = (u + 1) * formats.length;
                progBar.value = step;
            } finally {
                if (temp) {
                    try { temp.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
                }
            }
        }
    } finally {
        if (oldCoord !== null) { try { app.coordinateSystem = oldCoord; } catch (eC2) {} }
        if (oldUIL !== null) { try { app.userInteractionLevel = oldUIL; } catch (eU2) {} }
        try { srcDoc.activate(); } catch (eAct) {}
        try {
            srcDoc.selection = null;
            srcDoc.selection = savedSelection;
        } catch (eSel) {}
        try { prog.close(); } catch (eProg) {}
    }

    function showSummary() {
        var lines = [];
        lines.push('Exported ' + exported.length + ' file' + (exported.length === 1 ? '' : 's') +
            (exported.length ? ' to:' : '.'));
        if (exported.length) lines.push(outFolder.fsName);
        lines.push('');
        var i;
        for (i = 0; i < exported.length; i++) lines.push(exported[i]);
        if (errors.length) {
            lines.push('');
            lines.push('Failed (' + errors.length + '):');
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
        var openBtn = row.add('button', undefined, 'Open Folder');
        openBtn.enabled = exported.length > 0;
        openBtn.onClick = function () { try { outFolder.execute(); } catch (eO) {} };
        var okB = row.add('button', undefined, 'OK');
        okB.onClick = function () { w.close(); };
        w.center();
        w.show();
    }

    showSummary();
})();
