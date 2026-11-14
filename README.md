# WOB

WOB is a cyberpunk survival shooter built with React, TypeScript, Vite, Tailwind CSS, HTML Canvas, and the Web Audio API.

Survive chapter-based episodes, defeat bosses, collect shards, and buy upgrades. Use Polly's combat assist, your tactical shield, and EMP; track achievements and high scores on the leaderboard. Play with keyboard or touch controls.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run build` to create a production build, or `npm run lint` to check TypeScript.

## Install on mobile or desktop

Deploy the production build over HTTPS, then install WOB from your browser's install
prompt or menu. On iPhone and iPad, open WOB in Safari, tap **Share**, then **Add
to Home Screen**. The installed app requests landscape orientation when a campaign
starts and uses the full available screen; browser support for orientation locking
and fullscreen varies by device. The service worker caches the app shell and loaded
game assets for offline play after the first visit.
