import Link from "next/link";
import { loginAction } from "@/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";

export const metadata = { title: "Sign in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  return <LoginInner searchParams={searchParams} />;
}

async function LoginInner({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const errorHint =
    params.error === "rejected"
      ? "Your account was rejected. Contact Super Admin."
      : params.error === "inactive"
        ? "Your account is inactive."
        : null;
  const resetOk = params.reset === "1";
  const redirectTo =
    params.redirect &&
    params.redirect.startsWith("/") &&
    !params.redirect.startsWith("//")
      ? params.redirect
      : "";

  return (
    <AuthShell>
      {errorHint && (
        <p className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 backdrop-blur dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          {errorHint}
        </p>
      )}
      {resetOk && (
        <p className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 backdrop-blur dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          Password updated successfully. Sign in with your new password.
        </p>
      )}
      <AuthForm
        action={loginAction}
        title="Welcome back"
        subtitle={`Sign in to your ${APP_NAME} workspace`}
        submitLabel="Sign in"
        footer={
          <p className="text-muted">
            New here?{" "}
            <Link
              href="/register"
              className="font-semibold text-brand hover:underline"
            >
              Create an account
            </Link>
          </p>
        }
      >
        {redirectTo ? (
          <input type="hidden" name="redirect" value={redirectTo} />
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-brand hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            className="h-11"
          />
        </div>
      </AuthForm>
    </AuthShell>
  );
}
