import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fetchExecutions, fetchExecution, parseExecution } from '../../../lib/n8n'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const userId  = searchParams.get('user')    ?? ''
  const session = searchParams.get('session') ?? ''

  try {
    if (session) {
      // ── Thread view: all messages in a session ──────────────────────────────
      // n8n doesn't have session-level lookup, so get recent executions and filter
      const { data: execs } = await fetchExecutions(250)
      const sessionExecs = execs.filter(ex => {
        // We can't filter by session without full data, return all recent for now
        return ex.status === 'success'
      }).slice(0, 50)

      const fullResults = await Promise.allSettled(
        sessionExecs.slice(0, 30).map(ex => fetchExecution(ex.id))
      )

      const messages = fullResults
        .filter(r => r.status === 'fulfilled')
        .map(r => {
          const p = parseExecution((r as PromiseFulfilledResult<typeof r extends PromiseFulfilledResult<infer T> ? T : never>).value)
          return p
        })
        .filter(p => p.sessionId === session)
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
        .map((p, i) => ({
          id:               i + 1,
          correlation_id:   p.id,
          user_id:          p.userId,
          message_in:       p.messageIn,
          message_out:      p.messageOut,
          response_json:    null,
          skill_used:       p.skillActivated,
          tool_calls_count: 0,
          duration_ms:      p.durationMs,
          created_at:       p.startedAt,
        }))

      return NextResponse.json({ type: 'thread', sessionId: session, messages })

    } else {
      // ── Session list: most recent 50 unique users ──────────────────────────
      const { data: execs } = await fetchExecutions(250)

      // Fetch full data for last 60 to get userId, path, messages
      const fullResults = await Promise.allSettled(
        execs.slice(0, 60).map(ex => fetchExecution(ex.id))
      )

      const parsed = fullResults
        .filter(r => r.status === 'fulfilled')
        .map(r => parseExecution((r as PromiseFulfilledResult<typeof r extends PromiseFulfilledResult<infer T> ? T : never>).value))

      // Group by sessionId
      const sessionMap = new Map<string, typeof parsed[0][]>()
      for (const p of parsed) {
        if (!sessionMap.has(p.sessionId)) sessionMap.set(p.sessionId, [])
        sessionMap.get(p.sessionId)!.push(p)
      }

      const sessions = Array.from(sessionMap.entries()).map(([sessionId, msgs]) => {
        msgs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        const latest = msgs[0]
        const oldest = msgs[msgs.length - 1]
        return {
          session_id:       sessionId,
          user_id:          latest.userId,
          started_at:       oldest.startedAt,
          last_message_at:  latest.startedAt,
          message_count:    msgs.length,
          last_skill:       latest.skillActivated,
          last_message_in:  latest.messageIn,
          last_message_out: latest.messageOut,
          last_duration_ms: latest.durationMs,
        }
      })
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())

      return NextResponse.json({ type: 'sessions', sessions })
    }

  } catch (err) {
    console.error('[n8n conversations]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
