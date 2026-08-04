/**
 * Terminal navigation out of an auth flow. Every method returns `never`:
 * implementations MUST NOT return normally, mirroring Next.js `redirect()`,
 * which throws. Callers may therefore treat a call as the end of the flow.
 */
export interface AuthNavigationPort {
  dashboard(): never;
  login(error?: string): never;
  register(error?: string): never;
}
