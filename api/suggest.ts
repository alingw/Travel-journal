// Serverless AI endpoint: given a trip + its places (scheduled and wishlist),
// ask Claude for the best day-by-day schedule and return structured assignments.
//
// Required environment variable (set in Vercel project settings):
//   ANTHROPIC_API_KEY   your Anthropic API key (billed per suggestion)
//
// Calls the Messages API directly (no SDK dependency), constrained to a JSON
// schema via structured outputs so the response is always valid to parse.

const ANTHROPIC = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reasoning: { type: 'string' },
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          placeId: { type: 'string' },
          dayDate: { type: 'string' }, // ISO yyyy-mm-dd within the trip range
          order: { type: 'integer' }, // 0-based position within that day
          startTime: { type: 'string' }, // "HH:mm" or "" if none
        },
        required: ['placeId', 'dayDate', 'order', 'startTime'],
      },
    },
  },
  required: ['reasoning', 'assignments'],
}

const SYSTEM = `You are an expert travel planner. You are given a trip (dates + base
city) and a list of places, each with an id, name, category, optional coordinates,
current status ("scheduled" or "wishlist"), and optional fixed time/notes.

Produce the best day-by-day schedule as a set of assignments. Rules:
- Only use placeIds and dayDates that appear in the input; every dayDate must be one
  of the provided trip days.
- Keep places that already have a fixed startTime (especially category "event",
  "arrival", or "lodging") on a sensible day and time — respect real constraints.
- Group places that are geographically close on the same day (use the coordinates).
- Order each day sensibly: arrival/transport first, meals at meal times (food ~08:00,
  ~12:30, ~19:00), sights between, lodging/hotel check-in in the afternoon.
- Don't overpack a day — 3 to 5 substantial stops is usually plenty.
- You MAY leave some wishlist places unscheduled if there genuinely isn't time; simply
  omit them from assignments. Never invent places.
- Give each assignment an integer "order" (0-based) within its day and a "startTime"
  ("HH:mm", or "" if you don't want to pin a time).
- In "reasoning", briefly explain the plan (2-4 sentences): the logic for grouping and pacing.`

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY not set' })

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ ok: false, error: 'bad json' })
    }
  }
  const { trip, places, days } = body || {}
  if (!trip || !Array.isArray(places) || !Array.isArray(days))
    return res.status(400).json({ ok: false, error: 'bad params' })

  // Trim the payload to what the planner needs.
  const slimPlaces = places.map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    status: p.status,
    dayDate: p.dayDate,
    startTime: p.startTime,
    notes: p.notes,
  }))

  const userContent = JSON.stringify(
    {
      trip: { name: trip.name, baseCity: trip.baseCity, startDate: trip.startDate, endDate: trip.endDate },
      days,
      places: slimPlaces,
    },
    null,
    1,
  )

  try {
    const r = await fetch(ANTHROPIC, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: 'disabled' },
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!r.ok) {
      const detail = await r.text()
      return res.status(502).json({ ok: false, error: `Claude API ${r.status}`, detail })
    }
    const data = await r.json()
    if (data.stop_reason === 'refusal')
      return res.status(422).json({ ok: false, error: 'The model declined this request.' })
    const textBlock = (data.content || []).find((b: any) => b.type === 'text')
    if (!textBlock) return res.status(502).json({ ok: false, error: 'empty response' })
    const parsed = JSON.parse(textBlock.text)
    return res.status(200).json({ ok: true, ...parsed })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'suggest failed' })
  }
}
