import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError, venueApi } from "@/services/api";

const EMPTY = { name: "", address: "", city: "", capacity: 0 };

export function VenuesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: venueApi.list,
  });

  const create = useMutation({
    mutationFn: venueApi.create,
    onSuccess: () => {
      setForm(EMPTY);
      setError(null);
      qc.invalidateQueries({ queryKey: ["venues"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Failed to create venue");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => venueApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Failed to delete venue");
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    create.mutate({ ...form, capacity: Number(form.capacity) || 0 });
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-100">Venues</h1>
        <p className="text-sm text-gray-500">
          Create and manage venues where events take place.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-100">New venue</h2>
        <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="City"
            required
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Input
              label="Address"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <Input
            label="Capacity"
            type="number"
            min={0}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
          <div className="flex items-end">
            <Button type="submit" loading={create.isPending}>
              Add venue
            </Button>
          </div>
          {error && (
            <p className="sm:col-span-2 rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
        </form>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 shadow-sm">
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-100">All venues</h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-6 text-sm text-gray-500">Loading…</p>
        ) : data && data.length ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-800 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Capacity</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.map((v) => (
                <tr key={v.id}>
                  <td className="px-6 py-3 font-medium text-gray-100">{v.name}</td>
                  <td className="px-6 py-3 text-gray-400">{v.city}</td>
                  <td className="px-6 py-3 text-gray-400">{v.capacity}</td>
                  <td className="px-6 py-3 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete venue "${v.name}"?`)) remove.mutate(v.id);
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-6 text-sm text-gray-500">No venues yet.</p>
        )}
      </section>
    </div>
  );
}
