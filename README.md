# PostDated

**Write now. Read later.**

PostDated is a small browser app for letters to your future self. You write a message, choose a delivery date, and pick a stamp — Prediction, Goal, or Reminder. Sealed letters hide their text until that date. Delivered letters open, and each stamp asks a different follow-up (were you right, did you achieve it, is the reminder done).

Everything is stored in this browser’s `localStorage`. There is no server and no account.

## How to run

No install, no build step.

1. Open `index.html` in a modern browser (double-click the file, or drag it into a window).
2. Write a message, pick today or a later date, choose a stamp, and click **Seal & send**.

Chrome, Firefox, Edge, and Safari all work. If the page is opened as a `file://` URL, storage still works in typical desktop browsers.

## What it does

- Rejects dates in the past with a short, friendly error.
- Keeps a **Sealed** tray (tag, written date, countdown — never the message) and a **Delivered** tray (full text plus dates).
- Rechecks unlock dates on load and every minute while the tab stays open, so a letter can slide into Delivered at midnight without a refresh.
- Shows counts for total / sealed / delivered, plus prediction accuracy after at least one prediction is answered.
- Filters by stamp and lets you discard a letter after a confirm prompt.

## Files

| File | Role |
| --- | --- |
| `index.html` | Structure and copy |
| `style.css` | Postal / vintage paper theme |
| `script.js` | Form, storage, unlocks, stats, filters |

Built with [Cursor](https://cursor.com).
