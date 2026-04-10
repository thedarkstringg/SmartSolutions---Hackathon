// CyberClowns Content Script - Comprehensive Page Analysis
// Runs at document_idle on all URLs

(async () => {
  try {
    // === EARLY EXIT: Skip analysis for privileged pages ===
    const url = window.location.href;
    if (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("about:") ||
      !url ||
      url === "undefined"
    ) {
      return;
    }

    // Add delay to let page fully settle
    await new Promise((resolve) => setTimeout(resolve, 500));

    // === HELPER FUNCTIONS ===

    function getTextFromBody() {
      return (document.body?.textContent || "").toLowerCase();
    }

    function getFormActions() {
      const forms = document.querySelectorAll("form[action]");
      const actions = [];
      const currentDomain = new URL(url).hostname;

      forms.forEach((form) => {
        const action = form.getAttribute("action");
        if (action) {
          try {
            const actionUrl = new URL(action, url);
            if (actionUrl.hostname !== currentDomain) {
              actions.push(action);
            }
          } catch (e) {
            // Invalid URL, but record it as suspicious
            if (!action.startsWith("/") && !action.startsWith("#")) {
              actions.push(action);
            }
          }
        }
      });

      return actions;
    }

    function getFaviconUrl() {
      const link = document.querySelector("link[rel*='icon']");
      return link ? link.href : null;
    }

    function isFaviconExternal(faviconUrl) {
      if (!faviconUrl) return false;
      try {
        const faviconDomain = new URL(faviconUrl, url).hostname;
        const currentDomain = new URL(url).hostname;
        return faviconDomain !== currentDomain;
      } catch (e) {
        return false;
      }
    }

    // === SIGNAL 1: Hidden Fields & Password Detection ===
    function collectFieldSignals() {
      try {
        const hiddenFields = document.querySelectorAll('input[type="hidden"]');
        const passwordFields = document.querySelectorAll('input[type="password"]');

        return {
          hidden_field_count: hiddenFields.length,
          password_field_count: passwordFields.length,
          has_hidden_fields: hiddenFields.length > 0,
        };
      } catch (e) {
        return {
          hidden_field_count: 0,
          password_field_count: 0,
          has_hidden_fields: false,
        };
      }
    }

    // === SIGNAL 2: Redirect Detection ===
    function collectRedirectSignals() {
      try {
        let redirectCount = 0;
        const redirectMethods = [];

        // Method 1: Meta refresh tags
        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        if (metaRefresh) {
          redirectCount++;
          redirectMethods.push("meta-refresh");
        }

        // Method 2: Monitor window.location via Proxy
        let locationRedirects = 0;
        const originalLocationSet = Object.getOwnPropertyDescriptor(
          Location.prototype,
          "href"
        )?.set;

        if (originalLocationSet) {
          Object.defineProperty(Location.prototype, "href", {
            set: function (newUrl) {
              locationRedirects++;
              try {
                originalLocationSet.call(this, newUrl);
              } catch (e) {
                // Continue on error
              }
            },
            configurable: true,
          });
        }

        // Method 3: Monitor history API
        let historyApiRedirects = 0;
        const originalPushState = window.history.pushState;
        const originalReplaceState = window.history.replaceState;

        window.history.pushState = function (...args) {
          historyApiRedirects++;
          return originalPushState.apply(this, args);
        };

        window.history.replaceState = function (...args) {
          historyApiRedirects++;
          return originalReplaceState.apply(this, args);
        };

        if (locationRedirects > 0) {
          redirectMethods.push("location-assignment");
          redirectCount += locationRedirects;
        }

        if (historyApiRedirects > 0) {
          redirectMethods.push("history-api");
          redirectCount += historyApiRedirects;
        }

        return {
          redirect_count: redirectCount,
          redirect_methods: redirectMethods,
        };
      } catch (e) {
        return {
          redirect_count: 0,
          redirect_methods: [],
        };
      }
    }

    // === SIGNAL 3: Obfuscated JavaScript Detection ===
    function collectObfuscationSignals() {
      try {
        const patterns = new Set();
        const scriptTags = document.querySelectorAll("script:not([src])");
        let patternCount = 0;

        scriptTags.forEach((script) => {
          const content = script.textContent;

          // Check for eval()
          if (/\beval\s*\(/i.test(content)) {
            patterns.add("eval-usage");
            patternCount++;
          }

          // Check for unescape()
          if (/\bunescape\s*\(/i.test(content)) {
            patterns.add("unescape-usage");
            patternCount++;
          }

          // Check for document.write()
          if (/document\s*\.\s*write\s*\(/i.test(content)) {
            patterns.add("document-write");
            patternCount++;
          }

          // Check for String.fromCharCode()
          if (/String\s*\.\s*fromCharCode\s*\(/i.test(content)) {
            patterns.add("string-fromcharcode");
            patternCount++;
          }

          // Check for atob() decoding
          if (/\batob\s*\(/i.test(content)) {
            patterns.add("atob-decoding");
            patternCount++;
          }

          // Check for hex encoded strings (\x pattern)
          const hexMatches = content.match(/\\x[0-9a-f]{2}/gi);
          if (hexMatches && hexMatches.length >= 5) {
            patterns.add("hex-encoding");
            patternCount += hexMatches.length;
          }

          // Check for very long single-line strings (> 500 chars)
          const longStrings = content.match(/"[^"]{500,}"|'[^']{500,}'/g);
          if (longStrings) {
            patterns.add("long-strings");
            patternCount += longStrings.length;
          }
        });

        return {
          has_obfuscated_js: patterns.size > 0,
          obfuscation_patterns: Array.from(patterns),
          pattern_count: patternCount,
        };
      } catch (e) {
        return {
          has_obfuscated_js: false,
          obfuscation_patterns: [],
          pattern_count: 0,
        };
      }
    }

    // === SIGNAL 4: Cookie Analysis ===
    function collectCookieSignals() {
      try {
        let cookieCount = 0;
        const suspiciousCookieNames = [];
        const suspiciousPatterns = [
          "session",
          "token",
          "auth",
          "jwt",
          "user",
          "login",
        ];

        try {
          if (document.cookie && document.cookie.length > 0) {
            const cookies = document.cookie.split(";");
            cookieCount = cookies.length;

            cookies.forEach((cookie) => {
              const name = cookie.split("=")[0].trim().toLowerCase();
              if (
                suspiciousPatterns.some((pattern) =>
                  name.includes(pattern.toLowerCase())
                )
              ) {
                suspiciousCookieNames.push(name);
              }
            });
          }
        } catch (e) {
          // Might fail due to CSP
        }

        return {
          cookie_count: cookieCount,
          has_suspicious_cookies: suspiciousCookieNames.length > 0,
          suspicious_cookie_names: suspiciousCookieNames,
        };
      } catch (e) {
        return {
          cookie_count: 0,
          has_suspicious_cookies: false,
          suspicious_cookie_names: [],
        };
      }
    }

    // === SIGNAL 5: External Resources Ratio ===
    function collectResourceSignals() {
      try {
        const currentDomain = new URL(url).hostname;
        const resources = [];
        let externalCount = 0;
        let totalCount = 0;
        const suspiciousFormActions = [];

        // Collect all resources
        document.querySelectorAll('script[src]').forEach((el) => {
          resources.push(el.src);
        });
        document.querySelectorAll('img[src]').forEach((el) => {
          resources.push(el.src);
        });
        document.querySelectorAll('iframe[src]').forEach((el) => {
          resources.push(el.src);
        });
        document.querySelectorAll('link[href]').forEach((el) => {
          resources.push(el.href);
        });

        // Count external vs internal
        totalCount = resources.length;
        resources.forEach((resourceUrl) => {
          try {
            const resourceDomain = new URL(resourceUrl, url).hostname;
            if (resourceDomain !== currentDomain) {
              externalCount++;
            }
          } catch (e) {
            externalCount++;
          }
        });

        // Check form actions
        const formActions = getFormActions();
        suspiciousFormActions.push(...formActions);

        const externalRatio = totalCount > 0 ? externalCount / totalCount : 0;

        return {
          total_resources: totalCount,
          external_resources: externalCount,
          external_resources_ratio: parseFloat(externalRatio.toFixed(2)),
          suspicious_form_actions: suspiciousFormActions,
          has_suspicious_external:
            suspiciousFormActions.length > 0 || externalRatio > 0.7,
        };
      } catch (e) {
        return {
          total_resources: 0,
          external_resources: 0,
          external_resources_ratio: 0,
          suspicious_form_actions: [],
          has_suspicious_external: false,
        };
      }
    }

    // === SIGNAL 6: DOM Suspicious Patterns ===
    function collectDOMPatternSignals() {
      try {
        const bodyText = getTextFromBody();
        const urgencyPhrases = [
          "urgent",
          "immediately",
          "suspended",
          "verify now",
          "limited time",
          "act now",
          "confirm identity",
          "update payment",
          "action required",
        ];

        const foundPhrases = urgencyPhrases.filter(
          (phrase) => bodyText.includes(phrase)
        );

        // Check for disabled right-click
        const hasDisabledRightClick =
          document.body?.oncontextmenu === "return false" ||
          document.documentElement?.oncontextmenu === "return false";

        // Check for credential forms (email/username + password)
        const emailInputs = document.querySelectorAll(
          'input[type="email"], input[type="text"][name*="email"], input[name*="user"]'
        );
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        const hasCredentialForm =
          emailInputs.length > 0 && passwordInputs.length > 0;

        // Check favicon
        const faviconUrl = getFaviconUrl();
        const faviconExternal = isFaviconExternal(faviconUrl);

        return {
          has_urgency_text: foundPhrases.length > 0,
          urgency_phrases: foundPhrases,
          has_disabled_right_click: hasDisabledRightClick,
          has_credential_form: hasCredentialForm,
          favicon_external: faviconExternal,
        };
      } catch (e) {
        return {
          has_urgency_text: false,
          urgency_phrases: [],
          has_disabled_right_click: false,
          has_credential_form: false,
          favicon_external: false,
        };
      }
    }

    // === SIGNAL 7: Page Metadata ===
    function collectPageMetadata() {
      try {
        const loadTime =
          performance.timing && performance.timing.loadEventEnd
            ? performance.timing.loadEventEnd - performance.timing.navigationStart
            : null;

        return {
          title: document.title || "",
          description:
            document
              .querySelector('meta[name="description"]')
              ?.getAttribute("content") || "",
          referrer: document.referrer || "",
          url: window.location.href,
          load_time_ms: loadTime,
          charset: document.characterSet || "UTF-8",
        };
      } catch (e) {
        return {
          title: "",
          description: "",
          referrer: "",
          url: window.location.href,
          load_time_ms: null,
          charset: "UTF-8",
        };
      }
    }

    // === COLLECT ALL SIGNALS ===
    const behavior_signals = {
      // Signal 1
      ...collectFieldSignals(),
      // Signal 2
      ...collectRedirectSignals(),
      // Signal 3
      ...collectObfuscationSignals(),
      // Signal 4
      ...collectCookieSignals(),
      // Signal 5
      ...collectResourceSignals(),
      // Signal 6
      ...collectDOMPatternSignals(),
      // Signal 7
      ...collectPageMetadata(),
    };

    // === COLLECT DOM SNAPSHOT ===
    const dom_snapshot = (() => {
      try {
        return document.documentElement.outerHTML.substring(0, 50000);
      } catch {
        return "";
      }
    })();

    // === SEND TO BACKGROUND ===
    chrome.runtime.sendMessage({
      type: "ANALYZE_PAGE",
      payload: {
        url: window.location.href,
        dom_snapshot,
        behavior_signals,
      },
    });
  } catch (e) {
    // Catch all errors to prevent breaking the page
    console.error("CyberClowns content script error:", e);
  }
})();

