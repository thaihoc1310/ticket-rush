import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api";
import type { Gender } from "@/types/auth";

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
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-gray-100">Create your account</h1>
        <p className="mt-1 text-sm text-gray-400">
          Sign up to reserve seats at your next event.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          name="full_name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date of birth"
            name="date_of_birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gender" className="text-sm font-medium text-gray-300">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | "")}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 shadow-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            >
              <option value="">Prefer not to say</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        {error ? (
          <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
        ) : null}
        <Button type="submit" loading={submitting}>
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-rose-400 hover:text-rose-300">
          Log in
        </Link>
      </p>
    </div>
  );
}
