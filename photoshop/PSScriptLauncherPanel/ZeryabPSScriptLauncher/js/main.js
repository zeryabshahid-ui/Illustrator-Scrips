(function () {
    'use strict';
    var cs = new CSInterface();
    // Used only when this folder exists, so an existing setup keeps working.
    // Otherwise the panel asks for a folder on first run and remembers it.
    var PREFERRED_FOLDER = 'E:\\Illustrator Scripts\\PS Scripts';
    var LS_FOLDER = 'psScriptLauncher.folder';
    var LS_FAVS = 'psScriptLauncher.favs';

    var listEl = document.getElementById('list');
    var searchEl = document.getElementById('search');
    var statusEl = document.getElementById('status');
    var pathEl = document.getElementById('path');

    var scripts = [];
    var busy = false;

    function getSavedFolder() { return localStorage.getItem(LS_FOLDER) || ''; }
    function getFolder() { return getSavedFolder() || PREFERRED_FOLDER; }
    function setFolder(p) { localStorage.setItem(LS_FOLDER, p); }
    function getFavs() {
        try { return JSON.parse(localStorage.getItem(LS_FAVS) || '{}') || {}; } catch (e) { return {}; }
    }
    function setFavs(f) { localStorage.setItem(LS_FAVS, JSON.stringify(f)); }

    function status(msg, kind) {
        statusEl.textContent = msg || '';
        statusEl.className = kind || '';
    }

    function displayName(file) {
        var n = file.replace(/\.(jsx|js)$/i, '');
        n = n.replace(/[_\-]+/g, ' ');
        n = n.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
        return n.replace(/\s+/g, ' ').trim();
    }

    function parse(res) {
        try { return JSON.parse(res); }
        catch (e) { return { ok: false, error: res || 'No response from Photoshop' }; }
    }

    function call(fn, arg, cb) {
        cs.evalScript(fn + '(' + JSON.stringify(arg) + ')', function (res) { cb(parse(res)); });
    }

    // Escape a Windows path so it is safe inside an ExtendScript string literal.
    function escapeForEvalFile(path) {
        return String(path)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
    }

    function render() {
        var q = searchEl.value.toLowerCase().trim();
        var favs = getFavs();
        var rows = scripts.filter(function (s) {
            return !q || s.label.toLowerCase().indexOf(q) >= 0 || s.name.toLowerCase().indexOf(q) >= 0;
        });
        rows.sort(function (a, b) {
            var fa = favs[a.name] ? 0 : 1, fb = favs[b.name] ? 0 : 1;
            if (fa !== fb) return fa - fb;
            return a.label.localeCompare(b.label);
        });
        listEl.innerHTML = '';
        if (!rows.length) {
            var empty = document.createElement('li');
            empty.className = 'empty';
            empty.textContent = scripts.length ? 'No scripts match your search.' : 'No scripts found in this folder.';
            listEl.appendChild(empty);
            return;
        }
        rows.forEach(function (s) {
            var li = document.createElement('li');
            li.title = s.path;
            var star = document.createElement('span');
            star.className = 'star' + (favs[s.name] ? ' on' : '');
            star.textContent = favs[s.name] ? '\u2605' : '\u2606';
            star.title = favs[s.name] ? 'Unpin' : 'Pin to top';
            star.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var f = getFavs();
                if (f[s.name]) delete f[s.name]; else f[s.name] = true;
                setFavs(f);
                render();
            });
            var name = document.createElement('span');
            name.className = 'name';
            name.textContent = s.label;
            li.appendChild(star);
            li.appendChild(name);
            li.addEventListener('click', function () { run(s, li); });
            li.addEventListener('dblclick', function (ev) {
                ev.preventDefault();
                run(s, li);
            });
            listEl.appendChild(li);
        });
    }

    function refresh() {
        var folder = getFolder();
        pathEl.textContent = folder;
        pathEl.title = folder;
        status('Loading...');
        call('psl_listScripts', folder, function (r) {
            if (!r.ok) {
                scripts = [];
                render();
                status(r.error || 'Could not read folder', 'error');
                return;
            }
            scripts = r.items.map(function (it) { return { name: it.name, path: it.path, label: displayName(it.name) }; });
            render();
            status(scripts.length + ' script' + (scripts.length === 1 ? '' : 's'));
        });
    }

    function isEvalError(res) {
        if (res === undefined || res === null) return false;
        var s = String(res);
        if (s === 'undefined' || s === 'null' || s === '' || s === 'OK') return false;
        if (s.indexOf('EvalScript error') === 0) return true;
        if (s.indexOf('ERROR:') === 0) return true;
        return false;
    }

    function run(s, li) {
        if (busy) { status('A script is still running...', 'error'); return; }
        busy = true;
        if (li) li.classList.add('running');
        status('Running ' + s.label + '...');
        var path = escapeForEvalFile(s.path);
        // $.evalFile as required; try/catch so the panel can show the real error.
        var code = 'try { $.evalFile(new File("' + path + '")); "OK"; } catch (e) { "ERROR:" + String(e.message || e) + (e.line ? " (line " + e.line + ")" : ""); }';
        cs.evalScript(code, function (res) {
            busy = false;
            if (li) li.classList.remove('running');
            if (isEvalError(res)) {
                var msg = String(res);
                if (msg.indexOf('ERROR:') === 0) msg = msg.slice(6);
                status(s.label + ' failed:\n' + msg, 'error');
            } else {
                status('Ran ' + s.label, 'ok');
            }
        });
    }

    function changeFolder() {
        call('psl_pickFolder', getFolder(), function (r) {
            if (r.ok && r.folder) { setFolder(r.folder); refresh(); }
            else if (!r.cancelled && r.error) status(r.error, 'error');
        });
    }

    function openFolder() {
        call('psl_openFolder', getFolder(), function (r) {
            if (!r.ok) status(r.error || 'Could not open folder', 'error');
        });
    }

    function toHex(c) {
        function h(v) { v = Math.max(0, Math.min(255, Math.round(v))); return ('0' + v.toString(16)).slice(-2); }
        return '#' + h(c.red) + h(c.green) + h(c.blue);
    }
    function shade(c, d) { return { red: c.red + d, green: c.green + d, blue: c.blue + d }; }

    function applyTheme() {
        try {
            var skin = cs.hostEnvironment.appSkinInfo;
            var bg = skin.panelBackgroundColor.color;
            var light = (bg.red + bg.green + bg.blue) / 3 > 128;
            var root = document.documentElement.style;
            root.setProperty('--bg', toHex(bg));
            root.setProperty('--row', toHex(shade(bg, light ? -14 : 10)));
            root.setProperty('--hover', toHex(shade(bg, light ? -28 : 25)));
            root.setProperty('--border', toHex(shade(bg, light ? -45 : -15)));
            root.setProperty('--fg', light ? '#1e1e1e' : '#e6e6e6');
            root.setProperty('--muted', light ? '#555555' : '#9a9a9a');
        } catch (e) { /* keep default dark theme */ }
    }

    document.getElementById('refresh').addEventListener('click', refresh);
    document.getElementById('openFolder').addEventListener('click', openFolder);
    document.getElementById('changeFolder').addEventListener('click', changeFolder);
    searchEl.addEventListener('input', render);
    searchEl.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { searchEl.value = ''; render(); }
    });

    function chooseFolderFirstRun() {
        status('Choose the folder that holds your Photoshop scripts.');
        pathEl.textContent = 'No folder chosen yet';
        call('psl_pickFolder', '', function (picked) {
            if (picked.ok && picked.folder) { setFolder(picked.folder); refresh(); }
            else status('Choose a scripts folder to get started.', 'error');
        });
    }

    function start() {
        if (getSavedFolder()) { refresh(); return; }
        call('psl_resolveFolder', PREFERRED_FOLDER, function (r) {
            if (r.ok && r.folder) { setFolder(r.folder); refresh(); return; }
            chooseFolderFirstRun();
        });
    }

    try { cs.addEventListener('com.adobe.csxs.events.ThemeColorChanged', applyTheme); } catch (e) {}
    applyTheme();
    start();
})();
