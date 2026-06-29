import os from "os";

/** First non-internal IPv4 on this machine (for sharing dev URLs on the LAN). */
export function getLanIPv4(): string | undefined {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    if (!ifaces) continue;
    for (const net of ifaces) {
      const family = net.family as string | number;
      const isIPv4 = family === "IPv4" || family === 4;
      if (isIPv4 && !net.internal) return net.address;
    }
  }
  return undefined;
}
