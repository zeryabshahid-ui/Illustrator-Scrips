/*
  Extract Logo Colors  -  Adobe Illustrator script
  Works on vector artwork only. It does NOT work on images (placed or
  embedded raster images such as JPG/PNG are skipped).
  ------------------------------------------------------------------
  USAGE
    1. Select your logo (any mix of groups, paths, compound paths, text,
       clipping groups and symbol instances).
    2. File > Scripts > Other Script... > ExtractLogoColors.jsx
       (or run it from the Script Launcher panel).
    3. A window lists every unique colour used in the selection, sorted by
       how often it is used, with HEX, RGB, CMYK, usage count and source.

  BUTTONS
    Add to Swatches  - creates a swatch group (name editable) with the colours.
                       Swatch names that already exist in the document are skipped.
    Make palette     - draws labelled colour squares (HEX / RGB / CMYK) next to the
                       selection on a layer called "Color Palette".
    Copy HEX list    - shows the list in a text box you can copy (Ctrl+C); on Windows
                       there is also a one-click "Copy to clipboard" button.
    Tip: select rows in the list to act on just those colours. With no rows
    selected, all colours are used.

  OPTIONS
    Include strokes / gradient stops / text / look inside symbols, and a
    tolerance slider that merges near-identical colours (0 = exact match).

  NOTES
    Images (placed / raster), meshes, plugin objects and pattern fills are
    skipped and counted. Hidden objects are ignored. Symbols are read from a
    temporary copy that is deleted straight away.
*/
#target illustrator
(function () {
    if (app.documents.length === 0) { alert('Open a document and select your logo first.'); return; }
    var doc = app.activeDocument;
    var isCMYK = (doc.documentColorSpace === DocumentColorSpace.CMYK);
    var rawSel = doc.selection;
    var textSel = null, selItems = [];
    if (rawSel && rawSel.typename === 'TextRange') {
        textSel = rawSel;
    } else if (rawSel && rawSel.length) {
        for (var si = 0; si < rawSel.length; si++) { selItems.push(rawSel[si]); }
    }
    if (!textSel && selItems.length === 0) {
        alert('Nothing is selected.\nSelect your logo (or any artwork), then run Extract Logo Colors again.');
        return;
    }

    // =====================================================================
    // Helpers
    // =====================================================================
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
    function r0(v) { return Math.round(v); }
    function trimStr(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
    function hex2(v) { var h = clamp(r0(v), 0, 255).toString(16).toUpperCase(); return h.length < 2 ? '0' + h : h; }
    function toHex(rgb) { return '#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]); }

    function rgbToCmykFormula(rgb) {
        var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
        var k = 1 - Math.max(r, g, b);
        if (k >= 0.9999) { return [0, 0, 0, 100]; }
        return [(1 - r - k) / (1 - k) * 100, (1 - g - k) / (1 - k) * 100, (1 - b - k) / (1 - k) * 100, k * 100];
    }
    function cmykToRgbFormula(c) {
        var k = c[3] / 100;
        return [255 * (1 - c[0] / 100) * (1 - k), 255 * (1 - c[1] / 100) * (1 - k), 255 * (1 - c[2] / 100) * (1 - k)];
    }
    var convCache = {};
    function convert(fromSpace, vals) {
        var key = fromSpace + ':' + vals.join(',');
        if (convCache[key]) { return convCache[key]; }
        var out = null;
        try {
            var src = fromSpace === 'RGB' ? ImageColorSpace.RGB : (fromSpace === 'CMYK' ? ImageColorSpace.CMYK : ImageColorSpace.LAB);
            var dst = fromSpace === 'RGB' ? ImageColorSpace.CMYK : ImageColorSpace.RGB;
            var res = app.convertSampleColor(src, vals, dst, ColorConvertPurpose.defaultpurpose);
            if (res && res.length >= (dst === ImageColorSpace.CMYK ? 4 : 3)) {
                out = [];
                for (var i = 0; i < res.length && i < 4; i++) { out.push(Number(res[i])); }
            }
        } catch (e) { out = null; }
        if (!out) {
            if (fromSpace === 'RGB') { out = rgbToCmykFormula(vals); }
            else if (fromSpace === 'CMYK') { out = cmykToRgbFormula(vals); }
            else { out = null; }
        }
        convCache[key] = out;
        return out;
    }
    function rgbOf(vals) { return convert('CMYK', vals); }   // CMYK -> RGB
    function cmykOf(vals) { return convert('RGB', vals); }   // RGB  -> CMYK

    // Turn any Illustrator colour into {spot, tint, rgb[], cmyk[]}; null if unsupported
    function normalize(c) {
        var t = c.typename, rgb, cmyk;
        if (t === 'RGBColor') {
            rgb = [c.red, c.green, c.blue]; cmyk = cmykOf(rgb);
            return { spot: null, tint: 100, rgb: rgb, cmyk: cmyk, gray: false };
        }
        if (t === 'CMYKColor') {
            cmyk = [c.cyan, c.magenta, c.yellow, c.black]; rgb = rgbOf(cmyk);
            return { spot: null, tint: 100, rgb: rgb, cmyk: cmyk, gray: false };
        }
        if (t === 'GrayColor') {
            var v = 255 * (1 - c.gray / 100);
            return { spot: null, tint: 100, rgb: [v, v, v], cmyk: [0, 0, 0, c.gray], gray: true };
        }
        if (t === 'SpotColor') {
            var sp = c.spot, tint = c.tint, base = sp.color, f = tint / 100;
            if (base.typename === 'RGBColor') {
                rgb = [255 - (255 - base.red) * f, 255 - (255 - base.green) * f, 255 - (255 - base.blue) * f];
                cmyk = cmykOf(rgb);
            } else if (base.typename === 'CMYKColor') {
                cmyk = [base.cyan * f, base.magenta * f, base.yellow * f, base.black * f];
                rgb = rgbOf(cmyk);
            } else if (base.typename === 'GrayColor') {
                var gv = base.gray * f; var vv = 255 * (1 - gv / 100);
                rgb = [vv, vv, vv]; cmyk = [0, 0, 0, gv];
            } else if (base.typename === 'LabColor') {
                var lrgb = convert('LAB', [base.l, base.a, base.b]);
                if (!lrgb) { return null; }
                rgb = [255 - (255 - lrgb[0]) * f, 255 - (255 - lrgb[1]) * f, 255 - (255 - lrgb[2]) * f];
                cmyk = cmykOf(rgb);
            } else { return null; }
            return { spot: sp.name, tint: tint, rgb: rgb, cmyk: cmyk, gray: false };
        }
        return null;
    }

    // =====================================================================
    // Scanning
    // =====================================================================
    var recs, recMap, skip, objCount;
    function resetScan() {
        recs = []; recMap = {}; objCount = 0;
        skip = { images: 0, patterns: 0, symbols: 0, mesh: 0, other: 0, hidden: 0, gradients: 0 };
    }

    // srcKey: [t]ext? + f(ill)/s(troke) + [g]radient?
    function addColor(c, isStroke, isText, isGrad) {
        if (!c) { return; }
        var t = c.typename;
        if (t === 'NoColor') { return; }
        if (t === 'GradientColor') {
            var stops;
            try { stops = c.gradient.gradientStops; } catch (eG) { skip.gradients++; return; }
            for (var i = 0; i < stops.length; i++) { addColor(stops[i].color, isStroke, isText, true); }
            return;
        }
        if (t === 'PatternColor') { skip.patterns++; return; }
        var n = null;
        try { n = normalize(c); } catch (eN) { n = null; }
        if (!n) { skip.other++; return; }
        var key;
        if (n.spot !== null) { key = 'S|' + n.spot + '|' + r0(n.tint); }
        else if (isCMYK) { key = 'C|' + r0(n.cmyk[0]) + ',' + r0(n.cmyk[1]) + ',' + r0(n.cmyk[2]) + ',' + r0(n.cmyk[3]); }
        else { key = 'R|' + r0(n.rgb[0]) + ',' + r0(n.rgb[1]) + ',' + r0(n.rgb[2]); }
        var rec = recMap[key];
        if (!rec) {
            rec = { key: key, spot: n.spot, tint: n.tint, rgb: n.rgb, cmyk: n.cmyk, gray: n.gray, src: {} };
            recMap[key] = rec; recs.push(rec);
        }
        var sk = (isText ? 't' : '') + (isStroke ? 's' : 'f') + (isGrad ? 'g' : '');
        rec.src[sk] = (rec.src[sk] || 0) + 1;
    }

    function pathColors(p) {
        try { if (p.guides) { return; } } catch (e0) { }
        objCount++;
        try { if (p.filled) { addColor(p.fillColor, false, false, false); } } catch (e1) { }
        try { if (p.stroked && p.strokeWidth > 0) { addColor(p.strokeColor, true, false, false); } } catch (e2) { }
    }

    function rangeColors(r) {
        var txt = '';
        try { txt = r.contents; } catch (e) { }
        if (trimStr(txt) === '') { return; }          // ignore whitespace-only runs
        var ca = r.characterAttributes;
        try { addColor(ca.fillColor, false, true, false); } catch (e1) { }
        try {
            var sc = ca.strokeColor;
            if (sc && sc.typename !== 'NoColor' && ca.strokeWeight > 0) { addColor(sc, true, true, false); }
        } catch (e2) { }
    }
    function textColors(tr) {
        objCount++;
        var runs = null;
        try { runs = tr.textRanges; } catch (e) { runs = null; }
        if (runs && runs.length) {
            for (var i = 0; i < runs.length; i++) { rangeColors(runs[i]); }
        } else {
            try { rangeColors(tr.textRange ? tr.textRange : tr); } catch (e2) { }
        }
    }

    function snapshot(coll) { var a = []; for (var i = 0; i < coll.length; i++) { a.push(coll[i]); } return a; }

    var lookInSymbols = true;
    function symbolColors(it, depth) {
        if (!lookInSymbols || depth > 5) { skip.symbols++; return; }
        var tl = null;
        try {
            tl = doc.layers.add();
            tl.name = '__ExtractLogoColors_temp';
            var d = it.duplicate(tl, ElementPlacement.PLACEATEND);
            d.breakLink();
            var kids = snapshot(tl.pageItems);
            for (var i = 0; i < kids.length; i++) { walk(kids[i], depth + 1); }
        } catch (e) { skip.symbols++; }
        if (tl) { try { tl.remove(); } catch (eR) { } }
    }

    function walk(it, depth) {
        if (!it) { return; }
        try { if (it.hidden) { skip.hidden++; return; } } catch (eH) { }
        var t = it.typename, i, kids;
        switch (t) {
            case 'GroupItem':
                kids = snapshot(it.pageItems);
                for (i = 0; i < kids.length; i++) { walk(kids[i], depth); }
                break;
            case 'CompoundPathItem':
                // all sub-paths share one appearance: read it once
                if (it.pathItems.length) { pathColors(it.pathItems[0]); }
                break;
            case 'PathItem': pathColors(it); break;
            case 'TextFrame': textColors(it); break;
            case 'SymbolItem': symbolColors(it, depth); break;
            case 'PlacedItem': case 'RasterItem': skip.images++; break;
            case 'MeshItem': skip.mesh++; break;
            default: skip.other++; break;   // PluginItem, GraphItem, LegacyTextItem, NonNativeItem...
        }
    }

    function scan() {
        resetScan();
        var prevLayer = null;
        try { prevLayer = doc.activeLayer; } catch (e) { }
        if (textSel) { textColors(textSel); }
        for (var i = 0; i < selItems.length; i++) { walk(selItems[i], 0); }
        if (prevLayer) { try { doc.activeLayer = prevLayer; } catch (e2) { } }
        // put the original selection back (temp symbol layers can disturb it)
        try { if (!textSel) { doc.selection = selItems; } } catch (e3) { }
    }

    // =====================================================================
    // Filtering / merging
    // =====================================================================
    var opt = { strokes: true, grads: true, text: true, tol: 0 };
    var list = [];

    function passes(sk) {
        if (!opt.strokes && sk.indexOf('s') >= 0) { return false; }
        if (!opt.grads && sk.indexOf('g') >= 0) { return false; }
        if (!opt.text && sk.charAt(0) === 't') { return false; }
        return true;
    }
    function dist(a, b) {
        var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }
    function byCount(a, b) { return b.count - a.count; }

    function buildList() {
        var out = [], i, j, k;
        for (i = 0; i < recs.length; i++) {
            var rec = recs[i], o = { rec: rec, count: 0, fill: 0, stroke: 0, grad: 0, text: 0, merged: 0 };
            for (k in rec.src) {
                if (!rec.src.hasOwnProperty(k) || !passes(k)) { continue; }
                var n = rec.src[k];
                o.count += n;
                if (k.indexOf('s') >= 0) { o.stroke += n; } else { o.fill += n; }
                if (k.indexOf('g') >= 0) { o.grad += n; }
                if (k.charAt(0) === 't') { o.text += n; }
            }
            if (o.count > 0) { out.push(o); }
        }
        out.sort(byCount);
        if (opt.tol > 0) {
            var merged = [];
            for (i = 0; i < out.length; i++) {
                var cur = out[i], hit = null;
                if (cur.rec.spot === null) {
                    for (j = 0; j < merged.length; j++) {
                        if (merged[j].rec.spot === null && dist(merged[j].rec.rgb, cur.rec.rgb) <= opt.tol) { hit = merged[j]; break; }
                    }
                }
                if (hit) {
                    hit.count += cur.count; hit.fill += cur.fill; hit.stroke += cur.stroke;
                    hit.grad += cur.grad; hit.text += cur.text; hit.merged += 1 + cur.merged;
                } else { merged.push(cur); }
            }
            merged.sort(byCount);
            out = merged;
        }
        list = out;
    }

    function rgbStr(o) { var c = o.rec.rgb; return r0(c[0]) + ', ' + r0(c[1]) + ', ' + r0(c[2]); }
    function cmykStr(o) { var c = o.rec.cmyk; return r0(c[0]) + ', ' + r0(c[1]) + ', ' + r0(c[2]) + ', ' + r0(c[3]); }
    function sourceStr(o) {
        var p = [];
        if (o.rec.spot !== null) { p.push('Spot: ' + o.rec.spot + (r0(o.rec.tint) < 100 ? ' ' + r0(o.rec.tint) + '%' : '')); }
        if (o.fill) { p.push('fill ' + o.fill); }
        if (o.stroke) { p.push('stroke ' + o.stroke); }
        if (o.grad) { p.push('gradient ' + o.grad); }
        if (o.text) { p.push('text ' + o.text); }
        if (o.rec.gray) { p.push('gray'); }
        if (o.merged) { p.push('+' + o.merged + ' similar'); }
        return p.join(', ');
    }
    function skipStr() {
        var p = [];
        if (skip.images) { p.push(skip.images + ' image(s)'); }
        if (skip.patterns) { p.push(skip.patterns + ' pattern fill(s)'); }
        if (skip.symbols) { p.push(skip.symbols + ' symbol(s)'); }
        if (skip.mesh) { p.push(skip.mesh + ' mesh(es)'); }
        if (skip.other) { p.push(skip.other + ' other'); }
        if (skip.hidden) { p.push(skip.hidden + ' hidden'); }
        return p.length ? 'Skipped: ' + p.join(', ') : 'Nothing skipped.';
    }

    // =====================================================================
    // Tiny PNG swatch generator (for list row icons)
    // =====================================================================
    var crcTable = null;
    function crc32(s) {
        var c, n, k;
        if (!crcTable) {
            crcTable = [];
            for (n = 0; n < 256; n++) {
                c = n;
                for (k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
                crcTable[n] = c >>> 0;
            }
        }
        c = 0xFFFFFFFF;
        for (n = 0; n < s.length; n++) { c = crcTable[(c ^ s.charCodeAt(n)) & 0xFF] ^ (c >>> 8); }
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    function be32(v) { return String.fromCharCode((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
    function chunk(type, data) { return be32(data.length) + type + data + be32(crc32(type + data)); }
    function swatchPNG(rgb, size) {
        var r = clamp(r0(rgb[0]), 0, 255), g = clamp(r0(rgb[1]), 0, 255), b = clamp(r0(rgb[2]), 0, 255);
        var raw = '', x, y, edge = String.fromCharCode(90, 90, 90), px = String.fromCharCode(r, g, b);
        for (y = 0; y < size; y++) {
            raw += String.fromCharCode(0);
            for (x = 0; x < size; x++) { raw += (x === 0 || y === 0 || x === size - 1 || y === size - 1) ? edge : px; }
        }
        var a = 1, bb = 0;
        for (x = 0; x < raw.length; x++) { a = (a + raw.charCodeAt(x)) % 65521; bb = (bb + a) % 65521; }
        var len = raw.length;
        var zlib = String.fromCharCode(0x78, 0x01, 0x01, len & 255, (len >>> 8) & 255, (~len) & 255, ((~len) >>> 8) & 255) + raw + be32(((bb << 16) | a) >>> 0);
        var ihdr = be32(size) + be32(size) + String.fromCharCode(8, 2, 0, 0, 0);
        return String.fromCharCode(137, 80, 78, 71, 13, 10, 26, 10) + chunk('IHDR', ihdr) + chunk('IDAT', zlib) + chunk('IEND', '');
    }
    function swatchImage(rgb) { try { return ScriptUI.newImage(swatchPNG(rgb, 14)); } catch (e) { return null; } }

    // =====================================================================
    // Document actions
    // =====================================================================
    function getSpot(name) { try { return doc.spots.getByName(name); } catch (e) { return null; } }
    function docColor(o) {
        var rec = o.rec;
        if (rec.spot !== null) {
            var sp = getSpot(rec.spot);
            if (sp) { var sc = new SpotColor(); sc.spot = sp; sc.tint = rec.tint; return sc; }
        }
        if (isCMYK) {
            var c = new CMYKColor();
            c.cyan = clamp(rec.cmyk[0], 0, 100); c.magenta = clamp(rec.cmyk[1], 0, 100);
            c.yellow = clamp(rec.cmyk[2], 0, 100); c.black = clamp(rec.cmyk[3], 0, 100);
            return c;
        }
        var r = new RGBColor();
        r.red = clamp(rec.rgb[0], 0, 255); r.green = clamp(rec.rgb[1], 0, 255); r.blue = clamp(rec.rgb[2], 0, 255);
        return r;
    }
    function blackColor() {
        if (isCMYK) { var c = new CMYKColor(); c.black = 100; return c; }
        var r = new RGBColor(); r.red = 0; r.green = 0; r.blue = 0; return r;
    }
    function grayColor(pct) {
        if (isCMYK) { var c = new CMYKColor(); c.black = pct; return c; }
        var v = 255 * (1 - pct / 100), r = new RGBColor(); r.red = v; r.green = v; r.blue = v; return r;
    }
    function swatchName(o) {
        var rec = o.rec;
        if (rec.spot !== null) { return r0(rec.tint) >= 100 ? rec.spot : rec.spot + ' ' + r0(rec.tint) + '%'; }
        if (isCMYK) { return 'C=' + r0(rec.cmyk[0]) + ' M=' + r0(rec.cmyk[1]) + ' Y=' + r0(rec.cmyk[2]) + ' K=' + r0(rec.cmyk[3]); }
        return toHex(rec.rgb);
    }
    function swatchExists(name) { try { doc.swatches.getByName(name); return true; } catch (e) { return false; } }
    function groupExists(name) { try { doc.swatchGroups.getByName(name); return true; } catch (e) { return false; } }

    function addToSwatches(items, gname) {
        gname = trimStr(gname) || 'Logo Colors';
        var base = gname, n = 2;
        while (groupExists(gname)) { gname = base + ' ' + n; n++; }
        var grp = doc.swatchGroups.add();
        grp.name = gname;
        var added = 0, dup = 0, failed = 0, used = {};
        for (var i = 0; i < items.length; i++) {
            var o = items[i], name = swatchName(o);
            if (used[name]) { dup++; continue; }
            used[name] = true;
            try {
                if (o.rec.spot !== null && r0(o.rec.tint) >= 100) {
                    var sp = getSpot(o.rec.spot);
                    if (sp) { grp.addSpot(sp); added++; continue; }
                }
                if (swatchExists(name)) { dup++; continue; }
                var sw = doc.swatches.add();
                sw.name = name;
                sw.color = docColor(o);
                grp.addSwatch(sw);
                added++;
            } catch (e) { failed++; }
        }
        if (added === 0) { try { grp.remove(); } catch (eR) { } }
        app.redraw();
        var msg = added ? ('Added ' + added + ' colour(s) to the swatch group "' + gname + '".') : 'No new swatches were added.';
        if (dup) { msg += '\nSkipped ' + dup + ' that already exist as swatches.'; }
        if (failed) { msg += '\n' + failed + ' could not be added.'; }
        alert(msg);
    }

    function selectionBounds() {
        var b = null, i, vb;
        var objs = selItems.slice(0);
        if (textSel) { try { objs.push(textSel.story.textFrames[0]); } catch (e) { } }
        for (i = 0; i < objs.length; i++) {
            try { vb = objs[i].visibleBounds; } catch (e2) { continue; }
            if (!b) { b = [vb[0], vb[1], vb[2], vb[3]]; }
            else { b[0] = Math.min(b[0], vb[0]); b[1] = Math.max(b[1], vb[1]); b[2] = Math.max(b[2], vb[2]); b[3] = Math.min(b[3], vb[3]); }
        }
        if (!b) {
            var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
            b = [ab[0], ab[1], ab[0] + 20, ab[1]];
        }
        return b;
    }

    function makePalette(items, title) {
        var lay = null;
        try { lay = doc.layers.getByName('Color Palette'); } catch (e) { lay = null; }
        if (!lay) { lay = doc.layers.add(); lay.name = 'Color Palette'; }
        lay.locked = false; lay.visible = true;
        var b = selectionBounds();
        var S = 56, stepX = 112, stepY = S + 62, perRow = 8;
        var x0 = b[2] + 40, y0 = b[1];
        var grp = lay.groupItems.add();
        grp.name = (trimStr(title) || 'Logo Colors') + ' palette';
        var black = blackColor(), edge = grayColor(25);
        for (var i = 0; i < items.length; i++) {
            var o = items[i];
            var col = i % perRow, row = Math.floor(i / perRow);
            var x = x0 + col * stepX, y = y0 - row * stepY;
            var sq = grp.pathItems.rectangle(y, x, S, S);
            sq.filled = true; sq.fillColor = docColor(o);
            sq.stroked = true; sq.strokeColor = edge; sq.strokeWidth = 0.5;
            sq.name = toHex(o.rec.rgb);
            var lines = [toHex(o.rec.rgb), 'RGB ' + rgbStr(o).replace(/,/g, ''), 'CMYK ' + cmykStr(o).replace(/,/g, '')];
            if (o.rec.spot !== null) { lines.push(swatchName(o)); }
            var tf = grp.textFrames.add();
            tf.contents = lines.join('\r');
            try {
                var ca = tf.textRange.characterAttributes;
                ca.size = 7; ca.fillColor = black;
            } catch (eT) { }
            tf.left = x; tf.top = y - S - 6;
        }
        app.redraw();
        alert('Palette with ' + items.length + ' colour(s) added on the "Color Palette" layer, to the right of your selection.');
    }

    function toClipboard(text) {
        if ($.os.indexOf('Windows') < 0) { return false; }
        try {
            var f = new File(Folder.temp + '/ExtractLogoColors_clip.txt');
            f.lineFeed = 'Windows'; f.encoding = 'UTF-8';
            f.open('w'); f.write(text); f.close();
            var bat = new File(Folder.temp + '/ExtractLogoColors_clip.bat');
            bat.lineFeed = 'Windows';
            bat.open('w');
            bat.write('@echo off\nchcp 65001 >nul\ntype "' + f.fsName + '" | clip\nexit\n');
            bat.close();
            return bat.execute();
        } catch (e) { return false; }
    }

    function showHexList(items) {
        var d = new Window('dialog', 'Colour list');
        d.alignChildren = 'fill';
        var fg = d.add('group');
        fg.add('statictext', undefined, 'Format:');
        var fmt = fg.add('dropdownlist', undefined, ['HEX only', 'HEX + RGB + CMYK', 'CSS variables']);
        fmt.selection = 0;
        var et = d.add('edittext', undefined, '', { multiline: true, scrolling: true });
        et.preferredSize = [460, 280];
        d.add('statictext', undefined, 'Click in the box, press Ctrl+A then Ctrl+C to copy.');
        function fill() {
            var out = [], f = fmt.selection ? fmt.selection.index : 0;
            for (var i = 0; i < items.length; i++) {
                var o = items[i], h = toHex(o.rec.rgb);
                if (f === 0) { out.push(h); }
                else if (f === 1) { out.push(h + '\tRGB ' + rgbStr(o) + '\tCMYK ' + cmykStr(o) + (o.rec.spot !== null ? '\t' + swatchName(o) : '')); }
                else { out.push('--color-' + (i + 1) + ': ' + h + ';'); }
            }
            et.text = out.join('\n');
        }
        fmt.onChange = fill;
        fill();
        var bg = d.add('group'); bg.alignment = 'right';
        if ($.os.indexOf('Windows') >= 0) {
            var cb = bg.add('button', undefined, 'Copy to clipboard');
            cb.onClick = function () {
                if (toClipboard(et.text.replace(/\r\n|\r/g, '\n'))) { cb.text = 'Copied!'; }
                else { alert('Could not reach the clipboard. Select the text and press Ctrl+C instead.'); }
            };
        }
        bg.add('button', undefined, 'Close', { name: 'ok' });
        d.onShow = function () { try { et.active = true; } catch (e) { } };
        d.show();
    }

    // =====================================================================
    // Initial scan
    // =====================================================================
    scan();
    buildList();
    if (recs.length === 0) {
        alert('No colours were found in the selection.\n' + skipStr());
        return;
    }

    var defaultName = 'Logo Colors';
    try { if (selItems.length === 1 && selItems[0].name) { defaultName = selItems[0].name + ' Colors'; } } catch (eN) { }

    // =====================================================================
    // Dialog
    // =====================================================================
    var w = new Window('dialog', 'Extract Logo Colors');
    w.alignChildren = 'fill';
    var head = w.add('statictext', undefined, '', { multiline: false });
    head.preferredSize.width = 680;

    var strip = w.add('panel', undefined, '');
    strip.preferredSize = [680, 70];
    strip.margins = 0;

    var lb = w.add('listbox', undefined, undefined, {
        numberOfColumns: 6, showHeaders: true, multiselect: true,
        columnTitles: ['#', 'HEX', 'RGB', 'CMYK', 'Uses', 'Source'],
        columnWidths: [56, 80, 100, 120, 45, 270]
    });
    lb.preferredSize = [680, 280];

    var op = w.add('panel', undefined, 'Options');
    op.orientation = 'column'; op.alignChildren = 'left';
    var og = op.add('group');
    var cbStroke = og.add('checkbox', undefined, 'Include strokes'); cbStroke.value = true;
    var cbGrad = og.add('checkbox', undefined, 'Include gradient stops'); cbGrad.value = true;
    var cbText = og.add('checkbox', undefined, 'Include text'); cbText.value = true;
    var cbSym = og.add('checkbox', undefined, 'Look inside symbols'); cbSym.value = true;
    var tg = op.add('group');
    tg.add('statictext', undefined, 'Merge similar colours (tolerance):');
    var tolS = tg.add('slider', undefined, 0, 0, 60); tolS.preferredSize.width = 260;
    var tolL = tg.add('statictext', undefined, '0 (exact)'); tolL.characters = 10;
    var skipLbl = op.add('statictext', undefined, ''); skipLbl.preferredSize.width = 640;

    var ng = w.add('group');
    ng.add('statictext', undefined, 'Swatch group / palette name:');
    var nameE = ng.add('edittext', undefined, defaultName); nameE.characters = 30;

    w.add('statictext', undefined, 'Tip: select rows (Ctrl/Shift+click) to use only those colours. With none selected, all colours are used.');

    var bg = w.add('group'); bg.alignment = 'fill';
    var bSw = bg.add('button', undefined, 'Add to Swatches');
    var bPal = bg.add('button', undefined, 'Make palette');
    var bHex = bg.add('button', undefined, 'Copy HEX list');
    var spacer = bg.add('group'); spacer.alignment = 'fill';
    var bClose = bg.add('button', undefined, 'Close', { name: 'cancel' });

    function selectedIdx() {
        var s = lb.selection, idx = [], i;
        if (!s) { return idx; }
        if (s.length === undefined) { s = [s]; }
        for (i = 0; i < s.length; i++) { idx.push(s[i].index); }
        return idx;
    }
    function targetItems() {
        var idx = selectedIdx(), out = [], i;
        if (!idx.length) { return list.slice(0); }
        idx.sort(function (a, b) { return a - b; });
        for (i = 0; i < idx.length; i++) { out.push(list[idx[i]]); }
        return out;
    }

    strip.onDraw = function () {
        var g = this.graphics, W = this.size[0], H = this.size[1], n = list.length;
        g.newPath(); g.rectPath(0, 0, W, H);
        g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [0.22, 0.22, 0.22, 1]));
        if (!n) { return; }
        var gap = 3, pad = 6, s = 40, cols, rows;
        while (s > 6) {
            cols = Math.floor((W - 2 * pad + gap) / (s + gap));
            rows = Math.floor((H - 2 * pad + gap) / (s + gap));
            if (cols * rows >= n) { break; }
            s--;
        }
        cols = Math.max(1, Math.floor((W - 2 * pad + gap) / (s + gap)));
        var sel = {}, idx = selectedIdx(), i;
        for (i = 0; i < idx.length; i++) { sel[idx[i]] = true; }
        var hiPen = g.newPen(g.PenType.SOLID_COLOR, [1, 1, 1, 1], 2);
        for (i = 0; i < n; i++) {
            var c = list[i].rec.rgb;
            var x = pad + (i % cols) * (s + gap), y = pad + Math.floor(i / cols) * (s + gap);
            if (y + s > H) { break; }
            g.newPath(); g.rectPath(x, y, s, s);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [clamp(c[0], 0, 255) / 255, clamp(c[1], 0, 255) / 255, clamp(c[2], 0, 255) / 255, 1]));
            if (sel[i]) { g.newPath(); g.rectPath(x + 1, y + 1, s - 2, s - 2); g.strokePath(hiPen); }
        }
    };
    function redrawStrip() { try { strip.hide(); strip.show(); } catch (e) { } }

    function refresh() {
        buildList();
        lb.removeAll();
        for (var i = 0; i < list.length; i++) {
            var o = list[i];
            var it = lb.add('item', String(i + 1));
            var img = swatchImage(o.rec.rgb);
            if (img) { try { it.image = img; } catch (eI) { } }
            it.subItems[0].text = toHex(o.rec.rgb);
            it.subItems[1].text = rgbStr(o);
            it.subItems[2].text = cmykStr(o);
            it.subItems[3].text = String(o.count);
            it.subItems[4].text = sourceStr(o);
        }
        head.text = list.length + ' unique colour(s) found in ' + objCount + ' object(s), sorted by usage.  Document mode: ' + (isCMYK ? 'CMYK' : 'RGB') + '.';
        skipLbl.text = skipStr();
        var has = list.length > 0;
        bSw.enabled = bPal.enabled = bHex.enabled = has;
        redrawStrip();
    }

    cbStroke.onClick = function () { opt.strokes = cbStroke.value; refresh(); };
    cbGrad.onClick = function () { opt.grads = cbGrad.value; refresh(); };
    cbText.onClick = function () { opt.text = cbText.value; refresh(); };
    cbSym.onClick = function () { lookInSymbols = cbSym.value; scan(); refresh(); };
    tolS.onChanging = function () { var v = Math.round(tolS.value); tolL.text = v === 0 ? '0 (exact)' : String(v); };
    tolS.onChange = function () { opt.tol = Math.round(tolS.value); tolS.onChanging(); refresh(); };
    lb.onChange = function () { redrawStrip(); };

    bSw.onClick = function () { addToSwatches(targetItems(), nameE.text); };
    bPal.onClick = function () { makePalette(targetItems(), nameE.text); };
    bHex.onClick = function () { showHexList(targetItems()); };
    bClose.onClick = function () { w.close(); };

    refresh();
    w.show();
})();
