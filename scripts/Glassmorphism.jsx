//@target illustrator
/*
    Glassmorphism.jsx  v1.0
    Adobe Illustrator script (ExtendScript / ES3).

    Turns the selected shape(s) into a "glass" card:
      - a copy of the artwork behind the shape, clipped to the shape and
        Gaussian-blurred (fake background blur / frosted glass)
      - a translucent fill (optionally a two-tone fade gradient)
      - a thin translucent border (optionally a light-edge gradient)
      - a soft drop shadow
      - optional rounded corners
    Everything is controlled from a dialog. Settings can be remembered
    between runs and there are presets plus an optional live preview.

    Result for each shape: a group named "Glass" placed where the shape was:
        Glass
          Glass Border
          Glass Fill
          Glass Background (blurred)   <- clip group
          Glass Shadow                 (when "Separate layer" shadow is used)

    Install: File > Scripts > Other Script... or copy into
    <Illustrator>/Presets/<locale>/Scripts/ and restart Illustrator.
*/

var GlassmorphismScript = (function () {

    var SCRIPT_NAME = 'Glassmorphism';
    var VERSION = '1.0';
    var SETTINGS_FILE_NAME = 'Glassmorphism_settings.json';

    // ------------------------------------------------------------------
    // Defaults & presets
    // ------------------------------------------------------------------
    var DEFAULTS = {
        // Fill
        fillColor: 'FFFFFF',
        fillOpacity: 20,
        fillGradient: false,
        gradEndOpacity: 40,      // opacity (%) of the far end of the gradient
        gradAngle: -45,          // degrees (fill & border gradients)
        // Background blur
        blurOn: true,
        blurRadius: 20,          // pt
        includeLocked: false,    // copy locked artwork behind the glass too
        // Border
        strokeOn: true,
        strokeWidth: 1,          // pt
        strokeColor: 'FFFFFF',
        strokeOpacity: 50,
        strokeGradient: false,   // light-edge: fades border along gradient angle
        // Shadow
        shadowOn: true,
        shadowMethod: 0,         // 0 = separate blurred layer, 1 = Live "Drop Shadow" effect
        shadowColor: '000000',
        shadowOpacity: 15,
        shadowX: 0,              // pt (+ = right)
        shadowY: 8,              // pt (+ = down)
        shadowBlur: 20,          // pt
        // Corners
        cornerOn: false,
        cornerRadius: 16,        // pt
        // Options
        replaceOriginal: true,
        rememberSettings: true,
        livePreview: false
    };

    // keys that presets / reset never touch
    var OPTION_KEYS = { replaceOriginal: 1, rememberSettings: 1, livePreview: 1, includeLocked: 1 };

    var PRESETS = [
        { name: 'Light Glass', values: {
            fillColor: 'FFFFFF', fillOpacity: 20, fillGradient: true, gradEndOpacity: 40, gradAngle: -45,
            blurOn: true, blurRadius: 20,
            strokeOn: true, strokeWidth: 1, strokeColor: 'FFFFFF', strokeOpacity: 50, strokeGradient: true,
            shadowOn: true, shadowMethod: 0, shadowColor: '000000', shadowOpacity: 15, shadowX: 0, shadowY: 8, shadowBlur: 20,
            cornerOn: true, cornerRadius: 16 } },
        { name: 'Dark Glass', values: {
            fillColor: '101820', fillOpacity: 35, fillGradient: true, gradEndOpacity: 60, gradAngle: -45,
            blurOn: true, blurRadius: 24,
            strokeOn: true, strokeWidth: 0.75, strokeColor: 'FFFFFF', strokeOpacity: 20, strokeGradient: true,
            shadowOn: true, shadowMethod: 0, shadowColor: '000000', shadowOpacity: 30, shadowX: 0, shadowY: 10, shadowBlur: 30,
            cornerOn: true, cornerRadius: 16 } },
        { name: 'Frosted Heavy', values: {
            fillColor: 'FFFFFF', fillOpacity: 40, fillGradient: false, gradEndOpacity: 40, gradAngle: -45,
            blurOn: true, blurRadius: 45,
            strokeOn: true, strokeWidth: 1.5, strokeColor: 'FFFFFF', strokeOpacity: 60, strokeGradient: false,
            shadowOn: true, shadowMethod: 0, shadowColor: '000000', shadowOpacity: 20, shadowX: 0, shadowY: 12, shadowBlur: 32,
            cornerOn: true, cornerRadius: 24 } },
        { name: 'Clear Minimal', values: {
            fillColor: 'FFFFFF', fillOpacity: 10, fillGradient: false, gradEndOpacity: 40, gradAngle: -45,
            blurOn: true, blurRadius: 10,
            strokeOn: true, strokeWidth: 0.5, strokeColor: 'FFFFFF', strokeOpacity: 40, strokeGradient: false,
            shadowOn: false, shadowMethod: 0, shadowColor: '000000', shadowOpacity: 10, shadowX: 0, shadowY: 4, shadowBlur: 12,
            cornerOn: true, cornerRadius: 12 } }
    ];

    // ------------------------------------------------------------------
    // Small helpers (ES3 only)
    // ------------------------------------------------------------------
    function copyObj(o) {
        var r = {};
        for (var k in o) { if (o.hasOwnProperty(k)) { r[k] = o[k]; } }
        return r;
    }

    function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

    function roundTo(v, dec) {
        var p = Math.pow(10, dec);
        return Math.round(v * p) / p;
    }

    function fmt(v, dec) {
        if (!dec) { return String(Math.round(v)); }
        return String(roundTo(v, dec));
    }

    function num(v) {
        // number for LiveEffect XML: always '.' decimal, max 3 decimals
        var n = Math.round(Number(v) * 1000) / 1000;
        if (isNaN(n)) { n = 0; }
        return String(n);
    }

    function normHex(s) {
        s = String(s).replace(/[^0-9a-fA-F]/g, '');
        if (s.length === 3) {
            s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
        }
        if (s.length !== 6) { return null; }
        return s.toUpperCase();
    }

    function hexToRgb(hex) {
        hex = normHex(hex) || '000000';
        return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16)
        };
    }

    function rgbToCmyk(c) {
        var r = c.r / 255, g = c.g / 255, b = c.b / 255;
        var k = 1 - Math.max(r, Math.max(g, b));
        if (k >= 1) { return { c: 0, m: 0, y: 0, k: 100 }; }
        return {
            c: (1 - r - k) / (1 - k) * 100,
            m: (1 - g - k) / (1 - k) * 100,
            y: (1 - b - k) / (1 - k) * 100,
            k: k * 100
        };
    }

    function intToHex(n) {
        var h = n.toString(16);
        while (h.length < 6) { h = '0' + h; }
        return h.toUpperCase();
    }

    function isCMYKDoc(doc) {
        try { return doc.documentColorSpace == DocumentColorSpace.CMYK; } catch (e) { return false; }
    }

    // Illustrator colour object in the document's colour space
    function makeColor(doc, hex) {
        var c = hexToRgb(hex), col;
        if (isCMYKDoc(doc)) {
            var k = rgbToCmyk(c);
            col = new CMYKColor();
            col.cyan = k.c; col.magenta = k.m; col.yellow = k.y; col.black = k.k;
        } else {
            col = new RGBColor();
            col.red = c.r; col.green = c.g; col.blue = c.b;
        }
        return col;
    }

    // Colour string used inside LiveEffect XML: "5 r g b" (RGB 0..1) or "1 c m y k" (CMYK 0..1)
    function effectColorString(doc, hex) {
        var c = hexToRgb(hex);
        if (isCMYKDoc(doc)) {
            var k = rgbToCmyk(c);
            return '1 ' + num(k.c / 100) + ' ' + num(k.m / 100) + ' ' + num(k.y / 100) + ' ' + num(k.k / 100);
        }
        return '5 ' + num(c.r / 255) + ' ' + num(c.g / 255) + ' ' + num(c.b / 255);
    }

    // ------------------------------------------------------------------
    // LiveEffect XML (undocumented; names/params verified against
    // Adobe community forum threads and m1b's "Live Effect Functions
    // for Illustrator" on GitHub)
    // ------------------------------------------------------------------
    function xmlGaussianBlur(radius) {
        return '<LiveEffect name="Adobe PSL Gaussian Blur"><Dict data="R PrevDocScale 1 I PrevDres 300 R blur ' +
            num(radius) + ' "/></LiveEffect>';
    }

    function xmlRoundCorners(radius) {
        return '<LiveEffect name="Adobe Round Corners"><Dict data="R radius ' + num(radius) + ' "/></LiveEffect>';
    }

    // blnd: 0 normal, 1 multiply ; opac 0..1 ; horz/vert offsets pt (+vert = down) ; blur pt
    // csrc 0 = use colour (sclr), 1 = use darkness
    function xmlDropShadow(doc, opacity01, x, y, blur, hex) {
        return '<LiveEffect name="Adobe Drop Shadow"><Dict data="I blnd 1 R opac ' + num(opacity01) +
            ' R horz ' + num(x) + ' R vert ' + num(y) + ' R blur ' + num(blur) +
            ' B usePSLBlur 1 I csrc 0 R dark 100 B pair 1 "><Entry name="sclr" valueType="F"><Fill color="' +
            effectColorString(doc, hex) + '"/></Entry></Dict></LiveEffect>';
    }

    // ------------------------------------------------------------------
    // Settings persistence (flat JSON-ish file in Folder.userData)
    // ------------------------------------------------------------------
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
            else if (t === 'number') {
                var n = parseFloat(raw);
                if (!isNaN(n)) { out[k] = n; }
            } else if (t === 'string' && raw.charAt(0) === '"') {
                out[k] = raw.substring(1, raw.length - 1);
            }
        }
        return out;
    }

    function settingsFile() {
        return new File(Folder.userData + '/' + SETTINGS_FILE_NAME);
    }

    function loadSettings() {
        var S = copyObj(DEFAULTS);
        try {
            var f = settingsFile();
            if (!f.exists) { return S; }
            f.encoding = 'UTF-8';
            if (!f.open('r')) { return S; }
            var txt = f.read();
            f.close();
            var saved = parseSettings(txt, DEFAULTS);
            if (saved.rememberSettings === false) {
                S.rememberSettings = false;      // keep the user's "don't remember" choice only
                return S;
            }
            for (var k in saved) { if (saved.hasOwnProperty(k)) { S[k] = saved[k]; } }
            S.fillColor = normHex(S.fillColor) || DEFAULTS.fillColor;
            S.strokeColor = normHex(S.strokeColor) || DEFAULTS.strokeColor;
            S.shadowColor = normHex(S.shadowColor) || DEFAULTS.shadowColor;
        } catch (e) { /* ignore, use defaults */ }
        return S;
    }

    function saveSettings(S) {
        try {
            var data = S.rememberSettings ? copyObj(S) : { rememberSettings: false };
            var f = settingsFile();
            f.encoding = 'UTF-8';
            if (f.open('w')) {
                f.write(serialize(data));
                f.close();
            }
        } catch (e) { /* not critical */ }
    }

    // ------------------------------------------------------------------
    // Illustrator object helpers
    // ------------------------------------------------------------------
    function sameItem(a, b) {
        if (a === b) { return true; }
        try { if (a.uuid && b.uuid) { return a.uuid === b.uuid; } } catch (e) { }
        return false;
    }

    function getZ(item) {
        try {
            var z = item.absoluteZOrderPosition;
            return (typeof z === 'number') ? z : null;
        } catch (e) { return null; }
    }

    function isShape(item) {
        if (item.typename === 'PathItem') {
            try { if (item.guides || item.clipping) { return false; } } catch (e) { }
            return true;
        }
        return item.typename === 'CompoundPathItem';
    }

    // Collect PathItems / CompoundPathItems from the selection, recursing into groups.
    function gatherTargets(items, out, skipped) {
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var t = it.typename;
            if (t === 'PathItem') {
                var bad = false;
                try { bad = item_isGuideOrClip(it); } catch (e) { }
                if (bad) { skipped.push(t + ' (guide/clipping path)'); } else { out.push(it); }
            } else if (t === 'CompoundPathItem') {
                out.push(it);
            } else if (t === 'GroupItem') {
                var kids = [];
                for (var j = 0; j < it.pageItems.length; j++) { kids.push(it.pageItems[j]); }
                gatherTargets(kids, out, skipped);
            } else {
                skipped.push(t);
            }
        }
    }

    function item_isGuideOrClip(p) { return !!(p.guides || p.clipping); }

    function boundsOverlap(a, b) {
        // bounds = [left, top, right, bottom], top > bottom in Illustrator
        return !(a[2] < b[0] || a[0] > b[2] || a[1] < b[3] || a[3] > b[1]);
    }

    function layerChainOK(item, includeLocked) {
        try {
            var L = item.layer;
            while (L && L.typename === 'Layer') {
                if (!L.visible) { return false; }
                if (!includeLocked && L.locked) { return false; }
                L = L.parent;
            }
        } catch (e) { }
        return true;
    }

    function usableBackground(item, targetBounds, S) {
        try {
            if (item.hidden) { return false; }
            if (!S.includeLocked && item.locked) { return false; }
            if (item.typename === 'PathItem' && item.guides) { return false; }
            if (!layerChainOK(item, S.includeLocked)) { return false; }
            return boundsOverlap(item.visibleBounds, targetBounds);
        } catch (e) { return false; }
    }

    function collectLayerTopItems(layer, list) {
        // direct children of the layer first, then its sub-layers
        var i;
        for (i = 0; i < layer.pageItems.length; i++) { list.push(layer.pageItems[i]); }
        for (i = 0; i < layer.layers.length; i++) { collectLayerTopItems(layer.layers[i], list); }
    }

    // Visible, overlapping artwork beneath the target, ordered top -> bottom.
    function collectBeneath(doc, target, S) {
        var tb = target.visibleBounds;
        var result = [];
        var node = target, i;

        // 1. siblings below the target inside its parent groups
        while (node.parent && node.parent.typename !== 'Layer' && node.parent.typename !== 'Document') {
            var par = node.parent;
            if (par.typename === 'GroupItem') {
                var found = false;
                for (i = 0; i < par.pageItems.length; i++) {
                    var k = par.pageItems[i];
                    if (found) {
                        var isClipPath = false;
                        try { isClipPath = (k.typename === 'PathItem' && k.clipping); } catch (e1) { }
                        if (!isClipPath && usableBackground(k, tb, S)) { result.push(k); }
                    } else if (sameItem(k, node)) {
                        found = true;
                    }
                }
            }
            node = par;
        }

        // 2. top-level items (direct children of layers) below the target's top-level ancestor
        var all = [];
        for (i = 0; i < doc.layers.length; i++) { collectLayerTopItems(doc.layers[i], all); }
        var topZ = getZ(node);
        var below = [];
        if (topZ !== null) {
            for (i = 0; i < all.length; i++) {
                var z = getZ(all[i]);
                if (z !== null && z < topZ && !sameItem(all[i], node) && usableBackground(all[i], tb, S)) {
                    below.push({ item: all[i], z: z });
                }
            }
            below.sort(function (a, b) { return b.z - a.z; });
            for (i = 0; i < below.length; i++) { result.push(below[i].item); }
        } else {
            // fallback: assume list order == stacking order (top -> bottom)
            var seen = false;
            for (i = 0; i < all.length; i++) {
                if (seen) {
                    if (usableBackground(all[i], tb, S)) { result.push(all[i]); }
                } else if (sameItem(all[i], node)) {
                    seen = true;
                }
            }
        }
        return result;
    }

    function resetAppearance(item) {
        try { item.opacity = 100; } catch (e) { }
        try { item.blendingMode = BlendModes.NORMAL; } catch (e2) { }
    }

    function eachPath(item, fn) {
        if (item.typename === 'CompoundPathItem') {
            for (var i = 0; i < item.pathItems.length; i++) { fn(item.pathItems[i]); }
        } else if (item.typename === 'PathItem') {
            fn(item);
        }
    }

    function setFill(item, color) {
        eachPath(item, function (p) {
            if (color) { p.filled = true; p.fillColor = color; } else { p.filled = false; }
        });
    }

    function setStroke(item, color, width) {
        eachPath(item, function (p) {
            if (color && width > 0) {
                p.stroked = true;
                p.strokeColor = color;
                p.strokeWidth = width;
                try { p.strokeJoin = StrokeJoin.ROUNDENDJOIN; } catch (e) { }
            } else {
                p.stroked = false;
            }
        });
    }

    var gradientCounter = 0;
    function makeGradientColor(doc, hex, startOpacity, endOpacity, angle, session) {
        var col = makeColor(doc, hex);
        var gr = doc.gradients.add();
        gradientCounter++;
        try { gr.name = 'Glass Gradient ' + (new Date().getTime()) + '-' + gradientCounter; } catch (e) { }
        gr.type = GradientType.LINEAR;
        while (gr.gradientStops.length < 2) { gr.gradientStops.add(); }
        var s0 = gr.gradientStops[0], s1 = gr.gradientStops[gr.gradientStops.length - 1];
        s0.rampPoint = 0;   s0.midPoint = 50; s0.color = col;
        s1.rampPoint = 100; s1.color = makeColor(doc, hex);
        try { s0.opacity = startOpacity; s1.opacity = endOpacity; } catch (e2) {
            session.warnings.push('Gradient stop opacity not supported in this Illustrator version.');
        }
        session.gradients.push(gr);
        var gc = new GradientColor();
        gc.gradient = gr;
        try { gc.angle = angle; } catch (e3) { }
        return gc;
    }

    function selectOnly(doc, item) {
        doc.selection = null;
        item.selected = true;
    }

    // Applies Round Corners and expands it so the geometry can be used as a clipping path.
    // Returns { item: newItem, expanded: bool }
    function roundCorners(doc, item, radius) {
        item.applyEffect(xmlRoundCorners(radius));
        try {
            selectOnly(doc, item);
            app.executeMenuCommand('expandStyle');
            var sel = doc.selection;
            if (!sel || sel.length !== 1) { throw new Error('expand'); }
            var res = sel[0];
            if (res.typename === 'GroupItem' && res.pageItems.length === 1) {
                var child = res.pageItems[0];
                child.move(res, ElementPlacement.PLACEBEFORE);
                res.remove();
                res = child;
            }
            doc.selection = null;
            if (res.typename !== 'PathItem' && res.typename !== 'CompoundPathItem') { throw new Error('type'); }
            return { item: res, expanded: true };
        } catch (e) {
            try { doc.selection = null; } catch (e2) { }
            // item still carries the live Round Corners effect; duplicates inherit it
            return { item: item, expanded: false };
        }
    }

    function newGroupIn(layer, container, name) {
        var g = layer.groupItems.add();
        g.move(container, ElementPlacement.PLACEATEND);
        g.name = name;
        return g;
    }

    // ------------------------------------------------------------------
    // Build one glass object
    // ------------------------------------------------------------------
    function buildGlass(doc, target, S, session) {
        var layer = target.layer;
        var beneath = (S.blurOn) ? collectBeneath(doc, target, S) : [];

        var glass = layer.groupItems.add();
        glass.move(target, ElementPlacement.PLACEBEFORE);
        glass.name = 'Glass';
        session.created.push(glass);

        // ---- base geometry (clean copy of the shape, optionally rounded) ----
        // Built next to the original (outside the Glass group) so that expanding
        // Round Corners can never swallow or delete the Glass group itself.
        var base = target.duplicate(target, ElementPlacement.PLACEBEFORE);
        var maskRounded = true;
        try {
            resetAppearance(base);
            setFill(base, makeColor(doc, '808080'));
            setStroke(base, null, 0);
            if (S.cornerOn && S.cornerRadius > 0) {
                var rc = roundCorners(doc, base, S.cornerRadius);
                base = rc.item;
                maskRounded = rc.expanded;
                if (!rc.expanded) {
                    session.warnings.push('Could not expand Round Corners; the blurred background keeps sharp corners.');
                }
            }
            base.move(glass, ElementPlacement.PLACEATEND);
        } catch (eBase) {
            try { base.remove(); } catch (eR) { }
            throw eBase;
        }

        // ---- border (top) ----
        if (S.strokeOn && S.strokeWidth > 0 && S.strokeOpacity > 0) {
            var border = base.duplicate(glass, ElementPlacement.PLACEATEND);
            border.name = 'Glass Border';
            setFill(border, null);
            var sCol = S.strokeGradient ?
                makeGradientColor(doc, S.strokeColor, 100, 10, S.gradAngle, session) :
                makeColor(doc, S.strokeColor);
            setStroke(border, sCol, S.strokeWidth);
            border.opacity = S.strokeOpacity;
        }

        // ---- fill ----
        var fill = base.duplicate(glass, ElementPlacement.PLACEATEND);
        fill.name = 'Glass Fill';
        var fCol = S.fillGradient ?
            makeGradientColor(doc, S.fillColor, 100, S.gradEndOpacity, S.gradAngle, session) :
            makeColor(doc, S.fillColor);
        setFill(fill, fCol);
        fill.opacity = S.fillOpacity;

        // ---- blurred background (clip group) ----
        if (S.blurOn) {
            if (beneath.length) {
                var clip = newGroupIn(layer, glass, 'Glass Background (blurred)');
                var copies = newGroupIn(layer, clip, 'Background copies');
                var failed = 0;
                for (var i = 0; i < beneath.length; i++) {
                    try {
                        var cp = beneath[i].duplicate(copies, ElementPlacement.PLACEATEND);
                        try { cp.locked = false; } catch (eL) { }
                    } catch (eD) { failed++; }
                }
                if (failed) { session.warnings.push(failed + ' background object(s) could not be copied.'); }
                if (copies.pageItems.length) {
                    var mask = base.duplicate(clip, ElementPlacement.PLACEATBEGINNING);
                    mask.name = 'Glass Mask';
                    clip.clipped = true;
                    if (S.blurRadius > 0) { copies.applyEffect(xmlGaussianBlur(S.blurRadius)); }
                } else {
                    clip.remove();
                }
            } else {
                session.notes.noBackground++;
            }
        }

        // ---- shadow (bottom) ----
        if (S.shadowOn && S.shadowOpacity > 0) {
            if (S.shadowMethod === 1) {
                // Live Drop Shadow on the fill. Its strength is multiplied by the fill's own
                // opacity, so compensate (capped at 100%).
                var op = S.shadowOpacity / Math.max(S.fillOpacity, 1);
                if (op > 1) {
                    op = 1;
                    session.warnings.push('Live Drop Shadow can\'t be stronger than the fill opacity; use "Separate layer" for a stronger shadow.');
                }
                fill.applyEffect(xmlDropShadow(doc, op, S.shadowX, S.shadowY, S.shadowBlur, S.shadowColor));
            } else {
                var sh = base.duplicate(glass, ElementPlacement.PLACEATEND);
                sh.name = 'Glass Shadow';
                setFill(sh, makeColor(doc, S.shadowColor));
                sh.opacity = S.shadowOpacity;
                sh.translate(S.shadowX, -S.shadowY);
                if (S.shadowBlur > 0) { sh.applyEffect(xmlGaussianBlur(S.shadowBlur)); }
            }
        }

        base.remove();
        if (!maskRounded) { /* noted in warnings */ }

        // hide original (deleted later if "Replace original" is on)
        target.hidden = true;
        session.hidden.push(target);
        session.glassGroups.push(glass);
        return glass;
    }

    // ------------------------------------------------------------------
    // Session = everything one run created, so preview can be undone
    // without relying on app.undo()
    // ------------------------------------------------------------------
    function Session() {
        this.created = [];
        this.glassGroups = [];
        this.hidden = [];
        this.gradients = [];
        this.warnings = [];
        this.notes = { noBackground: 0 };
    }

    function cleanupSession(session) {
        var i;
        for (i = session.created.length - 1; i >= 0; i--) { try { session.created[i].remove(); } catch (e) { } }
        for (i = 0; i < session.hidden.length; i++) { try { session.hidden[i].hidden = false; } catch (e2) { } }
        for (i = 0; i < session.gradients.length; i++) { try { session.gradients[i].remove(); } catch (e3) { } }
        session.created = []; session.glassGroups = []; session.hidden = []; session.gradients = [];
    }

    function uniqueWarnings(list) {
        var seen = {}, out = [];
        for (var i = 0; i < list.length; i++) {
            if (!seen[list[i]]) { seen[list[i]] = 1; out.push(list[i]); }
        }
        return out;
    }

    function sortBottomFirst(targets) {
        var withZ = [], allZ = true, i;
        for (i = 0; i < targets.length; i++) {
            var z = getZ(targets[i]);
            if (z === null) { allZ = false; }
            withZ.push({ item: targets[i], z: z, idx: i });
        }
        if (allZ) {
            withZ.sort(function (a, b) { return a.z - b.z; });
        } else {
            withZ.reverse();     // selection is usually top-first
        }
        var out = [];
        for (i = 0; i < withZ.length; i++) { out.push(withZ[i].item); }
        return out;
    }

    function runAll(doc, targets, S) {
        var session = new Session();
        var ordered = sortBottomFirst(targets);
        for (var i = 0; i < ordered.length; i++) {
            try {
                buildGlass(doc, ordered[i], S, session);
            } catch (e) {
                session.warnings.push('Failed on one shape: ' + e.message + (e.line ? ' (line ' + e.line + ')' : ''));
            }
        }
        try { doc.selection = null; } catch (e2) { }
        return session;
    }

    // ------------------------------------------------------------------
    // Dialog
    // ------------------------------------------------------------------
    function showDialog(doc, targets, skipped, S) {
        var LABEL_W = 96;
        var ctl = {};             // key -> { set: fn }
        var enableRules = [];     // [groupControl, function () { return bool; }]
        var suspend = false;
        var previewSession = null;

        var dlg = new Window('dialog', SCRIPT_NAME + ' ' + VERSION);
        dlg.orientation = 'column';
        dlg.alignChildren = ['fill', 'top'];
        dlg.spacing = 8;

        var cols = dlg.add('group');
        cols.orientation = 'row';
        cols.alignChildren = ['fill', 'top'];
        var col1 = cols.add('group'); col1.orientation = 'column'; col1.alignChildren = ['fill', 'top'];
        var col2 = cols.add('group'); col2.orientation = 'column'; col2.alignChildren = ['fill', 'top'];

        function addPanel(parent, title) {
            var p = parent.add('panel', undefined, title);
            p.orientation = 'column';
            p.alignChildren = ['left', 'center'];
            p.margins = [10, 14, 10, 8];
            p.spacing = 4;
            return p;
        }

        function row(parent) {
            var g = parent.add('group');
            g.orientation = 'row';
            g.alignChildren = ['left', 'center'];
            g.spacing = 6;
            return g;
        }

        function addSlider(parent, label, key, min, max, dec, unit) {
            var g = row(parent);
            var st = g.add('statictext', undefined, label);
            st.preferredSize.width = LABEL_W;
            var sl = g.add('slider', undefined, clamp(S[key], min, max), min, max);
            sl.preferredSize.width = 150;
            var et = g.add('edittext', undefined, fmt(S[key], dec));
            et.characters = 6;
            var u = g.add('statictext', undefined, unit || '');
            u.preferredSize.width = 24;
            sl.onChanging = function () {
                var v = roundTo(sl.value, dec);
                et.text = fmt(v, dec);
                S[key] = v;
            };
            sl.onChange = function () { sl.onChanging(); changed(); };
            et.onChange = function () {
                var v = parseFloat(String(et.text).replace(',', '.'));
                if (isNaN(v)) { v = S[key]; }
                v = clamp(roundTo(v, dec), min, max);
                S[key] = v;
                et.text = fmt(v, dec);
                sl.value = v;
                changed();
            };
            ctl[key] = { set: function (v) { v = clamp(v, min, max); sl.value = v; et.text = fmt(v, dec); } };
            return g;
        }

        function addCheck(parent, label, key, refreshPreview) {
            var cb = parent.add('checkbox', undefined, label);
            cb.value = !!S[key];
            cb.onClick = function () {
                S[key] = cb.value;
                updateEnabled();
                if (refreshPreview !== false) { changed(); }
            };
            ctl[key] = { set: function (v) { cb.value = !!v; } };
            return cb;
        }

        function addColor(parent, label, key) {
            var g = row(parent);
            var st = g.add('statictext', undefined, label);
            st.preferredSize.width = LABEL_W;
            var et = g.add('edittext', undefined, '#' + S[key]);
            et.characters = 8;
            var sw = g.add('group');
            sw.preferredSize = [30, 18];
            sw.onDraw = function () {
                var gr = this.graphics;
                var c = hexToRgb(S[key]);
                var w = this.size[0], h = this.size[1];
                gr.newPath();
                gr.rectPath(0, 0, w, h);
                gr.fillPath(gr.newBrush(gr.BrushType.SOLID_COLOR, [c.r / 255, c.g / 255, c.b / 255, 1]));
                gr.newPath();
                gr.rectPath(0, 0, w, h);
                gr.strokePath(gr.newPen(gr.PenType.SOLID_COLOR, [0.5, 0.5, 0.5, 1], 1));
            };
            var pick = g.add('button', undefined, 'Pick...');
            pick.preferredSize.width = 56;
            function apply(hex) {
                S[key] = hex;
                et.text = '#' + hex;
                try { sw.hide(); sw.show(); } catch (e) { }
            }
            et.onChange = function () {
                var h = normHex(et.text);
                if (!h) { alert('Please enter a hex colour like #FFFFFF or #FFF.'); h = S[key]; }
                apply(h);
                changed();
            };
            pick.onClick = function () {
                try {
                    var r = $.colorPicker(parseInt(S[key], 16));
                    if (r >= 0) { apply(intToHex(r)); changed(); }
                } catch (e) { alert('Colour picker not available; type a hex value instead.'); }
            };
            ctl[key] = { set: function (v) { apply(normHex(v) || '000000'); } };
            return g;
        }

        function addRule(control, fn) { enableRules.push([control, fn]); }

        function updateEnabled() {
            for (var i = 0; i < enableRules.length; i++) {
                try { enableRules[i][0].enabled = !!enableRules[i][1](); } catch (e) { }
            }
        }

        // ---------------- Fill ----------------
        var pFill = addPanel(col1, 'Fill');
        addColor(pFill, 'Colour', 'fillColor');
        addSlider(pFill, 'Opacity', 'fillOpacity', 0, 100, 0, '%');
        addCheck(pFill, 'Subtle gradient (fades the fill)', 'fillGradient');
        var gEnd = addSlider(pFill, 'Gradient end', 'gradEndOpacity', 0, 100, 0, '%');
        var gAng = addSlider(pFill, 'Gradient angle', 'gradAngle', -180, 180, 0, 'deg');
        addRule(gEnd, function () { return S.fillGradient; });
        addRule(gAng, function () { return S.fillGradient || (S.strokeOn && S.strokeGradient); });

        // ---------------- Blur ----------------
        var pBlur = addPanel(col1, 'Background blur');
        addCheck(pBlur, 'Blur the artwork behind the glass', 'blurOn');
        var gBlur = addSlider(pBlur, 'Blur radius', 'blurRadius', 0, 200, 1, 'pt');
        var cbLocked = addCheck(pBlur, 'Include locked artwork', 'includeLocked');
        addRule(gBlur, function () { return S.blurOn; });
        addRule(cbLocked, function () { return S.blurOn; });

        // ---------------- Corners ----------------
        var pCorner = addPanel(col1, 'Corners');
        addCheck(pCorner, 'Round corners', 'cornerOn');
        var gCorner = addSlider(pCorner, 'Corner radius', 'cornerRadius', 0, 300, 1, 'pt');
        addRule(gCorner, function () { return S.cornerOn; });

        // ---------------- Border ----------------
        var pStroke = addPanel(col2, 'Border');
        addCheck(pStroke, 'Border', 'strokeOn');
        var gSW = addSlider(pStroke, 'Width', 'strokeWidth', 0, 20, 2, 'pt');
        var gSC = addColor(pStroke, 'Colour', 'strokeColor');
        var gSO = addSlider(pStroke, 'Opacity', 'strokeOpacity', 0, 100, 0, '%');
        var cbSG = addCheck(pStroke, 'Light-edge gradient (uses gradient angle)', 'strokeGradient');
        addRule(gSW, function () { return S.strokeOn; });
        addRule(gSC, function () { return S.strokeOn; });
        addRule(gSO, function () { return S.strokeOn; });
        addRule(cbSG, function () { return S.strokeOn; });

        // ---------------- Shadow ----------------
        var pShadow = addPanel(col2, 'Drop shadow');
        addCheck(pShadow, 'Drop shadow', 'shadowOn');
        var gMethod = row(pShadow);
        var stM = gMethod.add('statictext', undefined, 'Method');
        stM.preferredSize.width = LABEL_W;
        var ddMethod = gMethod.add('dropdownlist', undefined, ['Separate blurred layer (recommended)', 'Live "Drop Shadow" effect']);
        ddMethod.selection = (S.shadowMethod === 1) ? 1 : 0;
        ddMethod.onChange = function () {
            if (!ddMethod.selection) { return; }
            S.shadowMethod = ddMethod.selection.index;
            changed();
        };
        ctl.shadowMethod = { set: function (v) { ddMethod.selection = (v === 1) ? 1 : 0; } };
        var gShC = addColor(pShadow, 'Colour', 'shadowColor');
        var gShO = addSlider(pShadow, 'Opacity', 'shadowOpacity', 0, 100, 0, '%');
        var gShX = addSlider(pShadow, 'X offset', 'shadowX', -200, 200, 1, 'pt');
        var gShY = addSlider(pShadow, 'Y offset', 'shadowY', -200, 200, 1, 'pt');
        var gShB = addSlider(pShadow, 'Blur', 'shadowBlur', 0, 200, 1, 'pt');
        var shRule = function () { return S.shadowOn; };
        addRule(gMethod, shRule); addRule(gShC, shRule); addRule(gShO, shRule);
        addRule(gShX, shRule); addRule(gShY, shRule); addRule(gShB, shRule);

        // ---------------- Presets ----------------
        var pPre = addPanel(dlg, 'Presets');
        pPre.orientation = 'row';
        pPre.alignChildren = ['left', 'center'];
        function presetButton(p) {
            var b = pPre.add('button', undefined, p.name);
            b.onClick = function () { applyValues(p.values); };
        }
        for (var pi = 0; pi < PRESETS.length; pi++) { presetButton(PRESETS[pi]); }
        var bReset = pPre.add('button', undefined, 'Reset to defaults');
        bReset.onClick = function () { applyValues(DEFAULTS); };

        // ---------------- Options ----------------
        var pOpt = addPanel(dlg, 'Options');
        pOpt.orientation = 'row';
        pOpt.alignChildren = ['left', 'center'];
        addCheck(pOpt, 'Replace original', 'replaceOriginal', false);
        addCheck(pOpt, 'Remember my settings', 'rememberSettings', false);
        var cbPreview = addCheck(pOpt, 'Live preview', 'livePreview');

        var info = dlg.add('statictext', undefined,
            targets.length + ' shape(s) selected' +
            (skipped.length ? ', ' + skipped.length + ' unsupported object(s) will be skipped.' : '.'),
            { multiline: true });
        info.preferredSize = [560, 34];

        var btns = dlg.add('group');
        btns.alignment = ['right', 'center'];
        btns.add('button', undefined, 'Cancel', { name: 'cancel' });
        btns.add('button', undefined, 'Apply', { name: 'ok' });

        function applyValues(vals) {
            suspend = true;
            for (var k in vals) {
                if (!vals.hasOwnProperty(k) || OPTION_KEYS[k]) { continue; }
                S[k] = vals[k];
                if (ctl[k]) { ctl[k].set(vals[k]); }
            }
            suspend = false;
            updateEnabled();
            changed();
        }

        function setInfo(session) {
            var msg = targets.length + ' shape(s) selected.';
            if (skipped.length) { msg += ' Skipping ' + skipped.length + ' unsupported object(s).'; }
            if (session) {
                if (session.notes.noBackground) { msg += ' ' + session.notes.noBackground + ' shape(s) have no artwork behind them to blur.'; }
                var w = uniqueWarnings(session.warnings);
                if (w.length) { msg += ' ' + w.join(' '); }
            }
            info.text = msg;
        }

        function clearPreview() {
            if (previewSession) {
                cleanupSession(previewSession);
                previewSession = null;
            }
        }

        function changed() {
            if (suspend) { return; }
            if (!S.livePreview) {
                if (previewSession) { clearPreview(); try { app.redraw(); } catch (e0) { } }
                return;
            }
            clearPreview();
            previewSession = runAll(doc, targets, S);
            try { app.redraw(); } catch (e) { }
            setInfo(previewSession);
        }

        updateEnabled();
        if (S.livePreview) { changed(); }

        var res = dlg.show();
        clearPreview();
        try { app.redraw(); } catch (e2) { }
        return res === 1;
    }

    // ------------------------------------------------------------------
    // Main
    // ------------------------------------------------------------------
    function main() {
        if (app.documents.length === 0) {
            alert(SCRIPT_NAME + ':\nOpen a document and select one or more shapes first.');
            return;
        }
        var doc = app.activeDocument;
        var sel = doc.selection;
        if (sel && sel.typename) {
            alert(SCRIPT_NAME + ':\nYou are editing text. Press Esc, then select shapes (not text) and run the script again.');
            return;
        }
        if (!sel || sel.length === 0) {
            alert(SCRIPT_NAME + ':\nNothing is selected. Select one or more shapes (paths, compound paths or groups of them).');
            return;
        }
        var selCopy = [], i;
        for (i = 0; i < sel.length; i++) { selCopy.push(sel[i]); }

        var targets = [], skipped = [];
        gatherTargets(selCopy, targets, skipped);
        if (!targets.length) {
            alert(SCRIPT_NAME + ':\nNo supported shapes in the selection.\nSupported: paths, compound paths and groups containing them.\nSkipped: ' + uniqueWarnings(skipped).join(', '));
            return;
        }

        var S = loadSettings();
        var ok = showDialog(doc, targets, skipped, S);
        if (!ok) { return; }
        saveSettings(S);

        var session = runAll(doc, targets, S);
        if (S.replaceOriginal) {
            for (i = 0; i < session.hidden.length; i++) { try { session.hidden[i].remove(); } catch (e) { } }
        }
        try {
            doc.selection = null;
            for (i = 0; i < session.glassGroups.length; i++) { session.glassGroups[i].selected = true; }
        } catch (e2) { }
        app.redraw();

        var msgs = [];
        if (skipped.length) { msgs.push('Skipped unsupported objects: ' + uniqueWarnings(skipped).join(', ') + '.'); }
        if (S.blurOn && session.notes.noBackground) {
            msgs.push(session.notes.noBackground + ' shape(s) had no visible artwork behind them, so there was nothing to blur.');
        }
        var w = uniqueWarnings(session.warnings);
        for (i = 0; i < w.length; i++) { msgs.push(w[i]); }
        if (msgs.length) {
            alert(SCRIPT_NAME + ': created ' + session.glassGroups.length + ' glass object(s).\n\n' + msgs.join('\n'));
        }
    }

    return {
        main: main,
        // exposed for offline testing
        _test: {
            serialize: serialize, parseSettings: parseSettings, normHex: normHex, hexToRgb: hexToRgb,
            rgbToCmyk: rgbToCmyk, intToHex: intToHex, xmlGaussianBlur: xmlGaussianBlur,
            xmlRoundCorners: xmlRoundCorners, xmlDropShadow: xmlDropShadow, boundsOverlap: boundsOverlap,
            DEFAULTS: DEFAULTS, PRESETS: PRESETS, copyObj: copyObj
        }
    };
})();

if (typeof app !== 'undefined' && typeof Window !== 'undefined') {
    try {
        GlassmorphismScript.main();
    } catch (err) {
        alert('Glassmorphism error:\n' + err.message + (err.line ? '\n(line ' + err.line + ')' : ''));
    }
} else if (typeof module !== 'undefined') {
    module.exports = GlassmorphismScript;
}
