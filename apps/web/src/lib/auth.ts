'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';

const REFRESH_COOKIE = 'refresh_token';

export async function setRefreshTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: REFRESH_COOKIE,
    value: token,
    httpOnly: true,
    secure: env.WEB_ORIGIN.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearRefreshTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(REFRESH_COOKIE);
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));

  const res = await fetch(`${env.API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/login?error=${encodeURIComponent(body.message ?? 'login_failed')}`);
  }

  const data = await res.json();
  await setRefreshTokenCookie(data.refreshToken);
  redirect('/dashboard');
}

export async function registerAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));
  const name = String(formData.get('name'));

  const res = await fetch(`${env.API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/register?error=${encodeURIComponent(body.message ?? 'register_failed')}`);
  }

  const data = await res.json();
  await setRefreshTokenCookie(data.refreshToken);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await clearRefreshTokenCookie();
  redirect('/login');
}
