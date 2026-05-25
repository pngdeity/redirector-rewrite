# Functional Requirements Document: URL Rewrite Engine

## 1. System Overview

**Objective:** Develop a browser extension that intercepts outbound network requests and seamlessly redirects them to alternative URLs based on a user-defined set of custom pattern-matching rules.

**Target Environment:** Modern web browsers (Chrome/Firefox/Edge) utilizing current extension architecture standards (e.g., Manifest V3 `declarativeNetRequest` paired with non-persistent background fallbacks).

## 2. Core Data Model: The "Redirect Rule"

The system must persist an array of rule objects. The schema must include the following attributes for each rule:

*   **ID:** Unique identifier (UUID).
*   **Description:** Human-readable label for the rule.
*   **Example URL:** A sample outbound URL string used to verify and test rule matches.
*   **Include Pattern:** The string pattern to match against outbound URLs.
*   **Exclude Pattern:** (Optional) A string pattern that, if matched, explicitly exempts the URL from being redirected, even if it matches the Include Pattern.
*   **Target URL:** The destination string, which may contain substitution variables (e.g., `$1`, `$2`) corresponding to capture groups from the Include Pattern.
*   **Pattern Type:** Enum identifying the matching logic. Must support:
    *   `REGEX`: Standard Regular Expressions.
    *   `WILDCARD`: Simple wildcard matching (where `*` translates to non-greedy `(.*?)` under the hood).
*   **Pattern Description (Hint):** (Optional) Extra sub-hint or custom notes explaining the pattern logic.
*   **Match Processing:** Enum defining how captured strings are handled before being injected into the Target URL. Must support:
    *   `NONE`: Raw injection of capture values.
    *   `URL_ENCODE`: Encodes captured components to secure URI strings.
    *   `URL_DECODE`: Decodes URI components (converting `%2F` back to `/`) before substitution.
    *   `DOUBLE_URL_DECODE`: Applies double decoding on highly encoded query routing parameters.
    *   `BASE64_DECODE`: Decodes base64-encoded strings (useful for extracting encoded landing URLs).
*   **Applies To (Request Filters):** Array of string filters determining which network request contexts the rule interceptor applies to. Valid values include:
    *   `main_frame` (Main Window URL address bar)
    *   `sub_frame` (IFrames)
    *   `stylesheet` (Stylesheets)
    *   `script` (Scripts)
    *   `image` (Images)
    *   `font` (Fonts)
    *   `xmlhttprequest` (Ajax/Fetch/XHR)
    *   `other` (Miscellaneous types)
*   **Grouped:** Boolean identifying if the rule resides in a collapsed custom groupings container.
*   **Status:** Boolean (`enabled` / `disabled`).

## 3. Functional Capabilities

### 3.1 Network Interception & Routing

*   **REQ-3.1.1:** The extension must listen to outgoing navigation requests at the earliest possible lifecycle stage (before headers are sent and before the DOM is loaded) using Manifest V3's dynamic `declarativeNetRequest` APIs.
*   **REQ-3.1.2:** Upon interception, the system evaluates the requested URL against the array of active Redirect Rules sequentially.
*   **REQ-3.1.3:** If a match is found (and not excluded by the Exclude Pattern, and matching the current request type filter), the system must halt the original request and initiate a redirect to the dynamically generated Target URL.
*   **REQ-3.1.4:** The system must implement a safeguard to prevent infinite redirect loops (e.g., if Rule A redirects to Rule B, and Rule B redirects back to Rule A, or if a rule matches its own output) both inside the browser and during dry-run testing.

### 3.2 Rule Management Engine (CRUD)

*   **REQ-3.2.1:** The system must store rules in the browser's local storage (`chrome.storage.local`), with optional synchronization support (`chrome.storage.sync`) for cross-device sharing.
*   **REQ-3.2.2:** Users must be able to Create, Read, Update, and Delete individual rules.
*   **REQ-3.2.3:** Users must be able to toggle the active state of an individual rule without deleting it.
*   **REQ-3.2.4:** Users must be able to toggle the active state of the *entire extension* via a global kill-switch.
*   **REQ-3.2.5:** Users must be able to duplicate existing rules and re-order them in the matching queue.

### 3.3 State Import / Export

*   **REQ-3.3.1:** The system must allow users to export their entire rule database as a standard JSON file.
*   **REQ-3.3.2:** The system must allow users to import a JSON file to populate the rule database. The import mechanism must validate the schema of the incoming JSON and gracefully handle malformed data.

### 3.4 Dry-Run Testing Engine

*   **REQ-3.4.1:** The system must provide a sandboxed testing utility function.
*   **REQ-3.4.2:** Given a test URL string and a specific Rule object, the testing engine must output the predicted resulting URL and indicate whether the rule matched, failed to match, or threw an execution error.
*   **REQ-3.4.3:** The testing engine must recursively evaluate the URL against all active rules to proactively report infinite loops and show step-by-step redirect hop counts.

## 4. User Interface (UI) Requirements

### 4.1 The Options Dashboard (Main Application View)

*   **Layout:** A clean, tabular list displaying all configured rules.
*   **List Items:** Each row must display the rule Description, Include Pattern, Target URL, Exclude Pattern, and an Enable/Disable toggle.
*   **Rule Editor Modal/Page:** Form interface bound to the Rule Data Model (Section 2).
*   **Live Testing Integration:** The Rule Editor must contain a "Test URL" input field. As the user types into the Test URL, Include Pattern, or Target URL fields, the UI must dynamically display the resulting output URL in real-time, leveraging the Dry-Run Testing Engine (REQ-3.4).

### 4.2 The Browser Action (Popup)

*   **Popup Features:**
    *   Global Enable/Disable toggle for the entire extension.
    *   A button to open the full Options Dashboard.
    *   Toggles to manage logging and notifications preferences.
    *   (Optional) A quick-add context mechanism to auto-populate a new rule based on the current active tab's URL.

## 5. Non-Functional Requirements & AI Directives

*   **Performance:** The interception logic must be non-blocking and evaluate rules in less than 5ms to avoid degrading user browsing speed.
*   **Security:** Ensure that injected variables in Target URLs cannot be executed as arbitrary JavaScript (mitigate XSS risks by stripping innerHTML manipulations in UI scripts).
*   **Implementation Directive for AI:** Isolate the rule evaluation logic (the engine) from the browser-specific API calls. This ensures the matching logic can be unit-tested in a standard Node.js/V8 environment independently of the browser extension APIs.
*   **Cross-Browser Compliance:** Manifest configurations must declare paired service-worker/background scripts, unique Gecko extension IDs, and `"none"` data collection permissions to ensure perfect compatibility with Chrome Web Store and Firefox Add-ons store policies.
