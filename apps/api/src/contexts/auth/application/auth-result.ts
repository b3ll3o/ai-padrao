export interface AuthResult {
  user: { id: string; email: string; name: string; role: string };
  accessToken: string;
  refreshToken: string;
}
