# ⏰ Event Reminder — Shareable Countdown Link

A lightweight, backend-free web app for creating event reminders with a live countdown, shareable as a single link. No sign-up, no database, no server — everything lives in the URL.

**[Live demo →](#)** *(replace with your GitHub Pages URL once deployed)*

## Features

- Create a reminder with title, description, date, time, timezone, and optional location
- Generates a unique shareable link — works when opened on any other browser or device
- Copy link, share on WhatsApp, or open the reminder directly
- Live countdown (days / hours / minutes / seconds) on the reminder page
- "Add to Calendar" button that downloads a standards-compliant `.ics` file
- Native Web Share API support, with WhatsApp as a fallback
- Automatically detects the viewer's local timezone for display
- Fully responsive, card-based, animated UI

## How it works (no backend required)

When you fill out the form, the event details are packed into a JSON object, base64-encoded, and appended to the URL after `#data=`:

```
https://yourusername.github.io/event-reminder/#data=eyJ0IjoiVGVhbSBTeW5jIiwi...
```

Browsers never send the URL fragment (everything after `#`) to the server, so GitHub Pages just serves the same static `index.html` every time — `script.js` reads the fragment client-side and decides whether to show the "create" form or the "reminder" view.

The date and time you pick are converted to a UTC timestamp **at creation time**, using the actual UTC offset of the timezone you selected (including daylight saving rules). That means the countdown is accurate for whoever opens the link, regardless of their own timezone.

## File structure

```
├── index.html   # Markup for both the "create" form and the "reminder" view
├── style.css    # All styling — responsive, card-based, animated
└── script.js    # Timezone math, URL encoding/decoding, countdown, .ics export
```

## Deploying to GitHub Pages

1. Push these three files to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under "Build and deployment," set **Source** to "Deploy from a branch," pick `main` and `/ (root)`, then save.
4. Your site will be live at `https://<username>.github.io/<repo-name>/`.

## Local testing

No build step needed — just open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Limitations

- Very long descriptions or locations make the URL longer, since there's no server-side storage — description is capped at 500 characters and location at 150.
- If a link gets truncated by a messaging app, the reminder page shows a friendly "this link looks broken" message instead of failing silently.
- Default calendar event duration is 1 hour (adjustable in `script.js` via the `durationMs` constant in `downloadIcs`).

## License

Free to use, modify, and deploy for personal or commercial projects.
