import { useEffect, useState } from 'preact/hooks';

export interface Route {
  name: 'home' | 'new' | 'room';
  code?: string;
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const [path, query] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query ?? '');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'new') return { name: 'new', params };
  if (parts[0] === 'r' && parts[1]) return { name: 'room', code: parts[1].toUpperCase(), params };
  return { name: 'home', params };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = path;
}

/** Shareable join link for a room. */
export function joinLink(code: string): string {
  return `${location.origin}${location.pathname}#/r/${code}`;
}

export function hostLink(code: string, key: string): string {
  return `${location.origin}${location.pathname}#/r/${code}?host=${key}`;
}
