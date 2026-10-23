// A background read may apply only if no local write started or finished since it began.
export function createRefreshGuard() {
  let revision = 0, pending = 0;
  return {
    capture() {
      const current = ++revision;
      return () => pending === 0 && current === revision;
    },
    async mutate(operation) {
      revision++; pending++;
      try { return await operation(); }
      finally { pending--; revision++; }
    },
  };
}
