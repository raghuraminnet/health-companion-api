# BP Tracker — Health Companion

A lightweight health companion app for tracking blood pressure, weight, and weekly health trends.

## Features

### 🔴 Blood Pressure Tracking
- Log systolic, diastolic, and pulse readings
- **Smart context tags** — tag readings with situations like "After Coffee", "Post Walk", "Stressed", "Morning", etc.
- AHA-based BP category classification (Normal → Hypertensive Crisis)
- **Heart Health Score** (1–100) calculated from your latest reading

### ⚖️ Weight Tracking
- Log weight readings with optional notes
- 7-day weight trend with change indicator

### 📊 Weekly Summary
- Average BP for the week vs. previous week
- Most common context tags
- Daily breakdown grid
- AI-style insights (e.g., "Your BP is in the high range this week")

### 📋 History Log
- Unified log of all BP and weight entries
- Filter by type (All / BP / Weight)
- Delete entries

## Tech Stack

- **React 19** + Vite
- **Chart.js** + **react-chartjs-2** for trend charts
- **date-fns** for date handling
- **lucide-react** for icons
- **localStorage** for persistence (no backend needed)

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
