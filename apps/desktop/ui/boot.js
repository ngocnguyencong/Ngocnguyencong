/* global document, window, URLSearchParams, URL, AbortController, setTimeout, fetch, clearTimeout */

(function () {
  var PROBE_TIMEOUT_MS = 10000;
  var title = document.getElementById("title");
  var message = document.getElementById("message");
  var retry = document.getElementById("retry");

  // The shell injects __SUPASTACK_APP_URL__ at document start; ?target=
  // stays supported so the page can be exercised from a plain browser.
  function resolveTarget() {
    var injected = window.__SUPASTACK_APP_URL__;
    if (typeof injected === "string" && injected.length > 0) {
      return injected;
    }
    if (typeof URLSearchParams === "function") {
      return new URLSearchParams(window.location.search).get("target");
    }
    return null;
  }

  function hostOf(target) {
    try {
      return new URL(target).host || target;
    } catch {
      return target;
    }
  }

  // Reachability probe: an opaque no-cors fetch resolves when the server
  // answers at all; rejection or the timeout means unreachable.
  function probe(target) {
    return new Promise(function (resolve) {
      var settled = false;
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (controller) {
          controller.abort();
        }
        finish(false);
      }, PROBE_TIMEOUT_MS);
      var init = { mode: "no-cors", cache: "no-store" };
      if (controller) {
        init.signal = controller.signal;
      }
      try {
        fetch(target, init).then(
          function () {
            finish(true);
          },
          function () {
            finish(false);
          },
        );
      } catch {
        finish(false);
      }
      function finish(ok) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(ok);
        }
      }
    });
  }

  var target = resolveTarget();
  if (target) {
    var host = hostOf(target);
    var probing = false;

    var attempt = function () {
      if (probing) {
        return;
      }
      probing = true;
      title.hidden = true;
      retry.hidden = true;
      message.textContent = "Connecting to " + host + "…";
      probe(target).then(function (reachable) {
        probing = false;
        if (reachable) {
          window.location.replace(target);
        } else {
          title.textContent = "Can't reach " + host;
          title.hidden = false;
          message.textContent =
            "The app at " +
            target +
            " isn't responding. Make sure the server is running, then try again.";
          retry.hidden = false;
        }
      });
    };

    retry.addEventListener("click", attempt);
    window.addEventListener("online", attempt);
    attempt();
  }
})();
