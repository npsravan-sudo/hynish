import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate } from 'react-router-dom';
import { LogIn, ShieldCheck, TrendingUp, Boxes } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandMark } from '@/components/layout/brand';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginValues = z.infer<typeof loginSchema>;

/** Production login screen (Phase 2 §8, §9). Real Firebase Auth — no fake credentials. */
export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const signIn = useAuthStore((s) => s.signIn);
  const signingIn = useAuthStore((s) => s.signingIn);
  const signInError = useAuthStore((s) => s.signInError);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  useEffect(() => setFocus('email'), [setFocus]);

  if (status === 'ready') return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: LoginValues) => {
    await signIn(values.email, values.password);
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Brand / visual panel (desktop) */}
      <aside className="relative hidden overflow-hidden bg-gradient-sales p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10">
          <BrandMark />
        </div>
        <div className="relative z-10 flex flex-col gap-6">
          <h2 className="max-w-md text-3xl font-extrabold leading-tight">
            Wholesale billing, inventory, GST and accounting — in one clean workspace.
          </h2>
          <ul className="flex flex-col gap-3 text-white/90">
            <li className="flex items-center gap-3"><TrendingUp className="size-5" /> Real-time sales & dues</li>
            <li className="flex items-center gap-3"><Boxes className="size-5" /> Location-aware stock</li>
            <li className="flex items-center gap-3"><ShieldCheck className="size-5" /> Server-enforced security</li>
          </ul>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-80 rounded-full bg-black/10 blur-3xl" />
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <BrandMark />
          </div>
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Welcome back. Enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            {signInError && (
              <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                {signInError}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="mt-2 w-full" loading={signingIn}>
              <LogIn /> Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Accounts are provisioned by your administrator. There is no public sign-up.
          </p>
        </div>
      </main>
    </div>
  );
}
