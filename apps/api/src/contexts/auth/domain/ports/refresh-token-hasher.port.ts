export interface RefreshTokenHasherPort {
  hash(raw: string): string;
}
