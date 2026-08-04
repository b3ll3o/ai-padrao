"use server";

import { LoginUseCase } from "@/features/auth/application/use-cases/login.use-case";
import { LogoutUseCase } from "@/features/auth/application/use-cases/logout.use-case";
import { RegisterUseCase } from "@/features/auth/application/use-cases/register.use-case";
import { FetchAuthApiAdapter } from "@/features/auth/infrastructure/adapters/fetch-auth-api.adapter";
import { NextAuthCookieStoreAdapter } from "@/features/auth/infrastructure/adapters/next-auth-cookie-store.adapter";
import { NextAuthNavigationAdapter } from "@/features/auth/infrastructure/adapters/next-auth-navigation.adapter";
import { env } from "./env.server";

/**
 * Composition root for the server-side auth flows: builds the adapters and
 * hands them to the use cases. Everything below the ports stays framework-free.
 */
function buildAuthDependencies() {
  return {
    api: new FetchAuthApiAdapter(env.API_URL),
    cookies: new NextAuthCookieStoreAdapter({
      secure: env.WEB_ORIGIN.startsWith("https"),
    }),
    navigation: new NextAuthNavigationAdapter(),
  };
}

export async function loginAction(formData: FormData): Promise<void> {
  const { api, cookies, navigation } = buildAuthDependencies();
  return new LoginUseCase(api, cookies, navigation).execute({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function registerAction(formData: FormData): Promise<void> {
  const { api, cookies, navigation } = buildAuthDependencies();
  return new RegisterUseCase(api, cookies, navigation).execute({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
}

export async function logoutAction(): Promise<void> {
  const { api, cookies, navigation } = buildAuthDependencies();
  return new LogoutUseCase(api, cookies, navigation).execute();
}
