"use client";

import ky, { type KyInstance } from "ky";
import { RefreshSessionUseCase } from "@/features/auth/application/use-cases/refresh-session.use-case";
import { BrowserAuthCookieStoreAdapter } from "@/features/auth/infrastructure/adapters/browser-auth-cookie-store.adapter";
import { FetchAuthApiAdapter } from "@/features/auth/infrastructure/adapters/fetch-auth-api.adapter";
import { env } from "./env.client";

/**
 * Composition root para o HTTP client do browser. Leituras de token e
 * rotação de refresh passam pelas auth ports; este módulo apenas as conecta
 * ao ky.
 */
const cookieStore = new BrowserAuthCookieStoreAdapter();
const refreshSession = new RefreshSessionUseCase(
  new FetchAuthApiAdapter(env.NEXT_PUBLIC_API_URL),
  cookieStore,
);

/** Refresh em andamento, para que 401s concorrentes disparem exatamente uma rotação. */
let refreshing: Promise<string | null> | null = null;

export const apiClient: KyInstance = ky.create({
  prefixUrl: env.NEXT_PUBLIC_API_URL,
  credentials: "include",
  hooks: {
    beforeRequest: [
      async (request) => {
        const token = await cookieStore.getAccessToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) return response;
        if (!refreshing) {
          refreshing = refreshSession
            .execute()
            .finally(() => (refreshing = null));
        }
        const token = await refreshing;
        if (!token) return response;
        request.headers.set("Authorization", `Bearer ${token}`);
        return ky(request);
      },
    ],
  },
});
