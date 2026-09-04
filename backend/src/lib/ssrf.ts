import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Guards outbound fetches that take their URL from a user.
 *
 * The link unfurler is the only such endpoint: a workspace member hands the
 * server a URL and the server fetches it. Without this, that is a request
 * forgery primitive — `http://169.254.169.254/latest/meta-data/` reaches the
 * cloud metadata service from most hosts, `http://127.0.0.1:5432` reaches
 * whatever else runs on the box, and internal hostnames resolve on the server's
 * network rather than the caller's.
 *
 * What this closes: literal private/loopback/link-local addresses, and public
 * hostnames whose DNS records point at them (the usual way of dressing up the
 * first case). Callers must also refuse redirects, since a permitted host can
 * still answer `302 http://169.254.169.254/` — see `unfurl.controller.ts`.
 *
 * What it does not close: DNS rebinding. The name is resolved here and resolved
 * again by `fetch`, so a record with a one-second TTL can answer differently
 * the second time. Closing that properly means connecting to the validated IP
 * ourselves and carrying the hostname in the `Host` header, which breaks TLS
 * certificate validation unless the socket is built by hand. For an unfurler
 * that returns only og:title/description/image, the residual risk is a blind
 * request with no response read back to the caller, so the trade is deliberate.
 */

const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // RFC1918 private
  ['100.64.0.0', 10], // RFC6598 carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local — cloud metadata lives here
  ['172.16.0.0', 12], // RFC1918 private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // RFC1918 private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, includes 255.255.255.255
];

const toInt = (ip: string): number =>
  ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;

const isBlockedV4 = (ip: string): boolean => {
  const value = toInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (toInt(base) & mask);
  });
};

const isBlockedV6 = (ip: string): boolean => {
  const address = ip.toLowerCase().split('%')[0]; // drop any zone index

  // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible forms smuggle a v4
  // address through a v6 literal, so unwrap and re-check them as v4.
  const mapped = address.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);

  if (address === '::' || address === '::1') return true; // unspecified, loopback
  if (/^f[cd]/.test(address)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(address)) return true; // fe80::/10 link-local
  if (/^ff/.test(address)) return true; // ff00::/8 multicast
  if (address.startsWith('2001:db8:')) return true; // documentation
  return false;
};

const isBlockedAddress = (ip: string): boolean =>
  isIP(ip) === 6 ? isBlockedV6(ip) : isBlockedV4(ip);

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

/**
 * Throws `BlockedUrlError` unless `raw` is an http(s) URL on a publicly
 * routable host. Returns the parsed URL so callers do not parse it twice.
 */
export const assertPublicHttpUrl = async (raw: string): Promise<URL> => {
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw new BlockedUrlError('Invalid URL format');
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new BlockedUrlError('Only http and https protocols are supported');
  }

  const hostname = target.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // A literal address needs no DNS round trip, and must not get one — resolving
  // it would be a no-op that only widens the window for the check to go stale.
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new BlockedUrlError('URL resolves to a non-public address');
    }
    return target;
  }

  let resolved: Array<{ address: string }>;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedUrlError('Could not resolve host');
  }

  // Every answer has to be public. A name that resolves to one public and one
  // private address is still a way in, since which one gets connected to is not
  // ours to decide.
  if (resolved.length === 0 || resolved.some((entry) => isBlockedAddress(entry.address))) {
    throw new BlockedUrlError('URL resolves to a non-public address');
  }

  return target;
};
