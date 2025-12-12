# MakeMeMoney — Ad Canyon

Massive scrolling ad wall inspired by Times Square. Fake neon billboards, endless feed, and a local leaderboard that tracks how long you stay on the site. No accounts or backend needed—perfect for GitHub Pages.

## Files
- `index.html` — layout and content
- `style.css` — neon Times Square styling
- `script.js` — ad generation, session timer, and local leaderboard

## Run locally
Open `index.html` in a browser or serve the folder with any static server (e.g., `python -m http.server 3000`).

## Deploy to GitHub Pages
1) Push these files to your repo (root).  
2) Enable GitHub Pages in repo settings (Source: main branch / root).  
3) Visit the provided Pages URL.

## Customizing
- Edit colors/layout in `style.css`.
- Change ad names/slogans/prices in `script.js` (`products`, `slogans`, `priceTags`, `tags` arrays).
- Leaderboard is local-only (stored in the visitor’s browser). Wire it to a backend if you want global rankings.
