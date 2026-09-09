/**
 * Navegação terminal a partir de um auth flow. Cada método retorna `never`:
 * as implementações NÃO DEVEM retornar normalmente, espelhando o `redirect()`
 * do Next.js, que lança. Os chamadores podem portanto tratar uma chamada como
 * o fim do fluxo.
 */
export interface AuthNavigationPort {
  dashboard(): never;
  login(error?: string): never;
  register(error?: string): never;
}
