// AHA Blood Pressure Categories
export function getBpCategory(systolic, diastolic) {
  if (systolic >= 180 || diastolic >= 120) return { label: 'Hypertensive Crisis', color: '#ef4444', severity: 4 }
  if (systolic >= 140 || diastolic >= 90) return { label: 'High BP Stage 2', color: '#f97316', severity: 3 }
  if (systolic >= 130 || diastolic >= 80) return { label: 'High BP Stage 1', color: '#f59e0b', severity: 2 }
  if (systolic >= 120 && diastolic < 80) return { label: 'Elevated', color: '#eab308', severity: 1 }
  if (systolic < 120 && diastolic < 80) return { label: 'Normal', color: '#10b981', severity: 0 }
  return { label: 'Low', color: '#0ea5e9', severity: -1 }
}

// Heart Health Score (1-100)
export function calcHeartScore(systolic, diastolic, pulse) {
  let score = 100
  const cat = getBpCategory(systolic, diastolic).severity
  if (cat === 4) score -= 60
  else if (cat === 3) score -= 40
  else if (cat === 2) score -= 25
  else if (cat === 1) score -= 10

  if (pulse) {
    if (pulse < 50) score -= 10
    else if (pulse > 100) score -= 10
    else if (pulse > 80) score -= 5
  }

  return Math.max(1, Math.min(100, score))
}

export function getScoreLabel(score) {
  if (score >= 85) return { label: 'Excellent', color: '#10b981' }
  if (score >= 65) return { label: 'Good', color: '#84cc16' }
  if (score >= 45) return { label: 'Fair', color: '#f59e0b' }
  if (score >= 25) return { label: 'Poor', color: '#f97316' }
  return { label: 'Critical', color: '#ef4444' }
}

// BP Context Tags
export const BP_CONTEXT_TAGS = [
  { id: 'morning', label: '🌅 Morning', group: 'time' },
  { id: 'afternoon', label: '☀️ Afternoon', group: 'time' },
  { id: 'evening', label: '🌙 Evening', group: 'time' },
  { id: 'after-coffee', label: '☕ After Coffee', group: 'stimulant' },
  { id: 'after-alcohol', label: '🍷 After Alcohol', group: 'stimulant' },
  { id: 'before-meal', label: '🍽️ Before Meal', group: 'meal' },
  { id: 'after-meal', label: '🍽️ After Meal', group: 'meal' },
  { id: 'post-walk', label: '🚶 Post Walk', group: 'activity' },
  { id: 'post-exercise', label: '🏃 Post Exercise', group: 'activity' },
  { id: 'resting', label: '😌 Resting', group: 'activity' },
  { id: 'stressed', label: '😰 Stressed', group: 'emotion' },
  { id: 'relaxed', label: '😌 Relaxed', group: 'emotion' },
  { id: 'after-medication', label: '💊 After Medication', group: 'medication' },
  { id: 'before-medication', label: '💊 Before Medication', group: 'medication' },
  { id: 'fasting', label: '🍽️ Fasting', group: 'meal' },
]

export function getContextTag(id) {
  return BP_CONTEXT_TAGS.find(t => t.id === id)
}

export function groupContextTags(tags) {
  const groups = {}
  tags.forEach(id => {
    const tag = getContextTag(id)
    if (tag) {
      if (!groups[tag.group]) groups[tag.group] = []
      groups[tag.group].push(tag)
    }
  })
  return groups
}
