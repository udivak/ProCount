export async function withSubmissionLock(lock, operation) {
  if (lock.current) return;
  lock.current = true;
  try {
    return await operation();
  } finally {
    lock.current = false;
  }
}
