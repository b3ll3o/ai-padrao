'use client';

import ky, { type KyInstance } from 'ky';
import { env } from './env';

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = document.cookie.match(/refresh_token=([^;]+)/)?.[1];
  if (!refreshToken) return null;

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = await res.json();
  sessionStorage.setItem('access_token', data.accessToken);
  return data.accessToken;
}

export const apiClient: KyInstance = ky.create({
  prefixUrl: env.NEXT_PUBLIC_API_URL,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      (request) => {
        const token = sessionStorage.getItem('access_token');
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
