/* global window, document, location, navigator, history, URL, URLSearchParams, crypto, fetch, setTimeout */
/*!
 * Supadata tracker — pageview/custom-goal/scroll tracking with cookie or
 * cookieless identity, UTM + ad-click capture, SPA support.
 * Usage:
 *   <script defer data-website-id="sdid_…" src="https://app/sd.js"></script>
 * Optional attrs: data-domain="extra.com", data-cookieless="true",
 *   data-api-url="https://app/api/e"
 * API: window.supadata("goal", name, props) / supadata("pageview", url?)
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;
  var siteId = script.getAttribute("data-website-id") || script.getAttribute("data-site-id");
  if (!siteId) return;
  var apiUrl = script.getAttribute("data-api-url") || new URL(script.src).origin + "/api/e";
  var cookieless = script.getAttribute("data-cookieless") === "true";
  var extraDomains = (script.getAttribute("data-domain") || "")
    .split(",")
    .map(function (d) {
      return d.trim().replace(/^www\./, "");
    })
    .filter(Boolean);

  var VISITOR_COOKIE = "supadata_visitor_id";
  var SESSION_COOKIE = "supadata_session_id";
  var SESSION_TTL_MIN = 30;
  var VISITOR_TTL_DAYS = 365;

  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeCookie(name, value, maxAgeSec) {
    if (cookieless) return;
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; Path=/; SameSite=Lax; Max-Age=" +
      maxAgeSec +
      secure;
  }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function visitorId() {
    if (cookieless) return null;
    var v = readCookie(VISITOR_COOKIE);
    if (!v) {
      v = uuid();
      writeCookie(VISITOR_COOKIE, v, VISITOR_TTL_DAYS * 86400);
    } else {
      writeCookie(VISITOR_COOKIE, v, VISITOR_TTL_DAYS * 86400);
    }
    return v;
  }
  function sessionId() {
    if (cookieless) return null;
    var s = readCookie(SESSION_COOKIE);
    if (!s) s = uuid();
    writeCookie(SESSION_COOKIE, s, SESSION_TTL_MIN * 60); // sliding window
    return s;
  }

  var CLICK_PARAMS = [
    "gclid",
    "gclsrc",
    "fbclid",
    "msclkid",
    "ttclid",
    "twclid",
    "wbraid",
    "gbraid",
    "li_fat_id",
  ];
  var HANDOFF_PREFIX = "_sd_";

  function clickIds(search) {
    var p = new URLSearchParams(search || location.search);
    var out = {};
    CLICK_PARAMS.forEach(function (k) {
      var v = p.get(k);
      if (v) out[k] = v;
    });
    var v2 = p.get(HANDOFF_PREFIX + "click_ids");
    if (v2) {
      try {
        Object.assign(out, JSON.parse(decodeURIComponent(v2)));
      } catch {
        /* ignore */
      }
    }
    return out;
  }
  function utm(name, search) {
    var p = new URLSearchParams(search || location.search);
    return p.get("utm_" + name) || p.get(HANDOFF_PREFIX + "utm_" + name);
  }

  // Persist first-touch attribution params in a cookie for later pageviews.
  var ATTR_COOKIE = "supadata_attr";
  function persistedAttribution() {
    var raw = readCookie(ATTR_COOKIE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function captureAttribution() {
    var params = new URLSearchParams(location.search);
    var has =
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].some(function (k) {
        return params.get(k) || params.get(HANDOFF_PREFIX + k);
      }) ||
      CLICK_PARAMS.some(function (k) {
        return params.get(k);
      });
    if (has) {
      writeCookie(
        ATTR_COOKIE,
        JSON.stringify({
          utm_source: utm("source"),
          utm_medium: utm("medium"),
          utm_campaign: utm("campaign"),
          utm_term: utm("term"),
          utm_content: utm("content"),
          click_ids: clickIds(),
        }),
        30 * 86400,
      );
    }
    return persistedAttribution();
  }

  function referrer() {
    var handoff = new URLSearchParams(location.search).get(HANDOFF_PREFIX + "referrer");
    var ref = handoff || document.referrer || null;
    if (!ref) return null;
    try {
      var host = new URL(ref).hostname.replace(/^www\./, "");
      var own = location.hostname.replace(/^www\./, "");
      if (host === own) return null;
    } catch {
      /* ignore */
    }
    return ref;
  }

  function send(payload) {
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon && navigator.sendBeacon(apiUrl, body)) return;
    fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body,
      keepalive: true,
      credentials: "omit",
    }).catch(function () {});
  }

  function basePayload(type) {
    var attr = captureAttribution() || {};
    return {
      site_id: siteId,
      visitor_id: visitorId(),
      session_id: sessionId(),
      type: type,
      url: location.href.split("#")[0],
      referrer: referrer(),
      timestamp: new Date().toISOString(),
      language: navigator.language || null,
      timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || null,
      utm_source: attr.utm_source || utm("source"),
      utm_medium: attr.utm_medium || utm("medium"),
      utm_campaign: attr.utm_campaign || utm("campaign"),
      utm_term: attr.utm_term || utm("term"),
      utm_content: attr.utm_content || utm("content"),
      click_ids: attr.click_ids || clickIds(),
    };
  }

  function pageview() {
    send(basePayload("pageview"));
  }
  function goal(name, props) {
    var p = basePayload("custom");
    p.name = name;
    if (props) p.props = props;
    send(p);
  }
  function identify(identity) {
    var p = basePayload("identify");
    if (identity) {
      p.user_id = identity.user_id || identity.userId || null;
      p.email = identity.email || null;
      p.visitor_name = identity.name || null;
      p.visitor_image = identity.image || null;
    }
    send(p);
  }

  // ---- automatic tracking ----

  pageview();

  // SPA navigation
  var lastUrl = location.href;
  function maybeTrack() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      pageview();
    }
  }
  ["pushState", "replaceState"].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      orig.apply(this, arguments);
      setTimeout(maybeTrack, 0);
    };
  });
  window.addEventListener("popstate", maybeTrack);
  window.addEventListener("hashchange", maybeTrack);

  // data-sd-goal elements: <button data-sd-goal="signup_click">
  document.addEventListener(
    "click",
    function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-sd-goal]") : null;
      if (el)
        goal(el.getAttribute("data-sd-goal"), {
          text: (el.textContent || "").trim().slice(0, 120),
        });
      // external links
      var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
      if (a) {
        try {
          var u = new URL(a.href);
          var own = location.hostname.replace(/^www\./, "");
          var host = u.hostname.replace(/^www\./, "");
          var isExternal = host !== own && extraDomains.indexOf(host) === -1;
          if (isExternal && /^https?:$/.test(u.protocol)) {
            var p = basePayload("external_link");
            p.name = u.href;
            send(p);
          }
        } catch {
          /* ignore */
        }
      }
    },
    true,
  );

  // data-sd-scroll depth tracking: <body data-sd-scroll> → 25/50/75/100
  if (document.body && document.body.hasAttribute("data-sd-scroll")) {
    var marks = [25, 50, 75, 100];
    var fired = {};
    window.addEventListener(
      "scroll",
      function () {
        var h = document.documentElement;
        var pct = Math.round(((h.scrollTop + h.clientHeight) / h.scrollHeight) * 100);
        marks.forEach(function (m) {
          if (pct >= m && !fired[m]) {
            fired[m] = true;
            goal("scroll_" + m, { depth: m });
          }
        });
      },
      { passive: true },
    );
  }

  // Cross-domain handoff: append _sd_* params to links pointing at configured domains.
  if (extraDomains.length) {
    document.addEventListener(
      "click",
      function (ev) {
        var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
        if (!a) return;
        try {
          var u = new URL(a.href);
          var host = u.hostname.replace(/^www\./, "");
          if (extraDomains.indexOf(host) === -1) return;
          var p = u.searchParams;
          var attr = persistedAttribution() || {};
          var v = readCookie(VISITOR_COOKIE);
          if (v) p.set(HANDOFF_PREFIX + "visitor_id", v);
          if (attr.utm_source) p.set(HANDOFF_PREFIX + "utm_source", attr.utm_source);
          if (attr.utm_medium) p.set(HANDOFF_PREFIX + "utm_medium", attr.utm_medium);
          if (attr.utm_campaign) p.set(HANDOFF_PREFIX + "utm_campaign", attr.utm_campaign);
          if (attr.click_ids && Object.keys(attr.click_ids).length)
            p.set(HANDOFF_PREFIX + "click_ids", encodeURIComponent(JSON.stringify(attr.click_ids)));
          var ref = document.referrer;
          if (ref) p.set(HANDOFF_PREFIX + "referrer", ref);
          a.href = u.toString();
        } catch {
          /* ignore */
        }
      },
      true,
    );
    // restore visitor id from handoff
    var handoffVisitor = new URLSearchParams(location.search).get(HANDOFF_PREFIX + "visitor_id");
    if (handoffVisitor && !readCookie(VISITOR_COOKIE)) {
      writeCookie(VISITOR_COOKIE, handoffVisitor, VISITOR_TTL_DAYS * 86400);
    }
  }

  // Auto payment detection: checkout return URLs with common id params.
  var payParams = new URLSearchParams(location.search);
  var checkoutId =
    payParams.get("session_id") || payParams.get("checkout_id") || payParams.get("order_id");
  if (checkoutId && /^(cs_|order_|ch_|sub_)/.test(checkoutId)) {
    var pp = basePayload("custom");
    pp.name = "payment_return";
    pp.props = { checkout_id: checkoutId };
    send(pp);
  }

  // Public API
  window.supadata =
    window.supadata ||
    function (cmd, a, b) {
      if (cmd === "goal" || cmd === "event") goal(a, b);
      else if (cmd === "pageview") pageview();
      else if (cmd === "identify") identify(a);
    };
})();
