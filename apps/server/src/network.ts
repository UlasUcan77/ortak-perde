import os from 'node:os';

function isPrivateIpv4(ip: string): boolean {
  return ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

/**
 * Best guess of this machine's address on the local network (IPv4, non-internal).
 * Private ranges are preferred; typical virtual adapters (WSL, Docker, VirtualBox) are skipped.
 */
export function getLanIp(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
): string | null {
  const candidates: { ip: string; score: number }[] = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const iface of list ?? []) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      if (iface.address.startsWith('169.254.')) continue;
      const virtual = /docker|veth|br-|vbox|vmnet|wsl|vethernet|virtual|utun|tailscale|zt/i.test(
        name,
      );
      let score = 0;
      if (iface.address.startsWith('192.168.')) score += 3;
      else if (iface.address.startsWith('10.')) score += 2;
      else if (isPrivateIpv4(iface.address)) score += 1;
      if (virtual) score -= 5;
      candidates.push({ ip: iface.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.ip ?? null;
}
