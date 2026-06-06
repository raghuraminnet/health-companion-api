import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns'
import {
  Activity, Scale, Heart, Calendar, TrendingUp, ChevronRight,
  Plus, X, Trash2, AlertCircle, CheckCircle, Clock, Droplets, LogOut,
} from 'lucide-react'
import {
  getBpEntries, saveBpEntry, deleteBpEntry,
  getWeightEntries, saveWeightEntry, deleteWeightEntry,
  isAuthenticated, logout,
} from './utils/storage'
import AuthScreen from './components/AuthScreen'
import PasswordResetScreen from './components/PasswordResetScreen'
import OnboardingModal, { markOnboardingComplete, hasOnboarded } from './components/OnboardingModal'
import {
  getBpCategory, calcHeartScore, getScoreLabel,
  BP_CONTEXT_TAGS, groupContextTags,
} from './utils/bp'
import {
  formatDate, formatShortDate, formatDayOfWeek, getLast7Days, isSameDayJS,
} from './utils/date'
import './App.css'

const TABS = ['dashboard', 'log', 'summary']

// ─── BP Entry Modal ────────────────────────────────────────────

function BPEntryModal({ onClose, onSave }) {
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [pulse, setPulse] = useState('')
  const [context, setContext] = useState([])
  const [notes, setNotes] = useState('')
  const [medicationTaken, setMedicationTaken] = useState(false)

  const toggleTag = (id) => {
    setContext(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const handleSave = () => {
    if (!systolic || !diastolic) return
    onSave({
      systolic: parseInt(systolic),
      diastolic: parseInt(diastolic),
      pulse: pulse ? parseInt(pulse) : null,
      context,
      notes,
      medicationTaken,
    })
    onClose()
  }

  const grouped = groupContextTags(context)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log Blood Pressure</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="bp-inputs">
          <div className="bp-field">
            <label>Systolic (upper)</label>
            <input type="number" value={systolic} onChange={e => setSystolic(e.target.value)} placeholder="120" min="60" max="300" />
            <span className="unit">mmHg</span>
          </div>
          <div className="bp-divider">/</div>
          <div className="bp-field">
            <label>Diastolic (lower)</label>
            <input type="number" value={diastolic} onChange={e => setDiastolic(e.target.value)} placeholder="80" min="40" max="200" />
            <span className="unit">mmHg</span>
          </div>
          <div className="bp-field">
            <label>Pulse (optional)</label>
            <input type="number" value={pulse} onChange={e => setPulse(e.target.value)} placeholder="72" min="40" max="250" />
            <span className="unit">bpm</span>
          </div>
        </div>

        {systolic && diastolic && (() => {
          const cat = getBpCategory(parseInt(systolic), parseInt(diastolic))
          return (
            <div className="bp-category-badge" style={{ background: cat.color + '22', color: cat.color, borderColor: cat.color }}>
              {cat.label}
            </div>
          )
        })()}

        <div className="context-section">
          <label>Context tags</label>
          <div className="context-tags">
            {BP_CONTEXT_TAGS.map(tag => (
              <button
                key={tag.id}
                className={`ctx-tag ${context.includes(tag.id) ? 'active' : ''}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        <div className="medication-toggle">
          <label>
            <input type="checkbox" checked={medicationTaken} onChange={e => setMedicationTaken(e.target.checked)} />
            💊 Medication taken today
          </label>
        </div>

        <div className="notes-field">
          <label>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." rows={2} />
        </div>

        <button className="primary-btn" onClick={handleSave} disabled={!systolic || !diastolic}>
          Save Entry
        </button>
      </div>
    </div>
  )
}

// ─── Weight Entry Modal ─────────────────────────────────────────

function WeightEntryModal({ onClose, onSave }) {
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    if (!weight) return
    onSave({ weight: parseFloat(weight), notes })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log Weight</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="weight-input">
          <input
            type="number"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder="70.0"
            step="0.1"
            min="20"
            max="500"
          />
          <span className="unit">kg</span>
        </div>

        <div className="notes-field">
          <label>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." rows={2} />
        </div>

        <button className="primary-btn" onClick={handleSave} disabled={!weight}>
          Save Entry
        </button>
      </div>
    </div>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────

function Dashboard({ bpEntries, weightEntries, onBpEntry, onWeightEntry }) {
  const lastBp = bpEntries[0]
  const lastWeight = weightEntries[0]

  const last7Days = getLast7Days()
  const bpLast7 = last7Days.map(day => {
    const entry = bpEntries.find(e => isSameDayJS(e.date, day))
    return entry ? { day, entry } : { day, entry: null }
  })
  const weightLast7 = last7Days.map(day => {
    const entry = weightEntries.find(e => isSameDayJS(e.date, day))
    return entry ? { day, entry } : { day, entry: null }
  })

  const weekScore = lastBp ? calcHeartScore(lastBp.systolic, lastBp.diastolic, lastBp.pulse) : null
  const scoreLabel = weekScore ? getScoreLabel(weekScore) : null

  const avgSystolic = bpLast7.filter(d => d.entry).reduce((s, d) => s + d.entry.systolic, 0) / (bpLast7.filter(d => d.entry).length || 1)
  const avgDiastolic = bpLast7.filter(d => d.entry).reduce((s, d) => s + d.entry.diastolic, 0) / (bpLast7.filter(d => d.entry).length || 1)

  const weightTrend = weightLast7.filter(d => d.entry)
  const weightChange = weightTrend.length >= 2
    ? (weightTrend[0].entry.weight - weightTrend[weightTrend.length - 1].entry.weight).toFixed(1)
    : null

  return (
    <div className="dashboard">
      {/* Heart Score */}
      <div className="score-card">
        <div className="score-header">
          <Heart size={20} />
          <span>Heart Health Score</span>
        </div>
        {weekScore ? (
          <>
            <div className="score-value" style={{ color: scoreLabel.color }}>{weekScore}</div>
            <div className="score-label" style={{ color: scoreLabel.color }}>{scoreLabel.label}</div>
            {lastBp && (
              <div className="score-bp">
                {lastBp.systolic}/{lastBp.diastolic} mmHg
                {lastBp.pulse && <span> · {lastBp.pulse} bpm</span>}
              </div>
            )}
          </>
        ) : (
          <div className="no-data">Log your first BP reading to see your score</div>
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dbeafe' }}>
            <Activity size={18} color="#2563eb" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Avg BP (7d)</span>
            <span className="stat-value">
              {bpLast7.filter(d => d.entry).length > 0
                ? `${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}`
                : '—'}
            </span>
            <span className="stat-unit">mmHg</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7' }}>
            <Scale size={18} color="#16a34a" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Current Weight</span>
            <span className="stat-value">
              {lastWeight ? lastWeight.weight : '—'}
            </span>
            <span className="stat-unit">kg</span>
          </div>
          {weightChange && (
            <span className={`weight-change ${parseFloat(weightChange) < 0 ? 'down' : 'up'}`}>
              {parseFloat(weightChange) < 0 ? '↓' : '↑'} {Math.abs(parseFloat(weightChange))} kg
            </span>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fce7f3' }}>
            <Calendar size={18} color="#db2777" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Entries (7d)</span>
            <span className="stat-value">{bpLast7.filter(d => d.entry).length + weightLast7.filter(d => d.entry).length}</span>
            <span className="stat-unit">total</span>
          </div>
        </div>
      </div>

      {/* Mini Trend Chart */}
      <div className="chart-card">
        <div className="chart-header">
          <TrendingUp size={16} />
          <span>7-Day BP Trend</span>
        </div>
        {bpLast7.some(d => d.entry) ? (
          <div style={{ height: 140 }}>
            <Line
              data={{
                labels: bpLast7.map(d => formatDayOfWeek(d.day)),
                datasets: [
                  {
                    label: 'Systolic',
                    data: bpLast7.map(d => d.entry?.systolic ?? null),
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    pointRadius: 3,
                    pointBackgroundColor: '#ef4444',
                    tension: 0.3,
                    spanGaps: true,
                  },
                  {
                    label: 'Diastolic',
                    data: bpLast7.map(d => d.entry?.diastolic ?? null),
                    borderColor: '#0ea5e9',
                    backgroundColor: '#0ea5e9',
                    pointRadius: 3,
                    pointBackgroundColor: '#0ea5e9',
                    tension: 0.3,
                    spanGaps: true,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 11 } } },
                  tooltip: {
                    callbacks: {
                      label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`,
                    },
                  },
                },
                scales: {
                  y: {
                    min: 60,
                    max: 180,
                    grid: { color: '#e5e4e7' },
                    ticks: { font: { size: 11 }, color: '#6b6375' },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 }, color: '#6b6375' },
                  },
                },
              }}
            />
          </div>
        ) : (
          <div className="no-data">No BP data yet</div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn bp" onClick={onBpEntry}>
          <Plus size={18} />
          Log BP
        </button>
        <button className="action-btn weight" onClick={onWeightEntry}>
          <Plus size={18} />
          Log Weight
        </button>
      </div>

      {/* Recent Context Tags */}
      {lastBp && lastBp.context.length > 0 && (
        <div className="recent-context">
          <span className="context-label">Last reading context:</span>
          <div className="context-tags-row">
            {lastBp.context.map(id => {
              const tag = BP_CONTEXT_TAGS.find(t => t.id === id)
              return tag ? <span key={id} className="ctx-chip">{tag.label}</span> : null
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── History Log ───────────────────────────────────────────────

function HistoryLog({ bpEntries, weightEntries, onDeleteBp, onDeleteWeight }) {
  const [filter, setFilter] = useState('all') // 'all' | 'bp' | 'weight'

  const filtered = filter === 'bp'
    ? bpEntries.map(e => ({ ...e, _type: 'bp' }))
    : filter === 'weight'
    ? weightEntries.map(e => ({ ...e, _type: 'weight' }))
    : [
        ...bpEntries.map(e => ({ ...e, _type: 'bp' })),
        ...weightEntries.map(e => ({ ...e, _type: 'weight' })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="history">
      <div className="filter-tabs">
        {[['all', 'All'], ['bp', 'BP'], ['weight', 'Weight']].map(([val, label]) => (
          <button key={val} className={`filter-tab ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>
            {label}
          </button>
        ))}
      </div>

      <div className="entries-list">
        {filtered.length === 0 && (
          <div className="empty-state">
            <Clock size={32} />
            <p>No entries yet. Start logging!</p>
          </div>
        )}
        {filtered.map(entry => {
          if (entry._type === 'bp') {
            const cat = getBpCategory(entry.systolic, entry.diastolic)
            return (
              <div key={entry.id} className="entry-card bp-entry">
                <div className="entry-left">
                  <div className="entry-bp" style={{ color: cat.color }}>
                    {entry.systolic}/{entry.diastolic}
                    <span className="entry-unit">mmHg</span>
                  </div>
                  {entry.pulse && <div className="entry-pulse">♥ {entry.pulse} bpm</div>}
                  <div className="entry-date">{formatDate(entry.date)}</div>
                  {entry.context.length > 0 && (
                    <div className="entry-context">
                      {entry.context.map(id => {
                        const tag = BP_CONTEXT_TAGS.find(t => t.id === id)
                        return tag ? <span key={id} className="ctx-chip small">{tag.label}</span> : null
                      })}
                    </div>
                  )}
                  {entry.notes && <div className="entry-notes">{entry.notes}</div>}
                  {entry.medicationTaken && <div className="entry-med">💊 Medication taken</div>}
                </div>
                <button className="delete-btn" onClick={() => onDeleteBp(entry.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            )
          } else {
            return (
              <div key={entry.id} className="entry-card weight-entry">
                <div className="entry-left">
                  <div className="entry-weight">
                    {entry.weight}
                    <span className="entry-unit">kg</span>
                  </div>
                  <div className="entry-date">{formatDate(entry.date)}</div>
                  {entry.notes && <div className="entry-notes">{entry.notes}</div>}
                </div>
                <button className="delete-btn" onClick={() => onDeleteWeight(entry.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            )
          }
        })}
      </div>
    </div>
  )
}

// ─── Weekly Summary ────────────────────────────────────────────

function WeeklySummary({ bpEntries, weightEntries }) {
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const bpThisWeek = bpEntries.filter(e => {
    const d = new Date(e.date)
    return d >= weekStart && d <= weekEnd
  })
  const weightThisWeek = weightEntries.filter(e => {
    const d = new Date(e.date)
    return d >= weekStart && d <= weekEnd
  })

  // Last week for comparison
  const lastWeekStart = subDays(weekStart, 7)
  const lastWeekEnd = subDays(weekEnd, 7)
  const bpLastWeek = bpEntries.filter(e => {
    const d = new Date(e.date)
    return d >= lastWeekStart && d <= lastWeekEnd
  })

  const avg = (arr, key) => arr.length ? arr.reduce((s, e) => s + e[key], 0) / arr.length : null

  const thisWeekAvgSys = avg(bpThisWeek, 'systolic')
  const thisWeekAvgDia = avg(bpThisWeek, 'diastolic')
  const lastWeekAvgSys = avg(bpLastWeek, 'systolic')
  const lastWeekAvgDia = avg(bpLastWeek, 'diastolic')

  const sysChange = lastWeekAvgSys ? thisWeekAvgSys - lastWeekAvgSys : null
  const diaChange = lastWeekAvgDia ? thisWeekAvgDia - lastWeekAvgDia : null

  const latestWeight = weightEntries[0]?.weight
  const weekAgoWeight = weightThisWeek.length > 1
    ? weightThisWeek[weightThisWeek.length - 1]?.weight
    : weightEntries.find(e => isSameDayJS(e.date, subDays(today, 7)))?.weight
  const weightDelta = latestWeight && weekAgoWeight ? (latestWeight - weekAgoWeight).toFixed(1) : null

  // Most common context tags this week
  const tagCounts = {}
  bpThisWeek.forEach(e => {
    e.context.forEach(id => {
      tagCounts[id] = (tagCounts[id] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, count]) => ({ tag: BP_CONTEXT_TAGS.find(t => t.id === id), count }))

  // Daily breakdown
  const dailyBreakdown = days.map(day => {
    const bpDay = bpEntries.filter(e => isSameDayJS(e.date, day))
    const wtDay = weightEntries.filter(e => isSameDayJS(e.date, day))
    return { day, bp: bpDay, weight: wtDay }
  })

  return (
    <div className="summary">
      <div className="summary-header">
        <h2>📊 Weekly Summary</h2>
        <span className="summary-range">
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </span>
      </div>

      {/* Key Stats */}
      <div className="summary-stats">
        <div className="summary-stat">
          <span className="summary-stat-label">Avg BP This Week</span>
          <span className="summary-stat-value">
            {thisWeekAvgSys ? `${Math.round(thisWeekAvgSys)}/${Math.round(thisWeekAvgDia)}` : '—'}
          </span>
          <span className="summary-stat-unit">mmHg</span>
          {sysChange !== null && (
            <span className={`change ${sysChange > 0 ? 'up' : 'down'}`}>
              {sysChange > 0 ? '↑' : '↓'} {Math.abs(Math.round(sysChange))} vs last week
            </span>
          )}
        </div>

        <div className="summary-stat">
          <span className="summary-stat-label">BP Readings</span>
          <span className="summary-stat-value">{bpThisWeek.length}</span>
          <span className="summary-stat-unit">this week</span>
        </div>

        <div className="summary-stat">
          <span className="summary-stat-label">Weight</span>
          <span className="summary-stat-value">
            {latestWeight ? `${latestWeight} kg` : '—'}
          </span>
          {weightDelta && (
            <span className={`change ${parseFloat(weightDelta) < 0 ? 'down' : 'up'}`}>
              {parseFloat(weightDelta) < 0 ? '↓' : '↑'} {Math.abs(parseFloat(weightDelta))} kg this week
            </span>
          )}
        </div>
      </div>

      {/* Top Context Tags */}
      {topTags.length > 0 && (
        <div className="summary-section">
          <h3>🏷️ Common Contexts This Week</h3>
          <div className="top-tags">
            {topTags.map(({ tag, count }) => (
              <div key={tag.id} className="top-tag">
                <span className="top-tag-label">{tag.label}</span>
                <span className="top-tag-count">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Breakdown */}
      <div className="summary-section">
        <h3>📅 Daily Breakdown</h3>
        <div className="daily-grid">
          {dailyBreakdown.map(({ day, bp, weight }) => (
            <div key={day.toISOString()} className={`day-card ${isSameDay(day, today) ? 'today' : ''}`}>
              <div className="day-name">{format(day, 'EEE')}</div>
              <div className="day-date">{format(day, 'MMM d')}</div>
              <div className="day-entries">
                {bp.length === 0 && weight.length === 0 && (
                  <span className="day-empty">—</span>
                )}
                {bp.map(e => {
                  const cat = getBpCategory(e.systolic, e.diastolic)
                  return (
                    <div key={e.id} className="day-bp" style={{ color: cat.color }}>
                      {e.systolic}/{e.diastolic}
                    </div>
                  )
                })}
                {weight.map(e => (
                  <div key={e.id} className="day-weight">
                    {e.weight} kg
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="summary-section">
        <h3>💡 Insights</h3>
        <div className="insights-list">
          {bpThisWeek.length === 0 && weightThisWeek.length === 0 && (
            <div className="insight-item">
              <AlertCircle size={16} />
              No readings logged this week yet. Start tracking!
            </div>
          )}
          {bpThisWeek.length > 0 && thisWeekAvgSys >= 140 && (
            <div className="insight-item warning">
              <AlertCircle size={16} />
              Your average systolic BP is in the high range this week. Consider consulting your doctor.
            </div>
          )}
          {bpThisWeek.length > 0 && thisWeekAvgSys < 120 && thisWeekAvgDia < 80 && (
            <div className="insight-item good">
              <CheckCircle size={16} />
              Great job! Your BP is in the normal range this week.
            </div>
          )}
          {topTags.length > 0 && (() => {
            const topTag = topTags[0]
            return (
              <div className="insight-item">
                <Activity size={16} />
                Your most common context this week: <strong>{topTag.tag.label}</strong> ({topTag.count} readings)
              </div>
            )
          })()}
          {weightDelta && parseFloat(weightDelta) !== 0 && (
            <div className="insight-item">
              <Scale size={16} />
              Your weight has {parseFloat(weightDelta) > 0 ? 'increased' : 'decreased'} by {Math.abs(parseFloat(weightDelta))} kg this week.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────

function App() {
  const [tab, setTab] = useState('dashboard')
  const [showBpModal, setShowBpModal] = useState(false)
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [bpEntries, setBpEntries] = useState([])
  const [weightEntries, setWeightEntries] = useState([])
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded())
  const [loading, setLoading] = useState(true)
  const [isAuthed, setIsAuthed] = useState(() => isAuthenticated())
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [bp, weight] = await Promise.all([getBpEntries(), getWeightEntries()])
      setBpEntries(bp)
      setWeightEntries(weight)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = () => {
    setIsAuthed(true)
    loadData()
  }

  const handlePasswordResetRequired = () => {
    setNeedsPasswordReset(true)
  }

  const handlePasswordResetComplete = () => {
    setNeedsPasswordReset(false)
    loadData()
  }

  const handleOnboardingComplete = async (bpData) => {
    if (bpData?.systolic && bpData?.diastolic) {
      const entry = await saveBpEntry({
        systolic: parseInt(bpData.systolic),
        diastolic: parseInt(bpData.diastolic),
        pulse: bpData.pulse ? parseInt(bpData.pulse) : null,
        context: bpData.context || [],
        notes: '',
        medicationTaken: bpData.medicationTaken || false,
      })
      setBpEntries(prev => [entry, ...prev])
    }
    markOnboardingComplete()
    setShowOnboarding(false)
  }

  const handleSaveBp = async (data) => {
    const entry = await saveBpEntry(data)
    setBpEntries(prev => [entry, ...prev])
  }

  const handleDeleteBp = async (id) => {
    await deleteBpEntry(id)
    setBpEntries(prev => prev.filter(e => e.id !== id))
  }

  const handleSaveWeight = async (data) => {
    const entry = await saveWeightEntry(data)
    setWeightEntries(prev => [entry, ...prev])
  }

  const handleDeleteWeight = async (id) => {
    await deleteWeightEntry(id)
    setWeightEntries(prev => prev.filter(e => e.id !== id))
  }

  const handleLogout = async () => {
    await logout()
    setIsAuthed(false)
  }

  if (!isAuthed) {
    return <AuthScreen onAuth={handleAuth} onPasswordResetRequired={handlePasswordResetRequired} />
  }

  if (needsPasswordReset) {
    return <PasswordResetScreen onComplete={handlePasswordResetComplete} />
  }

  if (loading) {
    return (
      <div className="app loading">
        <div className="loading-spinner">
          <Heart size={32} className="pulse" />
          <p>Loading your data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <Droplets size={22} />
          <span>BP Tracker</span>
        </div>
        <nav className="tab-nav">
          {TABS.map(t => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'dashboard' && <Activity size={15} />}
              {t === 'log' && <Clock size={15} />}
              {t === 'summary' && <Calendar size={15} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button className="tab-btn logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={15} />
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="app-content">
        {tab === 'dashboard' && (
          <Dashboard
            bpEntries={bpEntries}
            weightEntries={weightEntries}
            onBpEntry={() => setShowBpModal(true)}
            onWeightEntry={() => setShowWeightModal(true)}
          />
        )}
        {tab === 'log' && (
          <HistoryLog
            bpEntries={bpEntries}
            weightEntries={weightEntries}
            onDeleteBp={handleDeleteBp}
            onDeleteWeight={handleDeleteWeight}
          />
        )}
        {tab === 'summary' && (
          <WeeklySummary bpEntries={bpEntries} weightEntries={weightEntries} />
        )}
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => setShowBpModal(true)}>
        <Plus size={24} />
      </button>

      {/* Modals */}
      {showBpModal && (
        <BPEntryModal
          onClose={() => setShowBpModal(false)}
          onSave={handleSaveBp}
        />
      )}
      {showWeightModal && (
        <WeightEntryModal
          onClose={() => setShowWeightModal(false)}
          onSave={handleSaveWeight}
        />
      )}

      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}
    </div>
  )
}

export default App
