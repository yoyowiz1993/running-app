# Running Plan (iPhone-friendly PWA)

Mobile-first web app that lets you:

- Set a **race goal** (distance, target pace, race date)
- Tap **Create plan** to generate a training plan
- Follow the plan in a **training calendar**
- Tap **Start** on any workout to run it interactively with **stage timers** (warmup → main set → cooldown)

Everything is stored **offline on your device** via `localStorage`.

## Run locally

```bash
cd running-goal-app
npm install
npm run dev -- --host
```

Then open the printed LAN URL on your iPhone (same Wi‑Fi).

## Install on iPhone (Add to Home Screen)

1. Open the app in **Safari** on iPhone
2. Tap **Share**
3. Tap **Add to Home Screen**

## Build for production

```bash
npm run build
npm run preview -- --host
```

