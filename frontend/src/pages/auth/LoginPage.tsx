import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api";

interface LocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      const from = (location.state as LocationState | null)?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to log in. Try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border p-8 shadow-sm"
      style={{
        borderColor: "var(--border-primary)",
        background: "var(--bg-secondary)",
      }}
    >
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Welcome back
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Log in to book tickets and manage your reservations.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? (
          <p
            className="rounded-md px-3 py-2 text-sm"
            style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={submitting}>
          Log in
        </Button>
      </form>
      <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
        No account?{" "}
        <Link
          to="/register"
          className="font-medium hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
