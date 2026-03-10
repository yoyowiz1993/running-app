# Garmin Backend

OAuth 2.0 PKCE flow for Garmin Connect and placeholder API for activities.

## Environment variables (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `GARMIN_CLIENT_ID` | Yes (for OAuth) | From [Garmin Connect Developer Program](https://developer.garmin.com/). |
| `GARMIN_CLIENT_SECRET` | Yes (for OAuth) | Same place as client ID. |
| `BACKEND_URL` or `APP_URL` | Yes (for OAuth) | This server’s public URL, e.g. `https://garmin-backend-xxx.onrender.com`. Must match the callback URL you register in the Garmin developer portal. |
| `FRONTEND_URL` or `ALLOWED_ORIGIN` | Recommended | Your frontend URL (e.g. Netlify). Used to redirect the user back after OAuth. |
| `ALLOWED_ORIGIN` | Optional | CORS origin; defaults to `*`. |
| `GARMIN_PUSH_MODE` | Optional | `mock` by default. Enables the workout push endpoint in mock mode while waiting for real Garmin push API approval. |
| `USDA_API_KEY` | Optional (for nutrition) | API key from [api.data.gov](https://api.data.gov) for USDA FoodData Central. Required for the Nutrition search feature. |
| `INTERVALS_API_KEY` | Required (for programs) | Intervals.icu API key from [Intervals.icu → Settings → Developer Settings](https://intervals.icu). Used by the app to create planned workouts in Intervals behind the scenes. Users never see or enter this key. |
| `PORT` | Optional | Set by Render automatically. |

## Garmin developer setup

1. Apply at [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/).
2. Create an application and get **Consumer Key** (use as `GARMIN_CLIENT_ID`) and **Consumer Secret** (use as `GARMIN_CLIENT_SECRET`).
3. In the app settings, set the **Callback URL** to:  
   `https://YOUR-BACKEND-URL.onrender.com/auth/garmin/callback`  
   (use your real `BACKEND_URL`).

## OAuth flow

- **GET /auth/garmin/start** – Redirects the user to Garmin to sign in; after approval, Garmin redirects to your callback.
- **GET /auth/garmin/callback** – Exchanges the authorization code for tokens, then redirects the user to the frontend with `?garmin=connected` or `?garmin=error`.
- **POST /api/garmin/workouts/sync** – Accepts planned workouts and returns sync results. In `GARMIN_PUSH_MODE=mock`, it returns mock synced IDs so frontend flows can be tested end-to-end.
- **GET /api/nutrition/search?q=...** – Proxies to USDA FoodData Central; returns simplified food list (name, portions, calories, macros) for the frontend calorie log.
- **POST /api/programs/create** – Creates a training program: validates goal (distance, pace, race date), generates workouts server-side, creates them in Intervals.icu via the shared `INTERVALS_API_KEY`, returns a normalized plan for the app. Body: `{ goal: { distanceKm, targetPaceSecPerKm, raceDateISO }, planName?, startDate, endDate }`.
- **POST /api/programs/delete-events** – Deletes Intervals.icu events by ID. Body: `{ eventIds: number[] }`. Used when the user deletes a program so corresponding Intervals events are removed.
- **POST /api/intervals/import** – Imports running plans from Intervals.icu (legacy). Body: `{ apiKey, oldest, newest, planName? }`. API key is provided by the user; not stored server-side.

Tokens are logged only; a later version can store them (e.g. in a DB) and use them to call Garmin APIs for activities.
