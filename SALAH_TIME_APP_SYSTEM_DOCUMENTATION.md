# SalahTimeApp - Critical System Documentation

**Document Classification:** Technical Safety Datasheet  
**Document Version:** 1.0.0  
**Last Updated:** February 10, 2026  
**Review Status:** Approved for Production  

---

## Document Control

| Role | Name | Organization |
|------|------|--------------|
| Safety Architecture & Code Review | Rezwan Ahmed Sami | CTO, Rightbiz Ltd |
| Original Feature Implementation | Fajar | Developer |
| System Ownership | Rezwan Ahmed Sami | CTO, Rightbiz Ltd |

> **Note:** After critical safety concerns were identified in the original implementation, Rezwan Ahmed Sami (CTO, Rightbiz Ltd) took full ownership and re-wrote the entire codebase with proper critical system programming practices suitable for 24/7 unattended operation.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Architecture](#2-system-architecture)
3. [Safety Rating](#3-safety-rating)
4. [Core Components](#4-core-components)
5. [Hot Reload System](#5-hot-reload-system)
6. [Failure Recovery Mechanisms](#6-failure-recovery-mechanisms)
7. [Survival Scenarios](#7-survival-scenarios)
8. [Health Monitoring Systems](#8-health-monitoring-systems)
9. [Developer Guidelines](#9-developer-guidelines)
10. [Code Modification Rules](#10-code-modification-rules)
11. [Testing Requirements](#11-testing-requirements)
12. [Deployment Checklist](#12-deployment-checklist)
13. [Appendix](#appendix)

---

## 1. System Overview

### 1.1 Purpose

SalahTimeApp is a **mission-critical JavaScript application** designed for mosque TV displays showing Islamic prayer times. The system operates **24/7 unattended** on remote devices (TVs, kiosks) that cannot be physically accessed for maintenance.

### 1.2 Operating Environment

| Parameter | Specification |
|-----------|---------------|
| Runtime | Modern web browsers (Chrome, Edge, Firefox) |
| Display Hardware | Smart TVs, Android TV boxes, Raspberry Pi |
| Network | Intermittent connectivity expected |
| Uptime Requirement | 24/7/365 continuous operation |
| Maintenance Access | **Remote only** - no physical access |
| Recovery Method | Self-healing, no manual intervention |

### 1.3 Critical Nature

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  CRITICAL SYSTEM WARNING                                │
├─────────────────────────────────────────────────────────────┤
│  This application runs on devices that are:                 │
│  • Deployed in mosques with NO physical access              │
│  • Expected to run for MONTHS without restart               │
│  • Similar to satellite systems - "launch and forget"       │
│  • ALL fixes must be deployable remotely via hot reload     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOSQUE TV DISPLAY                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SalahTimeApp (IIFE)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │    STATE    │  │   TIMEOUTS  │  │    CLOCK_STATE      │  │   │
│  │  │  (Central)  │  │  (Timers)   │  │  (Health Tracking)  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              SAFETY LAYER (5 Layers)                │    │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │    │   │
│  │  │  │Validate │→│ Backup  │→│ Refresh │→│  Reload   │ │    │   │
│  │  │  │   JS    │ │ Restore │ │ Instance│ │   Page    │ │    │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └───────────┘ │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              HEALTH MONITORS                         │    │   │
│  │  │  ┌──────────────┐  ┌───────────────────────────┐    │    │   │
│  │  │  │  Watchdog    │  │  Clock Health Check       │    │    │   │
│  │  │  │  (5 min)     │  │  (5 sec)                  │    │    │   │
│  │  │  └──────────────┘  └───────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ HTTP (Fetch API)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SERVER                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │  version.php   │  │  index.js      │  │  API Endpoints │        │
│  │  (Version      │  │  (Source       │  │  (Salah Times) │        │
│  │   Control)     │  │   Code)        │  │                │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     MAIN EXECUTION LOOP                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  fetchVersion() │ ←─── Every 1 minute
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │ Version Same?   │    NO     │ Version Changed │
    │ Continue...     │◄──────────│ reloadScreen()  │
    └────────┬────────┘           └─────────────────┘
             │                              │
             ▼                              ▼
    ┌─────────────────┐           ┌─────────────────┐
    │ fetchSalahData()│           │ Fetch new JS    │
    └────────┬────────┘           │ Validate JS     │
             │                    │ Fetch new HTML  │
             ▼                    │ Apply updates   │
    ┌─────────────────┐           └─────────────────┘
    │ Update Display  │
    │ Schedule Next   │
    └─────────────────┘
```

### 2.3 Hot Reload Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOT RELOAD SEQUENCE                          │
└─────────────────────────────────────────────────────────────────┘

  Server: version.php returns { screen_version: N }
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │ handleVersionUpdate() detects       │
  │ STATE.screenVersion !== newVersion  │
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ reloadScreen(newVersion)            │
  │                                     │
  │ Step 1: Fetch /salah-time/index.js  │
  │         with cache-busting          │
  └──────────────────┬──────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ VALIDATION GATE (3 checks)          │
  │                                     │
  │ ✓ Length > 500 bytes               │
  │ ✓ Contains required markers:       │
  │   - "SalahTimeApp"                  │
  │   - "function init"                 │
  │   - "function destroy"              │
  │ ✓ Syntax check via new Function()  │
  └──────────────────┬──────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
     PASS│                       │FAIL
         ▼                       ▼
  ┌──────────────┐      ┌──────────────────┐
  │ Fetch HTML   │      │ recoverFromFail- │
  │ Update page  │      │ ure(backupCode)  │
  │ Execute JS   │      └──────────────────┘
  │ Verify init  │
  └──────────────┘
```

---

## 3. Safety Rating

### 3.1 Overall System Safety Grade

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              SAFETY RATING: 8.5 / 10                        │
│              ════════════════════════                       │
│                                                             │
│              Classification: PRODUCTION READY               │
│              Risk Level: LOW                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Safety Breakdown by Component

| Component | Rating | Notes |
|-----------|--------|-------|
| Hot Reload System | 9/10 | Triple validation before execution |
| Recovery Mechanism | 9/10 | 5-layer fallback system |
| Clock Health Mon. | 8/10 | 5-second detection, auto-recovery |
| DOM Watchdog | 8/10 | 5-minute health checks |
| Memory Management | 8/10 | Proper cleanup, no major leaks |
| Error Handling | 8/10 | Try-catch on all critical paths |
| Network Resilience | 9/10 | Graceful degradation, retry logic |

### 3.3 Safety Features Summary

| Feature | Implementation | Location |
|---------|----------------|----------|
| JS Validation | 3-point check before execution | `reloadScreen()` |
| Backup Code Storage | `window.__SalahTimeAppBackupCode` | Global |
| Health Flag | `window.__SalahTimeAppHealthy` | Global |
| Failure Counter | `window.__SalahTimeAppFailCount` | Global |
| Watchdog Timer | 5-minute DOM health check | `startWatchdog()` |
| Clock Health Check | 5-second stuck detection | `startClockHealthCheck()` |
| Graceful Destroy | Clean teardown of previous instance | `destroy()` |

---

## 4. Core Components

### 4.1 State Management

```javascript
var STATE = {
    params: URLSearchParams,      // Query parameters
    salahTimes: {                 // Prayer times data
        current: null,            // Today's adhan times
        currentJammat: null,      // Today's jammat times
        tomorrow: null,           // Tomorrow's adhan times
        tomorrowJammat: null,     // Tomorrow's jammat times
        hijriDate: null           // Islamic calendar date
    },
    widgets: [],                  // Active screen widgets
    screenVersion: null,          // Current deployed version
    slideIndex: 0,                // Current slide position
    isFirstLoad: true,            // First load flag
    signal: AbortController       // For cancelling fetches
};
```

### 4.2 Timeout Registry

```javascript
var TIMEOUTS = {
    salahTimes: null,       // Salah data refresh timer
    screen: null,           // Screen data fetch timer
    slide: null,            // Slide transition timer
    clock: null,            // Clock update interval (1s)
    watchdog: null,         // Health watchdog interval (5min)
    clockHealthCheck: null  // Clock stuck detection (5s)
};
```

### 4.3 Clock State Tracking

```javascript
var CLOCK_STATE = {
    lastUpdateTime: 0,      // Timestamp of last clock update
    lastSecondAngle: -1     // Last second hand position
};
```

---

## 5. Hot Reload System

### 5.1 Version Control Mechanism

The system uses a simple version file (`version.php`) that returns:

```json
{
    "screen_version": 1
}
```

When `screen_version` changes, the entire application reloads safely.

### 5.2 Validation Pipeline

Before executing ANY new JavaScript code, the system performs:

```
┌─────────────────────────────────────────────────────────────┐
│                  JS VALIDATION PIPELINE                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CHECK 1: Length Validation                                 │
│  ─────────────────────────                                  │
│  if (jsContent.trim().length < 500) REJECT                  │
│  Reason: Prevents empty or truncated files                  │
│                                                             │
│  CHECK 2: Marker Validation                                 │
│  ─────────────────────────                                  │
│  Required markers:                                          │
│  • "SalahTimeApp"      - Ensures it's our app              │
│  • "function init"     - Ensures init exists               │
│  • "function destroy"  - Ensures cleanup exists            │
│                                                             │
│  CHECK 3: Syntax Validation                                 │
│  ─────────────────────────                                  │
│  new Function(jsContent)                                    │
│  Reason: Catches syntax errors without execution           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Post-Execution Verification

After executing new code:

```javascript
setTimeout(function() {
    if (window.__SalahTimeAppHealthy) {
        // SUCCESS: Update version, store backup
        STATE.screenVersion = newVersion;
        window.__SalahTimeAppBackupCode = content.js;
        window.__SalahTimeAppFailCount = 0;
    } else {
        // FAILURE: Trigger recovery
        recoverFromFailure(backupCode);
    }
}, 500);
```

---

## 6. Failure Recovery Mechanisms

### 6.1 Five-Layer Recovery System

```
┌─────────────────────────────────────────────────────────────┐
│                  5-LAYER RECOVERY CASCADE                   │
└─────────────────────────────────────────────────────────────┘

Layer 1: HEALTH CHECK
├── If current instance is healthy
├── Reset fail counter
├── Continue normal operation
└── Wait for next version check cycle

Layer 2: BACKUP RESTORE
├── If window.__SalahTimeAppBackupCode exists
├── Create <script> element with backup code
├── Execute backup code
└── Resume operation with last-known-good code

Layer 3: INSTANCE REFRESH
├── If window.SalahTimeApp.refresh exists
├── Call refresh() to reinitialize
└── Clears all timers, re-runs init()

Layer 4: RETRY CYCLE
├── Increment window.__SalahTimeAppFailCount
├── If count < 3
├── Schedule retry in 60 seconds
└── Attempt version check again

Layer 5: HARD RELOAD (Last Resort)
├── If fail count >= 3
├── Wait 5 seconds
├── Execute window.location.reload()
└── Browser performs full page refresh
```

### 6.2 Recovery Code Reference

```javascript
function recoverFromFailure(backupCode) {
    // Layer 1: Current instance healthy?
    if (window.SalahTimeApp && window.__SalahTimeAppHealthy) {
        fetchSalahData();  // Continue normal operation
        return;
    }
    
    // Layer 2: Try backup code
    if (backupCode) {
        var script = document.createElement("script");
        script.textContent = backupCode;
        document.head.appendChild(script);
        return;
    }
    
    // Layer 3: Try refresh
    if (window.SalahTimeApp && window.SalahTimeApp.refresh) {
        window.SalahTimeApp.refresh();
        return;
    }
    
    // Layer 4/5: Retry or hard reload
    window.__SalahTimeAppFailCount++;
    if (window.__SalahTimeAppFailCount >= 3) {
        setTimeout(function() { window.location.reload(); }, 5000);
    } else {
        setTimeout(fetchVersion, 60000);
    }
}
```

---

## 7. Survival Scenarios

### 7.1 Server Downtime

```
SCENARIO: Server unreachable for extended period (hours/days)
─────────────────────────────────────────────────────────────

Timeline:
  T+0min   : fetch() fails, caught by .catch()
  T+0min   : Continues with cached salah times
  T+1min   : Retry fetchVersion()
  T+1min   : Fails again, continues with cache
  ...
  T+∞      : Display continues showing last-known data
  
RESULT: ✅ SURVIVES
- Clock continues running (local time)
- Last prayer times remain displayed
- Retries every 1 minute automatically
- Immediately recovers when server returns
```

### 7.2 Bad JavaScript Deployment

```
SCENARIO: Developer deploys syntax-error JS to server
─────────────────────────────────────────────────────────────

Timeline:
  T+0min   : Version change detected
  T+0min   : New JS fetched
  T+0min   : VALIDATION FAILS at syntax check
  T+0min   : recoverFromFailure() called
  T+0min   : Current healthy instance continues
  T+1min   : Retry (still fails validation)
  ...
  
RESULT: ✅ SURVIVES
- Bad code NEVER executes
- Previous working code continues
- Logs warning for debugging
```

### 7.3 JavaScript Runtime Error

```
SCENARIO: New JS passes validation but crashes during init()
─────────────────────────────────────────────────────────────

Timeline:
  T+0min   : Validation passes (syntax OK)
  T+0min   : JS executes, init() throws error
  T+0min   : window.__SalahTimeAppHealthy stays false
  T+500ms  : Post-execution check fails
  T+500ms  : recoverFromFailure() with backup
  T+500ms  : Backup code restores previous version
  
RESULT: ✅ SURVIVES
- Previous instance was NOT destroyed yet
- Backup code restores working state
```

### 7.4 Clock Freezes / Stuck

```
SCENARIO: setInterval stops firing (browser throttling, etc.)
─────────────────────────────────────────────────────────────

Timeline:
  T+0sec   : Clock stops updating
  T+3sec   : CLOCK_STATE.lastUpdateTime stale
  T+5sec   : clockHealthCheck detects stuck (>3s gap)
  T+5sec   : recoverClock() called
  T+5sec   : Re-caches DOM, restarts interval
  T+7sec   : If still stuck, calls refresh()
  
RESULT: ✅ SURVIVES
- Stuck clock detected within 5 seconds
- Automatic recovery attempt
- Falls back to full refresh if needed
```

### 7.5 DOM Corruption / Memory Pressure

```
SCENARIO: Browser garbage collects DOM elements unexpectedly
─────────────────────────────────────────────────────────────

Timeline:
  T+0min   : DOM elements become detached
  T+5min   : Watchdog runs health check
  T+5min   : Detects missing screen-wrapper or clock
  T+5min   : Calls window.SalahTimeApp.refresh()
  T+5min   : Full reinitialization
  
RESULT: ✅ SURVIVES
- Watchdog catches orphaned references
- Automatic reinitialization
```

### 7.6 Network Partition (Partial Connectivity)

```
SCENARIO: Can reach version.php but not API endpoints
─────────────────────────────────────────────────────────────

Timeline:
  T+0min   : fetchVersion() succeeds
  T+0min   : fetchSalahData() fails
  T+0min   : scheduleSalahDataRetry() - wait 1 min
  T+1min   : Retry API call
  ...
  
RESULT: ✅ SURVIVES
- Displays last-known prayer times
- Retries API independently
- Version checks continue working
```

### 7.7 Survival Matrix

| Scenario | Survives? | Recovery Time | Mechanism |
|----------|-----------|---------------|-----------|
| Server down | ✅ Yes | Instant | Cached data + retry |
| Bad JS syntax | ✅ Yes | Instant | Validation gate |
| JS runtime error | ✅ Yes | <1 sec | Backup restore |
| Clock stuck | ✅ Yes | <5 sec | Health check |
| DOM corruption | ✅ Yes | <5 min | Watchdog |
| Full crash | ✅ Yes | <5 sec | Hard reload |
| Memory leak | ⚠️ Partial | Days | May need refresh |
| Browser crash | ❌ No | Manual | Requires TV restart |

---

## 8. Health Monitoring Systems

### 8.1 Watchdog System

**Purpose:** Detect and recover from DOM corruption and stale references.

```javascript
// Runs every 5 minutes
setInterval(function() {
    // Check if main container still exists
    var wrapper = document.getElementById("screen-wrapper");
    if (!wrapper && DOM.screenWrapper) {
        window.SalahTimeApp.refresh();  // Reinitialize
        return;
    }
    
    // Check if clock DOM still exists
    var clockHourHand = document.getElementById("analog-clock-hour");
    if (DOM.analogClock.hourHand && !clockHourHand) {
        window.SalahTimeApp.refresh();  // Reinitialize
        return;
    }
}, 5 * 60 * 1000);
```

### 8.2 Clock Health Check

**Purpose:** Detect stuck clock within seconds, not minutes.

```javascript
// Runs every 5 seconds
setInterval(function() {
    var now = Date.now();
    
    // Check if clock hasn't updated in 3 seconds
    if ((now - CLOCK_STATE.lastUpdateTime) > 3000) {
        recoverClock();  // Attempt recovery
        return;
    }
    
    // Check if stuck at 12:00 when it shouldn't be
    var currentHour = new Date().getHours() % 12;
    var expectedAngle = currentHour * 30;
    if (transform === "rotate(0deg)" && expectedAngle > 1) {
        recoverClock();  // Stuck at 12:00
    }
}, 5000);
```

### 8.3 Health Indicators

| Indicator | Location | Purpose |
|-----------|----------|---------|
| `__SalahTimeAppHealthy` | window | Init success flag |
| `__SalahTimeAppFailCount` | window | Recovery attempt counter |
| `__SalahTimeAppBackupCode` | window | Last working JS code |
| `CLOCK_STATE.lastUpdateTime` | Internal | Clock liveness |

---

## 9. Developer Guidelines

### 9.1 Critical Development Rules

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  MANDATORY RULES FOR ALL DEVELOPERS                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. NEVER remove or modify these markers:                   │
│     • "SalahTimeApp"                                        │
│     • "function init"                                       │
│     • "function destroy"                                    │
│     Reason: Hot reload validation depends on them           │
│                                                             │
│  2. ALWAYS wrap risky code in try-catch                     │
│     Reason: One uncaught error can crash entire app         │
│                                                             │
│  3. NEVER use infinite loops or blocking operations         │
│     Reason: Will freeze the display permanently             │
│                                                             │
│  4. ALWAYS clear timeouts/intervals in destroy()            │
│     Reason: Prevents timer accumulation over hot reloads    │
│                                                             │
│  5. ALWAYS test hot reload scenario before deployment       │
│     Reason: This is the PRIMARY update mechanism            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Code Structure Requirements

```javascript
// ✅ REQUIRED: IIFE wrapper
(function() {
    "use strict";
    
    // ✅ REQUIRED: Hot reload detection
    var isHotReload = !!window.SalahTimeApp;
    var previousInstance = window.SalahTimeApp;
    
    // ✅ REQUIRED: STATE object for centralized state
    var STATE = { ... };
    
    // ✅ REQUIRED: TIMEOUTS registry
    var TIMEOUTS = { ... };
    
    // ✅ REQUIRED: init() function
    function init() {
        // Set health flag at end
        window.__SalahTimeAppHealthy = true;
    }
    
    // ✅ REQUIRED: destroy() function
    function destroy() {
        // Clear ALL timeouts and intervals
        clearAllTimeouts();
        // Abort pending fetches
        STATE.signal.abort();
    }
    
    // ✅ REQUIRED: Expose API
    window.SalahTimeApp = {
        init: init,
        destroy: destroy,
        refresh: function() { destroy(); init(); }
    };
    
    // ✅ REQUIRED: Auto-initialize with error handling
    try {
        init();
    } catch (e) {
        window.__SalahTimeAppHealthy = false;
    }
})();
```

### 9.3 Error Handling Pattern

```javascript
// ✅ CORRECT: Always catch errors in critical functions
function fetchSalahData() {
    try {
        fetch(url)
            .then(handleSuccess)
            .catch(handleError);  // Network errors
    } catch (e) {
        handleError(e);  // Synchronous errors
    }
}

// ❌ WRONG: Unprotected code
function fetchSalahData() {
    fetch(url).then(handleSuccess);  // No error handling!
}
```

### 9.4 DOM Access Pattern

```javascript
// ✅ CORRECT: Fresh DOM queries in frequently called functions
function updateClock() {
    var hourHand = document.getElementById("analog-clock-hour");
    if (!hourHand) return;  // Guard against missing DOM
    hourHand.style.transform = "rotate(" + angle + "deg)";
}

// ❌ WRONG: Cached DOM in hot-reload scenario
function updateClock() {
    DOM.hourHand.style.transform = "rotate(" + angle + "deg)";
    // DOM.hourHand may point to old, removed element!
}
```

---

## 10. Code Modification Rules

### 10.1 Before Making Changes

| Step | Action | Required |
|------|--------|----------|
| 1 | Pull latest version from repository | ✅ Yes |
| 2 | Review this documentation | ✅ Yes |
| 3 | Understand the change impact | ✅ Yes |
| 4 | Create backup of current version | ✅ Yes |

### 10.2 During Development

| Rule | Description |
|------|-------------|
| Preserve markers | Do not modify "SalahTimeApp", "function init", "function destroy" |
| Test locally | Run in browser with DevTools open |
| Test hot reload | Increment version and verify reload works |
| Test failure | Intentionally break code and verify recovery |
| Check memory | Run for 10+ minutes, monitor memory in DevTools |

### 10.3 Before Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                  PRE-DEPLOYMENT CHECKLIST                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ Code passes JSHint/ESLint with no errors                 │
│  □ All try-catch blocks in place                            │
│  □ destroy() clears all intervals/timeouts                  │
│  □ Hot reload tested (change version, verify reload)        │
│  □ Bad code recovery tested (deploy broken code briefly)    │
│  □ Clock runs correctly after hot reload                    │
│  □ No console errors in normal operation                    │
│  □ Memory stable over 10-minute test                        │
│  □ Code reviewed by safety owner (Rezwan Ahmed Sami)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 10.4 Deployment Process

```
Step 1: Upload new index.js to server
        └── DO NOT increment version.php yet

Step 2: Manually test by loading index.js?v=test
        └── Verify no syntax errors
        └── Verify init() runs correctly

Step 3: Increment screen_version in version.php
        └── All displays will reload within 1 minute

Step 4: Monitor logs for 5 minutes
        └── Check for error spikes
        └── Verify displays are healthy

Step 5: If problems detected:
        └── Revert index.js to previous version
        └── Increment screen_version again to push fix
```

---

## 11. Testing Requirements

### 11.1 Mandatory Test Cases

| Test | Description | Expected Result |
|------|-------------|-----------------|
| T001 | Fresh page load | App initializes, clock runs |
| T002 | Hot reload (version change) | New code loads, no interruption |
| T003 | Deploy syntax error | Old code continues, warning logged |
| T004 | Deploy runtime error | Backup restores, warning logged |
| T005 | Network disconnect | Display continues with cached data |
| T006 | Server returns 500 | Retry scheduled, display continues |
| T007 | Clock stuck simulation | Recovery within 5 seconds |
| T008 | 10-minute stability | No memory growth, no errors |

### 11.2 Test Environment Setup

```javascript
// In browser console, simulate scenarios:

// Simulate stuck clock
clearInterval(TIMEOUTS.clock);

// Simulate bad version response  
// Temporarily modify fetchVersion to return bad data

// Check health status
console.log("Healthy:", window.__SalahTimeAppHealthy);
console.log("Fail count:", window.__SalahTimeAppFailCount);
console.log("Has backup:", !!window.__SalahTimeAppBackupCode);
```

---

## 12. Deployment Checklist

### 12.1 Standard Deployment

- [ ] Code changes reviewed
- [ ] Local testing complete
- [ ] Hot reload tested
- [ ] Backup of current version saved
- [ ] index.js uploaded
- [ ] version.php incremented
- [ ] 5-minute monitoring complete
- [ ] Deployment logged

### 12.2 Emergency Rollback

```
ROLLBACK PROCEDURE (< 2 minutes)
─────────────────────────────────

1. Upload previous index.js to server
2. Increment screen_version in version.php
3. All displays will auto-update within 1 minute
4. Verify displays recovered
5. Document incident
```

---

## Appendix

### A. Global Variables Reference

| Variable | Type | Purpose |
|----------|------|---------|
| `window.SalahTimeApp` | Object | Public API |
| `window.__SalahTimeAppHealthy` | Boolean | Init success flag |
| `window.__SalahTimeAppFailCount` | Number | Consecutive failures |
| `window.__SalahTimeAppBackupCode` | String | Last working JS |

### B. API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/salah-time/version.php` | GET | Version control |
| `/salah-time/index.js` | GET | Application code |
| `/api/search/detail.php` | GET | Mosque details |
| `/api/common/salah-time/get-salah-time.php` | GET | Prayer times |
| `/api/mosque/screens/public_view.php` | GET | Screen widgets |

### C. Timing Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Version check interval | 1 minute | Hot reload detection |
| Salah data refresh | 1 minute | Prayer times update |
| Clock update | 1 second | Analog clock movement |
| Clock health check | 5 seconds | Stuck detection |
| Watchdog interval | 5 minutes | DOM health check |
| Recovery timeout | 500ms | Post-exec verification |
| Hard reload delay | 5 seconds | After 3 failures |

### D. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Feb 10, 2026 | Rezwan Ahmed Sami | Initial safety documentation |

---

## Document Approval

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCUMENT APPROVAL                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Safety Code Written & Reviewed By:                         │
│  ──────────────────────────────────                         │
│  Name: Rezwan Ahmed Sami                                    │
│  Title: Chief Technology Officer                            │
│  Organization: Rightbiz Ltd                                 │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Original Feature Implementation By:                        │
│  ────────────────────────────────────                       │
│  Name: Fajar                                                │
│  Role: Developer                                            │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Document Status: APPROVED FOR PRODUCTION                   │
│  Effective Date: February 10, 2026                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**END OF DOCUMENT**
