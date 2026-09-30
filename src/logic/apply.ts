/** Apply a multi-path update to a plain object (in-memory database). Used by tests and bots. */
export function applyUpdates(db: Record<string, any>, updates: Record<string, unknown>): void {
  for (const [path, value] of Object.entries(updates)) setPath(db, path.split('/'), value);
}

function setPath(obj: Record<string, any>, keys: string[], value: unknown) {
  const [head, ...rest] = keys;
  if (!rest.length) {
    if (value === null || value === undefined) delete obj[head];
    else obj[head] = clone(value);
    return;
  }
  if (typeof obj[head] !== 'object' || obj[head] === null) {
    if (value === null) return;
    obj[head] = {};
  }
  setPath(obj[head], rest, value);
  if (Object.keys(obj[head]).length === 0) delete obj[head];
}

function clone<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}
