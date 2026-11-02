/*
  Select Same Color Text  -  Adobe Illustrator script
  Select one text object (or some characters inside it), run the script,
  and every text object in the document with the same fill color gets selected.
  Options: match fill or stroke, color tolerance, partial-color matching, current artboard only.
*/
#target illustrator
(function () {
    if (app.documents.length === 0) { alert('Open a document first.'); return; }
    var doc = app.activeDocument;

    // ---------- get the reference color ----------
    function firstChars(sel) {
        // text selection inside a frame
        if (sel && sel.typename === 'TextRange') { return sel; }
        if (sel && sel.length) {
            for (var i = 0; i < sel.length; i++) {
                if (sel[i].typename === 'TextFrame') { return sel[i].textRange; }
            }
        }
        return null;
    }
    var refRange = firstChars(doc.selection);
    if (!refRange || refRange.characters.length === 0) {
        alert('Select a text object (or some text) whose color you want to match, then run the script again.');
        return;
    }
    var refChar = refRange.characters[0].characterAttributes;

    // ---------- dialog ----------
    var w = new Window('dialog', 'Select Same Color Text');
    w.alignChildren = 'fill';
    var p1 = w.add('panel', undefined, 'Match');
    p1.alignChildren = 'left';
    var rbFill = p1.add('radiobutton', undefined, 'Fill color');
    var rbStroke = p1.add('radiobutton', undefined, 'Stroke color');
    rbFill.value = true;
    var cbAny = p1.add('checkbox', undefined, 'Also select text that only partly uses this color');
    cbAny.value = true;
    var tolG = p1.add('group');
    tolG.add('statictext', undefined, 'Tolerance (0 = exact):');
    var tolE = tolG.add('edittext', undefined, '0'); tolE.characters = 4;
    var p2 = w.add('panel', undefined, 'Where');
    p2.alignChildren = 'left';
    var cbArt = p2.add('checkbox', undefined, 'Current artboard only');
    var info = w.add('statictext', undefined, 'Reference color: ' + describe(refChar.fillColor));
    rbFill.onClick = function () { info.text = 'Reference color: ' + describe(refChar.fillColor); };
    rbStroke.onClick = function () { info.text = 'Reference color: ' + describe(refChar.strokeColor); };
    var bg = w.add('group'); bg.alignment = 'right';
    bg.add('button', undefined, 'Cancel', { name: 'cancel' });
    bg.add('button', undefined, 'Select', { name: 'ok' });
    if (w.show() !== 1) { return; }

    var useFill = rbFill.value;
    var anyChar = cbAny.value;
    var tol = parseFloat(tolE.text); if (isNaN(tol) || tol < 0) { tol = 0; }
    var ref = useFill ? refChar.fillColor : refChar.strokeColor;

    // ---------- color helpers ----------
    function describe(c) {
        if (!c) { return 'none'; }
        switch (c.typename) {
            case 'RGBColor': return 'RGB ' + Math.round(c.red) + ', ' + Math.round(c.green) + ', ' + Math.round(c.blue);
            case 'CMYKColor': return 'CMYK ' + Math.round(c.cyan) + ', ' + Math.round(c.magenta) + ', ' + Math.round(c.yellow) + ', ' + Math.round(c.black);
            case 'GrayColor': return 'Gray ' + Math.round(c.gray);
            case 'SpotColor': return 'Spot "' + c.spot.name + '" ' + Math.round(c.tint) + '%';
            case 'NoColor': return 'none';
            default: return c.typename;
        }
    }
    function near(a, b) { return Math.abs(a - b) <= tol + 0.001; }
    function same(a, b) {
        if (!a || !b || a.typename !== b.typename) { return false; }
        switch (a.typename) {
            case 'RGBColor': return near(a.red, b.red) && near(a.green, b.green) && near(a.blue, b.blue);
            case 'CMYKColor': return near(a.cyan, b.cyan) && near(a.magenta, b.magenta) && near(a.yellow, b.yellow) && near(a.black, b.black);
            case 'GrayColor': return near(a.gray, b.gray);
            case 'SpotColor': return a.spot.name === b.spot.name && near(a.tint, b.tint);
            case 'NoColor': return true;
            case 'GradientColor': return a.gradient.name === b.gradient.name;
            case 'PatternColor': return a.pattern.name === b.pattern.name;
            default: return false;
        }
    }
    function frameMatches(tf) {
        var chars = tf.textRange.characters;
        var n = chars.length;
        if (n === 0) { return false; }
        if (!anyChar) {
            // whole frame must be this color: check every character run
            var runs = tf.textRange.textRanges ? tf.textRange.textRanges : chars;
            for (var r = 0; r < runs.length; r++) {
                var a = runs[r].characterAttributes;
                if (!same(useFill ? a.fillColor : a.strokeColor, ref)) { return false; }
            }
            return true;
        }
        var parts = tf.textRange.textRanges ? tf.textRange.textRanges : chars;
        for (var k = 0; k < parts.length; k++) {
            var at = parts[k].characterAttributes;
            if (same(useFill ? at.fillColor : at.strokeColor, ref)) { return true; }
        }
        return false;
    }
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
        var r = ab.artboardRect, b = item.visibleBounds; // [left, top, right, bottom]
        return !(b[2] < r[0] || b[0] > r[2] || b[1] < r[3] || b[3] > r[1]);
    }

    // ---------- search ----------
    var ab = cbArt.value ? doc.artboards[doc.artboards.getActiveArtboardIndex()] : null;
    var hits = [];
    var skipped = 0;
    for (var i = 0; i < doc.textFrames.length; i++) {
        var tf = doc.textFrames[i];
        try {
            if (ab && !onArtboard(tf, ab)) { continue; }
            if (!frameMatches(tf)) { continue; }
            if (!isEditable(tf)) { skipped++; continue; }
            hits.push(tf);
        } catch (e) { }
    }

    doc.selection = null;
    for (var j = 0; j < hits.length; j++) { hits[j].selected = true; }
    app.redraw();

    var msg = 'Selected ' + hits.length + ' text object(s) with ' + (useFill ? 'fill ' : 'stroke ') + describe(ref) + '.';
    if (skipped) { msg += '\n' + skipped + ' matching object(s) were locked or hidden and were skipped.'; }
    if (hits.length === 0 || skipped) { alert(msg); }
})();
