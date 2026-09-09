/**
 * Lançado pelas implementações de `AuthApiPort` quando a auth API responde com
 * uma resposta não-OK. `apiMessage` carrega o campo `message` do corpo do erro
 * quando a API forneceu um, para que a camada de aplicação possa exibi-lo
 * literalmente e recorrer ao seu próprio código quando ele estiver ausente.
 */
export class AuthFlowError extends Error {
  readonly apiMessage?: string;

  constructor(apiMessage?: string) {
    super(apiMessage ?? "auth_flow_failed");
    this.name = "AuthFlowError";
    this.apiMessage = apiMessage;
  }
}
