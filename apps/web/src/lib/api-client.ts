'use client';

import ky, { type KyInstance } from 'ky';
import { env } from './env.client';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = readCookie(REFRESH_COOKIE);
  if (!refreshToken) return null;

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.accessToken) writeCookie(ACCESS_COOKIE, data.accessToken, REFRESH_TTL_SECONDS);
  if (data.refreshToken) writeCookie(REFRESH_COOKIE, data.refreshToken, REFRESH_TTL_SECONDS);
  return data.accessToken ?? null;
}

export const apiClient: KyInstance = ky.create({
  prefixUrl: env.NEXT_PUBLIC_API_URL,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      (request) => {
        const token = readCookie(ACCESS_COOKIE);
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) return response;
        if (!refreshing) refreshing = refreshAccessToken().finally(() => (refreshing = null));
        const token = await refreshing;
        if (!token) return response;
        request.headers.set('Authorization', `Bearer ${token}`);
        return ky(request);
      },
    ],
  },
});
