type HeaderChrome = {
  query: string;
  addOpen: boolean;
};

const EMPTY: HeaderChrome = { query: "", addOpen: false };
const listeners = new Set<() => void>();
let snapshot: HeaderChrome = EMPTY;

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: HeaderChrome) {
  if (snapshot.query === next.query && snapshot.addOpen === next.addOpen) return;
  snapshot = next;
  emit();
}

export function subscribeHeaderChrome(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHeaderChrome(): HeaderChrome {
  return snapshot;
}

export function getHeaderChromeServer(): HeaderChrome {
  return EMPTY;
}

export function setHeaderQuery(next: string) {
  commit({ query: next, addOpen: snapshot.addOpen });
}

export function setHeaderAdd(next: boolean) {
  commit({ query: snapshot.query, addOpen: next });
}

export function readHeaderChromeFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/") return;
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  commit({
    query: q ?? snapshot.query,
    addOpen: params.get("add") === "1" ? true : snapshot.addOpen,
  });
}
