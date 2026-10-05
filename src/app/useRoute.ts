// Điều hướng đơn giản bằng hash để chạy SPA tĩnh, không cần máy chủ route.
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'library' }
  | { name: 'editor'; setId: string }
  | { name: 'setup' }
  | { name: 'stage'; sessionId: string }
  | { name: 'results'; sessionId: string }
  | { name: 'help' };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'library' };
  switch (parts[0]) {
    case 'set':
      return parts[1] ? { name: 'editor', setId: parts[1] } : { name: 'library' };
    case 'setup':
      return { name: 'setup' };
    case 'play':
      return parts[1] ? { name: 'stage', sessionId: parts[1] } : { name: 'setup' };
    case 'results':
      return parts[1] ? { name: 'results', sessionId: parts[1] } : { name: 'library' };
    case 'help':
      return { name: 'help' };
    default:
      return { name: 'library' };
  }
}

export function navigate(path: string): void {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
