/* Web stub — notifications are native-only. Keeps the web bundle building. */
export async function scheduleReminders(): Promise<{ ok: boolean; reason?: string; count?: number }> {
  return { ok: false, reason: 'unsupported' };
}
export async function cancelReminders(): Promise<void> { /* no-op */ }
export async function sendTestReminder(): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: 'unsupported' };
}
