import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AdminActionBar } from "@/components/admin/AdminActionBar";
import {
  AdminFilterModal,
  countActiveFilters,
  defaultValues,
  type FilterFieldConfig,
  type FilterValues,
} from "@/components/admin/AdminFilterModal";
import { paymentApi } from "@/services/api";
import { formatCurrency, formatDateTime } from "@/utils/format";

export function PaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: paymentApi.list,
  });

  const payments = data ?? [];

  // ── Search & Filter ──
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<FilterValues>({});

  // Derive dynamic options from data
  const uniqueMethods = useMemo(
    () => [...new Set(payments.map((p) => p.method))].sort(),
    [payments],
  );

  const amountBounds = useMemo(() => {
    if (payments.length === 0) return { min: 0, max: 1000 };
    const amounts = payments.map((p) => Number(p.amount));
    return {
      min: Math.floor(Math.min(...amounts)),
      max: Math.ceil(Math.max(...amounts)),
    };
  }, [payments]);

  const filterFields: FilterFieldConfig[] = useMemo(
    () => [
      { key: "date", label: "Date", type: "dateRange" as const },
      { key: "status", label: "Status", type: "pills" as const, options: ["COMPLETED", "PENDING"] },
      ...(uniqueMethods.length > 0
        ? [{ key: "method", label: "Payment Method", type: "pills" as const, options: uniqueMethods }]
        : []),
      ...(amountBounds.min !== amountBounds.max
        ? [{
            key: "amount",
            label: "Amount",
            type: "numericRange" as const,
            min: amountBounds.min,
            max: amountBounds.max,
            prefix: "$",
          }]
        : []),
    ],
    [uniqueMethods, amountBounds],
  );

  const safeFilterValues = useMemo(
    () => ({ ...defaultValues(filterFields), ...filterValues }),
    [filterFields, filterValues],
  );

  // ── Filtered payments ──
  const filteredPayments = useMemo(() => {
    let list = payments;
    // Text search (primary: event_title + user_email)
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.event_title ?? "").toLowerCase().includes(q) ||
          (p.user_email ?? "").toLowerCase().includes(q),
      );
    }
    // Date range
    const dr = safeFilterValues.date as { startDate: string | null; endDate: string | null } | undefined;
    if (dr?.startDate) {
      list = list.filter((p) => p.paid_at && p.paid_at.slice(0, 10) >= dr.startDate!);
    }
    if (dr?.endDate) {
      list = list.filter((p) => p.paid_at && p.paid_at.slice(0, 10) <= dr.endDate!);
    }
    // Status
    const statuses = safeFilterValues.status as string[];
    if (statuses && statuses.length > 0) {
      list = list.filter((p) => statuses.includes(p.status));
    }
    // Method
    const methods = safeFilterValues.method as string[];
    if (methods && methods.length > 0) {
      list = list.filter((p) => methods.includes(p.method));
    }
    // Amount range
    const amt = safeFilterValues.amount as { min: number; max: number } | undefined;
    if (amt && (amt.min !== amountBounds.min || amt.max !== amountBounds.max)) {
      list = list.filter((p) => {
        const a = Number(p.amount);
        return a >= amt.min && a <= amt.max;
      });
    }
    return list;
  }, [payments, search, safeFilterValues, amountBounds]);

  const filterCount = countActiveFilters(filterFields, safeFilterValues);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Payments</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          View all payment transactions.
        </p>
      </header>

      <AdminActionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search payments…"
        filterCount={filterCount}
        onFilterClick={() => setFilterOpen(true)}
      />

      <AdminFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        fields={filterFields}
        values={safeFilterValues}
        onApply={setFilterValues}
      />

      <section className="rounded-2xl border" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>All payments</h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : filteredPayments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--bg-tertiary)" }}>
                <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  <th className="px-6 py-3">Event</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Method</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Paid At</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: "var(--border-primary)" }}>
                    <td className="px-6 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                      {p.event_title ?? "—"}
                    </td>
                    <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>
                      {p.user_email ?? "—"}
                    </td>
                    <td className="px-6 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>{p.method}</td>
                    <td className="px-6 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: p.status === "COMPLETED" ? "var(--success-bg)" : "var(--warning-bg)",
                          color: p.status === "COMPLETED" ? "var(--success)" : "var(--warning)",
                        }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>
                      {p.paid_at ? formatDateTime(p.paid_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>No payments found.</p>
        )}
      </section>
    </div>
  );
}
