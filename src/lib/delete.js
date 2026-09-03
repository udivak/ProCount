export function foodUndoTarget(result) {
  if (result?.entry?.skipped) return null;
  const id = result?.entry?.data?.id || result?.data?.id;
  return id ? { id } : null;
}

export async function reconcileDeletedRow({ snapshot, remove, restore, deleteRemote, findById }) {
  if (!snapshot?.id) return { data: null, error: new Error("missing_entry") };
  remove(snapshot.id);

  let deleted;
  try {
    deleted = await deleteRemote(snapshot.id);
  } catch (error) {
    deleted = { data: null, error };
  }
  if (deleted?.data && !deleted.error) return { data: deleted.data, error: null };

  let lookup;
  try {
    lookup = await findById(snapshot.id);
  } catch (error) {
    lookup = { data: null, error };
  }
  if (!lookup?.error && !lookup?.data) return { data: snapshot, error: null };

  restore(snapshot);
  return { data: null, error: lookup?.error || deleted?.error || new Error("delete_unconfirmed") };
}
