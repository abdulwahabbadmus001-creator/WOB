# WOB

WOB is a cyberpunk survival shooter built with React, TypeScript, Vite, Tailwind CSS, HTML Canvas, and the Web Audio API.

Survive chapter-based episodes, defeat multi-phase bosses, collect shards, and buy upgrades between episodes. Pick a weapon loadout and unlock ship skins with high scores. Shielded enemies can be exposed with Polly or EMP, while drifting asteroids make each run more dangerous.

Play the campaign, endless survival, or a UTC daily challenge with rotating modifiers. Runs also feature combo milestones and achievements. High scores and the top-10 leaderboard are stored locally in the browser; there is no shared online leaderboard service. Play with keyboard or touch controls.

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
