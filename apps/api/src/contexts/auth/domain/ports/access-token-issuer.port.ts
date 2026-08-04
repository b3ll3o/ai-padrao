export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AccessTokenIssuerPort {
  sign(payload: AccessTokenPayload, ttl: string): Promise<string>;
}
