const REMINDER_SHOWN_KEY = 'runningPlan.reminderShown'
const REMINDERS_ENABLED_KEY = 'runningPlan.remindersEnabled'

export function getRemindersEnabled(): boolean {
  try {
    const raw = localStorage.getItem(REMINDERS_ENABLED_KEY)
    if (raw === null) return true // default on
    return raw === 'true'
  } catch {
    return true
  }
}

export function setRemindersEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(REMINDERS_ENABLED_KEY, String(enabled))
  } catch {
    // ignore
  }
}

export function getReminderShownToday(): boolean {
  try {
    const raw = localStorage.getItem(REMINDER_SHOWN_KEY)
    if (!raw) return false
    const date = new Date().toISOString().slice(0, 10)
    return raw === date
  } catch {
    return false
  }
}

export function setReminderShownToday(): void {
  const date = new Date().toISOString().slice(0, 10)
  localStorage.setItem(REMINDER_SHOWN_KEY, date)
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const perm = await Notification.requestPermission()
  return perm
}

export function showWorkoutReminder(workoutType: string): void {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted')
    return
  if (!getRemindersEnabled()) return
  if (getReminderShownToday()) return
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? ''
  new Notification('Running Plan', {
    body: `You have a ${workoutType} run scheduled for today. Tap to open.`,
    icon: `${base}pwa-icon.svg`,
    tag: 'workout-reminder',
  })
  setReminderShownToday()
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Send a test notification so the user can verify it works. */
export function sendTestNotification(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? ''
  new Notification('Running Plan', {
    body: 'Workout reminders are working! You’ll see this when you open the app with a run scheduled for today.',
    icon: `${base}pwa-icon.svg`,
    tag: 'test-reminder',
  })
}
