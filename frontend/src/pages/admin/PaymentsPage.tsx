import { useQuery } from "@tanstack/react-query";
import { paymentApi } from "@/services/api";
import { formatCurrency, formatDateTime } from "@/utils/format";

export function PaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: paymentApi.list,
  });

  const payments = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Payments</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          View all payment transactions.
        </p>
      </header>

      <section className="rounded-2xl border" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>All payments</h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : payments.length ? (
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
                {payments.map((p) => (
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
