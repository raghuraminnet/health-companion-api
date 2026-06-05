import { format, formatDistanceToNow, isToday, isYesterday, startOfWeek, endOfWeek, eachDayOfInterval, subDays, isSameDay } from 'date-fns'

export function formatDate(isoString) {
  const d = new Date(isoString)
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday, ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, h:mm a')
}

export function formatShortDate(isoString) {
  return format(new Date(isoString), 'MMM d')
}

export function formatDayOfWeek(isoString) {
  return format(new Date(isoString), 'EEE')
}

export function formatTime(isoString) {
  return format(new Date(isoString), 'h:mm a')
}

export function relativeTime(isoString) {
  return formatDistanceToNow(new Date(isoString), { addSuffix: true })
}

export function getWeekRange(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return { start, end }
}

export function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    days.push(subDays(new Date(), i))
  }
  return days
}

export function isSameDayJS(d1, d2) {
  return isSameDay(new Date(d1), new Date(d2))
}
