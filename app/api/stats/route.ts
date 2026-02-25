import { NextResponse } from 'next/server'
import { fetchExecutions, fetchExecution, parseExecution } from '../../../lib/n8n'

export const dynamic = 'force-dynamic'

function percentile(sorted: number[], p: number) {
  return sorted[Math.floor(sorted.length * p)] ?? 0
}

export async function GET() {
  try {
    // ── 1. Fetch last 250 executions (metadata only — fast) ──────────────────
    const { data: executions } = await fetchExecutions(250)
    if (!executions.length) {
      return NextResponse.json({ summary: {}, skills: [], tools: [], latency: {}, requestsOverTime: [], recentRequests: [] })
    }

    // ── 2. Aggregate metrics ──────────────────────────────────────────────────
    const errorCount   = executions.filter(e => e.status === 'error').length
    const successCount = executions.filter(e => e.status === 'success').length

    const durations = executions
      .map(e => {
        if (!e.startedAt || !e.stoppedAt) return 0
        return new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime()
      })
      .filter(Boolean)
      .sort((a, b) => a - b)

    const n      = durations.length
    const avgMs  = n ? Math.round(durations.reduce((a, b) => a + b, 0) / n) : 0
    const p50    = percentile(durations, 0.50)
    const p95    = percentile(durations, 0.95)
    const p99    = percentile(durations, 0.99)
    const maxMs  = durations[n - 1] ?? 0

    // Requests over time — bucket by hour (Bogotá UTC-5)
    const byHour: Record<string, { requests: number; errors: number; totalMs: number }> = {}
    for (const ex of executions) {
      if (!ex.startedAt) continue
      const dt  = new Date(new Date(ex.startedAt).getTime() - 5 * 3600_000)
      const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours()).toISOString()
      if (!byHour[key]) byHour[key] = { requests: 0, errors: 0, totalMs: 0 }
      byHour[key].requests++
      if (ex.status === 'error') byHour[key].errors++
      const dur = ex.stoppedAt
        ? new Date(ex.stoppedAt).getTime() - new Date(ex.startedAt).getTime() : 0
      byHour[key].totalMs += dur
    }
    const requestsOverTime = Object.entries(byHour)
      .map(([hour, { requests, errors, totalMs }]) => ({
        hour,
        requests,
        users:   0,
        avg_ms:  requests ? Math.round(totalMs / requests) : 0,
        errors,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-48) // last 48 hours

    // ── 3. Fetch last 20 with full data in parallel (for skills + recent) ─────
    const last20 = executions.slice(0, 20)
    const fullResults = await Promise.allSettled(last20.map(ex => fetchExecution(ex.id)))

    const skillsMap: Record<string, number> = {}
    const recentRequests = []
    const userIds = new Set<string>()

    for (const result of fullResults) {
      if (result.status !== 'fulfilled') continue
      const parsed = parseExecution(result.value)
      skillsMap[parsed.skillActivated] = (skillsMap[parsed.skillActivated] ?? 0) + 1
      userIds.add(parsed.userId)
      recentRequests.push({
        correlation_id:      parsed.id,
        user_id:             parsed.userId,
        skill_activated:     parsed.skillActivated,
        tools_used:          [] as string[],
        tool_calls_count:    0,
        web_search_used:     false,
        request_duration_ms: parsed.durationMs,
        error_occurred:      parsed.errorOccurred,
        error_message:       null,
        output_type:         'text',
        first_message:       false,
        created_at:          parsed.startedAt,
        message_in:          parsed.messageIn,
        message_out:         parsed.messageOut,
      })
    }

    const skills = Object.entries(skillsMap)
      .map(([skill_activated, count]) => ({ skill_activated, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      summary: {
        total_requests:   executions.length,
        unique_users:     userIds.size,
        avg_latency_ms:   avgMs,
        error_rate_pct:   parseFloat((errorCount / executions.length * 100).toFixed(1)),
        web_search_count: 0,
        new_sessions:     successCount,
      },
      skills,
      tools: [],
      latency: { p50, p95, p99, max_ms: maxMs },
      requestsOverTime,
      recentRequests,
    })
  } catch (err) {
    console.error('[n8n stats]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
