/** Hostnames a phone on the network can never reach. */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '::1' ||
    h === '0.0.0.0' ||
    /^127(\.\d{1,3}){3}$/.test(h)
  );
}

function parseUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export interface JoinBaseInput {
  /** PUBLIC_URL env var, if configured. */
  publicUrl?: string | null;
  /** The server's LAN IPv4 address, if one was detected. */
  lanIp?: string | null;
  /** window.location.origin of the host screen. */
  origin?: string | null;
}

/**
 * Picks the base URL that goes into the QR code. Priority:
 * 1. PUBLIC_URL
 * 2. If the host screen was opened via a loopback address (localhost): the LAN IP with the
 *    same protocol and port the host screen uses (this is the dev-server port in development)
 * 3. The host screen's own origin, as long as it is not a loopback address
 * Returns null when no phone-reachable address can be determined — localhost is never returned.
 */
export function resolveJoinBase({ publicUrl, lanIp, origin }: JoinBaseInput): string | null {
  const pub = parseUrl(publicUrl);
  if (pub && !isLoopbackHost(pub.hostname)) {
    return `${pub.origin}${pub.pathname.replace(/\/+$/, '')}`;
  }

  const org = parseUrl(origin);
  if (org && !isLoopbackHost(org.hostname)) {
    return org.origin;
  }

  if (lanIp && !isLoopbackHost(lanIp)) {
    const protocol = org?.protocol ?? 'http:';
    const port = org?.port ? `:${org.port}` : '';
    return `${protocol}//${lanIp}${port}`;
  }

  return null;
}

export function buildJoinUrl(base: string | null, code: string): string | null {
  return base ? `${base}/join/${code}` : null;
}

/** "https://perde.example.com/join/ABCD" → "perde.example.com/join" (for the manual-entry hint). */
export function displayJoinHint(base: string | null): string | null {
  if (!base) return null;
  return `${base.replace(/^https?:\/\//, '')}/join`;
}
