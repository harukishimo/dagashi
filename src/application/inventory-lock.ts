let pending = Promise.resolve();

/** Serializes checkout and bulk stocktakes within one server instance. */
export async function withInventoryLock<T>(task: () => Promise<T>): Promise<T> {
  const previous = pending;
  let release!: () => void;
  pending = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await task(); } finally { release(); }
}
