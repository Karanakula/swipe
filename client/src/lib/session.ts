const KEY = "swipe_session_id_v1";

export function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length > 10) return existing;
  } catch {
    // ignore
  }
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // ignore
  }
  return id;
}
