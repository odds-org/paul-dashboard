'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserSummary {
  userId:         string
  name:           string
  sports:         string[]
  stage:          'onboarding' | 'active' | 'support' | 'unknown'
  messageCount:   number
  sessionCount:   number
  firstSeen:      string
  lastSeen:       string
  lastMessageIn:  string
  lastMessageOut: string
  lastSkill:      string
}

interface Message {
  id:          string
  timestamp:   string
  durationMs:  number
  skill:       string
  messageIn:   string
  messageOut:  string
  status:      string
}

interface UserDetail {
  userId:   string
  name:     string
  sports:   string[]
  stage:    string
  messages: Message[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtMs(ms: number) {
  if (!ms) return ''
  if (ms >= 1000) return `${(ms/1000).toFixed(1)}s`
  return `${ms}ms`
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)      return 'ahora'
  if (diff < 3_600_000)   return `${Math.floor(diff/60_000)}m`
  if (diff < 86_400_000)  return `${Math.floor(diff/3_600_000)}h`
  return `${Math.floor(diff/86_400_000)}d`
}

const STAGE_LABEL: Record<string, string> = {
  active:     '🏅 Activo',
  onboarding: '🆕 Onboarding',
  support:    '⚠️ Soporte',
  unknown:    '❓',
}

const STAGE_COLOR: Record<string, string> = {
  active:     '#00e68a',
  onboarding: '#3d8bff',
  support:    '#f5b014',
  unknown:    '#4a5272',
}

const SKILL_COLOR: Record<string, string> = {
  reactivo:   '#f5b014',
  onboarding: '#3d8bff',
  soporte:    '#ff9144',
  unknown:    '#4a5272',
}

// ─── Components ───────────────────────────────────────────────────────────────

function UserCard({ user, selected, onClick }: {
  user: UserSummary
  selected: boolean
  onClick: () => void
}) {
  const displayName = user.name || user.userId.slice(-8)
  const stageColor  = STAGE_COLOR[user.stage] ?? '#4a5272'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        background: selected ? 'rgba(245,176,20,0.07)' : 'transparent',
        borderLeft: selected ? '2px solid #f5b014' : '2px solid transparent',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {/* Row 1: name + stage + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: `${stageColor}22`, border: `1px solid ${stageColor}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: 13,
          color: stageColor,
        }}>
          {displayName[0]?.toUpperCase() ?? '?'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-barlow)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {user.name || `...${user.userId.slice(-8)}`}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
              {fmtRelative(user.lastSeen)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              padding: '1px 6px', borderRadius: 3,
              background: `${stageColor}18`, color: stageColor,
            }}>
              {STAGE_LABEL[user.stage]}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
              {user.messageCount} msgs · {user.sessionCount} sesión{user.sessionCount !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: last message preview */}
      {user.lastMessageIn && (
        <div style={{ paddingLeft: 40, display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>👤</span>
          <span style={{
            fontSize: 11, color: 'var(--muted)', lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
          }}>
            {user.lastMessageIn}
          </span>
        </div>
      )}

      {/* Sports tags */}
      {user.sports.length > 0 && (
        <div style={{ paddingLeft: 40, marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          {user.sports.map(s => (
            <span key={s} style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: 'rgba(61,139,255,0.12)', color: '#3d8bff',
              fontFamily: 'var(--font-barlow)', letterSpacing: '0.05em',
            }}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const skillColor = SKILL_COLOR[msg.skill] ?? '#4a5272'
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Timestamp + skill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
          {fmtTime(msg.timestamp)}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
          background: `${skillColor}18`, color: skillColor, letterSpacing: '0.08em',
        }}>
          {msg.skill.toUpperCase()}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
          {fmtMs(msg.durationMs)}
        </span>
      </div>

      {/* User message (left) */}
      {msg.messageIn && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>👤</span>
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '4px 14px 14px 14px',
            padding: '8px 12px',
            fontSize: 13, lineHeight: 1.5, color: 'var(--text)',
            maxWidth: '80%',
          }}>
            {msg.messageIn}
          </div>
        </div>
      )}

      {/* Paul response (right) */}
      {msg.messageOut && (
        <div style={{ display: 'flex', gap: 8, flexDirection: 'row-reverse' }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
          <div style={{
            background: 'rgba(245,176,20,0.08)',
            border: '1px solid rgba(245,176,20,0.18)',
            borderRadius: '14px 4px 14px 14px',
            padding: '8px 12px',
            fontSize: 13, lineHeight: 1.5, color: 'var(--text)',
            maxWidth: '80%',
          }}>
            {msg.messageOut}
          </div>
        </div>
      )}

      {/* No response */}
      {!msg.messageOut && msg.messageIn && (
        <div style={{ display: 'flex', gap: 8, flexDirection: 'row-reverse' }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
          <div style={{
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '14px 4px 14px 14px',
            padding: '8px 12px',
            fontSize: 12, color: 'var(--muted)', fontStyle: 'italic',
          }}>
            (respuesta no capturada)
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const [users, setUsers]           = useState<UserSummary[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [loadingList, setLoadingList]   = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [search, setSearch]         = useState('')

  // Load user list
  const fetchUsers = useCallback(async () => {
    setLoadingList(true)
    try {
      const res  = await fetch('/api/players')
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch { /* retry on next load */ } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Load user detail on select
  const selectUser = useCallback(async (uid: string) => {
    if (selectedUser === uid) { setSelectedUser(null); setUserDetail(null); return }
    setSelectedUser(uid)
    setUserDetail(null)
    setLoadingThread(true)
    try {
      const res  = await fetch(`/api/players?userId=${encodeURIComponent(uid)}`)
      const data = await res.json()
      setUserDetail(data)
    } catch { /* skip */ } finally {
      setLoadingThread(false)
    }
  }, [selectedUser])

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.userId.toLowerCase().includes(search.toLowerCase()) ||
    u.lastMessageIn.toLowerCase().includes(search.toLowerCase()) ||
    u.sports.some(s => s.toLowerCase().includes(search.toLowerCase()))
  )

  // Counts by stage
  const byStage = {
    active:     users.filter(u => u.stage === 'active').length,
    onboarding: users.filter(u => u.stage === 'onboarding').length,
    support:    users.filter(u => u.stage === 'support').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{
        height: 52, flexShrink: 0,
        background: 'rgba(12,17,32,0.97)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ textDecoration: 'none', color: 'var(--muted)', fontSize: 18 }}>←</a>
          <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: 18, letterSpacing: '0.15em', color: 'var(--amber)' }}>
            JUGADORES
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            {users.length} usuarios · {byStage.active} activos · {byStage.onboarding} onboarding · {byStage.support} soporte
          </span>
        </div>

        <a href="/" style={{
          fontFamily: 'var(--font-barlow)', fontSize: 12, letterSpacing: '0.1em',
          color: 'var(--muted)', textDecoration: 'none', padding: '4px 12px',
          border: '1px solid var(--border)', borderRadius: 4,
        }}>
          ← Dashboard
        </a>
      </header>

      {/* ── Main layout: sidebar + thread ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: user list ── */}
        <div style={{
          width: 340, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar usuario, deporte, mensaje…"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '7px 12px', color: 'var(--text)',
                fontFamily: 'var(--font-barlow)', fontSize: 13,
                outline: 'none', boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {/* User list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingList && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                Cargando usuarios…
              </div>
            )}
            {!loadingList && filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                Sin resultados
              </div>
            )}
            {filtered.map(user => (
              <UserCard
                key={user.userId}
                user={user}
                selected={selectedUser === user.userId}
                onClick={() => selectUser(user.userId)}
              />
            ))}
          </div>
        </div>

        {/* ── Right: conversation thread ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedUser && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12, color: 'var(--muted)',
            }}>
              <div style={{ fontSize: 40 }}>💬</div>
              <div style={{ fontFamily: 'var(--font-barlow)', fontSize: 16, letterSpacing: '0.1em' }}>
                Selecciona un usuario para ver su conversación
              </div>
            </div>
          )}

          {selectedUser && (
            <>
              {/* User header */}
              {userDetail && (
                <div style={{
                  padding: '14px 24px', flexShrink: 0,
                  borderBottom: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.02)',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: `${STAGE_COLOR[userDetail.stage] ?? '#4a5272'}22`,
                    border: `2px solid ${STAGE_COLOR[userDetail.stage] ?? '#4a5272'}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: 16,
                    color: STAGE_COLOR[userDetail.stage] ?? '#4a5272',
                  }}>
                    {(userDetail.name || userDetail.userId)[0]?.toUpperCase()}
                  </div>

                  <div>
                    <div style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
                      {userDetail.name || `...${userDetail.userId.slice(-12)}`}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: STAGE_COLOR[userDetail.stage] ?? '#4a5272' }}>
                        {STAGE_LABEL[userDetail.stage]}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>·</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                        {userDetail.messages.length} mensajes
                      </span>
                      {userDetail.sports.length > 0 && (
                        <>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>·</span>
                          <span style={{ fontSize: 11, color: '#3d8bff' }}>
                            {userDetail.sports.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                {loadingThread && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 40 }}>
                    Cargando conversación…
                  </div>
                )}

                {userDetail?.messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {userDetail?.messages.length === 0 && !loadingThread && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 40 }}>
                    Sin mensajes encontrados para este usuario
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
