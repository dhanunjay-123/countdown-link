/* ================================================================
   Shareable Event Reminder — script.js
   Pure vanilla JS. No backend. Event data lives entirely in the
   URL hash (base64-encoded JSON), so any device that opens the
   link can reconstruct the event and countdown.
   ================================================================ */

(function () {
  "use strict";

  /* ---------------- DOM references ---------------- */
  const createPage = document.getElementById("createPage");
  const reminderPage = document.getElementById("reminderPage");

  const reminderForm = document.getElementById("reminderForm");
  const eventTitleEl = document.getElementById("eventTitle");
  const eventDescriptionEl = document.getElementById("eventDescription");
  const eventDateEl = document.getElementById("eventDate");
  const eventTimeEl = document.getElementById("eventTime");
  const eventTimezoneEl = document.getElementById("eventTimezone");
  const eventLocationEl = document.getElementById("eventLocation");
  const formErrorEl = document.getElementById("formError");

  const resultCard = document.getElementById("resultCard");
  const generatedLinkEl = document.getElementById("generatedLink");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const copyFeedbackEl = document.getElementById("copyFeedback");
  const whatsappShareBtn = document.getElementById("whatsappShareBtn");
  const openReminderBtn = document.getElementById("openReminderBtn");

  const viewTitleEl = document.getElementById("viewTitle");
  const viewDescriptionEl = document.getElementById("viewDescription");
  const viewDateTimeEl = document.getElementById("viewDateTime");
  const viewLocationRow = document.getElementById("viewLocationRow");
  const viewLocationEl = document.getElementById("viewLocation");
  const viewTimezoneEl = document.getElementById("viewTimezone");
  const eventStartedBanner = document.getElementById("eventStartedBanner");
  const reminderCardEl = document.querySelector("#reminderPage .reminder-card");

  const cdDays = document.getElementById("cdDays");
  const cdHours = document.getElementById("cdHours");
  const cdMinutes = document.getElementById("cdMinutes");
  const cdSeconds = document.getElementById("cdSeconds");

  const addToCalendarBtn = document.getElementById("addToCalendarBtn");
  const shareEventBtn = document.getElementById("shareEventBtn");
  const createAnotherBtn = document.getElementById("createAnotherBtn");

  const reminderErrorCard = document.getElementById("reminderErrorCard");
  const reminderErrorEl = document.getElementById("reminderError");
  const errorCreateAnotherBtn = document.getElementById("errorCreateAnotherBtn");

  let countdownIntervalId = null;

  /* Forces an element to hide/show using an inline style, in addition to
     the native `hidden` attribute. This guarantees the element disappears
     even if a stylesheet (cached or otherwise) declares `display: flex`
     or `display: grid` on that element elsewhere, which would normally
     defeat the `hidden` attribute. */
  function setHidden(el, isHidden) {
    if (!el) return;
    el.hidden = isHidden;
    el.style.display = isHidden ? "none" : "";
  }

  /* ================================================================
     BASE64 (unicode-safe, URL-safe) HELPERS
     ================================================================ */

  function base64UrlEncode(str) {
    // Handle unicode safely, then make base64 URL-safe.
    const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
    const b64 = btoa(utf8);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function base64UrlDecode(b64url) {
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const utf8 = atob(b64);
    const percentEncoded = utf8
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("");
    return decodeURIComponent(percentEncoded);
  }

  /* ================================================================
     TIMEZONE-AWARE DATE MATH
     Converts a "wall clock" date+time in a given IANA timezone into
     a UTC epoch (ms). This is what gets stored in the URL, so the
     countdown is correct regardless of the viewer's own timezone.
     ================================================================ */

  function getTimezoneOffsetMinutes(timeZone, date) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const map = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    let hour = parseInt(map.hour, 10);
    if (hour === 24) hour = 0;
    const asUTC = Date.UTC(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      hour,
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    );
    return (asUTC - date.getTime()) / 60000;
  }

  function zonedTimeToUtcEpoch(dateStr, timeStr, timeZone) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = timeStr.split(":").map(Number);
    const naiveUTC = Date.UTC(y, m - 1, d, hh, mm, 0);
    const offsetMinutes = getTimezoneOffsetMinutes(timeZone, new Date(naiveUTC));
    return naiveUTC - offsetMinutes * 60000;
  }

  /* ================================================================
     TIMEZONE LIST
     ================================================================ */

  const FALLBACK_TIMEZONES = [
    "UTC", "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles",
    "America/Denver", "America/Chicago", "America/New_York", "America/Sao_Paulo",
    "Atlantic/Azores", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Europe/Athens", "Europe/Moscow", "Asia/Dubai", "Asia/Karachi",
    "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai",
    "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Pacific/Auckland",
  ];

  function getAllTimezones() {
    if (typeof Intl.supportedValuesOf === "function") {
      try {
        const list = Intl.supportedValuesOf("timeZone");
        if (list && list.length) return list;
      } catch (e) {
        /* fall through to fallback list */
      }
    }
    return FALLBACK_TIMEZONES;
  }

  function populateTimezoneSelect() {
    const timezones = getAllTimezones();
    let userTz = "UTC";
    try {
      userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (e) {
      /* keep default */
    }

    eventTimezoneEl.innerHTML = "";
    timezones.forEach(function (tz) {
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = tz.replace(/_/g, " ");
      eventTimezoneEl.appendChild(opt);
    });

    if (timezones.indexOf(userTz) !== -1) {
      eventTimezoneEl.value = userTz;
    }
  }

  /* ================================================================
     FORM VALIDATION & SUBMISSION
     ================================================================ */

  function showFormError(message) {
    formErrorEl.textContent = message;
    setHidden(formErrorEl, false);
  }

  function clearFormError() {
    setHidden(formErrorEl, true);
    formErrorEl.textContent = "";
  }

  function setTodayAsMinDate() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    eventDateEl.min = `${yyyy}-${mm}-${dd}`;
  }

  function buildShareableUrl(payload) {
    const json = JSON.stringify(payload);
    const encoded = base64UrlEncode(json);
    const base = window.location.origin + window.location.pathname;
    return `${base}#data=${encoded}`;
  }

  reminderForm.addEventListener("submit", function (evt) {
    evt.preventDefault();
    clearFormError();

    const title = eventTitleEl.value.trim();
    const description = eventDescriptionEl.value.trim();
    const dateStr = eventDateEl.value;
    const timeStr = eventTimeEl.value;
    const timezone = eventTimezoneEl.value;
    const location = eventLocationEl.value.trim();

    if (!title) {
      showFormError("Please enter an event title.");
      eventTitleEl.focus();
      return;
    }
    if (!dateStr) {
      showFormError("Please choose a date.");
      eventDateEl.focus();
      return;
    }
    if (!timeStr) {
      showFormError("Please choose a time.");
      eventTimeEl.focus();
      return;
    }
    if (!timezone) {
      showFormError("Please choose a time zone.");
      eventTimezoneEl.focus();
      return;
    }

    let epoch;
    try {
      epoch = zonedTimeToUtcEpoch(dateStr, timeStr, timezone);
    } catch (e) {
      showFormError("Something went wrong reading that date/time. Please check your entries.");
      return;
    }

    if (isNaN(epoch)) {
      showFormError("That date/time could not be understood. Please check your entries.");
      return;
    }

    if (epoch <= Date.now()) {
      showFormError("Please choose a date and time in the future.");
      return;
    }

    const payload = {
      t: title,
      d: description,
      l: location,
      tz: timezone,
      e: epoch,
    };

    const url = buildShareableUrl(payload);
    generatedLinkEl.value = url;
    setHidden(resultCard, false);
    setHidden(copyFeedbackEl, true);
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });

    whatsappShareBtn.onclick = function () {
      const text = `📅 ${title}\n${url}`;
      window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    };

    openReminderBtn.onclick = function () {
      window.location.href = url;
    };
  });

  copyLinkBtn.addEventListener("click", function () {
    const url = generatedLinkEl.value;
    if (!url) return;

    function showCopied() {
      setHidden(copyFeedbackEl, false);
      setTimeout(function () {
        setHidden(copyFeedbackEl, true);
      }, 2500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(showCopied).catch(function () {
        legacyCopy(url, showCopied);
      });
    } else {
      legacyCopy(url, showCopied);
    }
  });

  function legacyCopy(text, onSuccess) {
    generatedLinkEl.removeAttribute("readonly");
    generatedLinkEl.select();
    generatedLinkEl.setSelectionRange(0, 99999);
    try {
      document.execCommand("copy");
      onSuccess();
    } catch (e) {
      /* silent fail; user can still manually copy */
    } finally {
      generatedLinkEl.setAttribute("readonly", "true");
    }
  }

  /* ================================================================
     REMINDER (VIEW) PAGE
     ================================================================ */

  function parseEventFromHash() {
    const hash = window.location.hash || "";
    const match = hash.match(/#data=(.+)/);
    if (!match) return null;

    const encoded = match[1];
    const json = base64UrlDecode(encoded);
    const payload = JSON.parse(json);

    if (!payload || typeof payload.t !== "string" || typeof payload.e !== "number") {
      throw new Error("Malformed event payload");
    }
    return payload;
  }

  function formatDateTimeForViewer(epoch, originalTimezone) {
    const date = new Date(epoch);
    const localString = date.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return localString + " (your local time)";
  }

  function renderReminder(payload) {
    viewTitleEl.textContent = payload.t;

    if (payload.d) {
      viewDescriptionEl.textContent = payload.d;
      setHidden(viewDescriptionEl, false);
    } else {
      setHidden(viewDescriptionEl, true);
    }

    viewDateTimeEl.textContent = formatDateTimeForViewer(payload.e, payload.tz);

    if (payload.l) {
      viewLocationEl.textContent = payload.l;
      setHidden(viewLocationRow, false);
    } else {
      setHidden(viewLocationRow, true);
    }

    viewTimezoneEl.textContent = "Originally set for: " + (payload.tz || "UTC").replace(/_/g, " ");

    startCountdown(payload.e);

    addToCalendarBtn.onclick = function () {
      downloadIcs(payload);
    };

    shareEventBtn.onclick = function () {
      const shareUrl = window.location.href;
      const shareText = `📅 ${payload.t}\n${shareUrl}`;
      if (navigator.share) {
        navigator.share({
          title: payload.t,
          text: `📅 ${payload.t}`,
          url: shareUrl,
        }).catch(function () {
          /* user cancelled share sheet; no action needed */
        });
      } else {
        window.open("https://wa.me/?text=" + encodeURIComponent(shareText), "_blank", "noopener");
      }
    };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function startCountdown(targetEpoch) {
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }

    function tick() {
      const diff = targetEpoch - Date.now();

      if (diff <= 0) {
        cdDays.textContent = "00";
        cdHours.textContent = "00";
        cdMinutes.textContent = "00";
        cdSeconds.textContent = "00";
        setHidden(eventStartedBanner, false);
        if (countdownIntervalId) {
          clearInterval(countdownIntervalId);
          countdownIntervalId = null;
        }
        return;
      }

      setHidden(eventStartedBanner, true);

      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      cdDays.textContent = pad2(days);
      cdHours.textContent = pad2(hours);
      cdMinutes.textContent = pad2(minutes);
      cdSeconds.textContent = pad2(seconds);
    }

    tick();
    countdownIntervalId = setInterval(tick, 1000);
  }

  /* ================================================================
     .ICS CALENDAR EXPORT
     ================================================================ */

  function escapeIcsText(str) {
    return String(str || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function toIcsDateUtc(epoch) {
    const d = new Date(epoch);
    return (
      d.getUTCFullYear() +
      pad2(d.getUTCMonth() + 1) +
      pad2(d.getUTCDate()) +
      "T" +
      pad2(d.getUTCHours()) +
      pad2(d.getUTCMinutes()) +
      pad2(d.getUTCSeconds()) +
      "Z"
    );
  }

  function downloadIcs(payload) {
    const durationMs = 60 * 60 * 1000; // default 1-hour event
    const start = toIcsDateUtc(payload.e);
    const end = toIcsDateUtc(payload.e + durationMs);
    const stamp = toIcsDateUtc(Date.now());
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@event-reminder`;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//EventReminder//Shareable Reminder//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + stamp,
      "DTSTART:" + start,
      "DTEND:" + end,
      "SUMMARY:" + escapeIcsText(payload.t),
    ];

    if (payload.d) lines.push("DESCRIPTION:" + escapeIcsText(payload.d));
    if (payload.l) lines.push("LOCATION:" + escapeIcsText(payload.l));

    lines.push("END:VEVENT", "END:VCALENDAR");

    const icsContent = lines.join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const safeName = (payload.t || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.download = `${safeName || "event"}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* ================================================================
     ROUTING — decide which "page" to show based on the URL hash
     ================================================================ */

  function showCreatePage() {
    setHidden(createPage, false);
    setHidden(reminderPage, true);
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  }

  function showReminderPage() {
    setHidden(createPage, true);
    setHidden(reminderPage, false);
  }

  function route() {
    const hash = window.location.hash || "";

    if (!hash || hash.indexOf("data=") === -1) {
      showCreatePage();
      return;
    }

    try {
      const payload = parseEventFromHash();
      if (!payload) {
        showCreatePage();
        return;
      }
      showReminderPage();
      setHidden(reminderCardEl, false);
      setHidden(reminderErrorCard, true);
      renderReminder(payload);
    } catch (e) {
      showReminderPage();
      setHidden(reminderCardEl, true);
      setHidden(reminderErrorCard, false);
      reminderErrorEl.textContent =
        "This reminder link looks broken or incomplete. It may have been cut off when copied.";
    }
  }

  function goToCreatePage() {
    // Strip the hash without reloading, then re-render.
    history.pushState("", document.title, window.location.pathname + window.location.search);
    showCreatePage();
  }

  createAnotherBtn.addEventListener("click", goToCreatePage);
  errorCreateAnotherBtn.addEventListener("click", goToCreatePage);

  window.addEventListener("hashchange", route);

  /* ================================================================
     INIT
     ================================================================ */

  document.addEventListener("DOMContentLoaded", function () {
    populateTimezoneSelect();
    setTodayAsMinDate();
    route();
  });
})();
