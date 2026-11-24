"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "login" | "signup";

type FormState = {
  email: string;
  password: string;
  confirmPassword: string;
  organizationName: string;
};

const initialForm: FormState = {
  email: "",
  password: "",
  confirmPassword: "",
  organizationName: "",
};

function Field({
  id,
  label,
  icon: Icon,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  icon: typeof Mail;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-[#26312d]">
          <Icon className="size-4 text-[#718079]" aria-hidden="true" />
          {label}
        </label>
        {hint && <span className="text-xs text-[#7b8782]">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-[#bd453b]">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "form", string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  function validate() {
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.password.length < 8) {
      next.password = "Use at least 8 characters.";
    } else if (isSignup && !/[a-z]/.test(form.password)) {
      next.password = "Include a lowercase letter.";
    } else if (isSignup && !/[A-Z]/.test(form.password)) {
      next.password = "Include an uppercase letter.";
    } else if (isSignup && !/[0-9]/.test(form.password)) {
      next.password = "Include a number.";
    }
    if (isSignup && form.organizationName.trim().length < 2) {
      next.organizationName = "Enter your organization name.";
    }
    if (isSignup && form.password !== form.confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setPending(true);
    setErrors({});
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isSignup
            ? {
                email: form.email.trim(),
                password: form.password,
                confirmPassword: form.confirmPassword,
                organizationName: form.organizationName.trim(),
              }
            : { email: form.email.trim(), password: form.password },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        field?: keyof FormState;
      };
      if (!response.ok) {
        const message = payload.error ?? "We couldn’t complete that request. Please try again.";
        setErrors(payload.field ? { [payload.field]: message } : { form: message });
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrors({ form: "StockFlow is temporarily unreachable. Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-[440px] animate-float-in">
      <div className="mb-9">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#16825d]">
          {isSignup ? "Start your workspace" : "Welcome back"}
        </p>
        <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-[#17201d]">
          {isSignup ? "Know what’s in stock." : "Pick up where you left off."}
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-[#66716d]">
          {isSignup
            ? "Create a private inventory workspace for your organization in under a minute."
            : "Sign in to see your inventory, low-stock items, and latest updates."}
        </p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-5">
        {isSignup && (
          <Field id="organizationName" label="Organization name" icon={Store} error={errors.organizationName}>
            <Input
              id="organizationName"
              autoComplete="organization"
              value={form.organizationName}
              onChange={(event) => update("organizationName", event.target.value)}
              aria-invalid={Boolean(errors.organizationName)}
              aria-describedby={errors.organizationName ? "organizationName-error" : undefined}
              placeholder="Northstar Supply Co."
              className="h-12 rounded-xl border-[#d3ddd6] bg-white px-4 text-base shadow-[0_1px_2px_rgb(23_32_29/4%)] focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-base"
            />
          </Field>
        )}

        <Field id="email" label="Email address" icon={Mail} error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            placeholder="you@company.com"
            className="h-12 rounded-xl border-[#d3ddd6] bg-white px-4 text-base shadow-[0_1px_2px_rgb(23_32_29/4%)] focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-base"
          />
        </Field>

        <Field id="password" label="Password" icon={LockKeyhole} hint={isSignup ? "8+ · upper · lower · number" : undefined} error={errors.password}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              placeholder="Enter your password"
              className="h-12 rounded-xl border-[#d3ddd6] bg-white px-4 pr-12 text-base shadow-[0_1px_2px_rgb(23_32_29/4%)] focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="focus-ring absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#718079] hover:bg-[#edf2ee] hover:text-[#26312d]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
        </Field>

        {isSignup && (
          <Field id="confirmPassword" label="Confirm password" icon={LockKeyhole} error={errors.confirmPassword}>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => update("confirmPassword", event.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              placeholder="Repeat your password"
              className="h-12 rounded-xl border-[#d3ddd6] bg-white px-4 text-base shadow-[0_1px_2px_rgb(23_32_29/4%)] focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-base"
            />
          </Field>
        )}

        {errors.form && (
          <div role="alert" className="rounded-xl border border-[#f1c6c1] bg-[#fff2f0] px-4 py-3 text-sm font-medium text-[#a73c34]">
            {errors.form}
          </div>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-xl bg-[#16825d] text-base font-semibold shadow-[0_9px_24px_rgb(22_130_93/20%)] hover:bg-[#0f704f]"
        >
          {pending ? (
            <><LoaderCircle className="size-5 animate-spin" /> Please wait</>
          ) : (
            <>{isSignup ? "Create workspace" : "Sign in"}</>
          )}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-[#66716d]">
        {isSignup ? "Already have a workspace?" : "New to StockFlow?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="focus-ring rounded font-semibold text-[#0f704f] underline decoration-[#9bd8c0] decoration-2 underline-offset-4 hover:text-[#0a563c]"
        >
          {isSignup ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  );
}
