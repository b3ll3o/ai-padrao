import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ai-padrao/ui';
import { env } from '@/lib/env.server';
import { logoutAction } from '@/lib/auth';

async function fetchMe(): Promise<{ id: string; email: string; role: string } | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;
  if (!refreshToken) return null;
  const refreshRes = await fetch(`${env.API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!refreshRes.ok) return null;
  const { accessToken } = await refreshRes.json();
  const meRes = await fetch(`${env.API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!meRes.ok) return null;
  return meRes.json();
}

export default async function DashboardPage() {
  const me = await fetchMe();
  if (!me) redirect('/login');

  return (
    <main className="container py-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Welcome, {me.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Role: {me.role}</p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">Sign out</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
