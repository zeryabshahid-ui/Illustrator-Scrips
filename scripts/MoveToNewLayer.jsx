#target illustrator
/*
 * Move To New Layer - Adobe Illustrator script (ES3)
 * ---------------------------------------------------------------
 * Select the objects and run the script. A new layer is created
 * automatically and the selected objects are moved onto it.
 *
 * - The new layer is named "Layer N" (the next free number) and is
 *   placed directly above the layer of the frontmost selected object.
 * - Objects keep their stacking order and their position on the artboard.
 * - If you select a group (or a path inside a compound path), the whole
 *   group / compound path moves. Objects inside a selected group are not
 *   pulled out of it.
 * - Locked or hidden objects are skipped and reported.
 * - The moved objects stay selected and the new layer becomes active.
 * Run from Script Launcher or File > Scripts > Other Script.
 */
(function () {
    var TITLE = 'Move To New Layer';

    function same(a, b) {
        if (a === b) { return true; }
        try { return !!a.uuid && a.uuid === b.uuid; } catch (e) { return false; }
    }
    // A path inside a compound path moves as the whole compound path.
    function normalize(item) {
        try { if (item.parent.typename === 'CompoundPathItem') { return item.parent; } } catch (e) { }
        return item;
    }
    function isInside(item, list) {
        var p, guard = 0;
        try { p = item.parent; } catch (e) { return false; }
        while (p && guard++ < 200) {
            if (p.typename === 'Layer' || p.typename === 'Document') { return false; }
            for (var i = 0; i < list.length; i++) { if (same(list[i], p)) { return true; } }
            try { p = p.parent; } catch (e2) { return false; }
        }
        return false;
    }
    function editable(item) {
        var p = item, guard = 0;
        while (p && guard++ < 200) {
            if (p.typename === 'Document') { return true; }
            try {
                if (p.locked) { return false; }
                if (p.typename === 'Layer' ? !p.visible : p.hidden) { return false; }
            } catch (e) { }
            p = p.parent;
        }
        return true;
    }
    function nextLayerName(doc) {
        var used = {}, i, n = 1;
        function collect(layers) {
            for (var k = 0; k < layers.length; k++) {
                used[layers[k].name] = true;
                try { collect(layers[k].layers); } catch (e) { }
            }
        }
        collect(doc.layers);
        for (i = 0; i < 10000; i++) {
            if (!used['Layer ' + n]) { return 'Layer ' + n; }
            n++;
        }
        return 'Layer ' + new Date().getTime();
    }

    try {
        if (!app.documents.length) { alert('Open a document first.', TITLE); return; }
        var doc = app.activeDocument;
        var sel = doc.selection;
        if (sel && sel.typename === 'TextRange') {
            alert('You are editing text. Press Esc, select the object(s) with the Selection tool, and run the script again.', TITLE);
            return;
        }
        if (!sel || !sel.length) { alert('Select the object(s) you want to move to a new layer.', TITLE); return; }

        // Unique, top-level selected items (selection is listed front to back).
        var items = [], i, j, dup;
        for (i = 0; i < sel.length; i++) {
            var it = normalize(sel[i]);
            dup = false;
            for (j = 0; j < items.length; j++) { if (same(items[j], it)) { dup = true; break; } }
            if (!dup) { items.push(it); }
        }
        var top = [];
        for (i = 0; i < items.length; i++) { if (!isInside(items[i], items)) { top.push(items[i]); } }

        // Keep front-to-back order using z-order when available.
        var allZ = true;
        for (i = 0; i < top.length; i++) {
            try { if (typeof top[i].absoluteZOrderPosition !== 'number') { allZ = false; break; } } catch (eZ) { allZ = false; break; }
        }
        if (allZ) { top.sort(function (a, b) { return b.absoluteZOrderPosition - a.absoluteZOrderPosition; }); }

        var movable = [], skipped = 0;
        for (i = 0; i < top.length; i++) { if (editable(top[i])) { movable.push(top[i]); } else { skipped++; } }
        if (!movable.length) { alert('Nothing could be moved. The selected objects are locked or hidden.', TITLE); return; }

        // Create the layer right above the frontmost object's layer.
        var refLayer = null;
        try { refLayer = movable[0].layer; } catch (eL) { }
        var newLayer = doc.layers.add();
        newLayer.name = nextLayerName(doc);
        if (refLayer) {
            try { newLayer.move(refLayer, ElementPlacement.PLACEBEFORE); } catch (eM) { }
        }

        // Front-to-back, each appended at the back: original order is kept.
        var moved = [], failed = 0;
        for (i = 0; i < movable.length; i++) {
            try { movable[i].move(newLayer, ElementPlacement.PLACEATEND); moved.push(movable[i]); }
            catch (eMove) { failed++; }
        }

        if (!moved.length) {
            try { newLayer.remove(); } catch (eR) { }
            alert('Illustrator could not move the selected objects.', TITLE);
            return;
        }

        try { doc.activeLayer = newLayer; } catch (eA) { }
        try { doc.selection = null; doc.selection = moved; } catch (eS) {
            for (i = 0; i < moved.length; i++) { try { moved[i].selected = true; } catch (eS2) { } }
        }
        app.redraw();

        if (skipped || failed) {
            var msg = 'Moved ' + moved.length + ' object' + (moved.length === 1 ? '' : 's') + ' to "' + newLayer.name + '".';
            if (skipped) { msg += '\nSkipped ' + skipped + ' locked or hidden object' + (skipped === 1 ? '' : 's') + '.'; }
            if (failed) { msg += '\nCould not move ' + failed + ' object' + (failed === 1 ? '' : 's') + '.'; }
            alert(msg, TITLE);
        }
    } catch (err) {
        alert('Error: ' + err + (err.line ? ' (line ' + err.line + ')' : ''), TITLE);
    }
})();
