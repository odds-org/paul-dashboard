'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type {
  StatsData, AnalyticsEvent, RequestsOverTimeRow,
  SkillRow, ToolRow, Latency, RecentRequest,
} from '@/lib/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const SKILL_COLOR: Record<string, string> = {
  reactivo:   '#f5b014',
  onboarding: '#3d8bff',
  proactivo:  '#00e68a',
  unknown:    '#4a5272',
}

const TOOL_COLOR: Record<string, string> = {
  memory:                  '#a78bfa',
  buscar_eventos_en_vivo:  '#f5b014',
  buscar_eventos_programados: '#3d8bff',
  buscar_eventos:          '#3d8bff',
  web_search:              '#00e68a',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (!ms) return '—'
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`
  return `${ms}ms`
}

function fmtHour(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}h`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function fmtUser(id: string): string {
  if (!id) return '—'
  return id.length > 10 ? `…${id.slice(-8)}` : id
}

function skillClass(skill: string): string {
  const map: Record<string, string> = {
    reactivo:   'badge-reactivo',
    onboarding: 'badge-onboarding',
    proactivo:  'badge-proactivo',
  }
  return `badge ${map[skill] ?? 'badge-unknown'}`
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="val">{p.value} <span style={{ color: '#4a5272', fontSize: 10 }}>{p.name}</span></div>
      ))}
    </div>
  )
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: 'amber' | 'green' | 'red'
}) {
  return (
    <div className="card p-4 fade-up">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${color ?? ''}`}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  )
}

// ─── Requests Over Time Chart ─────────────────────────────────────────────────

function RequestsChart({ data }: { data: RequestsOverTimeRow[] }) {
  if (!data.length) {
    return (
      <div className="card p-5">
        <p className="section-title">Requests / Hora — últimas 24h</p>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Sin datos todavía</span>
        </div>
      </div>
    )
  }

  const chartData = data.map(r => ({
    hour:     fmtHour(r.hour),
    requests: r.requests,
    errors:   r.errors,
    avg_ms:   Math.round(r.avg_ms / 1000),
  }))

  return (
    <div className="card p-5">
      <p className="section-title">Requests / Hora — últimas 24h</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f5b014" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f5b014" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ff3355" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#ff3355" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone" dataKey="requests" name="req"
            stroke="#f5b014" strokeWidth={1.5}
            fill="url(#amberGrad)" dot={false} activeDot={{ r: 3, fill: '#f5b014' }}
          />
          <Area
            type="monotone" dataKey="errors" name="err"
            stroke="#ff3355" strokeWidth={1}
            fill="url(#redGrad)" dot={false} activeDot={{ r: 3, fill: '#ff3355' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Skills Chart ─────────────────────────────────────────────────────────────

function SkillsPanel({ data }: { data: SkillRow[] }) {
  const total = data.reduce((a, r) => a + r.count, 0)
  return (
    <div className="card p-5">
      <p className="section-title">Skills</p>
      {!data.length && (
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Sin datos</div>
      )}
      {data.map(row => {
        const pct = total ? Math.round((row.count / total) * 100) : 0
        const color = SKILL_COLOR[row.skill_activated] ?? '#4a5272'
        return (
          <div key={row.skill_activated} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-barlow)', letterSpacing: '0.04em' }}>
                {row.skill_activated}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color }}>
                {row.count} <span style={{ color: 'var(--muted)' }}>({pct}%)</span>
              </span>
            </div>
            <div className="latency-bar-track">
              <div className="latency-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tools Chart ──────────────────────────────────────────────────────────────

function ToolsPanel({ data }: { data: ToolRow[] }) {
  const max = data[0]?.count ?? 1
  return (
    <div className="card p-5">
      <p className="section-title">Top Tools</p>
      {!data.length && (
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Sin datos</div>
      )}
      {data.slice(0, 6).map(row => {
        const pct = Math.round((row.count / max) * 100)
        const color = TOOL_COLOR[row.tool] ?? '#4a5272'
        const shortName = row.tool.replace('buscar_eventos_', 'b_evt_')
        return (
          <div key={row.tool} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                {shortName}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color }}>
                {row.count}
              </span>
            </div>
            <div className="latency-bar-track">
              <div className="latency-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Latency Panel ────────────────────────────────────────────────────────────

function LatencyPanel({ data }: { data: Latency | undefined }) {
  const items = [
    { label: 'P50', val: data?.p50 ?? 0, color: '#00e68a' },
    { label: 'P95', val: data?.p95 ?? 0, color: '#f5b014' },
    { label: 'P99', val: data?.p99 ?? 0, color: '#ff6b35' },
    { label: 'MAX', val: data?.max_ms ?? 0, color: '#ff3355' },
  ]
  const max = items[3].val || 1

  return (
    <div className="card p-5">
      <p className="section-title">Latencia</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(({ label, val, color }) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', fontWeight: 600 }}>
                {label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color }}>
                {fmtMs(val)}
              </span>
            </div>
            <div className="latency-bar-track">
              <div
                className="latency-bar-fill"
                style={{ width: `${Math.min(100, (val / max) * 100)}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Live Feed ────────────────────────────────────────────────────────────────

function LiveFeed({ events, connected }: { events: AnalyticsEvent[]; connected: boolean }) {
  const listRef = useRef<HTMLDivElement>(null)

  return (
    <div className="card p-4 flex flex-col" style={{ minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="section-title" style={{ marginBottom: 0 }}>Feed en Vivo</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {connected ? <div className="live-dot" /> : <div className="dead-dot" />}
          <span style={{ fontSize: 10, color: connected ? 'var(--green)' : 'var(--muted)', letterSpacing: '0.1em' }}>
            {connected ? 'CONECTADO' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Events */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {events.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'center', marginTop: 24 }}>
            Esperando eventos…
          </div>
        )}
        {events.map((e, i) => (
          <div
            key={e.correlationId}
            className={i === 0 ? 'event-enter' : ''}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 6px',
              borderRadius: 4,
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}
          >
            {/* Status dot */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: e.errorOccurred ? 'var(--red)' : 'var(--green)',
            }} />

            {/* Time */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
              {fmtTime(e.createdAt)}
            </span>

            {/* User */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)', flexShrink: 0 }}>
              {fmtUser(e.userId)}
            </span>

            {/* Skill badge */}
            <span className={skillClass(e.skillActivated)} style={{ flexShrink: 0 }}>
              {e.skillActivated.slice(0, 5)}
            </span>

            {/* Duration */}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 'auto', flexShrink: 0,
              color: e.requestDurationMs > 15000 ? 'var(--red)' : 'var(--amber)',
            }}>
              {fmtMs(e.requestDurationMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Recent Requests Table ────────────────────────────────────────────────────

function RecentTable({ rows }: { rows: RecentRequest[] }) {
  return (
    <div className="card p-5">
      <p className="section-title">Últimas Solicitudes</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Usuario</th>
              <th>Skill</th>
              <th>Tools</th>
              <th>Duración</th>
              <th>Tipo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>
                  Sin datos todavía — los requests aparecen aquí al llegar
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.correlation_id}>
                <td style={{ color: 'var(--muted)' }}>{fmtTime(r.created_at)}</td>
                <td style={{ color: 'var(--text)' }}>{fmtUser(r.user_id)}</td>
                <td>
                  <span className={skillClass(r.skill_activated)}>
                    {r.skill_activated}
                  </span>
                </td>
                <td style={{ color: 'var(--muted)' }}>
                  {r.tools_used?.length > 0
                    ? r.tools_used.map(t => t.replace('buscar_eventos_', 'b_')).join(', ')
                    : '—'}
                </td>
                <td style={{
                  color: r.request_duration_ms > 15000 ? 'var(--red)'
                       : r.request_duration_ms > 8000  ? 'var(--amber)' : 'var(--green)',
                }}>
                  {fmtMs(r.request_duration_ms)}
                </td>
                <td style={{ color: 'var(--muted)' }}>{r.output_type}</td>
                <td>
                  {r.error_occurred
                    ? <span style={{ color: 'var(--red)' }}>✗ error</span>
                    : <span style={{ color: 'var(--green)' }}>✓ ok</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats]         = useState<StatsData | null>(null)
  const [liveEvents, setLiveEvents] = useState<AnalyticsEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [mounted, setMounted]     = useState(false)
  const [clock, setClock]         = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError]         = useState<string | null>(null)

  // Client-only mount guard (prevents recharts SSR issues)
  useEffect(() => { setMounted(true) }, [])

  // ── Clock (Bogotá TZ) ──────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClock(
      new Date().toLocaleTimeString('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    )
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // ── Stats polling every 30s ────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (!res.ok) { setError('Error fetching stats'); return }
      const data: StatsData = await res.json()
      setStats(data)
      setError(null)
      setLastUpdated(new Date())
    } catch {
      setError('No se pudo conectar al servidor')
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const t = setInterval(fetchStats, 30_000)
    return () => clearInterval(t)
  }, [fetchStats])

  // ── SSE connection ─────────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/events')

    es.addEventListener('connected',  () => setConnected(true))
    es.addEventListener('heartbeat',  () => {/* keep alive */})
    es.addEventListener('analytics',  (e) => {
      const event: AnalyticsEvent = JSON.parse(e.data)
      setLiveEvents(prev => [event, ...prev].slice(0, 50))
    })
    es.addEventListener('error', () => setConnected(false))

    return () => { es.close(); setConnected(false) }
  }, [])

  // ── Derived metrics (live events augment stats counters) ───────────────────
  const s = stats?.summary
  const liveCount    = liveEvents.length
  const liveErrors   = liveEvents.filter(e => e.errorOccurred).length
  const liveWebSearch= liveEvents.filter(e => e.webSearchUsed).length

  // Total = DB snapshot + new live events since last refresh
  const totalReq = (s?.total_requests ?? 0) + liveCount
  const errPct   = totalReq > 0
    ? (((s?.error_rate_pct ?? 0) * (s?.total_requests ?? 0) / 100) + liveErrors) / totalReq * 100
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        height: 52,
        background: 'rgba(12,17,32,0.95)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Left: logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontFamily: 'var(--font-barlow)', fontWeight: 700,
            fontSize: 20, letterSpacing: '0.18em', color: 'var(--amber)',
          }}>
            PAUL
          </span>
          <span style={{ color: 'var(--border)', fontSize: 20, lineHeight: 1 }}>|</span>
          <span style={{
            fontFamily: 'var(--font-barlow)', fontWeight: 500,
            fontSize: 14, letterSpacing: '0.22em', color: 'var(--muted)',
            textTransform: 'uppercase',
          }}>
            Monitor
          </span>
        </div>

        {/* Center: connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {connected ? <div className="live-dot" /> : <div className="dead-dot" />}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: connected ? 'var(--green)' : 'var(--muted)',
            letterSpacing: '0.1em',
          }}>
            {connected ? '● LIVE' : '○ OFFLINE'}
          </span>
          {error && (
            <span style={{ fontSize: 10, color: 'var(--red)', marginLeft: 12 }}>
              ⚠ {error}
            </span>
          )}
        </div>

        {/* Right: clock + last updated */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)', letterSpacing: '0.05em' }}>
            {clock}
          </span>
          {lastUpdated && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)' }}>
              actualizó {fmtTime(lastUpdated.toISOString())}
            </span>
          )}
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Metric Cards */}
        {mounted && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            <MetricCard
              label="Requests 24h"
              value={totalReq.toLocaleString()}
              sub={`+${liveCount} en vivo`}
              color="amber"
            />
            <MetricCard
              label="Usuarios únicos"
              value={(s?.unique_users ?? 0).toLocaleString()}
              sub="24h"
            />
            <MetricCard
              label="Latencia avg"
              value={fmtMs(s?.avg_latency_ms ?? 0)}
              sub="24h"
            />
            <MetricCard
              label="Error rate"
              value={`${errPct.toFixed(1)}%`}
              sub={`${liveErrors} err en vivo`}
              color={errPct > 5 ? 'red' : errPct > 1 ? undefined : 'green'}
            />
            <MetricCard
              label="Web search"
              value={(s?.web_search_count ?? 0) + liveWebSearch}
              sub="búsquedas web"
            />
            <MetricCard
              label="Sesiones nuevas"
              value={s?.new_sessions ?? 0}
              sub="first_message=true"
            />
          </div>
        )}

        {/* Charts + Live Feed */}
        {mounted && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, minHeight: 0 }}>

            {/* Left column: charts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
              <RequestsChart data={stats?.requestsOverTime ?? []} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <SkillsPanel  data={stats?.skills ?? []} />
                <ToolsPanel   data={stats?.tools  ?? []} />
                <LatencyPanel data={stats?.latency} />
              </div>
            </div>

            {/* Right column: live feed */}
            <LiveFeed events={liveEvents} connected={connected} />
          </div>
        )}

        {/* Loading skeleton */}
        {!mounted && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
            <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>
              CARGANDO…
            </span>
          </div>
        )}

        {/* Recent Requests Table */}
        {mounted && <RecentTable rows={stats?.recentRequests ?? []} />}

        {/* Footer */}
        <div style={{
          textAlign: 'center', padding: '8px 0 4px',
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--muted)', letterSpacing: '0.1em',
        }}>
          PAUL AGENT MONITOR — DoradoBet — Refresca cada 30s · SSE en tiempo real
        </div>
      </main>
    </div>
  )
}
