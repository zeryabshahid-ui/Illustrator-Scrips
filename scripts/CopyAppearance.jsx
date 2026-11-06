#target illustrator
#targetengine 'copyAppearance'
/*
 * CopyAppearance.jsx  -  "Copy Appearance" for Adobe Illustrator
 * ---------------------------------------------------------------
 * Copies the full APPEARANCE of one object and applies it to one or many other objects.
 * Appearance = everything in the Appearance panel: fills and strokes (incl. multiple
 * fills/strokes, stroke weight, caps, joins, dashes, alignment, brushes, gradients,
 * patterns), live effects (drop shadow, offset path, etc.), opacity and blending mode.
 * It does NOT copy the object's path shape, size, position or contents.
 *
 * HOW TO USE  (a floating panel opens; it stays open while you work)
 *   Copy appearance
 *     Select the source object and click "Copy appearance". If several objects are
 *     selected, the frontmost (top of the stacking order) one is used. The appearance
 *     is stored in the document as the graphic style "[Copied Appearance]", so it is
 *     still there after you change the selection (or close and re-open the panel).
 *   Apply to selected
 *     Select one or many target objects and click "Apply to selected". The stored
 *     appearance is applied to every selected object.
 *   Apply topmost to the rest
 *     Select the source AND the targets, with the source in front of the others.
 *     One click copies the frontmost object's appearance onto all the other selected
 *     objects. No Copy step is needed and the stored appearance is not changed.
 *
 *   Locked or hidden objects, and placed/raster images, are skipped and counted.
 *   Your selection is restored after every action.
 *
 * HOW IT WORKS
 *   Illustrator has no scriptable "Paste Appearance", so the script makes a graphic
 *   style from the source (Graphic Styles panel > New Graphic Style) and applies it
 *   with GraphicStyle.applyTo(). Re-copying replaces the "[Copied Appearance]" style,
 *   so the document never fills up with duplicates. Objects already styled keep their
 *   look when the style is replaced or deleted.
 *
 * ExtendScript (ES3). Tested for syntax only; behaviour can vary slightly by Illustrator version.
 */
