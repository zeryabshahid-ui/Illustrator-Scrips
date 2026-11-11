#target illustrator
#targetengine 'copySize'
/*
 * Copy Size - Illustrator ExtendScript (ES3)
 * Select ONE source object and click Copy dimensions. Then select any number
 * of targets and click Apply to selected. The palette stays open between steps.
 * Width and height are measured in points, excluding strokes and live effects.
 * Clipping groups use the clipping path's bounds. Targets keep their centres.
 * Applying both dimensions stretches to the copied size. Applying just one
 * dimension leaves the other unchanged. Stroke weights are kept unchanged.
 * Copied dimensions stay available until the panel is closed, across documents.
 * Run from Script Launcher or File > Scripts > Other Script.
 */
(function () {
    var TITLE = 'Copy Size';
    if ($.global.__copySizeWin) {
        try { $.global.__copySizeWin.show(); $.global.__copySizeWin.active = true; return; } catch (e) { }
    }

    // Self-contained: executed in Illustrator's document context via BridgeTalk.
    function core(action, width, height, useWidth, useHeight) {
        function same(a, b) {
            if (a === b) { return true; }
            try { return !!a.uuid && a.uuid === b.uuid; } catch (e) { return false; }
        }
        function normalize(item) {
            try { if (item.parent.typename === 'CompoundPathItem') { return item.parent; } } catch (e) { }
            return item;
        }
        function editable(item) {
            var p = item, guard = 0;
            while (p && guard++ < 200) {
                if (p.typename === 'Document') { return true; }
                if (p.locked || (p.typename === 'Layer' ? !p.visible : p.hidden)) { return false; }
                p = p.parent;
            }
            return false;
        }
        function ancestor(a, b) {
            var p = b.parent, guard = 0;
            while (p && guard++ < 200) {
                if (same(a, p)) { return true; }
                if (p.typename === 'Document') { return false; }
                p = p.parent;
            }
            return false;
        }
        function bounds(item) {
            if (item.typename === 'GroupItem' && item.clipped) {
                for (var i = 0; i < item.pageItems.length; i++) {
                    var p = item.pageItems[i];
                    if (!same(p.parent, item)) { continue; }
                    if ((p.typename === 'PathItem' && p.clipping) ||
                        (p.typename === 'CompoundPathItem' && p.pathItems.length && p.pathItems[0].clipping)) {
                        return p.geometricBounds;
                    }
                }
            }
            return item.geometricBounds;
        }
        function positive(n) { return typeof n === 'number' && isFinite(n) && n > 0.0001; }
        try {
            if (!app.documents.length) { return 'ERROR|Open a document first.'; }
            var doc = app.activeDocument, sel = doc.selection;
            if (sel && sel.typename === 'TextRange') { return 'ERROR|Leave text editing and select whole objects first.'; }
            if (!sel || !sel.length) { return 'ERROR|Select ' + (action === 'copy' ? 'one source object.' : 'the target object(s).'); }
            var items = [], i, j;
            for (i = 0; i < sel.length; i++) {
                var item = normalize(sel[i]), duplicate = false;
                for (j = 0; j < items.length; j++) { if (same(items[j], item)) { duplicate = true; break; } }
                if (!duplicate) { items.push(item); }
            }
            if (action === 'copy') {
                if (items.length !== 1) { return 'ERROR|Select exactly one source object to copy its dimensions.'; }
                var b = bounds(items[0]), w = b[2] - b[0], h = b[1] - b[3];
                if (!positive(w) || !positive(h)) { return 'ERROR|The source must have a nonzero width and height.'; }
                return 'SIZE|' + w + '|' + h;
            }
            if (!positive(width) || !positive(height)) { return 'ERROR|Copy dimensions from a source object first.'; }
            if (!useWidth && !useHeight) { return 'ERROR|Choose Width, Height, or both.'; }
            var done = 0, skipped = 0, failed = 0, firstError = '';
            for (i = 0; i < items.length; i++) {
                var target = items[i], nested = false;
                for (j = 0; j < items.length; j++) {
                    if (i !== j && ancestor(items[j], target)) { nested = true; break; }
                }
                if (nested) { continue; } // A selected group already resizes its children.
                try {
                    if (!editable(target) || (target.typename === 'PathItem' && (target.guides || target.clipping))) { skipped++; continue; }
                    var before = bounds(target), tw = before[2] - before[0], th = before[1] - before[3];
                    if ((useWidth && !positive(tw)) || (useHeight && !positive(th))) { skipped++; continue; }
                    var sx = useWidth ? width / tw * 100 : 100;
                    var sy = useHeight ? height / th * 100 : 100;
                    if (!positive(sx) || !positive(sy)) { skipped++; continue; }
                    target.resize(sx, sy, true, true, true, true, 100, Transformation.CENTER);
                    // Clipping geometry can have a different centre than the full group.
                    var after = bounds(target);
                    target.translate((before[0] + before[2] - after[0] - after[2]) / 2,
                                     (before[1] + before[3] - after[1] - after[3]) / 2);
                    done++;
                } catch (eItem) {
                    failed++;
                    if (!firstError) { firstError = String(eItem.message || eItem).replace(/[|\r\n]/g, ' '); }
                }
            }
            app.redraw();
            var msg = 'Updated ' + done + ' object' + (done === 1 ? '' : 's') + '.';
            if (skipped) { msg += ' Skipped ' + skipped + ' locked, hidden, or unsupported object(s).'; }
            if (failed) { msg += ' Failed: ' + failed + '. ' + firstError; }
            return 'OK|' + msg;
        } catch (err) {
            return 'ERROR|' + String(err.message || err).replace(/[|\r\n]/g, ' ') + (err.line ? ' (line ' + err.line + ')' : '');
        }
    }

    var size = null, pending = null;
    var win = new Window('palette', TITLE);
    win.orientation = 'column'; win.alignChildren = ['fill', 'top'];
    win.spacing = 8; win.margins = 12;
    var info = win.add('statictext', undefined,
        '1. Select one source and copy its dimensions.\n2. Select target object(s) and apply.', { multiline: true });
    info.preferredSize = [310, 36];
    var copyBtn = win.add('button', undefined, 'Copy dimensions');
    var stored = win.add('panel', undefined, 'Copied dimensions');
    stored.alignChildren = ['fill', 'top'];
    var dimensions = stored.add('statictext', undefined, 'Nothing copied yet.');
    dimensions.preferredSize.width = 290;
    var options = win.add('group');
    var widthBox = options.add('checkbox', undefined, 'Width'); widthBox.value = true;
    var heightBox = options.add('checkbox', undefined, 'Height'); heightBox.value = true;
    var applyBtn = win.add('button', undefined, 'Apply to selected'); applyBtn.enabled = false;
    var note = win.add('statictext', undefined,
        'Both dimensions: stretch to size. One: change that axis.\nUses object bounds; excludes strokes and effects.\nKeeps object centres and stroke weights.', { multiline: true });
    note.preferredSize = [310, 50];
    var status = win.add('statictext', undefined, 'Ready.', { multiline: true });
    status.preferredSize = [310, 50];
    var closeBtn = win.add('button', undefined, 'Close');
    function sync() { applyBtn.enabled = !!size && (widthBox.value || heightBox.value); }
    function busy(value) {
        copyBtn.enabled = widthBox.enabled = heightBox.enabled = closeBtn.enabled = !value;
        if (value) { applyBtn.enabled = false; } else { sync(); }
    }
    function receive(result) {
        pending = null; busy(false);
        var parts = String(result || '').split('|');
        if (parts[0] === 'SIZE') {
            var w = Number(parts[1]), h = Number(parts[2]);
            if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) { status.text = 'Invalid dimensions returned.'; return; }
            size = { width: w, height: h };
            dimensions.text = 'W: ' + (Math.round(w * 1000) / 1000) + ' pt    H: ' + (Math.round(h * 1000) / 1000) + ' pt';
            status.text = 'Dimensions copied. Select your target object(s).'; sync();
        } else if (parts[0] === 'OK' || parts[0] === 'ERROR') {
            status.text = parts[1] || 'No result.';
            if (parts[0] === 'ERROR') { alert(status.text, TITLE); }
        } else { status.text = 'Unexpected response: ' + String(result); }
    }
    function run(action) {
        busy(true); status.text = action === 'copy' ? 'Copying dimensions...' : 'Applying dimensions...';
        var w = size ? size.width : 0, h = size ? size.height : 0;
        var body = '(' + core.toString() + ')("' + action + '",' + w + ',' + h + ',' + widthBox.value + ',' + heightBox.value + ');';
        var sent = false;
        try {
            pending = new BridgeTalk(); pending.target = 'illustrator'; pending.body = body;
            pending.onResult = function (r) { receive(r.body); };
            pending.onError = function (r) { receive('ERROR|' + String(r.body).replace(/[|\r\n]/g, ' ')); };
            sent = pending.send();
        } catch (e) { sent = false; }
        if (!sent) { receive(core(action, w, h, widthBox.value, heightBox.value)); }
    }
    copyBtn.onClick = function () { run('copy'); };
    applyBtn.onClick = function () { run('apply'); };
    widthBox.onClick = heightBox.onClick = sync;
    closeBtn.onClick = function () { win.close(); };
    win.onClose = function () { if (pending) { return false; } $.global.__copySizeWin = null; return true; };
    $.global.__copySizeWin = win;
    win.show();
})();
