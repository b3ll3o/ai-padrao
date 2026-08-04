/**
 * Parse the shorthand TTL strings used in config (e.g. "15m", "7d")
 * into milliseconds. Throws on unknown formats so misconfiguration
 * surfaces at boot rather than at first request.
 */
export function parseTtlToMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid TTL: ${ttl}`);
  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const ms: number = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }[unit];
  return value * ms;
}
