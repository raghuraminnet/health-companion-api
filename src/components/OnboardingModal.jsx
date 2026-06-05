import { useState } from 'react'
import { Heart, Activity, TrendingUp, ChevronRight, ChevronLeft, Plus, Droplets } from 'lucide-react'
import { format } from 'date-fns'
import { getBpCategory, BP_CONTEXT_TAGS } from '../utils/bp'
import './OnboardingModal.css'

const STORAGE_KEY = 'bp_onboarded'

export function markOnboardingComplete() {
  localStorage.setItem(STORAGE_KEY, '1')
}

export function hasOnboarded() {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

const TOTAL_STEPS = 3

export default function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(1)
  const [bpData, setBpData] = useState({ systolic: '', diastolic: '', pulse: '', context: [], medicationTaken: false })
  const [tagSelection, setTagSelection] = useState({})
  const [errors, setErrors] = useState({})

  const toggleTag = (tagId) => {
    setTagSelection(prev => ({ ...prev, [tagId]: !prev[tagId] }))
  }

  const validateStep2 = () => {
    const s = parseInt(bpData.systolic)
    const d = parseInt(bpData.diastolic)
    const errs = {}
    if (!s || s < 60 || s > 300) errs.systolic = 'Enter a value between 60–300'
    if (!d || d < 40 || d > 200) errs.diastolic = 'Enter a value between 40–200'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (step === 2 && !validateStep2()) return
    if (step < TOTAL_STEPS) setStep(step + 1)
    else onComplete({ ...bpData, context: selectedTags })
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSkip = () => {
    onComplete({ ...bpData, context: selectedTags })
  }

  const selectedTags = Object.entries(tagSelection).filter(([, v]) => v).map(([id]) => id)

  const category = parseInt(bpData.systolic) && parseInt(bpData.diastolic)
    ? getBpCategory(parseInt(bpData.systolic), parseInt(bpData.diastolic))
    : null

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Progress dots */}
        <div className="onboarding-progress">
          {[1, 2, 3].map(s => (
            <div key={s} className={`progress-dot ${s === step ? 'active' : s < step ? 'done' : ''}`} />
          ))}
        </div>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div className="onboarding-step">
            <div className="step-icon-wrap">
              <Heart size={40} />
            </div>
            <h1>Meet BP Tracker</h1>
            <p className="step-subtitle">Your personal heart health companion</p>
            <div className="benefit-list">
              <div className="benefit-item">
                <Activity size={18} />
                <span>Track your blood pressure and pulse daily</span>
              </div>
              <div className="benefit-item">
                <TrendingUp size={18} />
                <span>See trends and weekly insights</span>
              </div>
              <div className="benefit-item">
                <Droplets size={18} />
                <span>Understand what affects your reading</span>
              </div>
            </div>
            <p className="step-note">Takes less than 30 seconds to log a reading</p>
          </div>
        )}

        {/* Step 2 — First Reading */}
        {step === 2 && (
          <div className="onboarding-step">
            <h2>Log your first reading</h2>
            <p className="step-subtitle">Enter today's blood pressure (optional)</p>

            <div className="bp-quick-inputs">
              <div className={`bp-field ${errors.systolic ? 'has-error' : ''}`}>
                <label>Systolic</label>
                <input
                  type="number"
                  value={bpData.systolic}
                  onChange={e => setBpData(p => ({ ...p, systolic: e.target.value }))}
                  placeholder="120"
                  min="60"
                  max="300"
                />
                <span className="unit">mmHg</span>
                {errors.systolic && <span className="field-error">{errors.systolic}</span>}
              </div>
              <div className="bp-divider">/</div>
              <div className={`bp-field ${errors.diastolic ? 'has-error' : ''}`}>
                <label>Diastolic</label>
                <input
                  type="number"
                  value={bpData.diastolic}
                  onChange={e => setBpData(p => ({ ...p, diastolic: e.target.value }))}
                  placeholder="80"
                  min="40"
                  max="200"
                />
                <span className="unit">mmHg</span>
                {errors.diastolic && <span className="field-error">{errors.diastolic}</span>}
              </div>
            </div>

            {category && (
              <div className="bp-category-preview" style={{ borderColor: category.color, color: category.color }}>
                {category.label}
              </div>
            )}

            <div className="context-preview">
              <p className="context-label">Any context? (tap to select)</p>
              <div className="tag-grid">
                {BP_CONTEXT_TAGS.slice(0, 9).map(tag => (
                  <button
                    key={tag.id}
                    className={`tag-chip ${tagSelection[tag.id] ? 'selected' : ''}`}
                    onClick={() => toggleTag(tag.id)}
                    type="button"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — You're set */}
        {step === 3 && (
          <div className="onboarding-step">
            <div className="step-icon-wrap done-icon">
              <Heart size={40} />
            </div>
            <h2>You're all set!</h2>
            <p className="step-subtitle">
              {bpData.systolic
                ? `Your reading of ${bpData.systolic}/${bpData.diastolic} mmHg has been saved.`
                : 'Your dashboard is ready to go.'}
            </p>

            <div className="dashboard-preview">
              <div className="preview-stat">
                <span className="preview-label">Heart Health Score</span>
                <span className="preview-value" style={{ color: 'var(--green)' }}>85</span>
              </div>
              <div className="preview-stat">
                <span className="preview-label">Readings logged</span>
                <span className="preview-value">{bpData.systolic ? '1' : '0'}</span>
              </div>
              <div className="preview-stat">
                <span className="preview-label">Weekly trend</span>
                <span className="preview-value" style={{ color: 'var(--amber)' }}>—</span>
              </div>
            </div>

            <div className="tips-list">
              <p className="tips-title">Tips for accurate readings:</p>
              <div className="tip-item">☕ Avoid caffeine 30 min before</div>
              <div className="tip-item">🪑 Sit quietly for 5 minutes first</div>
              <div className="tip-item">💊 Take at the same time daily</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="onboarding-nav">
          {step > 1 ? (
            <button className="nav-btn back" onClick={handleBack}>
              <ChevronLeft size={18} /> Back
            </button>
          ) : (
            <button className="nav-btn skip" onClick={handleSkip}>Skip</button>
          )}

          <div className="step-counter">{step} / {TOTAL_STEPS}</div>

          <button className="nav-btn next primary" onClick={handleNext}>
            {step === TOTAL_STEPS ? 'Go to Dashboard' : 'Continue'} <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
