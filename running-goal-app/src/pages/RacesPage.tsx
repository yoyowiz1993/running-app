import { ExternalLink, MapPin, Sparkles, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input, Label, Select } from '../components/Field'
import { TopBar } from '../components/TopBar'
import { searchRaces, type RaceResult } from '../lib/races'

const RACE_TYPE_OPTIONS = [
  { value: '', label: 'Any distance' },
  { value: '5K', label: '5K' },
  { value: '10K', label: '10K' },
  { value: 'Half Marathon', label: 'Half Marathon (21K)' },
  { value: 'Marathon', label: 'Marathon (42K)' },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RacesPage() {
  const [raceType, setRaceType] = useState('')
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState('')
  const [races, setRaces] = useState<RaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    setError(null)
    setSearching(true)
    try {
      const results = await searchRaces({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        distances: raceType ? [raceType] : undefined,
      })
      setRaces(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setRaces([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Find Races" />
      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4">
        {/* Search form */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">AI race search</div>
              <div className="text-xs text-white/40">Israel-focused races via Gemini</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Race type</Label>
              <Select value={raceType} onChange={(e) => setRaceType(e.target.value)}>
                {RACE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value || 'any'} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label>To date (optional)</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="Leave empty for open-ended"
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => void handleSearch()}
              disabled={searching}
            >
              {searching ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Search races
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
        </Card>

        {/* Results */}
        {races.length > 0 && (
          <Card className="p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-white">
                Found {races.length} race{races.length !== 1 ? 's' : ''}
              </div>
              <div className="mt-1 text-[11px] text-white/40">
                Dates are AI-generated — verify on the registration site before making plans.
              </div>
            </div>
            <div className="space-y-3">
              {races.map((race, i) => (
                <div
                  key={`${race.name}-${race.date}-${i}`}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white">{race.name}</div>
                      {race.nameHe && (
                        <div className="text-xs text-white/50" dir="rtl">{race.nameHe}</div>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {race.city}
                        <span className="text-white/40">•</span>
                        {race.date}
                      </div>
                    </div>
                  </div>
                  {race.distances.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {race.distances.map((d) => (
                        <span
                          key={d}
                          className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                  {race.registrationUrl && (
                    <a
                      href={race.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      Register <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {races.length === 0 && !searching && !error && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            Pick dates and optionally a distance, then tap <strong className="text-white/70">Search races</strong> to find races in Israel.
          </div>
        )}
      </div>
    </div>
  )
}
