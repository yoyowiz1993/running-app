import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    credentials: true,
  }),
)
app.use(express.json())

const port = Number(process.env.PORT || 4000)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/activities', (_req, res) => {
  // Placeholder: this will return Garmin activities once wired up.
  res.json({ activities: [] })
})

app.get('/auth/garmin/start', (_req, res) => {
  // Placeholder endpoint for Garmin OAuth start.
  res.status(501).json({
    ok: false,
    message:
      'Garmin OAuth not configured yet. Set GARMIN_CLIENT_ID / GARMIN_CLIENT_SECRET and implement redirect.',
  })
})

app.listen(port, () => {
  console.log(`Garmin backend listening on http://localhost:${port}`)
})

