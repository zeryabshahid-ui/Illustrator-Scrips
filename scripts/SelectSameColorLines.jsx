/*
  Select Same Color Lines  -  Adobe Illustrator script
  Select one line/path, run the script, and every path in the document with the
  same stroke color gets selected. Optionally change the stroke weight of all of them at once.
*/
#target illustrator
(function () {
    if (app.documents.length === 0) { alert('Open a document first.'); return; }
    var doc = app.activeDocument;

    // ---------- reference path ----------
    function findPath(item) {
        if (!item) { return null; }
        if (item.typename === 'PathItem') { return item; }
        if (item.typename === 'CompoundPathItem' && item.pathItems.length) { return item.pathItems[0]; }
        if (item.typename === 'GroupItem') {
            for (var i = 0; i < item.pageItems.length; i++) {
                var p = findPath(item.pageItems[i]);
                if (p) { return p; }
            }
        }
        return null;
    }
    var sel = doc.selection, refPath = null;
    if (sel && sel.length) {
        for (var s = 0; s < sel.length && !refPath; s++) { refPath = findPath(sel[s]); }
    }
    if (!refPath || !refPath.stroked) {
        alert('Select a line or path that has a stroke, then run the script again.');
        return;
    }
    var ref = refPath.strokeColor;
    var refWeight = refPath.strokeWidth;

    // ---------- color helpers ----------
    function describe(c) {
        if (!c) { return 'none'; }
        switch (c.typename) {
            case 'RGBColor': return 'RGB ' + Math.round(c.red) + ', ' + Math.round(c.green) + ', ' + Math.round(c.blue);
            case 'CMYKColor': return 'CMYK ' + Math.round(c.cyan) + ', ' + Math.round(c.magenta) + ', ' + Math.round(c.yellow) + ', ' + Math.round(c.black);
            case 'GrayColor': return 'Gray ' + Math.round(c.gray);
            case 'SpotColor': return 'Spot "' + c.spot.name + '" ' + Math.round(c.tint) + '%';
            default: return c.typename;
        }
    }
    var tol = 0;
    function near(a, b) { return Math.abs(a - b) <= tol + 0.001; }
    function same(a, b) {
        if (!a || !b || a.typename !== b.typename) { return false; }
        switch (a.typename) {
            case 'RGBColor': return near(a.red, b.red) && near(a.green, b.green) && near(a.blue, b.blue);
            case 'CMYKColor': return near(a.cyan, b.cyan) && near(a.magenta, b.magenta) && near(a.yellow, b.yellow) && near(a.black, b.black);
            case 'GrayColor': return near(a.gray, b.gray);
            case 'SpotColor': return a.spot.name === b.spot.name && near(a.tint, b.tint);
            case 'GradientColor': return a.gradient.name === b.gradient.name;
            case 'PatternColor': return a.pattern.name === b.pattern.name;
            default: return false;
        }
    }

    // ---------- dialog ----------
    var w = new Window('dialog', 'Select Same Color Lines');
    w.alignChildren = 'fill';
    w.add('statictext', undefined, 'Stroke color: ' + describe(ref) + '   |   Weight: ' + Math.round(refWeight * 100) / 100 + ' pt');

    var p1 = w.add('panel', undefined, 'Match');
    p1.alignChildren = 'left';
    var tolG = p1.add('group');
    tolG.add('statictext', undefined, 'Color tolerance (0 = exact):');
    var tolE = tolG.add('edittext', undefined, '0'); tolE.characters = 4;
    var cbSameW = p1.add('checkbox', undefined, 'Only lines with the same stroke weight (' + Math.round(refWeight * 100) / 100 + ' pt)');
    var cbOpen = p1.add('checkbox', undefined, 'Only open paths (lines), skip closed shapes');
    var cbArt = p1.add('checkbox', undefined, 'Current artboard only');

    var p2 = w.add('panel', undefined, 'Change stroke weight');
    p2.alignChildren = 'left';
    var cbChange = p2.add('checkbox', undefined, 'Set all matching lines to a new weight');
    var wg = p2.add('group');
    wg.add('statictext', undefined, 'New weight (pt):');
    var wE = wg.add('edittext', undefined, String(Math.round(refWeight * 100) / 100)); wE.characters = 6;
    var wS = p2.add('slider', undefined, Math.min(refWeight, 20), 0.1, 20); wS.preferredSize.width = 260;
    wS.onChanging = function () { wE.text = String(Math.round(wS.value * 10) / 10); };
    wE.onChange = function () { var v = parseFloat(wE.text); if (!isNaN(v)) { wS.value = Math.min(Math.max(v, 0.1), 20); } };
    wg.enabled = wS.enabled = false;
    cbChange.onClick = function () { wg.enabled = wS.enabled = cbChange.value; };

    var bg = w.add('group'); bg.alignment = 'right';
    bg.add('button', undefined, 'Cancel', { name: 'cancel' });
    bg.add('button', undefined, 'OK', { name: 'ok' });
    if (w.show() !== 1) { return; }

    tol = parseFloat(tolE.text); if (isNaN(tol) || tol < 0) { tol = 0; }
    var newWeight = parseFloat(wE.text);
    if (cbChange.value && (isNaN(newWeight) || newWeight <= 0)) { alert('Enter a stroke weight above 0.'); return; }

    // ---------- helpers ----------
    function isEditable(item) {
        var p = item;
        while (p && p.typename !== 'Document') {
            try { if (p.locked || p.hidden) { return false; } } catch (e) { }
            try { if (p.typename === 'Layer' && !p.visible) { return false; } } catch (e2) { }
            p = p.parent;
        }
        return true;
    }
    function onArtboard(item, ab) {
        var r = ab.artboardRect, b = item.visibleBounds;
        return !(b[2] < r[0] || b[0] > r[2] || b[1] < r[3] || b[3] > r[1]);
    }
    // for paths inside a compound path, select/edit the compound path itself
    function selectable(p) {
        return (p.parent && p.parent.typename === 'CompoundPathItem') ? p.parent : p;
    }

    // ---------- search ----------
    var ab = cbArt.value ? doc.artboards[doc.artboards.getActiveArtboardIndex()] : null;
    var hits = [], skipped = 0, seen = {};
    for (var i = 0; i < doc.pathItems.length; i++) {
        var p = doc.pathItems[i];
        try {
            if (!p.stroked || p.guides || p.clipping) { continue; }
            if (cbOpen.value && p.closed) { continue; }
            if (cbSameW.value && Math.abs(p.strokeWidth - refWeight) > 0.001) { continue; }
            if (!same(p.strokeColor, ref)) { continue; }
            if (ab && !onArtboard(p, ab)) { continue; }
            if (!isEditable(p)) { skipped++; continue; }
            hits.push(p);
        } catch (e) { }
    }

    // ---------- apply ----------
    doc.selection = null;
    var count = 0;
    for (var j = 0; j < hits.length; j++) {
        if (cbChange.value) { try { hits[j].strokeWidth = newWeight; } catch (eW) { } }
        var target = selectable(hits[j]);
        try { target.selected = true; } catch (eS) { }
        count++;
    }
    app.redraw();

    var msg = 'Selected ' + count + ' line(s) with stroke ' + describe(ref) + '.';
    if (cbChange.value) { msg += '\nStroke weight set to ' + newWeight + ' pt.'; }
    if (skipped) { msg += '\n' + skipped + ' matching line(s) were locked or hidden and were skipped.'; }
    if (count === 0 || skipped || cbChange.value) { alert(msg); }
})();
