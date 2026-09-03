// Captures a revision that becomes stale when the next request starts.
export function captureRequestRevision(revision) {
  const current = ++revision.current;
  return () => revision.current === current;
}
