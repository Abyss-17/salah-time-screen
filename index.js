(function () {
  "use strict";

  // Hot reload safety: Mark that we're loading
  var isHotReload = !!window.SalahTimeApp;
  var previousInstance = window.SalahTimeApp;

  // ES5 compatibility polyfills for older Smart TV browsers
  (function () {
    // Object.entries
    if (!Object.entries) {
      Object.entries = function (obj) {
        var res = [];
        for (var k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            res.push([k, obj[k]]);
          }
        }
        return res;
      };
    }
    // Array.from (basic)
    if (!Array.from) {
      Array.from = function (arrayLike) {
        if (arrayLike == null) return [];
        var arr = [];
        for (var i = 0; i < arrayLike.length; i++) {
          arr.push(arrayLike[i]);
        }
        return arr;
      };
    }
    // Object.assign
    if (!Object.assign) {
      Object.assign = function (target) {
        if (target == null) throw new TypeError("Cannot convert undefined or null to object");
        var to = Object(target);
        for (var i = 1; i < arguments.length; i++) {
          var next = arguments[i];
          if (next != null) {
            for (var key in next) {
              if (Object.prototype.hasOwnProperty.call(next, key)) {
                to[key] = next[key];
              }
            }
          }
        }
        return to;
      };
    }
    // Array.prototype.find
    if (!Array.prototype.find) {
      Array.prototype.find = function (predicate) {
        if (this == null) throw new TypeError("Array.prototype.find called on null or undefined");
        if (typeof predicate !== "function") throw new TypeError("predicate must be a function");
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        for (var i = 0; i < length; i++) {
          var value = list[i];
          if (predicate.call(thisArg, value, i, list)) return value;
        }
        return undefined;
      };
    }
    // Array.prototype.findIndex
    if (!Array.prototype.findIndex) {
      Array.prototype.findIndex = function (predicate) {
        if (this == null) throw new TypeError("Array.prototype.findIndex called on null or undefined");
        if (typeof predicate !== "function") throw new TypeError("predicate must be a function");
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        for (var i = 0; i < length; i++) {
          if (predicate.call(thisArg, list[i], i, list)) return i;
        }
        return -1;
      };
    }
    // Minimal Promise shim if missing (covers Promise.all and basic then chaining)
    if (typeof Promise === "undefined") {
      (function () {
        var P = function (executor) {
          var self = this;
          self._state = 0;
          self._value = undefined;
          self._handlers = [];
          function fulfill(v) {
            if (self._state !== 0) return;
            self._state = 1;
            self._value = v;
            setTimeout(function () {
              for (var i = 0; i < self._handlers.length; i++) {
                if (self._handlers[i].onFulfilled) {
                  try {
                    self._handlers[i].onFulfilled(v);
                  } catch (e) {}
                }
              }
              self._handlers = [];
            }, 0);
          }
          function reject(r) {
            if (self._state !== 0) return;
            self._state = 2;
            self._value = r;
            setTimeout(function () {
              for (var i = 0; i < self._handlers.length; i++) {
                if (self._handlers[i].onRejected) {
                  try {
                    self._handlers[i].onRejected(r);
                  } catch (e) {}
                }
              }
              self._handlers = [];
            }, 0);
          }
          self.then = function (onFulfilled, onRejected) {
            return new P(function (resolveNext, rejectNext) {
              function _onFulfilled(v) {
                if (typeof onFulfilled === "function") {
                  try {
                    var ret = onFulfilled(v);
                    if (ret && typeof ret.then === "function") {
                      ret.then(resolveNext, rejectNext);
                    } else {
                      resolveNext(ret);
                    }
                  } catch (e) {
                    rejectNext(e);
                  }
                } else {
                  resolveNext(v);
                }
              }
              function _onRejected(e) {
                if (typeof onRejected === "function") {
                  try {
                    var ret2 = onRejected(e);
                    if (ret2 && typeof ret2.then === "function") {
                      ret2.then(resolveNext, rejectNext);
                    } else {
                      resolveNext(ret2);
                    }
                  } catch (er) {
                    rejectNext(er);
                  }
                } else {
                  rejectNext(e);
                }
              }
              if (self._state === 0) {
                self._handlers.push({ onFulfilled: _onFulfilled, onRejected: _onRejected });
              } else if (self._state === 1) {
                setTimeout(function () {
                  _onFulfilled(self._value);
                }, 0);
              } else if (self._state === 2) {
                setTimeout(function () {
                  _onRejected(self._value);
                }, 0);
              }
            });
          };
          self.catch = function (onRejected) {
            return self.then(null, onRejected);
          };
          try {
            executor(fulfill, reject);
          } catch (ex) {
            reject(ex);
          }
        };
        P.resolve = function (v) {
          return new P(function (r) {
            r(v);
          });
        };
        P.reject = function (e) {
          return new P(function (_, rej) {
            rej(e);
          });
        };
        P.all = function (arr) {
          return new P(function (resolve, reject) {
            if (!arr || arr.length === 0) {
              resolve([]);
              return;
            }
            var results = [];
            var remaining = arr.length;
            for (var i = 0; i < arr.length; i++) {
              (function (pIndex) {
                P.resolve(arr[pIndex]).then(
                  function (val) {
                    results[pIndex] = val;
                    remaining--;
                    if (remaining === 0) resolve(results);
                  },
                  function (err) {
                    reject(err);
                  },
                );
              })(i);
            }
          });
        };
        window.Promise = P;
      })();
    }
  })();

  // Don't destroy yet - wait until we successfully initialize
  // This protects against runtime errors in new code

  var STATE = {
    params: new URLSearchParams(window.location.search),
    salahTimes: {
      current: null,
      currentJammat: null,
      tomorrow: null,
      tomorrowJammat: null,
      hijriDate: null,
      zawal: null,
    },
    campaigns: [],
    lastCampaignIds: null, // Stores JSON fingerprint of campaign data for change detection
    fundraisersProcessing: false,
    marqueeText: null,
    widgets: [],
    screenVersion: null,
    slideIndex: 0,
    isFirstLoad: true,
    donationData: null,
    signal: new AbortController(),
    jamaatWarning: {
      isActive: false,
      currentPrayer: null,
    },
    jamaatInProgress: {
      isActive: false,
      currentPrayer: null,
      startTime: null,
    },
  };

  var TIMEOUTS = {
    salahTimes: null,
    campaigns: null,
    fundraisers: null,
    fundraiserCarousels: [],
    screen: null,
    slide: null,
    clock: null,
    watchdog: null,
    clockHealthCheck: null,
    jamaatWarning: null,
    jamaatInProgress: null,
    donationData: null,
  };

  // Track clock health
  var CLOCK_STATE = {
    lastUpdateTime: 0,
    lastSecondAngle: -1,
  };

  var PRAYER_NAMES = {
    fajr: "Fajr",
    shouruq: "Sunrise",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
    jummah: "Jummah",
  };

  var DEFAULT_WIDGETS = {
    time: { widget_type: "time", stay_time: 60 },
    qr: { widget_type: "qr", stay_time: 60, screen_order: 1 },
    jummahDonation: {
      widget_type: "jummah-donation",
      stay_time: 60,
      screen_order: 2,
    },
  };

  var DOM = {
    screenWrapper: null,
    timetableContainer: null,
    analogClock: {
      container: null,
      hourHand: null,
      minuteHand: null,
      secondHand: null,
    },
    digital: {
      time: null,
      dateArabic: null,
      date: null,
    },
    nextPrayer: {
      name: null,
      countdown: null,
    },
    jamaatWarning: null,
    jamaatInProgress: null,
    scrollMessageBar: null,
  };

  var fullscreenHandler = null;

  function init() {
    console.log("[SalahTimeApp] Initializing...");

    try {
      DOM.screenWrapper = document.getElementById("screen-wrapper");
      if (!DOM.screenWrapper) {
        throw new Error("screen-wrapper not found");
      }

      DOM.timetableContainer = document.getElementById(
        "screen-timetable-container",
      );
      STATE.widgets = [
        DEFAULT_WIDGETS.time,
        DEFAULT_WIDGETS.qr,
        DEFAULT_WIDGETS.jummahDonation,
      ];

      setupFullscreenHandler();
      setupPreviewMode();
      initScrollMessageBar();
      startWatchdog();
      startClockHealthCheck();
      fetchVersion();

      // If this is a hot reload and we got here, initialization succeeded
      // Now safe to destroy the previous instance
      if (isHotReload && previousInstance) {
        console.log(
          "[SalahTimeApp] Hot reload init succeeded, cleaning up previous instance...",
        );
        previousInstance.destroy();
        previousInstance = null;
      }

      // Mark successful initialization
      window.__SalahTimeAppHealthy = true;
    } catch (e) {
      console.error("[SalahTimeApp] Init failed:", e);
      window.__SalahTimeAppHealthy = false;

      // If hot reload failed, don't destroy previous instance - it's still running
      if (isHotReload && previousInstance) {
        console.warn(
          "[SalahTimeApp] Hot reload init failed, previous instance kept alive",
        );
      }
      throw e; // Re-throw to be caught by hot reload error handler
    }
  }

  function destroy() {
    console.log("[SalahTimeApp] Destroying previous instance...");

    // Clear all timeouts and intervals
    clearAllTimeouts();

    // Abort any pending fetch requests
    if (STATE.signal) {
      STATE.signal.abort();
    }

    // Remove fullscreen click handler
    if (fullscreenHandler) {
      document.removeEventListener("click", fullscreenHandler);
      fullscreenHandler = null;
    }

    // Remove donation canvas resize listener
    window.removeEventListener("resize", scaleDonationCanvas);

    // Remove preview badge if exists
    var badge = document.querySelector(".badge-test");
    if (badge) badge.remove();

    // Remove jamaat warning overlay if exists
    if (DOM.jamaatWarning && DOM.jamaatWarning.parentNode) {
      DOM.jamaatWarning.parentNode.removeChild(DOM.jamaatWarning);
    }

    // Remove jamaat in progress overlay if exists
    if (DOM.jamaatInProgress && DOM.jamaatInProgress.parentNode) {
      DOM.jamaatInProgress.parentNode.removeChild(DOM.jamaatInProgress);
    }

    // Remove scroll message bar if exists
    if (DOM.scrollMessageBar && DOM.scrollMessageBar.parentNode) {
      DOM.scrollMessageBar.parentNode.removeChild(DOM.scrollMessageBar);
    }
    DOM.scrollMessageBar = null;
    document.body.classList.remove("has-scroll-bar");

    // Reset DOM references
    DOM.screenWrapper = null;
    DOM.timetableContainer = null;
    DOM.analogClock = {
      container: null,
      hourHand: null,
      minuteHand: null,
      secondHand: null,
    };
    DOM.digital = { time: null, dateArabic: null, date: null };
    DOM.nextPrayer = { name: null, countdown: null };
    DOM.jamaatWarning = null;
    DOM.jamaatInProgress = null;

    // Reset jamaat warning state
    STATE.jamaatWarning = {
      isActive: false,
      currentPrayer: null,
    };
    STATE.jamaatInProgress = {
      isActive: false,
      currentPrayer: null,
      startTime: null,
    };

    // Reset campaigns
    STATE.campaigns = [];
    STATE.lastCampaignIds = null;
    STATE.fundraisersProcessing = false;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildScrollMessageBarInnerHtml(message) {
    // Split by newline, filter blank lines, escape each segment, join with bullet separator
    var segments = String(message)
      .split("\n")
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        return s.length > 0;
      });
    if (segments.length === 0) return "";
    var joined = segments
      .map(function (s) {
        return escapeHtml(s);
      })
      .join(' <span class="scroll-message-bar-sep">&bull;</span> ');
    var sep = ' <span class="scroll-message-bar-sep">&bull;</span> ';
    return (
      '<div class="scroll-message-bar-inner">' +
      '<span class="scroll-message-bar-text">' +
      joined +
      sep +
      "</span>" +
      '<span class="scroll-message-bar-text">' +
      joined +
      "</span>" +
      "</div>"
    );
  }

  function initScrollMessageBar() {
    try {
      // Remove any existing bar first
      var existing = document.querySelector(".scroll-message-bar");
      if (existing) existing.remove();
      DOM.scrollMessageBar = null;

      // Don't create bar if there's no message
      var message = STATE.marqueeText || null;
      if (!message) return;

      var bar = document.createElement("div");
      bar.className = "scroll-message-bar";
      bar.innerHTML = buildScrollMessageBarInnerHtml(message);

      document.body.appendChild(bar);
      document.body.classList.add("has-scroll-bar");
      DOM.scrollMessageBar = bar;
    } catch (e) {
      console.warn("[SalahTimeApp] Scroll message bar init error:", e);
    }
  }

  function updateScrollMessageBar(message) {
    try {
      if (!message) return;
      if (!DOM.scrollMessageBar) {
        // Bar doesn't exist yet — create it
        var bar = document.createElement("div");
        bar.className = "scroll-message-bar";
        bar.innerHTML = buildScrollMessageBarInnerHtml(message);
        document.body.appendChild(bar);
        document.body.classList.add("has-scroll-bar");
        DOM.scrollMessageBar = bar;
        return;
      }
      var inner = DOM.scrollMessageBar.querySelector(
        ".scroll-message-bar-inner",
      );
      if (!inner) {
        // Inner element missing — rebuild the whole bar
        DOM.scrollMessageBar.innerHTML =
          buildScrollMessageBarInnerHtml(message);
        return;
      }
      var rebuilt = buildScrollMessageBarInnerHtml(message);
      if (!rebuilt) return;
      // Replace only the inner div contents
      var tmp = document.createElement("div");
      tmp.innerHTML = rebuilt;
      var newInner = tmp.querySelector(".scroll-message-bar-inner");
      if (newInner) {
        inner.innerHTML = newInner.innerHTML;
      }
    } catch (e) {
      console.warn("[SalahTimeApp] Scroll message bar update error:", e);
    }
  }

  function removeScrollMessageBar() {
    try {
      if (DOM.scrollMessageBar && DOM.scrollMessageBar.parentNode) {
        DOM.scrollMessageBar.parentNode.removeChild(DOM.scrollMessageBar);
      }
      DOM.scrollMessageBar = null;
      document.body.classList.remove("has-scroll-bar");
    } catch (e) {
      console.warn("[SalahTimeApp] Scroll message bar remove error:", e);
    }
  }

  function setupFullscreenHandler() {
    // Remove any existing handler first
    if (fullscreenHandler) {
      document.removeEventListener("click", fullscreenHandler);
    }

    fullscreenHandler = function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    };

    document.addEventListener("click", fullscreenHandler);

    // Re-scale donation canvas on window resize
    window.addEventListener("resize", scaleDonationCanvas);
  }

  function setupPreviewMode() {
    var stayTime = getStayTime();
    if (stayTime && !document.querySelector(".badge-test")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        '<div class="badge-test"><p class="badge-test-text">Preview</p></div>',
      );
    }
  }

  function getStayTime() {
    var param = STATE.params.get("stay_time");
    return param ? Math.max(5, Number(param) || 0) : null;
  }

  function fetchVersion() {
    try {
      fetch("/salah-time/version.php")
        .then(function (res) {
          return res.json();
        })
        .then(handleVersionUpdate)
        .catch(function () {
          // On error, still try to fetch salah data
          fetchSalahData();
        });
    } catch (e) {
      fetchSalahData();
    }
  }

  function handleVersionUpdate(result) {
    try {
      var newVersion = result && result.screen_version;

      // Version changed - reload everything (JS first, then page content)
      if (STATE.screenVersion !== null && STATE.screenVersion !== newVersion) {
        console.log(
          "[SalahTimeApp] Screen version changed (" +
            STATE.screenVersion +
            " -> " +
            newVersion +
            "), reloading...",
        );
        reloadScreen(newVersion);
        return;
      }

      // No version change, continue normal operation
      fetchSalahData();

      // Store current version
      STATE.screenVersion = newVersion;
    } catch (e) {
      console.warn("[SalahTimeApp] Version update error:", e);
      fetchSalahData();
    }
  }

  function reloadScreen(newVersion) {
    console.log("[SalahTimeApp] Reloading screen...");

    var jsUrl = "/salah-time/index.js?v=" + Date.now();
    var backupCode = window.__SalahTimeAppBackupCode;

    // Step 1: Fetch and validate new JS
    fetch(jsUrl, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("JS fetch HTTP " + res.status);
        return res.text();
      })
      .then(function (jsContent) {
        // Validate JS content
        var jsValidation = validateJsContent(jsContent);
        if (!jsValidation.valid) {
          throw new Error("Invalid JS: " + jsValidation.reason);
        }

        // JS is valid, now fetch page content via JSON endpoint
        // Using ?json=1 provides structured response with error detection
        return fetchHtmlViaJson().then(function (html) {
          return { js: jsContent, html: html };
        });
      })
      .then(function (content) {
        console.log(
          "[SalahTimeApp] All content fetched and validated, applying updates...",
        );

        // Step 2: Update page HTML
        try {
          var parser = new DOMParser();
          var newDoc = parser.parseFromString(content.html, "text/html");

          // Validate parsed HTML has required elements
          var newBody = newDoc.body;
          if (
            !newBody ||
            !newBody.innerHTML ||
            newBody.innerHTML.trim().length < 100
          ) {
            throw new Error("Parsed HTML body is empty or too short");
          }

          document.body.innerHTML = newBody.innerHTML;

          // Refresh CSS
          document
            .querySelectorAll("link[rel=stylesheet]")
            .forEach(function (link) {
              var rawUrl = link.href.split("?")[0];
              link.href = rawUrl + "?v=" + Date.now();
            });
        } catch (e) {
          console.warn("[SalahTimeApp] HTML update failed:", e);
          // Don't throw - continue with current HTML, just update JS
        }

        // Step 3: Execute new JS
        window.__SalahTimeAppHealthy = false;

        var script = document.createElement("script");
        script.textContent = content.js;
        document.head.appendChild(script);
        script.remove();

        // Verify success after delay
        setTimeout(function () {
          if (window.__SalahTimeAppHealthy) {
            STATE.screenVersion = newVersion;
            window.__SalahTimeAppBackupCode = content.js;
            window.__SalahTimeAppFailCount = 0;
            console.log(
              "[SalahTimeApp] Screen reload completed successfully, version:",
              newVersion,
            );
          } else {
            console.warn("[SalahTimeApp] New code did not initialize properly");
            recoverFromFailure(backupCode);
          }
        }, 500);
      })
      .catch(function (error) {
        console.warn(
          "[SalahTimeApp] Screen reload failed:",
          error.message || error,
        );
        recoverFromFailure(backupCode);
      });
  }

  /**
   * Validates JavaScript content before execution
   * Triple validation: length, markers, syntax
   * @param {string} jsContent - The JavaScript code to validate
   * @returns {{valid: boolean, reason: string}}
   */
  function validateJsContent(jsContent) {
    // Check 1: Length validation - prevent empty or truncated files
    if (!jsContent || jsContent.trim().length < 500) {
      return { valid: false, reason: "too short (min 500 chars)" };
    }

    // Check 2: Marker validation - ensure critical functions exist
    var requiredMarkers = ["SalahTimeApp", "function init", "function destroy"];
    for (var i = 0; i < requiredMarkers.length; i++) {
      if (jsContent.indexOf(requiredMarkers[i]) === -1) {
        return { valid: false, reason: "missing '" + requiredMarkers[i] + "'" };
      }
    }

    // Check 3: Syntax validation - catches syntax errors without execution
    try {
      new Function(jsContent);
    } catch (e) {
      return { valid: false, reason: "syntax error - " + e.message };
    }

    return { valid: true, reason: "" };
  }

  /**
   * Fetches HTML content via JSON endpoint for robust error detection
   * Using ?json=1 allows us to:
   * 1. Detect PHP errors (they won't be valid JSON)
   * 2. Detect backend exceptions (response structure changes)
   * 3. Validate HTML content before applying
   *
   * @returns {Promise<string>} - The validated HTML content
   */
  function fetchHtmlViaJson() {
    // Build JSON URL using the known salah-time endpoint directly
    // This avoids issues with short URLs like /sid6419 that might redirect
    var jsonUrl = "/salah-time/?mosque_id=" + mosqueId + "&json=1";

    console.log("[SalahTimeApp] Fetching HTML via JSON endpoint...");

    return fetch(jsonUrl, { cache: "no-store" })
      .then(function (res) {
        // Check HTTP status first
        if (!res.ok) {
          throw new Error("HTML fetch HTTP " + res.status);
        }

        // Check content type - must be JSON
        var contentType = res.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") === -1) {
          console.warn(
            "[SalahTimeApp] Expected JSON content-type, got:",
            contentType,
          );
          // Don't throw yet - try parsing anyway, PHP might have output issues
        }

        return res.text();
      })
      .then(function (responseText) {
        // Validate response is not empty
        if (!responseText || responseText.trim().length === 0) {
          throw new Error("Empty response from server");
        }

        // Detect PHP errors in response (they appear as plain text)
        var errorPatterns = [
          "Fatal error",
          "Parse error",
          "Warning:",
          "Notice:",
          "Deprecated:",
          "<br />", // PHP error formatting
          "Stack trace:",
          "Exception:",
        ];

        for (var i = 0; i < errorPatterns.length; i++) {
          if (responseText.indexOf(errorPatterns[i]) !== -1) {
            console.error(
              "[SalahTimeApp] PHP error detected in response:",
              responseText.substring(0, 500),
            );
            throw new Error("Backend PHP error detected");
          }
        }

        // Parse JSON - this will fail if server returned non-JSON (like PHP error page)
        var jsonData;
        try {
          jsonData = JSON.parse(responseText);
        } catch (e) {
          console.error(
            "[SalahTimeApp] JSON parse failed, response:",
            responseText.substring(0, 500),
          );
          throw new Error("Invalid JSON response - " + e.message);
        }

        // Validate JSON structure
        if (!jsonData || typeof jsonData !== "object") {
          throw new Error("JSON response is not an object");
        }

        // Check for error property in response
        if (jsonData.error) {
          throw new Error("Server returned error: " + jsonData.error);
        }

        // Extract HTML from JSON
        var html = jsonData.html;
        if (!html || typeof html !== "string") {
          throw new Error("JSON response missing 'html' property");
        }

        // Validate HTML content
        var htmlValidation = validateHtmlContent(html);
        if (!htmlValidation.valid) {
          throw new Error("Invalid HTML: " + htmlValidation.reason);
        }

        console.log(
          "[SalahTimeApp] HTML fetched successfully via JSON (" +
            html.length +
            " chars)",
        );
        return html;
      })
      .catch(function (error) {
        // Fail fast - if JSON endpoint fails, direct HTML would have same issue
        // Let recovery mechanism handle it (keeps current working code)
        console.error(
          "[SalahTimeApp] HTML fetch via JSON failed:",
          error.message,
        );
        throw error;
      });
  }

  /**
   * Validates HTML content before applying to DOM
   * @param {string} html - The HTML content to validate
   * @returns {{valid: boolean, reason: string}}
   */
  function validateHtmlContent(html) {
    // Check 1: Not empty
    if (!html || html.trim().length === 0) {
      return { valid: false, reason: "empty content" };
    }

    // Check 2: Minimum length (basic HTML should be at least 100 chars)
    if (html.trim().length < 100) {
      return { valid: false, reason: "too short (min 100 chars)" };
    }

    // Check 3: Required markers for SalahTime app HTML
    var requiredMarkers = [
      "screen-wrapper", // Main container ID
    ];

    for (var i = 0; i < requiredMarkers.length; i++) {
      if (html.indexOf(requiredMarkers[i]) === -1) {
        return { valid: false, reason: "missing '" + requiredMarkers[i] + "'" };
      }
    }

    // Check 4: Detect PHP errors embedded in HTML
    var errorPatterns = [
      "Fatal error",
      "Parse error",
      "Warning:",
      "Deprecated:",
      "Stack trace:",
    ];

    for (var j = 0; j < errorPatterns.length; j++) {
      if (html.indexOf(errorPatterns[j]) !== -1) {
        return { valid: false, reason: "PHP error detected in HTML" };
      }
    }

    // Check 5: Basic HTML structure
    if (html.indexOf("<") === -1 || html.indexOf(">") === -1) {
      return { valid: false, reason: "no HTML tags found" };
    }

    return { valid: true, reason: "" };
  }

  function recoverFromFailure(backupCode) {
    console.log("[SalahTimeApp] Attempting recovery...");

    // Current instance still healthy? Just continue, retry next cycle
    if (window.SalahTimeApp && window.__SalahTimeAppHealthy) {
      console.log(
        "[SalahTimeApp] Current instance healthy, will retry next cycle",
      );
      window.__SalahTimeAppFailCount = 0;
      fetchSalahData();
      return;
    }

    // Try backup code
    if (backupCode) {
      console.log("[SalahTimeApp] Restoring from backup...");
      try {
        var script = document.createElement("script");
        script.textContent = backupCode;
        document.head.appendChild(script);
        script.remove();
        window.__SalahTimeAppFailCount = 0;
        console.log("[SalahTimeApp] Backup restored");
        return;
      } catch (e) {
        console.error("[SalahTimeApp] Backup restore failed:", e);
      }
    }

    // Try refresh
    if (window.SalahTimeApp && window.SalahTimeApp.refresh) {
      try {
        window.SalahTimeApp.refresh();
        return;
      } catch (e) {
        console.error("[SalahTimeApp] Refresh failed:", e);
      }
    }

    // Track failures, hard reload after 3
    window.__SalahTimeAppFailCount = (window.__SalahTimeAppFailCount || 0) + 1;

    if (window.__SalahTimeAppFailCount >= 3) {
      console.error("[SalahTimeApp] 3 failures, forcing page reload...");
      setTimeout(function () {
        window.location.reload();
      }, 5000);
    } else {
      console.log("[SalahTimeApp] Will retry in 1 minute...");
      setTimeout(fetchVersion, 60000);
    }
  }

  function fetchSalahData() {
    try {
      var today = new Date();

      var urls = [
        "/api/search/detail.php?mosque_id=" + mosqueId,
        "/api/common/salah-time/get-salah-time.php?mosque_id=" +
          mosqueId +
          "&month=" +
          (today.getMonth() + 1) +
          "&day=" +
          today.getDate() +
          "&year=" +
          today.getFullYear(),
      ];

      Promise.all(
        urls.map(function (url) {
          return fetch(url)
            .then(function (res) {
              return res.json();
            })
            .catch(function () {
              return null;
            });
        }),
      )
        .then(handleSalahDataSuccess)
        .catch(scheduleSalahDataRetry);
    } catch (e) {
      scheduleSalahDataRetry();
    }
  }

  function handleSalahDataSuccess(results) {
    try {
      var mosqueInfo = results && results[0];
      var salahTimes = results && results[1];
      if (!mosqueInfo || !salahTimes) {
        scheduleSalahDataRetry();
        return;
      }

      var mosqueDetails = mosqueInfo.mosque_details;

      if (!mosqueDetails && STATE.isFirstLoad) {
        showError(
          salahTimes.message ||
            salahTimes.error ||
            "Failed to load mosque details",
        );
        return;
      }

      updateSalahState(salahTimes);

      if (STATE.isFirstLoad) {
        initializeWidgets();
      }

      updateMosqueInfo(mosqueDetails);
      scheduleSalahDataRefresh();
      STATE.isFirstLoad = false;
    } catch (e) {
      console.warn("[SalahTimeApp] Salah data handling error:", e);
      scheduleSalahDataRetry();
    }
  }

  function updateSalahState(salahTimes) {
    // Extract data from new API structure
    var timesData = salahTimes && salahTimes.data && salahTimes.data.times;
    var dateData = salahTimes && salahTimes.data && salahTimes.data.date;

    if (!timesData) {
      STATE.salahTimes.current = null;
      STATE.salahTimes.currentJammat = null;
      STATE.salahTimes.tomorrow = null;
      STATE.salahTimes.tomorrowJammat = null;
      STATE.salahTimes.hijriDate = null;
      STATE.salahTimes.zawal = null;
      return;
    }

    // Map adhan_times to current
    STATE.salahTimes.current = timesData.adhan_times || null;

    // Map jammat_times to currentJammat
    STATE.salahTimes.currentJammat = timesData.jammat_times || null;

    // Map tommorow_adhan_times to tomorrow
    STATE.salahTimes.tomorrow = timesData.tommorow_adhan_times || null;

    // Map tommorow_jammat_times to tomorrowJammat
    STATE.salahTimes.tomorrowJammat = timesData.tommorow_jammat_times || null;

    // Extract jummah times from jummah_times
    if (timesData.jummah_times) {
      if (!STATE.salahTimes.currentJammat) {
        STATE.salahTimes.currentJammat = {};
      }
      STATE.salahTimes.currentJammat.jummah =
        timesData.jummah_times.jummah || null;
      STATE.salahTimes.currentJammat.jummah_jammat =
        timesData.jummah_times.jummah_jammat || null;
    }

    // Map date to hijriDate
    STATE.salahTimes.hijriDate = dateData || null;

    STATE.salahTimes.zawal =
      timesData.zawal_time && timesData.zawal_time.solar_noon
        ? timesData.zawal_time.solar_noon
        : null;
  }

  function initializeWidgets() {
    if (!DOM.screenWrapper) return;

    try {
      DOM.screenWrapper.appendChild(WidgetFactory.createTime());

      if (DOM.timetableContainer && STATE.salahTimes.current) {
        DOM.timetableContainer.innerHTML = WidgetFactory.createTimetable();
      }

      DOM.screenWrapper.appendChild(WidgetFactory.createQR());
      DOM.screenWrapper.appendChild(WidgetFactory.createJummahDonation());
      DOM.screenWrapper.appendChild(WidgetFactory.createDonationSummarySlide());
      initAnalogClock();
      fetchScreenData(true);
    } catch (e) {
      console.warn("[SalahTimeApp] Widget initialization error:", e);
      fetchScreenData(true);
    }
  }

  function addFundraiserWidgets() {
    // Clear any pending updates to prevent rapid fire
    if (TIMEOUTS.fundraisers) {
      clearTimeout(TIMEOUTS.fundraisers);
      TIMEOUTS.fundraisers = null;
    }

    // Debounce: wait 300ms before actually updating
    // This prevents rapid add/remove when both APIs complete close together
    TIMEOUTS.fundraisers = setTimeout(function () {
      performFundraiserUpdate();
    }, 300);
  }

  function performFundraiserUpdate() {
    console.log(
      "[SalahTimeApp] performFundraiserUpdate called, campaigns count:",
      STATE.campaigns ? STATE.campaigns.length : 0,
    );

    if (!DOM.screenWrapper) {
      console.log("[SalahTimeApp] Skipping fundraisers: no screenWrapper");
      return;
    }

    // Prevent concurrent execution
    if (STATE.fundraisersProcessing) {
      console.log("[SalahTimeApp] Already processing fundraisers, skipping");
      return;
    }

    try {
      STATE.fundraisersProcessing = true;

      // Check if fundraiser widgets already exist in DOM
      var existingFundraisers = [];
      var existingIds = [];
      Array.from(DOM.screenWrapper.children).forEach(function (el) {
        var slideAttr = el.getAttribute && el.getAttribute("data-screen-slide");
        if (slideAttr && slideAttr.indexOf("campaign-") === 0) {
          existingFundraisers.push(el);
          var campaignId = slideAttr.replace("campaign-", "");
          existingIds.push(campaignId);
        }
      });

      // If no campaigns in state but widgets exist, leave them alone (don't remove)
      if (!STATE.campaigns || STATE.campaigns.length === 0) {
        if (existingFundraisers.length > 0) {
          console.log(
            "[SalahTimeApp] No campaigns data, keeping existing",
            existingFundraisers.length,
            "widgets",
          );
        } else {
          console.log(
            "[SalahTimeApp] No campaigns data and no widgets, nothing to do",
          );
        }
        STATE.fundraisersProcessing = false;
        return;
      }

      // Create fingerprint of current campaign data to detect content changes
      // Include all fields that affect display: id, title, description, goal, donations, image
      var currentCampaignData = STATE.campaigns.map(function (c) {
        return {
          id: c.id,
          title: c.title || "",
          description: c.description || "",
          goal: c.goal || "0",
          total_donations: c.total_donations || "0",
          completed_percentage: c.completed_percentage || 0,
          image: c.image && c.image.length > 0 ? c.image[0] : "",
        };
      });
      var currentFingerprint = JSON.stringify(currentCampaignData);

      console.log("[SalahTimeApp] Fundraisers check:", {
        existingCount: existingFundraisers.length,
        campaignsCount: STATE.campaigns.length,
        fingerprintChanged: STATE.lastCampaignIds !== currentFingerprint,
      });

      // Compare full data fingerprint, not just IDs
      // This detects changes in goal, donations, title, description, etc.
      if (
        currentFingerprint === STATE.lastCampaignIds &&
        existingFundraisers.length === STATE.campaigns.length &&
        existingFundraisers.length > 0
      ) {
        // Campaigns data identical, no need to update
        console.log(
          "[SalahTimeApp] Fundraisers already up to date (content unchanged)",
        );
        STATE.fundraisersProcessing = false;
        return;
      }

      STATE.lastCampaignIds = currentFingerprint;

      // Remove existing fundraiser widgets
      if (existingFundraisers.length > 0) {
        console.log(
          "[SalahTimeApp] Removing",
          existingFundraisers.length,
          "old fundraiser widgets (content changed or count changed)",
        );

        // Clear carousel intervals for widgets being removed
        existingFundraisers.forEach(function (el) {
          try {
            var carousel = el.querySelector(".screen-fundraiser-carousel");
            if (carousel) {
              var campaignId = carousel.getAttribute("data-campaign-id");
              if (campaignId) {
                stopFundraiserCarousel(campaignId);
              }
            }
            DOM.screenWrapper.removeChild(el);
          } catch (e) {
            console.warn("[SalahTimeApp] Failed to remove fundraiser:", e);
          }
        });
      }

      // Add fundraiser widgets in API response order
      // Find highest adjusted screen_order from public widgets (they're offset by 100)
      var maxPublicOrder = 1; // Start after QR which is at order 1
      STATE.widgets.forEach(function (w) {
        if (w.screen_order && w.screen_order > maxPublicOrder) {
          maxPublicOrder = w.screen_order;
        }
      });

      STATE.campaigns.forEach(function (campaign, index) {
        // Assign order based on API response position (after all public widgets)
        var fundraiserWidget = WidgetFactory.createFundraiserFromCampaign(
          campaign,
          maxPublicOrder + index + 1,
        );
        if (fundraiserWidget) {
          DOM.screenWrapper.appendChild(fundraiserWidget);
          console.log(
            "[SalahTimeApp] Added fundraiser widget for campaign:",
            campaign.id,
            "order:",
            maxPublicOrder + index + 1,
          );

          // Start carousel if campaign has multiple images
          if (campaign.image && campaign.image.length > 1) {
            startFundraiserCarousel(campaign.id);
          }
        }
      });

      console.log(
        "[SalahTimeApp] Fundraiser widgets added:",
        STATE.campaigns.length,
      );
      STATE.fundraisersProcessing = false;
    } catch (e) {
      console.warn("[SalahTimeApp] Error adding fundraiser widgets:", e);
      STATE.fundraisersProcessing = false;
    }
  }

  function scheduleSalahDataRefresh() {
    // Always schedule next check regardless of current data state
    if (TIMEOUTS.salahTimes) {
      clearTimeout(TIMEOUTS.salahTimes);
    }
    TIMEOUTS.salahTimes = setTimeout(fetchVersion, 1 * 60 * 1000); // 1 minute
  }

  function scheduleSalahDataRetry() {
    TIMEOUTS.salahTimes = setTimeout(fetchSalahData, 1 * 60 * 1000); // 1 minute
  }

  function startFundraiserCarousel(campaignId) {
    try {
      var carousel = document.querySelector(
        '.screen-fundraiser-carousel[data-campaign-id="' + campaignId + '"]',
      );
      if (!carousel) return;

      var images = carousel.querySelectorAll(".screen-fundraiser-image");
      if (images.length <= 1) return;

      var currentIndex = 0;

      // Rotate every 10 seconds
      var intervalId = setInterval(function () {
        try {
          // Remove active class from current image
          images[currentIndex].classList.remove("active");

          // Move to next image
          currentIndex = (currentIndex + 1) % images.length;

          // Add active class to next image
          images[currentIndex].classList.add("active");
        } catch (e) {
          console.warn("[SalahTimeApp] Carousel rotation error:", e);
        }
      }, 10000);

      // Track interval for cleanup
      TIMEOUTS.fundraiserCarousels.push({
        campaignId: campaignId,
        intervalId: intervalId,
      });

      console.log("[SalahTimeApp] Started carousel for campaign:", campaignId);
    } catch (e) {
      console.warn("[SalahTimeApp] Error starting carousel:", e);
    }
  }

  function stopFundraiserCarousel(campaignId) {
    try {
      // Find and clear the interval for this campaign
      var carouselIndex = -1;
      for (var i = 0; i < TIMEOUTS.fundraiserCarousels.length; i++) {
        if (TIMEOUTS.fundraiserCarousels[i].campaignId === campaignId) {
          carouselIndex = i;
          break;
        }
      }

      if (carouselIndex !== -1) {
        clearInterval(TIMEOUTS.fundraiserCarousels[carouselIndex].intervalId);
        TIMEOUTS.fundraiserCarousels.splice(carouselIndex, 1);
        console.log(
          "[SalahTimeApp] Stopped carousel for campaign:",
          campaignId,
        );
      }
    } catch (e) {
      console.warn("[SalahTimeApp] Error stopping carousel:", e);
    }
  }

  function fetchCampaigns() {
    try {
      fetch("/api/common/mosques/get-campaigns.php?mosque_id=" + mosqueId, {
        cache: "no-store",
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (result) {
          if (result && result.code === 200 && result.data) {
            STATE.campaigns = result.data;
            console.log(
              "[SalahTimeApp] Campaigns loaded:",
              STATE.campaigns.length,
            );

            // Trigger debounced widget update (will be merged with public_view.php update if close together)
            addFundraiserWidgets();
          } else {
            console.warn(
              "[SalahTimeApp] Invalid campaigns data, keeping existing:",
              result,
            );
            // Don't clear campaigns on error - keep last good data
          }
        })
        .catch(function (error) {
          console.error(
            "[SalahTimeApp] Error fetching campaigns, keeping existing:",
            error,
          );
          // Don't clear campaigns on error - keep last good data
        });
    } catch (e) {
      console.error(
        "[SalahTimeApp] Error in fetchCampaigns, keeping existing:",
        e,
      );
      // Don't clear campaigns on error - keep last good data
    }
  }

  function showError(message) {
    DOM.screenWrapper.innerHTML =
      '<div class="screen-not-found"><p class="screen-not-found-text">' +
      message +
      "</p></div>";
  }

  function fetchScreenData(shouldAnimate) {
    if (shouldAnimate === undefined) shouldAnimate = false;

    // Fetch campaigns data alongside screen data
    fetchCampaigns();

    // Reuse or create AbortController safely
    try {
      if (STATE.signal && !STATE.signal.signal.aborted) {
        STATE.signal.abort();
      }
    } catch (e) {
      // Ignore abort errors
    }
    STATE.signal = new AbortController();

    fetch("/api/mosque/screens/public_view.php?mosque_id=" + mosqueId, {
      signal: STATE.signal.signal,
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (result) {
        return handleScreenDataSuccess(result, shouldAnimate);
      })
      .catch(function () {
        if (shouldAnimate) animateSlide();
      });
  }

  function handleScreenDataSuccess(result, shouldAnimate) {
    try {
      if (result && result.status === "success" && Array.isArray(result.data)) {
        var stayTime = getStayTime();
        var screens = stayTime
          ? result.data
          : result.data.filter(function (d) {
              return d.live;
            });

        updateWidgetsList(screens);

        // Add fundraiser widgets after public_view.php screens are added
        addFundraiserWidgets();

        // Update scroll message bar with marquee_text from meta
        var marqueeText =
          result.meta && result.meta.marquee_text
            ? result.meta.marquee_text.trim()
            : "";
        STATE.marqueeText = marqueeText;
        if (marqueeText) {
          updateScrollMessageBar(marqueeText);
        } else {
          removeScrollMessageBar();
        }
      }
    } catch (e) {
      console.warn("[SalahTimeApp] Screen data handling error:", e);
    }

    if (shouldAnimate) animateSlide();
  }

  function updateWidgetsList(screens) {
    try {
      // Track which widgets should be kept vs removed
      var widgetsToRemove = [];

      STATE.widgets = STATE.widgets.filter(function (w) {
        if (!w.id) return true; // Keep default widgets (time, qr)

        var matchingScreen = screens.find(function (s) {
          return s.id === w.id;
        });

        // If widget no longer exists in API, mark for removal
        if (!matchingScreen) {
          widgetsToRemove.push(w.id);
          return false;
        }

        // If widget exists but updated_at changed, mark old one for removal
        if (matchingScreen.updated_at !== w.updated_at) {
          widgetsToRemove.push(w.id);
          return false;
        }

        // Keep widget - same ID and same updated_at
        return true;
      });

      // Remove DOM elements for widgets that were filtered out
      if (widgetsToRemove.length > 0 && DOM.screenWrapper) {
        console.log(
          "[SalahTimeApp] Removing",
          widgetsToRemove.length,
          "updated/deleted widgets from DOM",
        );
        widgetsToRemove.forEach(function (widgetId) {
          var element = DOM.screenWrapper.querySelector(
            '[data-screen-slide="' + widgetId + '"]',
          );
          if (element) {
            try {
              DOM.screenWrapper.removeChild(element);
              console.log(
                "[SalahTimeApp] Removed widget DOM element:",
                widgetId,
              );
            } catch (e) {
              console.warn(
                "[SalahTimeApp] Failed to remove widget element:",
                widgetId,
                e,
              );
            }
          }
        });
      }

      // Add new or updated widgets
      screens.forEach(function (widget) {
        if (widget.id && widget.updated_at && !hasWidgetElement(widget.id)) {
          console.log(
            "[SalahTimeApp] Adding new/updated widget:",
            widget.id,
            "updated_at:",
            widget.updated_at,
          );
          addWidget(widget);
        }
      });
    } catch (e) {
      console.warn("[SalahTimeApp] Update widgets error:", e);
    }
  }

  function hasWidgetElement(widgetId) {
    try {
      return (
        DOM.screenWrapper &&
        DOM.screenWrapper.querySelector(
          '[data-screen-slide="' + widgetId + '"]',
        ) !== null
      );
    } catch (e) {
      return false;
    }
  }

  function addWidget(widget) {
    if (!DOM.screenWrapper) return;

    try {
      // Offset public widget screen_order by 100 to place after Time (0) and QR (1)
      var adjustedWidget = Object.assign({}, widget);
      if (
        adjustedWidget.screen_order !== null &&
        adjustedWidget.screen_order !== undefined
      ) {
        adjustedWidget.screen_order = Number(adjustedWidget.screen_order) + 100;
      } else {
        // Default public widgets to order 100 when not specified by API
        adjustedWidget.screen_order = 100;
      }

      var element = WidgetFactory.create(adjustedWidget);
      if (!element) return;

      STATE.widgets.push(adjustedWidget);
      sortWidgets();

      var widgetIndex = STATE.widgets.findIndex(function (w) {
        return w.id === widget.id;
      });
      var nextWidget = STATE.widgets[widgetIndex + 1];
      var refElement = nextWidget
        ? DOM.screenWrapper.querySelector(
            '[data-screen-slide="' + nextWidget.id + '"]',
          )
        : null;

      // Public widgets append at the end (after QR, before fundraisers)
      if (!refElement) {
        // Find first fundraiser to insert before, or append to end
        var fundraiserWidget = null;
        Array.from(DOM.screenWrapper.children).forEach(function (el) {
          if (el.querySelector && el.querySelector(".screen-fundraiser")) {
            fundraiserWidget = fundraiserWidget || el;
          }
        });

        if (fundraiserWidget) {
          refElement = fundraiserWidget;
        }
      }

      DOM.screenWrapper.insertBefore(element, refElement);
      updateActiveSlideIndex();
    } catch (e) {
      console.warn("[SalahTimeApp] Add widget error:", e);
    }
  }

  function sortWidgets() {
    STATE.widgets.sort(function (a, b) {
      var valA =
        a.screen_order !== null && a.screen_order !== undefined
          ? a.screen_order
          : -Infinity;
      var valB =
        b.screen_order !== null && b.screen_order !== undefined
          ? b.screen_order
          : -Infinity;
      return valA - valB;
    });
  }

  function sortDOMSlides() {
    if (!DOM.screenWrapper) return;

    try {
      // Convert children to array and sort by data-screen-slide-order
      var slides = Array.from(DOM.screenWrapper.children);
      slides.sort(function (a, b) {
        var orderA = parseInt(a.getAttribute("data-screen-slide-order")) || 0;
        var orderB = parseInt(b.getAttribute("data-screen-slide-order")) || 0;
        return orderA - orderB;
      });

      // Re-append in sorted order (this removes and re-inserts each element)
      slides.forEach(function (slide) {
        DOM.screenWrapper.appendChild(slide);
      });
    } catch (e) {
      console.warn("[SalahTimeApp] Error sorting DOM slides:", e);
    }
  }

  function updateActiveSlideIndex() {
    if (!DOM.screenWrapper) return;

    try {
      Array.from(DOM.screenWrapper.children).forEach(function (el, i) {
        if (el.classList.contains("active")) {
          STATE.slideIndex = i;
        }
      });
    } catch (e) {
      // Ignore
    }
  }

  function animateSlide() {
    if (!DOM.screenWrapper) return;

    try {
      // Sort DOM children by data-screen-slide-order to maintain API response order
      sortDOMSlides();

      deactivateAllSlides();

      // Bounds check - use actual DOM children count, not STATE.widgets
      if (STATE.slideIndex >= DOM.screenWrapper.children.length) {
        STATE.slideIndex = 0;
      }

      var slideElement = DOM.screenWrapper.children[STATE.slideIndex];
      if (!slideElement) {
        STATE.slideIndex = 0;
        slideElement = DOM.screenWrapper.children[STATE.slideIndex];
      }

      if (slideElement) slideElement.classList.add("active");

      // If this is the time/clock slide, re-cache DOM and force immediate update
      if (slideElement && !slideElement.hasAttribute("data-screen-slide")) {
        cacheClockElements();
        updateClock();
      }

      // If this is a donation-summary slide, refresh data and scale canvas
      if (slideElement && slideElement.querySelector(".screen-donation-slide")) {
        scaleDonationCanvas();
        fetchDonationData();
      }

      updateTimetableVisibility(slideElement);
      removeObsoleteSlides();
      scheduleNextActions(slideElement);
    } catch (e) {
      console.warn("[SalahTimeApp] Slide animation error:", e);
      // Recover by scheduling next slide
      scheduleNextActions(null);
    }
  }

  function deactivateAllSlides() {
    if (!DOM.screenWrapper) return;

    try {
      Array.from(DOM.screenWrapper.children).forEach(function (el) {
        el.classList.remove("active");
      });
    } catch (e) {
      // Ignore
    }
  }

  function updateTimetableVisibility(slideElement) {
    if (!DOM.timetableContainer || !STATE.salahTimes.current || !slideElement)
      return;

    try {
      var screenSize = slideElement.getAttribute("data-screen-size");
      var isTimeWidget = !slideElement.hasAttribute("data-screen-slide");
      var isFullScreen = screenSize === "full";

      if (isFullScreen) {
        DOM.timetableContainer.classList.remove("active");
        DOM.timetableContainer.removeAttribute("data-timetable-left");
      } else if (isTimeWidget || screenSize === "half") {
        DOM.timetableContainer.classList.add("active");
        DOM.timetableContainer.setAttribute("data-timetable-left", "");
      } else {
        DOM.timetableContainer.classList.add("active");
        DOM.timetableContainer.removeAttribute("data-timetable-left");
      }
    } catch (e) {
      // Ignore timetable visibility errors
    }
  }

  function removeObsoleteSlides() {
    if (!DOM.screenWrapper) return;

    try {
      var toRemove = [];
      Array.from(DOM.screenWrapper.children).forEach(function (el) {
        var slideId = el.getAttribute("data-screen-slide");
        var updatedAt = el.getAttribute("data-screen-slide-updated");

        // Skip fundraiser widgets - they're managed separately
        if (slideId && slideId.indexOf("campaign-") === 0) {
          return;
        }

        if (slideId && !el.classList.contains("active")) {
          var isObsolete = !STATE.widgets.some(function (w) {
            return w.id == slideId && w.updated_at == updatedAt;
          });
          if (isObsolete) toRemove.push(el);
        }
      });

      // Remove after iteration to avoid mutation during loop
      toRemove.forEach(function (el) {
        el.remove();
      });
    } catch (e) {
      // Ignore removal errors
    }
  }

  function scheduleNextActions(slideElement) {
    // Clear any existing timeouts first to prevent accumulation
    if (TIMEOUTS.screen) {
      clearTimeout(TIMEOUTS.screen);
      TIMEOUTS.screen = null;
    }
    if (TIMEOUTS.slide) {
      clearTimeout(TIMEOUTS.slide);
      TIMEOUTS.slide = null;
    }

    var stayTime = getStayTime();
    var duration = stayTime || 60;

    // Get duration from slide element if available
    if (slideElement && !stayTime) {
      var slideId = slideElement.getAttribute("data-screen-slide");
      if (slideId) {
        // Find matching widget in STATE.widgets
        var matchingWidget = STATE.widgets.find(function (w) {
          return w.id == slideId;
        });
        if (matchingWidget && matchingWidget.stay_time) {
          duration = matchingWidget.stay_time;
        }
      }
    }

    TIMEOUTS.screen = setTimeout(fetchScreenData, (duration / 2) * 1000);
    TIMEOUTS.slide = setTimeout(function () {
      STATE.slideIndex++;
      animateSlide();
    }, duration * 1000);
  }

  var WidgetFactory = {
    create: function (widget) {
      var self = this;
      var creators = {
        text: function () {
          return self.createText(widget);
        },
        image: function () {
          return self.createImage(widget);
        },
      };

      var creator = creators[widget.widget_type];
      if (!creator) return null;

      var isValid =
        widget.widget_type === "text"
          ? widget.text_widget_content && widget.text_widget_background
          : widget.image_widget_url;

      return isValid ? creator() : null;
    },

    createTime: function () {
      var element = document.createElement("div");
      element.classList.add("screen-slide");
      element.setAttribute("data-screen-size", "half");
      element.setAttribute("data-screen-slide-order", "0");
      element.innerHTML =
        '<div class="screen-time">' +
        '<div class="screen-time-left">' +
        '<div class="screen-time-header">' +
        '<h1 class="screen-time-mosque" data-screen="mosque-name"></h1>' +
        '<p class="screen-time-digital-text" id="digital-date"></p>' +
        '<p class="screen-time-digital-text" id="digital-date-arabic"></p>' +
        "</div>" +
        '<div class="screen-time-clock">' +
        '<div class="analog-clock" id="analog-clock">' +
        '<div class="analog-clock-face">' +
        this.generateClockNumbers() +
        this.generateClockHands() +
        "</div>" +
        '<div class="screen-time-brand">' +
        '<a href="/" class="screen-time-brand-link">' +
        '<img src="/images/logo-white.svg" alt="Mosquepay" class="screen-time-brand-image">' +
        "</a>" +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>";
      return element;
    },

    generateClockNumbers: function () {
      return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        .map(function (num, i) {
          return (
            '<div class="analog-clock-number" style="--analog-clock-id: ' +
            i +
            '"><span>' +
            num +
            "</span></div>"
          );
        })
        .join("");
    },

    generateClockHands: function () {
      return (
        '<div class="analog-clock-hand analog-clock-hour" id="analog-clock-hour"></div>' +
        '<div class="analog-clock-hand analog-clock-minute" id="analog-clock-minute"></div>' +
        '<div class="analog-clock-hand analog-clock-second" id="analog-clock-second"></div>' +
        '<div class="analog-clock-center"></div>'
      );
    },

    createTimetable: function () {
      if (!STATE.salahTimes.current) return "";

      return (
        '<div class="screen-time-digital">' +
        '<p class="screen-time-digital-time" id="digital-time"></p>' +
        "</div>" +
        '<div class="screen-time-prayer">' +
        '<div class="screen-time-table">' +
        this.createTimetableHeader() +
        this.createTimetableBody() +
        "</div>" +
        "</div>" +
        '<div class="screen-time-bottom-card">' +
        '<div class="screen-time-next screen-time-bottom-card-cell">' +
        '<p class="screen-time-next-title" id="next-salah-name"></p>' +
        '<p class="screen-time-next-time" id="next-salah-countdown"></p>' +
        "</div>" +
        '<div class="screen-time-footer-cell screen-time-bottom-card-cell" id="screen-time-jummah-cell">' +
        '<p class="screen-time-footer-label">Friday Jummah</p>' +
        '<p class="screen-time-footer-value" id="jummah-display"></p>' +
        "</div>" +
        '<div class="screen-time-footer-cell screen-time-bottom-card-cell" id="shouruq-cell">' +
        '<p class="screen-time-footer-label">Sunrise</p>' +
        '<p class="screen-time-footer-value" id="shouruq-display"></p>' +
        "</div>" +
        '<div class="screen-time-footer-cell screen-time-bottom-card-cell" id="zawal-cell">' +
        '<p class="screen-time-footer-label">Zawal Time</p>' +
        '<p class="screen-time-footer-value" id="zawal-display"></p>' +
        "</div>" +
        "</div>"
      );
    },

    createTimetableHeader: function () {
      return (
        '<div class="screen-time-table-header">' +
        '<div class="screen-time-table-row">' +
        '<div class="screen-time-table-container">' +
        '<div class="screen-time-table-head screen-time-table-grow"></div>' +
        '<div class="screen-time-table-head screen-time-table-fixed">Start</div>' +
        '<div class="screen-time-table-head screen-time-table-fixed">JAMAAT</div>' +
        '<div class="screen-time-table-head screen-time-table-fixed">Tomorrow</div>' +
        "</div>" +
        "</div>" +
        "</div>"
      );
    },

    createTimetableBody: function () {
      var self = this;
      var prayers = Object.entries(STATE.salahTimes.current)
        .map(function (entry) {
          return entry[0].replace("_adhan", "");
        })
        .filter(function (key) {
          return key !== "shouruq";
        });

      return (
        '<div class="screen-time-table-body">' +
        prayers
          .map(function (key) {
            return self.createPrayerRow(key);
          })
          .join("") +
        "</div>"
      );
    },

    checkJummahExists: function () {
      if (
        (STATE.salahTimes.current && STATE.salahTimes.current.jummah) ||
        (STATE.salahTimes.current && STATE.salahTimes.current.jummah_adhan)
      ) {
        return true;
      }
      if (
        STATE.salahTimes.currentJammat &&
        STATE.salahTimes.currentJammat.jummah_jammat
      ) {
        return true;
      }
      if (
        STATE.salahTimes.tomorrowJammat &&
        STATE.salahTimes.tomorrowJammat.jummah_jammat
      ) {
        return true;
      }
      return false;
    },

    createPrayerRow: function (key) {
      return (
        '<div class="screen-time-table-row" data-salah-time="' +
        key +
        '">' +
        '<div class="screen-time-table-container">' +
        '<div class="screen-time-table-data screen-time-table-grow">' +
        '<p class="screen-time-table-truncate">' +
        PRAYER_NAMES[key] +
        "</p>" +
        "</div>" +
        this.createTimeColumn(key + "-start") +
        this.createTimeColumn(key + "-jammat") +
        this.createTimeColumn(key + "-tomorrow") +
        "</div>" +
        "</div>"
      );
    },

    createTimeColumn: function (dataKey) {
      return (
        '<div class="screen-time-table-data screen-time-table-fixed">' +
        "<div>" +
        '<span class="screen-time-time" data-time="' +
        dataKey +
        '"></span>' +
        '<span class="screen-time-ampm" data-period="' +
        dataKey +
        '"></span>' +
        "</div>" +
        "</div>"
      );
    },

    createText: function (widget) {
      var element = this.createWidgetElement(widget);
      var bg = widget.text_widget_background
        ? escapeHtml(String(widget.text_widget_background))
        : "transparent";
      element.innerHTML =
        this.createStatusBadge(widget) +
        '<div class="screen-text" style="--theme-bg: ' +
        bg +
        '; --theme-text-color: #fff;">' +
        '<p class="screen-text-text">' +
        formatBreakLines(widget.text_widget_content) +
        "</p>" +
        "</div>";
      return element;
    },

    createImage: function (widget) {
      var element = this.createWidgetElement(widget);
      element.innerHTML =
        this.createStatusBadge(widget) +
        '<div class="screen-image">' +
        '<img src="' +
        widget.image_widget_url +
        '" alt="Image" class="screen-image-image">' +
        "</div>";
      return element;
    },

    createQR: function () {
      var element = document.createElement("div");
      element.classList.add("screen-slide");
      element.setAttribute("data-screen-size", "half");
      element.setAttribute("data-screen-slide-order", "1");
      element.innerHTML =
        '<div class="screen-qr">' +
        '<div class="screen-qr-header">' +
        '<p class="screen-qr-title">Stay Connected.</p>' +
        '<p class="screen-qr-mosque">DOWNLOAD OUR APP</p>' +
        '<p class="screen-qr-title" data-screen="mosque-name"></p>' +
        "</div>" +
        '<div class="screen-qr-image">' +
        '<img src="/salah-time/download-app-screen.png" alt="Download App" class="screen-image-image">' +
        "</div>" +
        "</div>";
      return element;
    },

    createJummahDonation: function () {
      var element = document.createElement("div");
      element.classList.add("screen-slide");
      element.setAttribute("data-screen-size", "full");
      element.setAttribute("data-screen-slide-order", "2");
      element.innerHTML =
        '<div class="screen-jummah-donation">' +
        '<div class="screen-jummah-donation-stripes">' +
        '<svg width="1552" height="232" viewBox="0 0 1552 232" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path opacity="0.1" d="M0 2L776 225L1552 0V6.5L776 231.5L0 6.5V2Z" fill="white"/></svg>' +
        '<svg width="1552" height="244" viewBox="0 0 1552 244" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path opacity="0.1" d="M0 0L776 226L1552 0V18.5L776 243.5L0 18.5V0Z" fill="white"/></svg>' +
        '<svg width="1552" height="267" viewBox="0 0 1552 267" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path opacity="0.1" d="M0 0L776 222L1552 0V42L776 267L0 42V0Z" fill="white"/></svg>' +
        '<svg width="1552" height="310" viewBox="0 0 1552 310" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path opacity="0.1" d="M0.000204563 0L776 220L1552 0V85L776 310L0 85L0.000204563 0Z" fill="white"/></svg>' +
        '<svg width="1552" height="292" viewBox="0 0 1552 292" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path opacity="0.1" d="M0 0L776 220L1552 0V292H0V0Z" fill="white"/></svg>' +
        "</div>" +
        '<div class="screen-jummah-donation-content">' +
        '<div class="screen-jummah-donation-badge">' +
        '<span class="screen-jummah-donation-badge-dot"></span>' +
        '<span class="screen-jummah-donation-badge-text">Featured</span>' +
        "</div>" +
        '<div class="screen-jummah-donation-headline">' +
        '<span class="screen-jummah-donation-headline-line1">Automate your Jummah</span>' +
        '<span class="screen-jummah-donation-headline-line2">Donations</span>' +
        "</div>" +
        '<p class="screen-jummah-donation-description">Why not automate your Jummah donations at <span data-screen="mosque-name">your mosque</span> and never miss out on your Friday contribution.</p>' +
        '<div class="screen-jummah-donation-qr-card">' +
        '<div class="screen-jummah-donation-qr-beam"></div>' +
        '<div class="screen-jummah-donation-qr-glass">' +
        '<div class="screen-jummah-donation-qr-inner">' +
        '<img src="/images/salah-time-jummah-qr.png" alt="Download App" class="screen-jummah-donation-qr-image">' +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="screen-jummah-donation-stores">' +
        '<div class="screen-jummah-donation-store-btn">' +
        '<span class="screen-jummah-donation-store-icon"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3.18 23.76c.31.17.66.2 1.01.08L16.6 12 13 8.39 3.18 23.76Z" fill="#EA4335"/><path d="M20.54 10.26 17.3 8.4 13.38 12l3.93 3.93 3.23-1.86a1.8 1.8 0 0 0 0-3.81Z" fill="#FBBC04"/><path d="M4.19.16A1.8 1.8 0 0 0 3.18.24L13 12l3.6-3.6L4.19.16Z" fill="#4285F4"/><path d="M3.18.24A1.8 1.8 0 0 0 2.4 1.8v20.4c0 .63.3 1.18.78 1.56L13.38 12 3.18.24Z" fill="#3DDC84"/></svg></span>' +
        '<span class="screen-jummah-donation-store-texts">' +
        '<span class="screen-jummah-donation-store-label">Get it on</span>' +
        '<span class="screen-jummah-donation-store-name">Google Play</span>' +
        "</span>" +
        "</div>" +
        '<div class="screen-jummah-donation-store-btn">' +
        '<span class="screen-jummah-donation-store-icon"><svg width="31" height="31" viewBox="0 0 31 31" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.0401 25.0552C22.9736 26.6485 21.8429 28.2032 20.1211 28.2289C18.3993 28.2675 17.8468 27.2139 15.8937 27.2139C13.9278 27.2139 13.3239 28.2032 11.6921 28.2675C10.0089 28.3317 8.7368 26.5714 7.65748 25.0167C5.46029 21.8429 3.77706 15.9966 6.0385 12.0648C7.15637 10.1117 9.16082 8.87823 11.3323 8.83968C12.977 8.81399 14.5446 9.95755 15.5597 9.95755C16.5619 9.95755 18.4636 8.5827 20.4552 8.78829C21.2903 8.82683 23.6289 9.12236 25.1322 11.3324C25.0166 11.4095 22.344 12.9771 22.3697 16.2279C22.4082 20.1083 25.7747 21.4061 25.8132 21.4189C25.7747 21.5089 25.2736 23.2692 24.0401 25.0552ZM16.7032 4.4967C17.6412 3.43022 19.196 2.62073 20.4809 2.56934C20.6479 4.07268 20.044 5.58887 19.1446 6.66819C18.258 7.76036 16.7932 8.6084 15.3541 8.49276C15.1613 7.01512 15.8809 5.47323 16.7032 4.4967Z" fill="white"/></svg></span>' +
        '<span class="screen-jummah-donation-store-texts">' +
        '<span class="screen-jummah-donation-store-label">Download on the</span>' +
        '<span class="screen-jummah-donation-store-name">App Store</span>' +
        "</span>" +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>";
      return element;
    },

    createFundraiserFromCampaign: function (campaign, orderValue) {
      if (!campaign) return null;

      var element = document.createElement("div");
      element.classList.add("screen-slide");
      element.setAttribute("data-screen-slide", "campaign-" + campaign.id);
      element.setAttribute("data-screen-slide-order", String(orderValue));
      element.setAttribute("data-screen-size", "full");

      // Prepare data from campaign API response
      var images = campaign.image || [];
      var title = campaign.title || "";
      var description = campaign.description || "";
      var goalAmount = campaign.goal || "0";
      var totalDonations = campaign.total_donations || "0";
      var percentageFunded = campaign.completed_percentage || 0;

      // Calculate remaining amount
      var goalNum = parseFloat(goalAmount.replace(/,/g, ""));
      var totalNum = parseFloat(totalDonations.replace(/,/g, ""));
      var remainingNum = Math.max(0, goalNum - totalNum);
      var remaining =
        remainingNum > 0
          ? "&pound;" + remainingNum.toLocaleString() + " remaining"
          : "Goal achieved!";

      // Format percentage
      var percentageStr = percentageFunded.toFixed(1) + "%";
      var progressPercentage = Math.min(100, Math.max(0, percentageFunded));

      // Build QR code footer HTML
      var qrCode = (campaign.qr_code || "").trim();
      var safeQr = qrCode ? escapeHtml(String(qrCode)) : "";
      var footerQrHtml = qrCode
        ? '<div class="screen-fundraiser-right-footer-qr">' +
          '<div class="screen-fundraiser-right-footer-qr-wrapper">' +
          '<img src="' +
          safeQr +
          '" alt="QR Code" class="screen-fundraiser-right-footer-qr-image">' +
          "</div>" +
          "</div>"
        : "";

      // Generate carousel images HTML
      var carouselImagesHTML = "";
      if (images.length > 0) {
        carouselImagesHTML =
          '<div class="screen-fundraiser-carousel" data-campaign-id="' +
          campaign.id +
          '">';
        images.forEach(function (img, idx) {
          var activeClass = idx === 0 ? " active" : "";
          var safeName = encodeURIComponent(String(img).trim());
          carouselImagesHTML +=
            '<img src="/api/mosque/donation-wishlist/image/' +
            safeName +
            '" alt="Campaign" class="screen-fundraiser-image' +
            activeClass +
            '">';
        });
        carouselImagesHTML += "</div>";
      }

      element.innerHTML =
        '<div class="screen-fundraiser">' +
        '<div class="screen-fundraiser-left">' +
        carouselImagesHTML +
        '<div class="screen-fundraiser-left-content">' +
        '<div class="screen-fundraiser-left-title"><span>' +
        formatBreakLines(title) +
        "</span></div>" +
        '<p class="screen-fundraiser-left-description">' +
        formatBreakLines(description) +
        "</p>" +
        "</div>" +
        "</div>" +
        '<div class="screen-fundraiser-right">' +
        '<div class="screen-fundraiser-right-content">' +
        '<h2 class="screen-fundraiser-right-title">Support our mosque</h2>' +
        '<p class="screen-fundraiser-right-description">Earn the rewards of Sadaqah Jariyah by helping us reach our fundraising goal.</p>' +
        '<div class="screen-fundraiser-progress-container">' +
        '<div class="screen-fundraiser-progress-header">' +
        '<div class="screen-fundraiser-progress-item">' +
        '<span class="screen-fundraiser-progress-label">Current Progress</span>' +
        '<span class="screen-fundraiser-progress-amount">&pound;' +
        parseFloat(totalDonations).toFixed(2) +
        "</span>" +
        "</div>" +
        '<div class="screen-fundraiser-progress-item">' +
        '<span class="screen-fundraiser-progress-label">Goal</span>' +
        '<span class="screen-fundraiser-progress-amount">&pound;' +
        goalAmount +
        "</span>" +
        "</div>" +
        "</div>" +
        '<div class="screen-fundraiser-progress-bar">' +
        '<div class="screen-fundraiser-progress-fill" style="width: ' +
        progressPercentage +
        '%;"></div>' +
        "</div>" +
        '<div class="screen-fundraiser-progress-footer">' +
        '<span class="screen-fundraiser-progress-footer-left">' +
        percentageStr +
        " Funded</span>" +
        '<span class="screen-fundraiser-progress-footer-right">' +
        remaining +
        "</span>" +
        "</div>" +
        "</div>" +
        '<div class="screen-fundraiser-quote">' +
        '<p class="screen-fundraiser-quote-footer">"Whatever you spend in charity, He will compensate you for it; and He is the best of providers." — Quran 34:39.</p>' +
        "</div>" +
        '<div class="screen-fundraiser-right-footer">' +
        '<div class="screen-fundraiser-right-footer-text">' +
        '<span class="screen-fundraiser-right-footer-scan">Scan to donate</span>' +
        '<span class="screen-fundraiser-right-footer-or">Or</span>' +
        '<span class="screen-fundraiser-right-footer-visit">Visit <span class="screen-fundraiser-right-footer-link">mosquepay.co.uk</span></span>' +
        "</div>" +
        footerQrHtml +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>";
      return element;
    },

    createWidgetElement: function (widget) {
      var element = document.createElement("div");
      element.classList.add("screen-slide");
      element.setAttribute("data-screen-slide", widget.id);
      var orderValue = widget.screen_order != null ? widget.screen_order : 0;
      element.setAttribute("data-screen-slide-order", String(orderValue));
      element.setAttribute(
        "data-screen-slide-updated",
        widget.updated_at,
      );
      element.setAttribute("data-screen-size", widget.screen_size || "full");
      return element;
    },

    createStatusBadge: function (widget) {
      if (!getStayTime()) return "";

      var icon = widget.live
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M12.0003 3C17.3924 3 21.8784 6.87976 22.8189 12C21.8784 17.1202 17.3924 21 12.0003 21C6.60812 21 2.12215 17.1202 1.18164 12C2.12215 6.87976 6.60812 3 12.0003 3ZM12.0003 19C16.2359 19 19.8603 16.052 20.7777 12C19.8603 7.94803 16.2359 5 12.0003 5C7.7646 5 4.14022 7.94803 3.22278 12C4.14022 16.052 7.7646 19 12.0003 19ZM12.0003 16.5C9.51498 16.5 7.50026 14.4853 7.50026 12C7.50026 9.51472 9.51498 7.5 12.0003 7.5C14.4855 7.5 16.5003 9.51472 16.5003 12C16.5003 14.4853 14.4855 16.5 12.0003 16.5ZM12.0003 14.5C13.381 14.5 14.5003 13.3807 14.5003 12C14.5003 10.6193 13.381 9.5 12.0003 9.5C10.6196 9.5 9.50026 10.6193 9.50026 12C9.50026 13.3807 10.6196 14.5 12.0003 14.5Z"></path></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M17.8827 19.2968C16.1814 20.3755 14.1638 21.0002 12.0003 21.0002C6.60812 21.0002 2.12215 17.1204 1.18164 12.0002C1.61832 9.62282 2.81932 7.5129 4.52047 5.93457L1.39366 2.80777L2.80788 1.39355L22.6069 21.1925L21.1927 22.6068L17.8827 19.2968ZM5.9356 7.3497C4.60673 8.56015 3.6378 10.1672 3.22278 12.0002C4.14022 16.0521 7.7646 19.0002 12.0003 19.0002C13.5997 19.0002 15.112 18.5798 16.4243 17.8384L14.396 15.8101C13.7023 16.2472 12.8808 16.5002 12.0003 16.5002C9.51498 16.5002 7.50026 14.4854 7.50026 12.0002C7.50026 11.1196 7.75317 10.2981 8.19031 9.60442L5.9356 7.3497ZM12.9139 14.328L9.67246 11.0866C9.5613 11.3696 9.50026 11.6777 9.50026 12.0002C9.50026 13.3809 10.6196 14.5002 12.0003 14.5002C12.3227 14.5002 12.6309 14.4391 12.9139 14.328ZM20.8068 16.5925L19.376 15.1617C20.0319 14.2268 20.5154 13.1586 20.7777 12.0002C19.8603 7.94818 16.2359 5.00016 12.0003 5.00016C11.1544 5.00016 10.3329 5.11773 9.55249 5.33818L7.97446 3.76015C9.22127 3.26959 10.5793 3.00016 12.0003 3.00016C17.3924 3.00016 21.8784 6.87992 22.8189 12.0002C22.5067 13.6998 21.8038 15.2628 20.8068 16.5925ZM11.7229 7.50857C11.8146 7.50299 11.9071 7.50016 12.0003 7.50016C14.4855 7.50016 16.5003 9.51488 16.5003 12.0002C16.5003 12.0933 16.4974 12.1858 16.4919 12.2775L11.7229 7.50857Z"></path></svg>';

      var label = widget.live ? "Public" : "Private";

      return (
        '<div class="screen-status">' +
        icon +
        "<span>" +
        label +
        "</span></div>"
      );
    },

    createDonationSummarySlide: function () {
      var element = document.createElement("div");
      element.classList.add("screen-slide");
      element.setAttribute("data-screen-size", "full");
      element.setAttribute("data-screen-slide-order", "3");
      element.innerHTML =
        '<div class="screen-donation-slide">' +
          '<div id="donation-slide-canvas">' +
            '<div class="ds-header">' +
              '<div class="ds-mosque-name" id="mosqueName"></div>' +
              '<div class="ds-page-title">Donation Summary</div>' +
            '</div>' +
            '<div class="ds-datetime-container">' +
              '<div class="ds-time" id="currentTime">00:00</div>' +
              '<div class="ds-date" id="currentDate"></div>' +
            '</div>' +
            '<div class="ds-cards-container">' +
              '<div class="ds-card">' +
                '<div class="ds-card-header">' +
                  '<div class="ds-card-title">Donations All Time</div>' +
                  '<div class="ds-card-total ds-total-green" id="totalAllTime">\u00a30</div>' +
                '</div>' +
                '<hr class="ds-card-divider">' +
                '<div class="ds-items-scroll-container">' +
                  '<div class="ds-items-scroll-wrapper">' +
                    '<div class="ds-items-list" id="allTimeList"></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="ds-card">' +
                '<div class="ds-card-header">' +
                  '<div class="ds-card-title">Donations Past 7 Days</div>' +
                  '<div class="ds-card-total ds-total-gold" id="totalPast7Days">\u00a30</div>' +
                '</div>' +
                '<hr class="ds-card-divider">' +
                '<div class="ds-items-scroll-container">' +
                  '<div class="ds-items-scroll-wrapper">' +
                    '<div class="ds-items-list" id="past7DaysList"></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="ds-card">' +
                '<div class="ds-card-header">' +
                  '<div class="ds-card-title">Top Contributors</div>' +
                  '<div class="ds-contributor-subtitle">May Allah \uD83E\uDD32 accept and reward their generosity.</div>' +
                '</div>' +
                '<hr class="ds-card-divider">' +
                '<div class="ds-items-scroll-container">' +
                  '<div class="ds-items-scroll-wrapper">' +
                    '<div class="ds-items-list" id="contributorsList"></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      return element;
    },
  };

  function updateMosqueInfo(mosqueDetails) {
    if (!mosqueDetails) return;

    updateElements("[data-screen='mosque-name']", mosqueDetails.title || "");
    updateElements(
      "[data-screen='mosque-address']",
      mosqueDetails.address || "",
    );

    if (STATE.salahTimes.current) {
      updatePrayerTimes();
    }
  }

  function updatePrayerTimes() {
    if (!STATE.salahTimes.current) return;

    try {
      Object.entries(STATE.salahTimes.current).forEach(function (entry) {
        var key = entry[0];
        var time = entry[1];
        var prayerKey = key.replace("_adhan", "");
        var jammatKey = prayerKey + "_jammat";

        var startTime = time ? convert24To12(time) : ["", ""];
        var jammatTime =
          STATE.salahTimes.currentJammat &&
          STATE.salahTimes.currentJammat[jammatKey]
            ? convert24To12(STATE.salahTimes.currentJammat[jammatKey])
            : ["", ""];

        // For shouruq, show tomorrow's sunrise time; for others, show jamaat time
        var tomorrowTime;
        var tomorrowSuffix;
        if (prayerKey === "shouruq") {
          // Use the original key which already has _adhan suffix
          tomorrowTime =
            STATE.salahTimes.tomorrow && STATE.salahTimes.tomorrow[key]
              ? convert24To12(STATE.salahTimes.tomorrow[key])
              : ["", ""];
          tomorrowSuffix = "Sunrise";
        } else {
          tomorrowTime =
            STATE.salahTimes.tomorrowJammat &&
            STATE.salahTimes.tomorrowJammat[jammatKey]
              ? convert24To12(STATE.salahTimes.tomorrowJammat[jammatKey])
              : ["", ""];
          tomorrowSuffix = "Jamaat";
        }

        updateElements('[data-time="' + prayerKey + '-start"]', startTime[0]);
        updateElements('[data-period="' + prayerKey + '-start"]', startTime[1]);

        updateElements('[data-time="' + prayerKey + '-jammat"]', jammatTime[0]);
        updateElements(
          '[data-period="' + prayerKey + '-jammat"]',
          jammatTime[1],
        );

        updateElements(
          '[data-time="' + prayerKey + '-tomorrow"]',
          tomorrowTime[0]
            ? tomorrowTime[0] +
                '<div class="screen-time-time-suffix">' +
                tomorrowSuffix +
                "</div>"
            : "",
        );
        updateElements(
          '[data-period="' + prayerKey + '-tomorrow"]',
          tomorrowTime[1],
        );
      });

      updateJummahTimes();

      // Update Sunrise footer — delegated to updateShouruqDisplay() for realtime updates
      updateShouruqDisplay();
      updateZawalDisplay();

      // Render salah markers on the clock after prayer times are loaded
      // renderSalahMarkers(); // Commented out - salah markers disabled
    } catch (e) {
      console.warn("[SalahTimeApp] Prayer times update error:", e);
    }
  }

  function updateShouruqDisplay() {
    if (!STATE.salahTimes.current) return;
    try {
      var todayShouruqRaw = STATE.salahTimes.current.shouruq;
      var tomorrowShouruqRaw =
        STATE.salahTimes.tomorrow && STATE.salahTimes.tomorrow.shouruq;
      var shouruqCell = document.getElementById("shouruq-cell");
      if (!shouruqCell) return;

      var now = new Date();
      var todayShouruqDate = todayShouruqRaw
        ? parseTimeToDate(todayShouruqRaw)
        : null;
      var isPastSunrise = todayShouruqDate && now >= todayShouruqDate;

      if (!isPastSunrise && todayShouruqRaw) {
        // Before today's sunrise — show today's time
        var todayShouruq = convert24To12(todayShouruqRaw);
        updateElements(
          "#shouruq-display",
          todayShouruq[0] +
            " " +
            todayShouruq[1].toUpperCase() +
            ' <span class="screen-time-time-suffix" style="display:inline">Today</span>',
        );
        shouruqCell.style.display = "";
      } else if (tomorrowShouruqRaw) {
        // After today's sunrise — show tomorrow's time
        var tomorrowShouruq = convert24To12(tomorrowShouruqRaw);
        updateElements(
          "#shouruq-display",
          tomorrowShouruq[0] +
            " " +
            tomorrowShouruq[1].toUpperCase() +
            ' <span class="screen-time-time-suffix" style="display:inline">Tomorrow</span>',
        );
        shouruqCell.style.display = "";
      } else {
        shouruqCell.style.display = "none";
      }
    } catch (e) {
      // Ignore
    }
  }

  function updateZawalDisplay() {
    try {
      var zawalCell = document.getElementById("zawal-cell");
      var zawalDisplay = document.getElementById("zawal-display");

      if (!zawalCell || !zawalDisplay) return;

      if (!STATE.salahTimes.zawal) {
        zawalCell.style.display = "none";
        zawalDisplay.textContent = "";
        return;
      }

      var zawalTime = convert24To12(STATE.salahTimes.zawal);
      if (!zawalTime[0]) {
        zawalCell.style.display = "none";
        zawalDisplay.textContent = "";
        return;
      }

      zawalDisplay.textContent =
        zawalTime[0] + " " + zawalTime[1].toUpperCase();
      zawalCell.style.display = "";
    } catch (e) {
      try {
        var cell = document.getElementById("zawal-cell");
        if (cell) cell.style.display = "none";
      } catch (e2) {
        // Ignore cleanup errors
      }
    }
  }

  function updateJummahVisibility() {
    if (!STATE.salahTimes.currentJammat) return;
    try {
      var jummahJammat = STATE.salahTimes.currentJammat.jummah_jammat;
      var jummah = STATE.salahTimes.currentJammat.jummah;
      var jummahTime = jummahJammat || jummah;
      var jummahCell = document.getElementById("screen-time-jummah-cell");
      if (!jummahCell || !jummahTime) return;
      // On Friday, hide the cell once jamaat time has passed
      var now = new Date();
      if (now.getDay() === 5) {
        var jummahDate = parseTimeToDate(jummahTime);
        if (now >= jummahDate) {
          jummahCell.style.display = "none";
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  function updateJummahTimes() {
    try {
      var jummahJammat =
        STATE.salahTimes.currentJammat &&
        STATE.salahTimes.currentJammat.jummah_jammat;
      var jummah =
        STATE.salahTimes.currentJammat && STATE.salahTimes.currentJammat.jummah;

      var jummahCell = document.getElementById("screen-time-jummah-cell");
      var jummahDisplay = document.getElementById("jummah-display");

      if (!jummahDisplay) return;

      var jummahTime = jummahJammat || jummah;

      if (jummahTime) {
        var time = convert24To12(jummahTime);
        if (time[0]) {
          var text = time[0] + " " + time[1].toUpperCase();
          text +=
            ' <span class="screen-time-time-suffix" style="display:inline">JAMAAT</span>';
          jummahDisplay.innerHTML = text;
          if (jummahCell) jummahCell.style.display = "";
        } else {
          if (jummahCell) jummahCell.style.display = "none";
        }
      } else {
        if (jummahCell) jummahCell.style.display = "none";
      }
    } catch (e) {
      // Ignore Jummah update errors
      try {
        var cell = document.getElementById("screen-time-jummah-cell");
        if (cell) cell.style.display = "none";
      } catch (e2) {
        // Ignore cleanup errors
      }
    }
  }

  function updateElements(selector, content) {
    try {
      document.querySelectorAll(selector).forEach(function (el) {
        // If content appears to contain HTML tags, set as innerHTML,
        // otherwise use textContent to avoid XSS from remote data.
        if (typeof content === "string" && content.indexOf("<") === -1) {
          el.textContent = content;
        } else {
          el.innerHTML = content;
        }
      });
    } catch (e) {
      // Ignore element update errors
    }
  }

  function initAnalogClock() {
    cacheClockElements();

    if (!isClockReady()) return;

    renderClockLines();
    // renderSalahMarkers(); // Commented out - salah markers disabled
    startClock();
  }

  function cacheClockElements() {
    DOM.analogClock.container = document.getElementById("analog-clock");
    DOM.analogClock.hourHand = document.getElementById("analog-clock-hour");
    DOM.analogClock.minuteHand = document.getElementById("analog-clock-minute");
    DOM.analogClock.secondHand = document.getElementById("analog-clock-second");
    DOM.digital.time = document.getElementById("digital-time");
    DOM.digital.dateArabic = document.getElementById("digital-date-arabic");
    DOM.digital.date = document.getElementById("digital-date");
    DOM.nextPrayer.name = document.getElementById("next-salah-name");
    DOM.nextPrayer.countdown = document.getElementById("next-salah-countdown");
  }

  function isClockReady() {
    return (
      DOM.analogClock.hourHand &&
      DOM.analogClock.minuteHand &&
      DOM.analogClock.secondHand &&
      DOM.analogClock.container &&
      DOM.digital.time &&
      DOM.digital.dateArabic &&
      DOM.digital.date
    );
  }

  function renderClockLines() {
    if (!DOM.analogClock.container) return;

    // Prevent duplicate line rendering
    if (DOM.analogClock.container.querySelector(".analog-clock-line")) return;

    var lines = [];
    for (var i = 0; i < 60; i++) {
      var isMajor = i % 5 === 0;
      lines.push(
        '<div class="analog-clock-line ' +
          (isMajor ? "major" : "") +
          '" style="--analog-clock-line: ' +
          i +
          ';"></div>',
      );
    }

    try {
      DOM.analogClock.container.insertAdjacentHTML("beforeend", lines.join(""));
    } catch (e) {
      // Ignore
    }
  }

  function renderSalahMarkers() {
    if (!DOM.analogClock.container) {
      console.log(
        "[SalahTimeApp] Cannot render salah markers: clock container not found",
      );
      return;
    }
    if (!STATE.salahTimes.current) {
      console.log(
        "[SalahTimeApp] Cannot render salah markers: salah times not loaded yet",
      );
      return;
    }

    console.log("[SalahTimeApp] Rendering salah markers...");

    // Remove existing markers
    var existingMarkers = DOM.analogClock.container.querySelectorAll(
      ".analog-clock-salah-marker",
    );
    existingMarkers.forEach(function (marker) {
      marker.remove();
    });

    var salahTimes = STATE.salahTimes.current;
    var markers = [];

    // Prayer order for display (exclude shouruq as it's just sunrise info)
    // Note: API returns times with _adhan suffix
    var prayerKeys = [
      "fajr_adhan",
      "dhuhr_adhan",
      "asr_adhan",
      "maghrib_adhan",
      "isha_adhan",
    ];

    prayerKeys.forEach(function (key) {
      var timeStr = salahTimes[key];
      if (!timeStr) return;

      // Parse time to get angle on 12-hour clock
      var angle = calculateClockAngle(timeStr);
      if (angle === null) return;

      // Remove _adhan suffix for the marker attribute and prayer name
      var prayerKey = key.replace("_adhan", "");
      var prayerName = PRAYER_NAMES[prayerKey] || prayerKey;

      console.log(
        "[SalahTimeApp] Adding marker for " +
          prayerName +
          " at " +
          timeStr +
          " (angle: " +
          angle +
          "deg)",
      );

      // Add class for angles less than 180 degrees to use different writing mode
      var writingClass = angle < 180 ? " lower-half" : "";

      markers.push(
        '<div class="analog-clock-salah-marker' +
          writingClass +
          '" data-salah-marker="' +
          prayerKey +
          '" style="--salah-angle: ' +
          angle +
          'deg;">' +
          '<div class="analog-clock-salah-line"></div>' +
          '<div class="analog-clock-salah-label">' +
          prayerName +
          "</div>" +
          "</div>",
      );
    });

    console.log("[SalahTimeApp] Total markers to render: " + markers.length);

    try {
      DOM.analogClock.container.insertAdjacentHTML(
        "beforeend",
        markers.join(""),
      );
      updateSalahMarkers();
      console.log("[SalahTimeApp] Salah markers rendered successfully");
    } catch (e) {
      console.warn("[SalahTimeApp] Error rendering salah markers:", e);
    }
  }

  function calculateClockAngle(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return null;

    var parts = timeStr.split(":");
    var hours = parseInt(parts[0], 10);
    var minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    // Convert to 12-hour format
    var hours12 = hours % 12;

    // Calculate angle: each hour = 30°, each minute = 0.5°
    var angle = hours12 * 30 + minutes * 0.5;

    return angle;
  }

  function updateSalahMarkers() {
    if (!DOM.analogClock.container) return;

    try {
      var nextPrayer = getNextPrayerTime();
      var prayerKey = nextPrayer.name
        .replace("_adhan", "")
        .replace("_jammat", "");

      // Update all markers
      var markers = DOM.analogClock.container.querySelectorAll(
        ".analog-clock-salah-marker",
      );
      markers.forEach(function (marker) {
        var markerPrayer = marker.getAttribute("data-salah-marker");
        var isActive = markerPrayer === prayerKey;
        marker.classList.toggle("active", isActive);
      });
    } catch (e) {
      // Ignore
    }
  }

  function startClock() {
    // Clear any existing clock interval first
    if (TIMEOUTS.clock) {
      clearInterval(TIMEOUTS.clock);
      TIMEOUTS.clock = null;
    }

    updateClock();
    TIMEOUTS.clock = setInterval(updateClock, 1000);
  }

  function updateClock() {
    // Always get fresh DOM references to avoid stale pointer issues
    var hourHand = document.getElementById("analog-clock-hour");
    var minuteHand = document.getElementById("analog-clock-minute");
    var secondHand = document.getElementById("analog-clock-second");

    if (!hourHand || !minuteHand || !secondHand) {
      return;
    }

    try {
      var now = new Date();

      var hours = now.getHours() % 12;
      var minutes = now.getMinutes();
      var seconds = now.getSeconds();

      var hourAngle = hours * 30 + minutes * 0.5;
      var minuteAngle = minutes * 6;
      var secondAngle = seconds * 6;

      hourHand.style.transform = "rotate(" + hourAngle + "deg)";
      minuteHand.style.transform = "rotate(" + minuteAngle + "deg)";
      secondHand.style.transform = "rotate(" + secondAngle + "deg)";

      // Track last successful update
      CLOCK_STATE.lastUpdateTime = Date.now();
      CLOCK_STATE.lastSecondAngle = secondAngle;

      if (STATE.salahTimes.current) {
        updateNextPrayer();
        checkJamaatWarning();
        updateShouruqDisplay();
        updateJummahVisibility();
      }

      if (STATE.salahTimes.hijriDate) {
        updateDigitalDisplay(now);
      }

      // Update donation summary widget clock if present
      try {
        var donTimeEl = document.getElementById("currentTime");
        if (donTimeEl) {
          donTimeEl.textContent =
            String(now.getHours()).padStart(2, "0") +
            ":" +
            String(now.getMinutes()).padStart(2, "0");
        }
        var donDateEl = document.getElementById("currentDate");
        if (donDateEl) {
          donDateEl.textContent = now.toLocaleDateString("en-GB", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }
      } catch (e) {
        // Ignore donation clock update errors
      }
    } catch (e) {
      console.warn("[SalahTimeApp] Clock update error:", e);
    }
  }

  

  function updateNextPrayer() {
    try {
      var nextPrayer = getNextPrayerTime();
      var prayerKey = nextPrayer.name.replace("_adhan", "");

      document.querySelectorAll("[data-salah-time]").forEach(function (el) {
        var rowPrayer = el.getAttribute("data-salah-time");
        // When next prayer is jummah, also activate dhuhr row (since jummah replaces dhuhr on Friday)
        var isActive =
          rowPrayer === prayerKey ||
          (prayerKey === "jummah" && rowPrayer === "dhuhr");
        el.classList.toggle("active", isActive);
      });

      // Update salah markers on clock
      updateSalahMarkers();

      var countdownHTML =
        "<span>" +
        nextPrayer.hours +
        "</span>h<span>" +
        nextPrayer.minutes +
        "</span>min<span class='screen-time-next-time-seconds'>" +
        nextPrayer.seconds +
        "<span>s</span></span>";
      updateElements("#next-salah-countdown", "");
      document.querySelectorAll("#next-salah-countdown").forEach(function (el) {
        el.innerHTML = countdownHTML;
      });

      var prayerType = nextPrayer.isJammat ? "Jamaat" : "Starts";
      // Always show "Jamaat" for Jummah
      if (prayerKey === "jummah") {
        prayerType = "Jamaat";
      }
      updateElements(
        "#next-salah-name",
        (PRAYER_NAMES[prayerKey] || prayerKey) + " " + prayerType + " in",
      );
    } catch (e) {
      // Ignore prayer update errors
    }
  }

  function updateDigitalDisplay(now) {
    // Always get fresh DOM references
    var digitalTime = document.getElementById("digital-time");
    var digitalDateArabic = document.getElementById("digital-date-arabic");
    var digitalDate = document.getElementById("digital-date");

    if (!digitalTime || !digitalDateArabic || !digitalDate) {
      return;
    }

    var hijri = STATE.salahTimes.hijriDate;
    if (!hijri) return;

    try {
      var hours = now.getHours();
      var minutes = now.getMinutes();
      var period = hours >= 12 ? "PM" : "AM";
      var displayHours = hours % 12 || 12;
      var displayMinutes = minutes < 10 ? "0" + minutes : minutes;

      digitalTime.textContent =
        displayHours + " : " + displayMinutes + " " + period;
      digitalDateArabic.textContent =
        hijri.day + " " + hijri.month_name_en + " " + hijri.year;
      digitalDate.textContent = now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      // DOM element may have been removed
    }
  }

  function convert24To12(time24) {
    if (!time24 || typeof time24 !== "string") return ["", ""];

    var parts = time24.split(":");
    var hStr = parts[0];
    var mStr = parts[1] || "00";
    var hour24 = parseInt(hStr, 10);

    if (isNaN(hour24)) return ["", ""];

    var period = hour24 >= 12 ? "pm" : "am";
    var hour12 = hour24 % 12 || 12;
    var minute = mStr.length < 2 ? "0" + mStr : mStr;
    return [hour12 + ":" + minute, period];
  }

  function getNextPrayerTime() {
    var now = new Date();
    var timeSlots = buildTimeSlots();

    if (!timeSlots.length)
      return {
        name: "fajr_adhan",
        hours: 0,
        minutes: 0,
        seconds: 0,
        isJammat: false,
      };

    var nextSlot = null;
    for (var i = 0; i < timeSlots.length; i++) {
      if (timeSlots[i].date > now) {
        nextSlot = timeSlots[i];
        break;
      }
    }
    if (!nextSlot) nextSlot = timeSlots[0];

    var diffMs = nextSlot.date - now;
    var diffSec = Math.max(0, Math.floor(diffMs / 1000));

    return {
      name: nextSlot.key,
      hours: Math.floor(diffSec / 3600),
      minutes: Math.floor((diffSec % 3600) / 60),
      seconds: diffSec % 60,
      isJammat: nextSlot.isJammat,
    };
  }

  function buildTimeSlots() {
    var slots = [];

    if (!STATE.salahTimes.current) return slots;

    addPrayerTimesToSlots(
      slots,
      STATE.salahTimes.current,
      STATE.salahTimes.currentJammat,
      0,
    );

    if (STATE.salahTimes.tomorrow) {
      addPrayerTimesToSlots(
        slots,
        STATE.salahTimes.tomorrow,
        STATE.salahTimes.tomorrowJammat,
        1,
      );
    }

    return slots.sort(function (a, b) {
      return a.date - b.date;
    });
  }

  function addPrayerTimesToSlots(slots, salahTimes, jammatTimes, dayOffset) {
    if (!salahTimes) return;

    // Check if today is Friday (only for dayOffset 0, which is today)
    var isFriday = dayOffset === 0 && new Date().getDay() === 5;

    Object.entries(salahTimes).forEach(function (entry) {
      var key = entry[0];
      var value = entry[1];
      if (!value) return;

      // Skip dhuhr on Friday - it will be replaced by jummah
      if (isFriday && key === "dhuhr_adhan") {
        return;
      }

      slots.push(createTimeSlot(key, value, false, dayOffset));

      var jammatKey = key.replace("_adhan", "_jammat");
      var jammatTime = jammatTimes && jammatTimes[jammatKey];
      if (jammatTime) {
        slots.push(createTimeSlot(key, jammatTime, true, dayOffset));
      }
    });

    // Add jummah times on Friday
    if (isFriday && jammatTimes) {
      if (jammatTimes.jummah) {
        slots.push(
          createTimeSlot("jummah_adhan", jammatTimes.jummah, false, dayOffset),
        );
      }
      if (jammatTimes.jummah_jammat) {
        slots.push(
          createTimeSlot(
            "jummah_adhan",
            jammatTimes.jummah_jammat,
            true,
            dayOffset,
          ),
        );
      }
    }
  }

  function createTimeSlot(key, timeStr, isJammat, dayOffset) {
    var date = parseTimeToDate(timeStr);
    date.setDate(date.getDate() + dayOffset);

    return {
      key: key,
      value: timeStr,
      date: date,
      isJammat: isJammat,
      isToday: dayOffset === 0,
    };
  }

  function parseTimeToDate(timeStr) {
    if (!timeStr) return new Date();

    var parts = timeStr.split(":").map(Number);
    var h = parts[0];
    var m = parts[1];
    var s = parts[2] || 0;
    var date = new Date();
    date.setHours(h, m, s, 0);
    return date;
  }

  function checkJamaatWarning() {
    if (!STATE.salahTimes.current || !STATE.salahTimes.currentJammat) {
      if (STATE.jamaatWarning.isActive) {
        hideJamaatWarning();
      }
      if (STATE.jamaatInProgress.isActive) {
        hideJamaatInProgress();
      }
      return;
    }

    try {
      var nextPrayer = getNextPrayerTime();
      var prayerKey = nextPrayer.name.replace("_adhan", "");

      // Skip jamaat warning for Jummah
      var isJummah =
        prayerKey.toLowerCase().indexOf("jummah") !== -1 ||
        prayerKey.toLowerCase().indexOf("jumuah") !== -1;

      // Check if jamaat in progress should be shown
      if (STATE.jamaatInProgress.isActive) {
        var elapsed = Date.now() - STATE.jamaatInProgress.startTime;
        var twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds

        if (elapsed >= twoMinutes) {
          hideJamaatInProgress();
        }
        return; // Don't check warning if in progress screen is active
      }

      // Only show warning if next prayer is jamaat and within 30 seconds (but not for Jummah)
      if (
        !isJummah &&
        nextPrayer.isJammat &&
        nextPrayer.hours === 0 &&
        nextPrayer.minutes === 0 &&
        nextPrayer.seconds <= 30
      ) {
        showJamaatWarning(prayerKey, nextPrayer.seconds);
      } else if (STATE.jamaatWarning.isActive) {
        hideJamaatWarning();
      }
    } catch (e) {
      console.warn("[SalahTimeApp] Jamaat warning check error:", e);
    }
  }

  function showJamaatWarning(prayerKey, secondsLeft) {
    // Create warning overlay if it doesn't exist
    if (!DOM.jamaatWarning) {
      var overlay = document.createElement("div");
      overlay.classList.add("jamaat-warning-overlay");
      overlay.id = "jamaat-warning-overlay";
      overlay.innerHTML =
        '<div class="jamaat-warning-icon-box">' +
        '<img src="/images/phone-silent.svg" alt="Phone Silent" class="jamaat-warning-icon" />' +
        "</div>" +
        '<div class="jamaat-warning-message">Salah is about to commence</div>' +
        '<div class="jamaat-warning-description">Please set your phone to silent or turn it off if you prefer.</div>' +
        '<div class="jamaat-warning-countdown">' +
        '<div class="jamaat-warning-countdown-label" id="jamaat-warning-label">Jamaat starting in</div>' +
        '<div class="jamaat-warning-countdown-time" id="jamaat-warning-time">' +
        '<span id="jamaat-seconds">00</span>' +
        "</div>" +
        "</div>";

      document.body.appendChild(overlay);
      DOM.jamaatWarning = overlay;

      // Trigger reflow for animation
      setTimeout(function () {
        if (DOM.jamaatWarning) {
          DOM.jamaatWarning.classList.add("active");
        }
      }, 10);
    } else if (!DOM.jamaatWarning.classList.contains("active")) {
      DOM.jamaatWarning.classList.add("active");
    }

    // Update countdown
    var secondsEl = document.getElementById("jamaat-seconds");
    var labelEl = document.getElementById("jamaat-warning-label");

    if (secondsEl) {
      secondsEl.textContent =
        secondsLeft < 10 ? "0" + secondsLeft : secondsLeft;
    }

    if (labelEl) {
      labelEl.textContent =
        (PRAYER_NAMES[prayerKey] || prayerKey) + " Jamaat starting in";
    }

    STATE.jamaatWarning.isActive = true;
    STATE.jamaatWarning.currentPrayer = prayerKey;

    // When countdown reaches 0, show in progress screen
    if (secondsLeft === 0) {
      setTimeout(function () {
        hideJamaatWarning();
        showJamaatInProgress(prayerKey);
      }, 100);
    }
  }

  function hideJamaatWarning() {
    if (DOM.jamaatWarning && DOM.jamaatWarning.classList.contains("active")) {
      DOM.jamaatWarning.classList.remove("active");

      // Remove from DOM after transition
      TIMEOUTS.jamaatWarning = setTimeout(function () {
        if (DOM.jamaatWarning && DOM.jamaatWarning.parentNode) {
          DOM.jamaatWarning.parentNode.removeChild(DOM.jamaatWarning);
          DOM.jamaatWarning = null;
        }
      }, 500);
    }

    STATE.jamaatWarning.isActive = false;
    STATE.jamaatWarning.currentPrayer = null;
  }

  function showJamaatInProgress(prayerKey) {
    // Get appropriate name (Taraweeh for Isha during Ramadan)
    var prayerName = getJamaatProgressName(prayerKey);

    // Create in-progress overlay if it doesn't exist
    if (!DOM.jamaatInProgress) {
      var overlay = document.createElement("div");
      overlay.classList.add("jamaat-in-progress-overlay");
      overlay.id = "jamaat-in-progress-overlay";
      overlay.innerHTML =
        '<div class="jamaat-in-progress-content">' +
        '<img src="/images/logo-white.svg" alt="Logo" class="jamaat-in-progress-logo">' +
        '<div class="jamaat-in-progress-title" id="jamaat-progress-title">' +
        prayerName +
        " is in progress" +
        "</div>" +
        "</div>";

      document.body.appendChild(overlay);
      DOM.jamaatInProgress = overlay;

      // Trigger reflow for animation
      setTimeout(function () {
        if (DOM.jamaatInProgress) {
          DOM.jamaatInProgress.classList.add("active");
        }
      }, 10);
    } else if (!DOM.jamaatInProgress.classList.contains("active")) {
      DOM.jamaatInProgress.classList.add("active");
      var titleEl = document.getElementById("jamaat-progress-title");
      if (titleEl) {
        titleEl.textContent = prayerName + " is in progress";
      }
    }

    STATE.jamaatInProgress.isActive = true;
    STATE.jamaatInProgress.currentPrayer = prayerKey;
    STATE.jamaatInProgress.startTime = Date.now();
  }

  function hideJamaatInProgress() {
    if (
      DOM.jamaatInProgress &&
      DOM.jamaatInProgress.classList.contains("active")
    ) {
      DOM.jamaatInProgress.classList.remove("active");

      // Remove from DOM after transition
      TIMEOUTS.jamaatInProgress = setTimeout(function () {
        if (DOM.jamaatInProgress && DOM.jamaatInProgress.parentNode) {
          DOM.jamaatInProgress.parentNode.removeChild(DOM.jamaatInProgress);
          DOM.jamaatInProgress = null;
        }
      }, 500);
    }

    STATE.jamaatInProgress.isActive = false;
    STATE.jamaatInProgress.currentPrayer = null;
    STATE.jamaatInProgress.startTime = null;
  }

  function formatBreakLines(text) {
    if (!text) return "";
    // Escape HTML to prevent XSS, then normalize newlines to <br>
    try {
      var escaped = escapeHtml(String(text));
      return escaped.replace(/\r\n|\n/g, "<br>");
    } catch (e) {
      return escapeHtml(String(text)).replace(/\r\n|\n/g, "<br>");
    }
  }

  function isRamadan() {
    // Check if current month is Ramadan based on hijri date
    if (!STATE.salahTimes.hijriDate) {
      return false;
    }
    var monthNameEn = STATE.salahTimes.hijriDate.month_name_en;
    return monthNameEn && monthNameEn.toLowerCase() === "ramadan";
  }

  function getJamaatProgressName(prayerKey) {
    // During Ramadan, show "Taraweeh" instead of "Isha"
    if (isRamadan() && prayerKey.toLowerCase() === "isha") {
      return "Taraweeh";
    }
    return PRAYER_NAMES[prayerKey] || prayerKey;
  }

  // ─── Donation Summary Widget Helpers ────────────────────────────────────────

  var DONATION_SCROLL_PX_PER_SEC = 10;

  function formatCurrency(amount) {
    return (
      "£" +
      parseFloat(amount).toLocaleString("en-GB", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    );
  }

  function formatCategoryName(category) {
    if (!category) return "UNKNOWN";
    return category.replace(/_/g, " ");
  }

  function buildDonationItem(item, index, isGold) {
    try {
      var itemClass = isGold ? "ds-donation-item-gold" : "";
      var numberClass = isGold ? "ds-number-gold" : "ds-number-green";
      var amountClass = isGold ? "ds-amount-gold" : "ds-amount-green";

      var safeCategory = "UNKNOWN";
      try {
        safeCategory = formatCategoryName(
          item && item.category ? item.category : "UNKNOWN",
        );
      } catch (e) {
        safeCategory = "UNKNOWN";
      }
      var safeAmount = "£0";
      try {
        safeAmount = formatCurrency(
          item && item.amount != null ? item.amount : 0,
        );
      } catch (e) {
        safeAmount = "£0";
      }

      return (
        '<div class="ds-donation-item ' +
        itemClass +
        '">' +
        '<div class="ds-item-number ' +
        numberClass +
        '">' +
        (index + 1) +
        "</div>" +
        '<div class="ds-item-label">' +
        safeCategory +
        "</div>" +
        '<div class="ds-item-amount ' +
        amountClass +
        '">' +
        safeAmount +
        "</div>" +
        "</div>"
      );
    } catch (err) {
      console.warn("[SalahTimeApp] buildDonationItem error", err);
      return (
        '<div class="ds-donation-item"><div class="ds-item-number ds-number-gray">' +
        (index + 1) +
        '</div><div class="ds-item-label">INVALID</div><div class="ds-item-amount">£0</div></div>'
      );
    }
  }

  function buildContributorItem(item, index) {
    try {
      var isGray = index > 2;
      var itemClass = isGray ? "ds-donation-item-gray" : "";
      var numberClass = isGray ? "ds-number-gray" : "ds-number-green";
      var labelClass = isGray ? "ds-item-label-gray" : "";
      var badgeHtml =
        item && item.is_top
          ? '<div class="ds-top-badge"><div class="ds-star-icon"></div><div class="ds-top-text">TOP</div></div>'
          : "";
      var safeName = item && item.name ? item.name : "UNKNOWN";

      return (
        '<div class="ds-donation-item ' +
        itemClass +
        '">' +
        '<div class="ds-item-number ' +
        numberClass +
        '">' +
        (index + 1) +
        "</div>" +
        '<div class="ds-item-label ' +
        labelClass +
        '">' +
        safeName +
        "</div>" +
        badgeHtml +
        "</div>"
      );
    } catch (err) {
      console.warn("[SalahTimeApp] buildContributorItem error", err);
      return (
        '<div class="ds-donation-item"><div class="ds-item-number ds-number-gray">' +
        (index + 1) +
        '</div><div class="ds-item-label">INVALID</div></div>'
      );
    }
  }

  function setupDonationInfiniteScroll(containerId, itemsHtml, itemCount) {
    try {
      var container = document.getElementById(containerId);
      if (!container) return;

      if (itemCount < 6) {
        container.innerHTML = itemsHtml;
        container.classList.remove("ds-scrolling");
        container.style.animationDuration = "";
        return;
      }

      container.innerHTML = itemsHtml + itemsHtml;
      setTimeout(function () {
        try {
          var singleHeight = container.scrollHeight / 2;
          var duration = Math.max(4, singleHeight / DONATION_SCROLL_PX_PER_SEC);
          container.style.animationDuration = duration + "s";
          container.classList.add("ds-scrolling");
        } catch (e) {
          console.warn(
            "[SalahTimeApp] setupDonationInfiniteScroll animation error",
            e,
          );
          try {
            container.innerHTML = itemsHtml;
          } catch (e2) {}
        }
      }, 2000);
    } catch (err) {
      console.warn(
        "[SalahTimeApp] setupDonationInfiniteScroll error",
        err,
      );
      try {
        var c = document.getElementById(containerId);
        if (c) c.innerHTML = itemsHtml;
      } catch (e) {}
    }
  }

  function scaleDonationCanvas() {
    try {
      var canvas = document.getElementById("donation-slide-canvas");
      if (!canvas) return;
      var scaleX = window.innerWidth / 1551;
      var scaleY = window.innerHeight / 959;
      var scale = Math.min(scaleX, scaleY);
      canvas.style.transform = "scale(" + scale + ")";
    } catch (e) {
      console.warn("[SalahTimeApp] scaleDonationCanvas error:", e);
    }
  }

  function fetchDonationData() {
    try {
      if (TIMEOUTS.donationData) {
        clearTimeout(TIMEOUTS.donationData);
        TIMEOUTS.donationData = null;
      }

      var url =
        "/api/mosque/screens/collection_and_contributor.php?mosque_id=" +
        mosqueId;

      fetch(url, { signal: STATE.signal.signal })
        .then(function (res) {
          return res.json();
        })
        .then(function (result) {
          if (result && result.status === "success") {
            STATE.donationData = result.data;
            updateDonationDisplay();
          } else {
            console.warn(
              "[SalahTimeApp] Donation data response not success:",
              result,
            );
          }
        })
        .catch(function (err) {
          if (err && err.name === "AbortError") return;
          console.warn("[SalahTimeApp] fetchDonationData error:", err);
        });
    } catch (e) {
      console.warn("[SalahTimeApp] fetchDonationData outer error:", e);
    }
  }

  function updateDonationDisplay() {
    try {
      var data = STATE.donationData;
      if (!data) return;

      var mosqueEl = document.getElementById("mosqueName");
      if (mosqueEl && data.mosque_info && data.mosque_info.title) {
        mosqueEl.textContent = data.mosque_info.title.toUpperCase();
      }

      var totalAll = document.getElementById("totalAllTime");
      if (totalAll && data.donations_all_time) {
        totalAll.textContent = formatCurrency(data.donations_all_time.total);
      }

      var total7 = document.getElementById("totalPast7Days");
      if (total7 && data.donations_past_7_days) {
        total7.textContent = formatCurrency(data.donations_past_7_days.total);
      }

      var allCats =
        (data.donations_all_time && data.donations_all_time.categories) || [];
      var allHtml = allCats
        .map(function (item, i) {
          return buildDonationItem(item, i, false);
        })
        .join("");
      setupDonationInfiniteScroll(
        "allTimeList",
        allHtml,
        allCats.length,
      );

      var past7Cats =
        (data.donations_past_7_days &&
          data.donations_past_7_days.categories) ||
        [];
      var past7Html = past7Cats
        .map(function (item, i) {
          return buildDonationItem(item, i, true);
        })
        .join("");
      setupDonationInfiniteScroll(
        "past7DaysList",
        past7Html,
        past7Cats.length,
      );

      var contributors = data.top_contributors || [];
      var contribHtml = contributors
        .map(function (item, i) {
          return buildContributorItem(item, i);
        })
        .join("");
      setupDonationInfiniteScroll(
        "contributorsList",
        contribHtml,
        contributors.length,
      );
    } catch (e) {
      console.warn("[SalahTimeApp] updateDonationDisplay error:", e);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  // Watchdog: Ensures the app stays healthy over long periods
  function startWatchdog() {
    if (TIMEOUTS.watchdog) {
      clearInterval(TIMEOUTS.watchdog);
    }

    // Check health every 5 minutes
    TIMEOUTS.watchdog = setInterval(
      function () {
        try {
          // Check if DOM is still valid
          var wrapper = document.getElementById("screen-wrapper");
          if (!wrapper && DOM.screenWrapper) {
            console.log("[SalahTimeApp] Watchdog: DOM lost, reinitializing...");
            window.SalahTimeApp.refresh();
            return;
          }

          // Check if clock DOM is still valid
          var clockHourHand = document.getElementById("analog-clock-hour");
          if (DOM.analogClock.hourHand && !clockHourHand) {
            console.log(
              "[SalahTimeApp] Watchdog: Clock DOM lost, reinitializing...",
            );
            window.SalahTimeApp.refresh();
            return;
          }

          // Force garbage collection hint
          if (typeof window.gc === "function") {
            window.gc();
          }

          console.log("[SalahTimeApp] Watchdog: Health check OK");
        } catch (e) {
          console.warn("[SalahTimeApp] Watchdog error:", e);
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes
  }

  // Clock health check: Detect and fix stuck clock more frequently
  function startClockHealthCheck() {
    if (TIMEOUTS.clockHealthCheck) {
      clearInterval(TIMEOUTS.clockHealthCheck);
    }

    // Check clock health every 5 seconds
    TIMEOUTS.clockHealthCheck = setInterval(function () {
      try {
        var now = Date.now();

        // Check if clock hasn't updated in 3 seconds (should update every 1 second)
        if (
          CLOCK_STATE.lastUpdateTime > 0 &&
          now - CLOCK_STATE.lastUpdateTime > 3000
        ) {
          console.warn(
            "[SalahTimeApp] Clock stuck detected (no update for 3s), attempting recovery...",
          );
          recoverClock();
          return;
        }

        // Check if clock hands are stuck (second hand at same position for 30 seconds = stuck)
        // This catches the "stuck at 12:00" scenario
        var hourHand = document.getElementById("analog-clock-hour");
        if (hourHand) {
          var currentTransform = hourHand.style.transform || "";
          // If hour hand is at rotate(0deg) and it's not actually midnight/noon
          var currentHour = new Date().getHours() % 12;
          var currentMinutes = new Date().getMinutes();
          var expectedAngle = currentHour * 30 + currentMinutes * 0.5;

          if (currentTransform === "rotate(0deg)" && expectedAngle > 1) {
            console.warn(
              "[SalahTimeApp] Clock stuck at 12:00 detected, recovering...",
            );
            recoverClock();
            return;
          }
        }
      } catch (e) {
        console.warn("[SalahTimeApp] Clock health check error:", e);
      }
    }, 5000); // 5 seconds
  }

  function recoverClock() {
    console.log("[SalahTimeApp] Recovering clock...");

    // Re-cache DOM elements
    cacheClockElements();

    // If clock interval is dead, restart it
    if (!TIMEOUTS.clock) {
      console.log("[SalahTimeApp] Clock interval was dead, restarting...");
      startClock();
    } else {
      // Force an immediate update
      updateClock();
    }

    // If still failing, try full refresh
    setTimeout(function () {
      if (
        CLOCK_STATE.lastUpdateTime > 0 &&
        Date.now() - CLOCK_STATE.lastUpdateTime > 5000
      ) {
        console.warn(
          "[SalahTimeApp] Clock recovery failed, attempting full refresh...",
        );
        if (window.SalahTimeApp && window.SalahTimeApp.refresh) {
          window.SalahTimeApp.refresh();
        }
      }
    }, 2000);
  }

  function clearAllTimeouts() {
    Object.keys(TIMEOUTS).forEach(function (key) {
      if (key === "fundraiserCarousels") {
        // Clear all carousel intervals
        if (Array.isArray(TIMEOUTS[key])) {
          TIMEOUTS[key].forEach(function (carousel) {
            if (carousel && carousel.intervalId) {
              clearInterval(carousel.intervalId);
            }
          });
          TIMEOUTS[key] = [];
        }
      } else if (TIMEOUTS[key]) {
        if (
          key === "clock" ||
          key === "watchdog" ||
          key === "clockHealthCheck"
        ) {
          clearInterval(TIMEOUTS[key]);
        } else {
          clearTimeout(TIMEOUTS[key]);
        }
        TIMEOUTS[key] = null;
      }    });
  }

  // Expose API for external control and reloading
  window.SalahTimeApp = {
    init: init,
    destroy: destroy,
    getState: function () {
      return STATE;
    },
    refresh: function () {
      destroy();
      init();
    },
  };

  // Auto-initialize
  try {
    init();

    // Store this code as backup for future hot reloads (only on successful init)
    // We fetch our own source to have a backup
    if (!window.__SalahTimeAppBackupCode) {
      fetch("/salah-time/index.js", { cache: "no-store" })
        .then(function (res) {
          return res.text();
        })
        .then(function (code) {
          if (code && code.length > 500) {
            window.__SalahTimeAppBackupCode = code;
            console.log("[SalahTimeApp] Backup code stored for recovery");
          }
        })
        .catch(function () {
          /* ignore backup fetch errors */
        });
    }

    console.log("[SalahTimeApp] Initialized successfully");
  } catch (e) {
    console.error("[SalahTimeApp] Fatal initialization error:", e);
    window.__SalahTimeAppHealthy = false;

    // Don't destroy previous instance if this is a hot reload - let it keep running
    if (!isHotReload) {
      // First load failed - nothing we can do except retry
      setTimeout(function () {
        console.log("[SalahTimeApp] Retrying initialization...");
        try {
          init();
        } catch (e2) {
          console.error("[SalahTimeApp] Retry failed:", e2);
        }
      }, 5000);
    }
  }
})();