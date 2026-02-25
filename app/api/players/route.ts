/**
 * Players API — groups n8n executions by userId.
 *
 * GET /api/players              → list of all users with summary
 * GET /api/players?userId=xxx   → full conversation timeline for one user
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fetchExecutions, fetchExecution, parseExecution } from '../../../lib/n8n'
import type { ParsedExecution } from '../../../lib/n8n'

export const dynamic = 'force-dynamic'

// Infer a display name from messages (looks for "me llamo X" / "mi nombre es X")
function inferName(messages: ParsedExecution[]): string {
  const patterns = [
    /me llamo\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
    /mi nombre es\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
    /soy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)(?:\s|,|\.)/i,
    /\bname\b.*?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,
  ]
  for (const msg of messages) {
    for (const re of patterns) {
      const m = msg.messageIn.match(re)
      if (m?.[1] && m[1].length > 2) return m[1]
    }
  }
  return ''
}

// Infer favorite sports from messages
function inferSports(messages: ParsedExecution[]): string[] {
  const sports: Set<string> = new Set()
  const patterns: [RegExp, string][] = [
    [/fútbol|futbol|soccer/i, 'Fútbol'],
    [/nba|basket/i, 'NBA'],
    [/champions|ucl/i, 'Champions League'],
    [/copa libertadores|libertadores/i, 'Copa Libertadores'],
    [/premier|pl\b/i, 'Premier League'],
    [/la liga|laliga/i, 'La Liga'],
    [/tenis|tennis/i, 'Tenis'],
    [/béisbol|beisbol|mlb/i, 'Béisbol'],
    [/nfl|americano/i, 'Fútbol Americano'],
  ]
  for (const msg of messages) {
    const text = (msg.messageIn + ' ' + msg.messageOut).toLowerCase()
    for (const [re, sport] of patterns) {
      if (re.test(text)) sports.add(sport)
    }
  }
  return Array.from(sports).slice(0, 4)
}

// Journey stage based on skill path history
function journeyStage(messages: ParsedExecution[]): string {
  const paths = messages.map(m => m.skillActivated)
  if (paths.includes('reactivo'))  return 'active'    // betting
  if (paths.includes('soporte'))   return 'support'   // needs help
  if (paths.includes('onboarding')) return 'onboarding' // still registering
  return 'unknown'
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') ?? ''

  try {
    // Fetch last 250 executions with full data (paginate if needed)
    const { data: execs } = await fetchExecutions(250)

    // Fetch full data for all (parallelized in batches of 20)
    const batchSize = 20
    const allParsed: ParsedExecution[] = []

    for (let i = 0; i < Math.min(execs.length, 250); i += batchSize) {
      const batch = execs.slice(i, i + batchSize)
      const results = await Promise.allSettled(batch.map(ex => fetchExecution(ex.id)))
      for (const r of results) {
        if (r.status === 'fulfilled') allParsed.push(parseExecution(r.value))
      }
    }

    // Group by userId
    const byUser = new Map<string, ParsedExecution[]>()
    for (const p of allParsed) {
      if (!byUser.has(p.userId)) byUser.set(p.userId, [])
      byUser.get(p.userId)!.push(p)
    }

    // Sort each user's messages chronologically
    for (const msgs of byUser.values()) {
      msgs.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    }

    if (userId) {
      // ── Single user: full conversation timeline ───────────────────────────
      const msgs = byUser.get(userId)
      if (!msgs?.length) return NextResponse.json({ userId, messages: [] })

      return NextResponse.json({
        userId,
        name:    inferName(msgs),
        sports:  inferSports(msgs),
        stage:   journeyStage(msgs),
        messages: msgs.map(m => ({
          id:          m.id,
          timestamp:   m.startedAt,
          durationMs:  m.durationMs,
          skill:       m.skillActivated,
          messageIn:   m.messageIn,
          messageOut:  m.messageOut,
          status:      m.status,
        })),
      })

    } else {
      // ── All users: summary list ───────────────────────────────────────────
      const users = Array.from(byUser.entries()).map(([uid, msgs]) => {
        const latest = msgs[msgs.length - 1]
        const first  = msgs[0]
        return {
          userId:         uid,
          name:           inferName(msgs),
          sports:         inferSports(msgs),
          stage:          journeyStage(msgs),
          messageCount:   msgs.length,
          sessionCount:   new Set(msgs.map(m => m.sessionId)).size,
          firstSeen:      first.startedAt,
          lastSeen:       latest.startedAt,
          lastMessageIn:  latest.messageIn,
          lastMessageOut: latest.messageOut,
          lastSkill:      latest.skillActivated,
        }
      }).sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())

      return NextResponse.json({ users, total: users.length })
    }

  } catch (err) {
    console.error('[players]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