(function () {
    var SCRIPT_NAME = 'Copy Appearance';
    var STYLE_NAME = '[Copied Appearance]';
    var TEMP_STYLE_NAME = '[Copied Appearance - temp]';

    // ------------------------------------------------------------------
    // Document work. This function is sent to Illustrator through BridgeTalk,
    // so it must be fully self-contained (no references to outer variables).
    // Returns 'OK\t<status>' or 'ALERT\t<message>\t<status>'.
    // ------------------------------------------------------------------
    function core(action, styleName, tempName) {
        function res(kind, msg, status) { return kind + '\t' + msg + '\t' + (status || ''); }

        function getStyle(doc, name) {
            var gs = doc.graphicStyles;
            for (var i = 0; i < gs.length; i++) {
                try { if (gs[i].name === name) { return gs[i]; } } catch (e) { }
            }
            return null;
        }

        function removeStyle(doc, name) {
            var guard = 0, s = getStyle(doc, name);
            while (s && guard < 50) {
                guard++;
                try { s.remove(); } catch (e) { return; }
                s = getStyle(doc, name);
            }
        }

        function isEditable(item) {
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

        // A path inside a compound path takes its appearance from the compound path.
        function normalize(item) {
            try { if (item.parent && item.parent.typename === 'CompoundPathItem') { return item.parent; } } catch (e) { }
            return item;
        }

        function sameItem(a, b) {
            if (a === b) { return true; }
            try { return a.uuid !== undefined && a.uuid === b.uuid; } catch (e) { }
            return false;
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

        function isImage(item) {
            var t = '';
            try { t = item.typename; } catch (e) { }
            return t === 'RasterItem' || t === 'PlacedItem';
        }

        function copyArray(a) { var r = []; for (var i = 0; i < a.length; i++) { r.push(a[i]); } return r; }

        function restoreSelection(doc, items) {
            try { doc.selection = null; } catch (e) { }
            try { doc.selection = items; } catch (e2) {
                for (var i = 0; i < items.length; i++) { try { items[i].selected = true; } catch (e3) { } }
            }
        }

        // Makes a graphic style named "name" from "source" (replacing any older one).
        function makeStyle(doc, source, name) {
            removeStyle(doc, name);
            var before = {}, gs = doc.graphicStyles, i;
            var countBefore = gs.length;
            for (i = 0; i < gs.length; i++) { try { before[gs[i].name] = true; } catch (e) { } }

            try { doc.selection = null; } catch (eS) { }
            source.selected = true;
            app.executeMenuCommand('Adobe New Style Shortcut');

            gs = doc.graphicStyles;
            if (gs.length <= countBefore) { return null; }
            var made = null;
            for (i = gs.length - 1; i >= 0; i--) {
                var n = '';
                try { n = gs[i].name; } catch (e1) { }
                if (!before[n]) { made = gs[i]; break; }
            }
            if (!made) { made = gs[gs.length - 1]; }
            try { made.name = name; } catch (e2) { }
            return made;
        }

        // Applies style to targets. Returns counts.
        function applyStyle(style, targets, source) {
            var c = { done: 0, locked: 0, images: 0, failed: 0 };
            var seen = [];
            for (var i = 0; i < targets.length; i++) {
                var t = normalize(targets[i]);
                var dup = false;
                for (var j = 0; j < seen.length; j++) { if (sameItem(seen[j], t)) { dup = true; break; } }
                if (dup) { continue; }
                seen.push(t);
                if (source && sameItem(t, source)) { continue; }
                if (!isEditable(t)) { c.locked++; continue; }
                if (isImage(t)) { c.images++; continue; }
                try { style.applyTo(t); c.done++; } catch (e) { c.failed++; }
            }
            return c;
        }

        function summary(c) {
            var s = 'Updated ' + c.done + ' object' + (c.done === 1 ? '' : 's') + '.';
            var extra = [];
            if (c.locked) { extra.push(c.locked + ' locked/hidden'); }
            if (c.images) { extra.push(c.images + ' image' + (c.images === 1 ? '' : 's')); }
            if (c.failed) { extra.push(c.failed + ' failed'); }
            if (extra.length) { s += ' Skipped: ' + extra.join(', ') + '.'; }
            return s;
        }

        try {
            if (app.documents.length === 0) { return res('ALERT', 'Open a document first.', 'No document open.'); }
            var doc = app.activeDocument;
            var hasStored = !!getStyle(doc, styleName);
            var storedTxt = hasStored ? 'Appearance stored.' : 'Nothing copied yet.';

            if (action === 'status') { return res('OK', '', storedTxt); }

            var sel = doc.selection;
            if (sel && sel.typename === 'TextRange') {
                return res('ALERT', 'You are editing text. Press Esc to leave text editing, select the object(s) with the Selection tool, and try again.', storedTxt);
            }
            if (!sel || !sel.length) {
                if (action === 'copy') { return res('ALERT', 'Select the object whose appearance you want to copy.', storedTxt); }
                if (action === 'apply') {
                    if (!hasStored) { return res('ALERT', 'Copy an appearance first: select the source object and click "Copy appearance".', storedTxt); }
                    return res('ALERT', 'Select the object(s) you want to apply the appearance to.', storedTxt);
                }
                return res('ALERT', 'Select the source object and the targets (at least two objects), with the source in front.', storedTxt);
            }
            var original = copyArray(sel);

            if (action === 'copy') {
                var src = normalize(original.length === 1 ? original[0] : pickTopmost(original));
                var st = makeStyle(doc, src, styleName);
                restoreSelection(doc, original);
                if (!st) {
                    return res('ALERT', 'Illustrator could not create the style from this object. Open Window > Graphic Styles once and try again.', storedTxt);
                }
                try { app.redraw(); } catch (eR) { }
                var what = '';
                try { what = src.typename.replace(/Item$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(); } catch (eT) { what = 'object'; }
                var msg = 'Appearance stored (from ' + (original.length === 1 ? 'the selected ' + what : 'the frontmost of ' + original.length + ' selected objects') + ').';
                return res('OK', '', msg);
            }

            if (action === 'apply') {
                var stored = getStyle(doc, styleName);
                if (!stored) { return res('ALERT', 'Copy an appearance first: select the source object and click "Copy appearance".', storedTxt); }
                var c1 = applyStyle(stored, original, null);
                restoreSelection(doc, original);
                try { app.redraw(); } catch (eR1) { }
                var s1 = 'Appearance stored. ' + summary(c1);
                if (!c1.done) { return res('ALERT', 'Nothing was updated. ' + summary(c1), s1); }
                return res('OK', '', s1);
            }

            if (action === 'topmost') {
                if (original.length < 2) {
                    return res('ALERT', 'Select at least two objects: the source in front, plus one or more targets.', storedTxt);
                }
                var top = normalize(pickTopmost(original));
                var tmp = makeStyle(doc, top, tempName);
                if (!tmp) {
                    restoreSelection(doc, original);
                    return res('ALERT', 'Illustrator could not create the style from the frontmost object. Open Window > Graphic Styles once and try again.', storedTxt);
                }
                var c2 = applyStyle(tmp, original, top);
                try { tmp.remove(); } catch (eRm) { }
                restoreSelection(doc, original);
                try { app.redraw(); } catch (eR2) { }
                var s2 = storedTxt + ' Topmost: ' + summary(c2);
                if (!c2.done) { return res('ALERT', 'Nothing was updated. ' + summary(c2), s2); }
                return res('OK', '', s2);
            }
            return res('ALERT', 'Unknown action: ' + action, storedTxt);
        } catch (err) {
            return res('ALERT', 'Error: ' + err + (err.line ? ' (line ' + err.line + ')' : ''), '');
        }
    }

    // ------------------------------------------------------------------
    // Running an action (BridgeTalk keeps palette clicks safe in Illustrator)
    // ------------------------------------------------------------------
    function quote(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }

    function handleResult(text, statusTxt) {
        var parts = String(text || '').split('\t');
        var kind = parts[0], msg = parts[1] || '', status = parts[2] || '';
        if (status) { statusTxt.text = status; }
        if (kind === 'ALERT' && msg) { alert(msg, SCRIPT_NAME); }
        else if (kind !== 'OK' && text) { statusTxt.text = String(text); }
    }

    function run(action, statusTxt) {
        var body = '(' + core.toString() + ')(' + quote(action) + ',' + quote(STYLE_NAME) + ',' + quote(TEMP_STYLE_NAME) + ');';
        var sent = false;
        try {
            var bt = new BridgeTalk();
            bt.target = 'illustrator';
            bt.body = body;
            bt.onResult = function (r) { handleResult(r.body, statusTxt); };
            bt.onError = function (r) { statusTxt.text = 'Error'; alert('Error: ' + r.body, SCRIPT_NAME); };
            sent = bt.send();
        } catch (e) { sent = false; }
        if (!sent) {
            // Fallback: run directly in this engine.
            handleResult(core(action, STYLE_NAME, TEMP_STYLE_NAME), statusTxt);
        }
    }

    // ------------------------------------------------------------------
    // Palette
    // ------------------------------------------------------------------
    if ($.global.__copyAppearanceWin) {
        try { $.global.__copyAppearanceWin.show(); $.global.__copyAppearanceWin.active = true; return; } catch (eW) { }
    }

    var w = new Window('palette', SCRIPT_NAME);
    w.orientation = 'column';
    w.alignChildren = ['fill', 'top'];
    w.spacing = 6;
    w.margins = 10;

    var info = w.add('statictext', undefined,
        '1. Select the source and click Copy appearance.\n' +
        '2. Select one or many targets and click Apply to selected.\n' +
        'Or select everything (source in front) and click Apply topmost to the rest.',
        { multiline: true });
    info.preferredSize = [290, 54];

    var bCopy = w.add('button', undefined, 'Copy appearance');
    bCopy.helpTip = 'Store the appearance of the selected object (frontmost one if several are selected).';
    var bApply = w.add('button', undefined, 'Apply to selected');
    bApply.helpTip = 'Apply the stored appearance to every selected object.';
    var bTop = w.add('button', undefined, 'Apply topmost to the rest');
    bTop.helpTip = 'Copy the frontmost selected object\'s appearance onto all the other selected objects.';

    var pS = w.add('panel', undefined, 'Status');
    pS.alignChildren = ['fill', 'top'];
    var statusTxt = pS.add('statictext', undefined, 'Checking...', { multiline: true });
    statusTxt.preferredSize = [270, 34];

    var bClose = w.add('button', undefined, 'Close');

    bCopy.onClick = function () { run('copy', statusTxt); };
    bApply.onClick = function () { run('apply', statusTxt); };
    bTop.onClick = function () { run('topmost', statusTxt); };
    bClose.onClick = function () { w.close(); };
    w.onClose = function () { $.global.__copyAppearanceWin = null; };

    $.global.__copyAppearanceWin = w;
    w.show();
    run('status', statusTxt);
})();
