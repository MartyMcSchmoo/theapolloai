# MakeMeMoney — Ad Canyon

A wall of neon ads with a timer and a built-in editor so you can add/remove ad spots directly in the page. No backend needed—perfect for GitHub Pages.

## Files
- `index.html` — layout and editor UI
- `style.css` — neon Times Square styling
- `script.js` — ad generator, timer, edit/delete/add, export/import via clipboard

## Run locally
Open `index.html` in a browser or serve the folder with any static server (e.g., `python -m http.server 3000`).

## Deploy to GitHub Pages
1) Push these files to your repo (root).  
2) Enable GitHub Pages in repo settings (Source: main branch / root).  
3) Visit the provided Pages URL.

## How to edit ads
- Click **Edit ads** to enter edit mode (shows delete buttons).
- Click **Add ad slot** to open the form; fill tag/headline/copy/price/background.
- Click **Export JSON** to copy the current grid definition to your clipboard.
- Click **Reset ads** to regenerate the default random set.

Ads are stored locally in your browser (`localStorage`). If you want global/shared ads, wire these controls to a simple backend later.
