import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { LED } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api";
import type { Gender } from "@/types/auth";
const mechanicalEase = [0.175, 0.885, 0.32, 1.275] as const;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        date_of_birth: dob || null,
        gender: gender || null,
      });
      navigate("/", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to create account.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: mechanicalEase }}
      className="mx-auto flex max-w-md flex-col gap-6"
    >
      {/* Industrial Card Container */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="card card-screws p-8"
      >
        {/* Header */}
        <div className="mb-6 border-b-2 border-[var(--muted)] pb-6">
          <div className="mb-3 flex items-center gap-2">
            <LED status="accent" size="sm" />
            <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              New Account Registration
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
            Create Your Account
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Sign up to reserve seats at your next event.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Input
            label="Full Name"
            name="full_name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
          />
          <Input
            label="Email Address"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            hint="Minimum 8 characters"
          />

          {/* Optional Fields */}
          <div className="rounded-lg bg-[var(--muted)] p-4 shadow-[var(--shadow-recessed)]">
            <p className="mb-3 font-mono text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Optional Information
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="dob" className="input-label">
                  Date of Birth
                </label>
                <input
                  id="dob"
                  name="date_of_birth"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="gender" className="input-label">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender | "")}
                  className="select-field"
                >
                  <option value="">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-[var(--danger-bg)] p-4">
              <div className="flex-shrink-0">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
            </div>
          )}

          <Button type="submit" loading={submitting} fullWidth>
            {submitting ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 border-t-2 border-[var(--muted)] pt-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
            >
              Log In
            </Link>
          </p>
        </div>
      </motion.div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.25 }}
        className="flex items-center justify-center gap-2"
      >
        <LED status="success" size="sm" />
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--text-muted)]">
          Secure Connection
        </span>
      </motion.div>
    </motion.div>
  );
}
