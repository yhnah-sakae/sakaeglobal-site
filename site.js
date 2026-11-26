/* Small page runtime for the Sakae Global site: renders the page template from a component's values. */
(function () {
  'use strict';
  var EVENTS = { onclick: 'click', onchange: 'change', onsubmit: 'submit', oninput: 'input' };
  var BOOL = { controls: 1, playsinline: 1, multiple: 1, novalidate: 1, defaultchecked: 1, disabled: 1, required: 1, checked: 1, open: 1, hidden: 1 };
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;

  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function text(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null || v === false ? '' : String(v); });
  }
  function single(str) { var m = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(str); return m ? m[1] : null; }
  function extend(scope, key, val) { var s = Object.create(scope); s[key] = val; return s; }

  function render(node, scope, out) {
    if (node.nodeType === 3) {
      var tx = text(node.data, scope);
      if (tx === '') return;
      if (out.lastChild && out.lastChild.nodeType === 3) out.lastChild.data += tx; else out.appendChild(document.createTextNode(tx));
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.tagName === 'TEMPLATE') {
      var f = node.getAttribute('data-for'), c = node.getAttribute('data-if'), kids = node.content.childNodes, i, j;
      if (f != null) {
        var list = lookup(f, scope) || [], as = node.getAttribute('data-as') || 'item';
        for (i = 0; i < list.length; i++) { var s2 = extend(scope, as, list[i]); for (j = 0; j < kids.length; j++) render(kids[j], s2, out); }
      } else if (c != null) {
        if (lookup(c, scope)) for (j = 0; j < kids.length; j++) render(kids[j], scope, out);
      }
      return;
    }
    var el = document.createElementNS(node.namespaceURI, node.localName);
    el.__h = {};
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], name = at.name, lname = name.toLowerCase(), val = at.value;
      if (lname.indexOf('hint-') === 0) continue;
      var p = single(val);
      if (EVENTS[lname]) { var fn = p ? lookup(p, scope) : null; if (typeof fn === 'function') el.__h[EVENTS[lname]] = fn; continue; }
      if (p && BOOL[lname]) {
        if (lookup(p, scope)) el.setAttribute(lname === 'defaultchecked' ? 'checked' : lname, '');
        continue;
      }
      if (p) { var v = lookup(p, scope); if (v == null || v === false) continue; el.setAttribute(name, v === true ? '' : String(v)); continue; }
      el.setAttribute(name, val.indexOf('{{') >= 0 ? text(val, scope) : val);
    }
    for (var k = 0; k < node.childNodes.length; k++) render(node.childNodes[k], scope, el);
    out.appendChild(el);
  }

  var KEEP = { open: 1 };
  function syncAttrs(from, to) {
    var i, n;
    for (i = to.attributes.length - 1; i >= 0; i--) { n = to.attributes[i].name; if (!from.hasAttribute(n) && !KEEP[n] && !(n === 'checked' && to.__touched)) to.removeAttribute(n); }
    for (i = 0; i < from.attributes.length; i++) { n = from.attributes[i].name; var v = from.attributes[i].value; if (to.getAttribute(n) !== v) to.setAttribute(n, v); }
    if (from.hasAttribute('value') && 'value' in to && to.value !== from.getAttribute('value')) to.value = from.getAttribute('value');
    to.__h = from.__h || {};
  }
  function morph(from, to) {
    var a = from.firstChild, b = to.firstChild;
    while (a || b) {
      var an = a ? a.nextSibling : null, bn = b ? b.nextSibling : null;
      if (!a) { to.removeChild(b); }
      else if (!b) { to.appendChild(a); }
      else if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { to.replaceChild(a, b); }
      else if (a.nodeType === 3) { if (b.data !== a.data) b.data = a.data; }
      else {
        var media = b.tagName === 'VIDEO' && b.getAttribute('src') === a.getAttribute('src');
        syncAttrs(a, b);
        if (!media) morph(a, b);
      }
      a = an; b = bn;
    }
  }

  function DCLogic() { this.state = {}; this.props = {}; }
  DCLogic.prototype.setState = function (patch) {
    if (typeof patch === 'function') patch = patch(this.state);
    var s = {}, k;
    for (k in this.state) s[k] = this.state[k];
    for (k in patch) s[k] = patch[k];
    this.state = s;
    if (this.__mounted) this.__update();
  };

  function dispatch(e) {
    var n = e.target;
    while (n && n !== document) {
      if (n.__h && n.__h[e.type]) {
        try { Object.defineProperty(e, 'currentTarget', { value: n, configurable: true }); } catch (x) {}
        if (e.type === 'change' && n.type === 'checkbox') n.__touched = true;
        n.__h[e.type](e);
        if (e.type !== 'change' && e.type !== 'input') return;
      }
      n = n.parentNode;
    }
  }

  function mount(Component) {
    var tpl = document.getElementById('tpl'), root = document.getElementById('app');
    var inst = new Component();
    inst.__update = function () {
      var vals = inst.renderVals() || {};
      var frag = document.createElement('div');
      for (var i = 0; i < tpl.content.childNodes.length; i++) render(tpl.content.childNodes[i], vals, frag);
      morph(frag, root);
    };
    ['click', 'change', 'submit', 'input'].forEach(function (t) { document.addEventListener(t, dispatch, false); });
    inst.__mounted = true;
    inst.__update();
    document.documentElement.setAttribute('data-ready', '1');
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }

  window.DCLogic = DCLogic;
  window.DC = { mount: mount };
})();
