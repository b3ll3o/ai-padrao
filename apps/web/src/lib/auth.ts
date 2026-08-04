'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginInputSchema, RegisterInputSchema } from '@ai-padrao/contracts';
import { env } from './env.server';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;

async function setRefreshTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: REFRESH_COOKIE,
    value: token,
    httpOnly: false,
    secure: env.WEB_ORIGIN.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

async function setAccessTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ACCESS_COOKIE,
    value: token,
    httpOnly: false,
    secure: env.WEB_ORIGIN.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(REFRESH_COOKIE);
  cookieStore.delete(ACCESS_COOKIE);
}

async function readRefreshTokenCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE)?.value;
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = LoginInputSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent('invalid_input')}`);
  }

  const res = await fetch(`${env.API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/login?error=${encodeURIComponent(body.message ?? 'login_failed')}`);
  }

  const data = await res.json();
  await setRefreshTokenCookie(data.refreshToken);
  await setAccessTokenCookie(data.accessToken);
  redirect('/dashboard');
}

export async function registerAction(formData: FormData): Promise<void> {
  const parsed = RegisterInputSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    redirect(`/register?error=${encodeURIComponent('invalid_input')}`);
  }

  const res = await fetch(`${env.API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/register?error=${encodeURIComponent(body.message ?? 'register_failed')}`);
  }

  const data = await res.json();
  await setRefreshTokenCookie(data.refreshToken);
  await setAccessTokenCookie(data.accessToken);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const refreshToken = await readRefreshTokenCookie();
  if (refreshToken) {
    await fetch(`${env.API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      // Best-effort: even if revoke fails, clear local cookies so the user is logged out.
    });
  }
  await clearAuthCookies();
  redirect('/login');
}
