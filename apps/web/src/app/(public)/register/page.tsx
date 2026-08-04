import { RegisterForm } from '@/components/register-form';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <RegisterForm error={error} />
    </main>
  );
}
