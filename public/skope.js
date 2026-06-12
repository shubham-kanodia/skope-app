/*!
 * skope.js, minimal DPDP consent banner (M2).
 * Reads data-site, fetches /api/cfg/:siteKey, renders an India-aware banner in a
 * shadow DOM, captures purpose-wise consent, and posts a receipt. No deps.
 * Tracker blocking, GCM v2, and form receipts come in M3.
 */
(function () {
  "use strict";

  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  if (!script) return;
  var siteKey = script.getAttribute("data-site");
  if (!siteKey) return;

  var base;
  try {
    base = new URL(script.src).origin;
  } catch (e) {
    base = "";
  }

  var COOKIE = "skope_consent_" + siteKey;
  var SUBJECT = "skope_subject_" + siteKey;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function getSubject() {
    var s;
    try {
      s = localStorage.getItem(SUBJECT);
    } catch (e) {}
    if (!s) {
      s = uuid();
      try {
        localStorage.setItem(SUBJECT, s);
      } catch (e) {}
    }
    return s;
  }
  function getCookie(name) {
    var m = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie =
      name + "=" + encodeURIComponent(value) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
  }
  function t(map, lang) {
    return (map && (map[lang] || map.en)) || "";
  }

  // ---------- tracker control ----------
  // Two layers:
  //  1. Manual tagging (deterministic, guaranteed): a tracker script tagged
  //     <script type="text/plain" data-skope data-skope-purpose="analytics">
  //     never runs until consent for that purpose is granted, then we activate it.
  //  2. Known-vendor auto-block (best-effort): a MutationObserver neutralizes
  //     scripts from known tracker domains added after we boot.
  //  3. Google Consent Mode v2: deny by default, update on consent.
  var KNOWN = [
    { re: /googletagmanager\.com|google-analytics\.com|\/gtag\/js|\/gtm\.js/i, purpose: "analytics" },
    { re: /static\.hotjar\.com|script\.hotjar\.com/i, purpose: "analytics" },
    { re: /clarity\.ms/i, purpose: "analytics" },
    { re: /connect\.facebook\.net|facebook\.com\/tr/i, purpose: "marketing" },
    { re: /snap\.licdn\.com|ads\.linkedin\.com/i, purpose: "marketing" },
    { re: /doubleclick\.net|googlesyndication\.com|googleadservices\.com/i, purpose: "marketing" }
  ];
  var currentGranted = [];

  function trackerPurpose(src) {
    for (var i = 0; i < KNOWN.length; i++) if (KNOWN[i].re.test(src)) return KNOWN[i].purpose;
    return null;
  }
  function gtagReady() {
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) window.gtag = function () { window.dataLayer.push(arguments); };
  }
  function gcmDefault() {
    gtagReady();
    window.gtag("consent", "default", { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  }
  function gcmUpdate(granted) {
    gtagReady();
    var a = granted.indexOf("analytics") !== -1 ? "granted" : "denied";
    var m = granted.indexOf("marketing") !== -1 ? "granted" : "denied";
    window.gtag("consent", "update", { analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m });
  }
  function activate(el) {
    var s = document.createElement("script");
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name === "type" || a.name === "data-skope" || a.name.indexOf("data-skope-") === 0) continue;
      s.setAttribute(a.name, a.value);
    }
    var realSrc = el.getAttribute("data-skope-src");
    if (realSrc) s.src = realSrc;
    else if (el.getAttribute("src")) s.src = el.getAttribute("src");
    else s.text = el.textContent;
    el.parentNode.insertBefore(s, el);
    el.parentNode.removeChild(el);
  }
  function releaseTagged(granted) {
    var blocked = document.querySelectorAll('script[type="text/plain"][data-skope]');
    Array.prototype.forEach.call(blocked, function (el) {
      var p = el.getAttribute("data-skope-purpose");
      if (!p || granted.indexOf(p) !== -1) activate(el);
    });
  }
  function maybeBlock(s) {
    if (s.type === "text/plain") return;
    var src = s.src || s.getAttribute("src") || "";
    if (!src) return;
    var p = trackerPurpose(src);
    if (p && currentGranted.indexOf(p) === -1) {
      s.type = "text/plain";
      s.setAttribute("data-skope", "");
      s.setAttribute("data-skope-purpose", p);
      s.setAttribute("data-skope-src", src);
      s.removeAttribute("src");
    }
  }
  function installObserver() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          if (nodes[j].tagName === "SCRIPT") maybeBlock(nodes[j]);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  function applyConsent(granted) {
    currentGranted = granted.slice();
    releaseTagged(granted);
    gcmUpdate(granted);
    try { document.dispatchEvent(new CustomEvent("skope:consent", { detail: { granted: granted } })); } catch (e) {}
  }

  // The last cfg we fetched, so the preference center can re-open without a refetch.
  var LATEST_CFG = null;

  // Expose a tiny API for SPAs / custom flows.
  window.skope = window.skope || {};
  window.skope.getConsent = function () { return currentGranted.slice(); };
  // Re-open the manage view so a visitor can change or withdraw consent at any
  // time (DPDP §6(4): withdrawing must be as easy as giving). Tracker blocking is
  // re-applied in place — already-running scripts can't be un-run, but Google
  // Consent Mode flips to denied and the reduced choice is stored, so nothing new
  // loads and the next page view is fully re-blocked.
  window.skope.openPreferences = function () {
    if (LATEST_CFG) {
      render(LATEST_CFG, { startView: "manage", method: "preference_center" });
      return;
    }
    fetch(base + "/api/cfg/" + encodeURIComponent(siteKey))
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (cfg && !cfg.error) { LATEST_CFG = cfg; render(cfg, { startView: "manage", method: "preference_center" }); }
      })
      .catch(function () {});
  };

  // Block by default, then honour any prior decision for the current notice.
  var prior = getCookie(COOKIE);
  var priorGranted = [];
  if (prior) { try { priorGranted = JSON.parse(prior).granted || []; } catch (e) {} }
  gcmDefault();
  installObserver();
  applyConsent(priorGranted);
  // skope.js often runs in <head>, before the body's tagged scripts are parsed.
  // Release again once the DOM is ready so prior consent applies on reload too.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { releaseTagged(currentGranted); }, { once: true });
  }

  fetch(base + "/api/cfg/" + encodeURIComponent(siteKey))
    .then(function (r) {
      return r.json();
    })
    .then(function (cfg) {
      if (!cfg || cfg.error) return;
      LATEST_CFG = cfg;
      // Optional persistent affordance so visitors can re-open their choices.
      if (cfg.banner && cfg.banner.showPreferencesButton) renderPrefsButton(cfg);
      if (!cfg.geo || !cfg.geo.showBanner) return;
      if (prior) {
        try {
          var st = JSON.parse(prior);
          if (st && st.noticeVersion === cfg.noticeVersion) return; // unchanged → no re-prompt
        } catch (e) {}
      }
      render(cfg);
    })
    .catch(function () {});

  // A small fixed "Privacy choices" button in its own host, re-opens the manage view.
  function renderPrefsButton(cfg) {
    if (document.getElementById("skope-prefs-host")) return;
    var host = document.createElement("div");
    host.id = "skope-prefs-host";
    var shadow = host.attachShadow({ mode: "open" });
    var accent = (cfg.banner && cfg.banner.accent) || "#0052ff";
    shadow.innerHTML =
      "<style>:host{position:fixed;z-index:2147483646}button{position:fixed;left:16px;bottom:16px;" +
      "display:inline-flex;align-items:center;gap:7px;" +
      "font:600 12px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#fff;background:" + esc(accent) +
      ";border:0;border-radius:999px;padding:8px 14px;box-shadow:0 4px 14px rgba(0,0,0,.18);cursor:pointer}" +
      "button svg{display:block}</style>" +
      '<button type="button">' + scopeMark(16, "mono") + "<span>Privacy choices</span></button>";
    shadow.querySelector("button").onclick = function () { window.skope.openPreferences(); };
    (document.body || document.documentElement).appendChild(host);
  }

  function essentialKeys(cfg) {
    return cfg.purposes.filter(function (p) { return p.isEssential; }).map(function (p) { return p.key; });
  }
  function nonEssentialKeys(cfg) {
    return cfg.purposes.filter(function (p) { return !p.isEssential; }).map(function (p) { return p.key; });
  }

  function decide(cfg, action, selected) {
    var ess = essentialKeys(cfg);
    var non = nonEssentialKeys(cfg);
    var granted, denied;
    if (action === "grant") {
      granted = ess.concat(non);
      denied = [];
    } else if (action === "deny" || action === "withdraw_all") {
      granted = ess.slice();
      denied = non.slice();
    } else {
      // update
      var keep = non.filter(function (k) { return selected.indexOf(k) !== -1; });
      granted = ess.concat(keep);
      denied = non.filter(function (k) { return keep.indexOf(k) === -1; });
    }
    return { granted: granted, denied: denied };
  }

  function send(cfg, action, decision, method) {
    var payload = {
      id: uuid(),
      siteKey: siteKey,
      subjectId: getSubject(),
      action: action,
      purposesGranted: decision.granted,
      purposesDenied: decision.denied,
      noticeVersion: cfg.noticeVersion,
      language: stateLang,
      region: cfg.geo.region,
      method: method || "banner",
    };
    var url = base + "/api/v1/consent";
    var body = JSON.stringify(payload);
    // Send as text/plain, a CORS-safelisted content type, so the request is
    // "simple" and needs no preflight. application/json would force a preflight
    // that browsers silently drop for cross-origin beacons (incl. file://).
    // The server reads it with request.json() regardless of content type.
    var sent = false;
    try {
      if (navigator.sendBeacon) {
        sent = navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      }
    } catch (e) {}
    if (!sent) {
      try {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: body,
          keepalive: true,
          mode: "cors",
        }).catch(function () {});
      } catch (e2) {}
    }
    setCookie(COOKIE, JSON.stringify({ noticeVersion: cfg.noticeVersion, granted: decision.granted }), 365);
  }

  var stateLang;

  function render(cfg, opts) {
    opts = opts || {};
    var method = opts.method || "banner";
    var prefs = method === "preference_center"; // opened from the persistent button / link
    var b = cfg.banner;
    stateLang = b.languages.indexOf(cfg.defaultLanguage) !== -1 ? cfg.defaultLanguage : b.languages[0] || "en";

    var host = document.getElementById("skope-banner-host");
    if (host) host.remove();
    host = document.createElement("div");
    host.id = "skope-banner-host";
    var shadow = host.attachShadow({ mode: "open" });
    (document.body || document.documentElement).appendChild(host);

    var view = opts.startView || "main";
    // In the preference center, reflect what's currently granted; on the first
    // banner the manage view defaults to "on" and the visitor toggles off.
    var selected = prefs
      ? nonEssentialKeys(cfg).filter(function (k) { return currentGranted.indexOf(k) !== -1; })
      : nonEssentialKeys(cfg).slice();

    function paint() {
      shadow.innerHTML = css(b) + (view === "main" ? mainView(cfg) : manageView(cfg, selected, prefs));
      wire();
    }

    function close() {
      host.remove();
    }

    function wire() {
      var $ = function (sel) { return shadow.querySelector(sel); };
      var langSel = $("[data-skope=lang]");
      if (langSel) langSel.onchange = function () { stateLang = langSel.value; paint(); };

      if (view === "main") {
        $("[data-skope=accept]").onclick = function () { var d = decide(cfg, "grant"); send(cfg, "grant", d, method); applyConsent(d.granted); close(); };
        $("[data-skope=reject]").onclick = function () { var d = decide(cfg, "deny"); send(cfg, "deny", d, method); applyConsent(d.granted); close(); };
        $("[data-skope=manage]").onclick = function () { view = "manage"; paint(); };
      } else {
        Array.prototype.forEach.call(shadow.querySelectorAll("[data-purpose]"), function (el) {
          el.onchange = function () {
            var k = el.getAttribute("data-purpose");
            if (el.checked) { if (selected.indexOf(k) === -1) selected.push(k); }
            else { selected = selected.filter(function (x) { return x !== k; }); }
          };
        });
        $("[data-skope=save]").onclick = function () { var d = decide(cfg, "update", selected); send(cfg, "update", d, method); applyConsent(d.granted); close(); };
        var withdraw = $("[data-skope=withdraw]");
        if (withdraw) withdraw.onclick = function () { var d = decide(cfg, "withdraw_all"); send(cfg, "withdraw_all", d, method); applyConsent(d.granted); close(); };
        $("[data-skope=back]").onclick = function () { if (prefs) close(); else { view = "main"; paint(); } };
      }
    }

    paint();
  }

  function langSwitcher(b) {
    if (!b.showLangSwitcher || b.languages.length < 2) return "";
    var names = { en: "English", hi: "हिन्दी", ta: "தமிழ்", te: "తెలుగు", bn: "বাংলা", mr: "मराठी", kn: "ಕನ್ನಡ", ml: "മലയാളം", gu: "ગુજરાતી", pa: "ਪੰਜਾਬੀ" };
    var opts = b.languages
      .map(function (l) {
        return '<option value="' + l + '"' + (l === stateLang ? " selected" : "") + ">" + (names[l] || l) + "</option>";
      })
      .join("");
    return '<select data-skope="lang" class="lang">' + opts + "</select>";
  }

  // The copy to show for the active language: its translation, else the source.
  function copyFor(b) {
    var tr = b.translations && b.translations[stateLang];
    return tr || { heading: b.heading, description: b.description, acceptLabel: b.acceptLabel, rejectLabel: b.rejectLabel, manageLabel: b.manageLabel };
  }

  function btns(c) {
    return (
      '<div class="actions">' +
      '<button data-skope="accept" class="btn primary">' + esc(c.acceptLabel) + "</button>" +
      '<button data-skope="reject" class="btn">' + esc(c.rejectLabel) + "</button>" +
      '<button data-skope="manage" class="btn ghost">' + esc(c.manageLabel) + "</button>" +
      "</div>"
    );
  }

  // The Skope mark (a "scope" reticle), drawn crisp at any size. "tile" =
  // blue rounded square + white reticle (for light backgrounds); "mono" = a
  // plain white reticle (for coloured surfaces like the accent button).
  function scopeMark(size, variant) {
    var s = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">';
    if (variant === "mono") {
      s += '<circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="11"/>' +
           '<circle cx="50" cy="50" r="12" fill="#fff"/>';
    } else {
      s += '<rect x="2" y="2" width="96" height="96" rx="26" fill="#2f6bff"/>' +
           '<circle cx="50" cy="50" r="27" fill="none" stroke="#fff" stroke-width="8"/>' +
           '<circle cx="50" cy="50" r="10" fill="#fff"/>';
    }
    return s + "</svg>";
  }

  // Footer on every banner view: a link to the hosted privacy page (where
  // visitors read the notice and make data-rights requests) + Skope branding.
  function footer(cfg) {
    var link = cfg.preferencesUrl
      ? '<a class="link" href="' + esc(cfg.preferencesUrl) + '" target="_blank" rel="noopener">Privacy notice and data requests</a>'
      : "<span></span>";
    // White-label plans hide the Skope brand but keep the data-requests link.
    var brand = cfg.whiteLabel ? "" : '<span class="brand">' + scopeMark(15, "tile") + "Secured by Skope</span>";
    return '<div class="foot">' + link + brand + "</div>";
  }

  function mainView(cfg) {
    var b = cfg.banner;
    var c = copyFor(b);
    return (
      '<div class="card" role="dialog" aria-label="Consent">' +
      '<div class="head"><strong class="h">' + esc(c.heading) + "</strong>" + langSwitcher(b) + "</div>" +
      '<p class="desc">' + esc(c.description) + "</p>" +
      btns(c) +
      footer(cfg) +
      "</div>"
    );
  }

  function manageView(cfg, selected, prefs) {
    var b = cfg.banner;
    // Declared data items (DPDP §5) grouped under their purpose. Older cached
    // cfg payloads may not carry dataItems, so guard.
    var items = cfg.dataItems || [];
    var rows = cfg.purposes
      .map(function (p) {
        var on = p.isEssential || selected.indexOf(p.key) !== -1;
        var names = items
          .filter(function (i) { return i.purposeKey === p.key; })
          .map(function (i) { return esc(t(i.name, stateLang)); });
        var pdata = names.length
          ? '<span class="pdata">Data collected: ' + names.join(", ") + "</span>"
          : "";
        return (
          '<label class="purpose">' +
          '<input type="checkbox" data-purpose="' + p.key + '"' + (on ? " checked" : "") + (p.isEssential ? " disabled" : "") + ">" +
          '<span class="ptext"><span class="pname">' + esc(t(p.name, stateLang)) + (p.isEssential ? ' <span class="locked">Always on</span>' : "") + "</span>" +
          '<span class="pdesc">' + esc(t(p.description, stateLang)) + "</span>" + pdata + "</span>" +
          "</label>"
        );
      })
      .join("");
    // In the preference center, offer a one-tap "Withdraw all" and label the
    // secondary action "Close" (there's no first-run "main" view to return to).
    var withdrawBtn = prefs ? '<button data-skope="withdraw" class="btn">Withdraw all</button>' : "";
    var backLabel = prefs ? "Close" : "Back";
    return (
      '<div class="card" role="dialog" aria-label="Manage choices">' +
      '<div class="head"><strong class="h">' + esc(copyFor(b).manageLabel) + "</strong>" + langSwitcher(b) + "</div>" +
      '<div class="purposes">' + rows + "</div>" +
      '<div class="actions">' +
      '<button data-skope="save" class="btn primary">Save choices</button>' +
      withdrawBtn +
      '<button data-skope="back" class="btn ghost">' + backLabel + "</button>" +
      "</div>" +
      footer(cfg) +
      "</div>"
    );
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function css(b) {
    var pos;
    if (b.layout === "modal") {
      pos =
        ":host{position:fixed;inset:0;z-index:2147483647}.wrap{position:fixed;inset:0;background:rgba(10,11,13,.45);display:flex;align-items:center;justify-content:center;padding:16px}.card{max-width:520px;width:100%}";
    } else if (b.layout === "corner") {
      pos = ":host{position:fixed;z-index:2147483647}.wrap{position:fixed;right:16px;bottom:16px;max-width:380px}";
    } else {
      pos = ":host{position:fixed;z-index:2147483647}.wrap{position:fixed;left:0;right:0;bottom:0}";
    }
    return (
      "<style>" +
      "*{box-sizing:border-box}" +
      pos +
      ".card{background:#fff;color:#5b616e;font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" +
      "border:1px solid #dee1e6;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.12);padding:18px 20px;margin:" +
      (b.layout === "bar" ? "0 auto;max-width:1100px;border-radius:16px 16px 0 0" : "0") +
      "}" +
      ".head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}" +
      ".h{color:#0a0b0d;font-size:15px;font-weight:600}" +
      ".desc{margin:0 0 14px}" +
      ".lang{font:13px inherit;border:1px solid #dee1e6;border-radius:8px;padding:4px 8px;background:#fff;color:#0a0b0d}" +
      ".actions{display:flex;flex-wrap:wrap;gap:8px}" +
      ".btn{font:600 14px inherit;padding:9px 16px;border-radius:999px;border:1px solid #dee1e6;background:#fff;color:#0a0b0d;cursor:pointer}" +
      ".btn:hover{background:#f7f7f7}" +
      ".btn.primary{background:" + esc(b.accent) + ";border-color:" + esc(b.accent) + ";color:#fff}" +
      ".btn.primary:hover{filter:brightness(.94)}" +
      ".btn.ghost{border-color:transparent;background:transparent;color:" + esc(b.accent) + "}" +
      ".purposes{display:flex;flex-direction:column;gap:10px;margin:4px 0 14px;max-height:240px;overflow:auto}" +
      ".purpose{display:flex;gap:10px;align-items:flex-start;cursor:pointer}" +
      ".purpose input{margin-top:3px}" +
      ".ptext{display:flex;flex-direction:column}" +
      ".pname{color:#0a0b0d;font-weight:600}" +
      ".locked{color:#7c828a;font-weight:400;font-size:12px}" +
      ".pdesc{font-size:13px}" +
      ".pdata{font-size:12px;color:#7c828a;margin-top:2px}" +
      ".foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:14px;padding-top:10px;border-top:1px solid #eef0f3;font-size:12px}" +
      ".link{color:" + esc(b.accent) + ";text-decoration:none}" +
      ".link:hover{text-decoration:underline}" +
      ".brand{display:inline-flex;align-items:center;gap:6px;color:#7c828a;white-space:nowrap}" +
      ".brand svg{display:block}" +
      "</style>" +
      '<div class="wrap">'
    );
    // NB: mainView/manageView open with .card inside .wrap; .wrap closed implicitly at host removal.
  }
})();
