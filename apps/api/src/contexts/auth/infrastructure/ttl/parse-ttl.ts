/**
 * Faz o parse das strings de TTL resumidas usadas na config (ex.: "15m", "7d")
 * para milissegundos. Lança erro em formatos desconhecidos para que a
 * má configuração apareça no boot, e não na primeira request.
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
