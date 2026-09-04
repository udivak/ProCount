// Captures a revision that becomes stale when the next request starts.
export function captureRequestRevision(revision) {
  const current = ++revision.current;
  return () => revision.current === current;
}

export function capturePhotoRequest(revision, file, guidance) {
  return { isCurrent: captureRequestRevision(revision), file, guidance: guidance.trim() };
}

export function captureFoodEstimateRequest(revision, foodName, unit) {
  return {
    isCurrent: captureRequestRevision(revision),
    foodName: String(foodName ?? "").trim(),
    unit: String(unit ?? "").trim(),
  };
}

export function acquireRequestLock(lock) {
  if (lock.current) return null;
  const token = {};
  lock.current = token;
  return token;
}

export function clearRequestLock(lock) {
  lock.current = null;
}

export function releaseRequestLock(lock, token) {
  if (lock.current === token) lock.current = null;
}
