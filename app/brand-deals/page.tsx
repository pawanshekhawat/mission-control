"use client";

import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";

type Deal = {
  id: string;
  brand: string;
  contact: string;
  type: string;
  amount: number;
  status: "active" | "negotiating" | "pending" | "completed";
  dueDate: string;
  notes: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  negotiating: "#f59e0b",
  pending: "#3b82f6",
  completed: "#6b7280",
};
const STATUS_LABELS: Record<string, string> = {
  active: "🟢 Active",
  negotiating: "🟡 Negotiating",
  pending: "🔵 Pending Payment",
  completed: "⚪ Completed",
};

const DEAL_TYPES = ["Sponsored Reel", "Sponsored Post", "Long-term Partnership", "Product Seeding", "Affiliate", "Brand Integration"];
const FILTER_OPTIONS = ["All", "Active", "Negotiating", "Pending Payment", "Completed"];

function AddDealModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (deal: Omit<Deal, "id" | "createdAt">) => void;
}) {
  const [form, setForm] = useState({
    brand: "", contact: "", type: "Sponsored Reel",
    amount: "", status: "negotiating" as Deal["status"],
    dueDate: "", notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...form,
      amount: parseFloat(form.amount) || 0,
    });
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0a0a14", border: "1px solid #1e1e3a",
    borderRadius: "8px", padding: "10px 12px", color: "#fff",
    fontSize: "14px", outline: "none",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}
      onClick={onClose}
    >
      <div style={{
        background: "#111127", border: "1px solid #1e1e3a", borderRadius: "16px",
        padding: "28px", width: "460px", maxHeight: "85vh", overflowY: "auto",
      }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "20px" }}>
          💼 Add New Deal
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input required placeholder="Brand name" value={form.brand}
            onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
            style={inputStyle} />
          <input required placeholder="Contact email" type="email" value={form.contact}
            onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
            style={inputStyle} />
          <select required value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            style={{ ...inputStyle, color: "#fff" }}>
            {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input required placeholder="Deal amount (₹)" type="number"
            value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            style={inputStyle} />
          <select required value={form.status}
            onChange={e => setForm(p => ({ ...p, status: e.target.value as Deal["status"] }))}
            style={{ ...inputStyle, color: "#fff" }}>
            <option value="negotiating">🟡 Negotiating</option>
            <option value="active">🟢 Active</option>
            <option value="pending">🔵 Pending Payment</option>
            <option value="completed">⚪ Completed</option>
          </select>
          <input required placeholder="Due date (YYYY-MM-DD)" value={form.dueDate}
            onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
            style={inputStyle} />
          <textarea placeholder="Notes..."
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
          />
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <button type="submit" style={{
              flex: 1, background: "#8b5cf6", border: "none", borderRadius: "8px",
              padding: "10px", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer",
            }}>
              Create Deal
            </button>
            <button type="button" onClick={onClose} style={{
              flex: 1, background: "transparent", border: "1px solid #1e1e3a",
              borderRadius: "8px", padding: "10px", color: "#9ca3af", fontSize: "14px", cursor: "pointer",
            }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BrandDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = () => {
    fetch("/api/brand-deals")
      .then(r => r.json())
      .then((data: Deal[]) => { setDeals(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const handleAdd = async (deal: Omit<Deal, "id" | "createdAt">) => {
    const res = await fetch("/api/brand-deals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deal),
    });
    const created: Deal = await res.json();
    setDeals(p => [...p, created]);
  };

  const handleDelete = async (id: string) => {
    setDeals(p => p.filter(d => d.id !== id));
    await fetch(`/api/brand-deals?id=${id}`, { method: "DELETE" });
  };

  const filtered = deals.filter(d =>
    filter === "All" ? true : d.status === filter.toLowerCase().replace(" payment", "").replace(" ", "-")
  );

  const activeCount = deals.filter(d => d.status === "active").length;
  const totalEarned = deals.filter(d => d.status === "completed").reduce((s, d) => s + d.amount, 0);
  const pendingPayment = deals.filter(d => d.status === "pending").length;

  const statCards = [
    { label: "Active Deals", value: activeCount, color: "#10b981" },
    { label: "Total Earned", value: `₹${totalEarned.toLocaleString("en-IN")}`, color: "#8b5cf6" },
    { label: "Pending Payment", value: pendingPayment, color: "#f59e0b" },
    { label: "Total Deals", value: deals.length, color: "#3b82f6" },
  ];

  return (
    <div className="flex h-full" style={{ background: "#0a0a14" }}>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0 }}>💼 Brand Deals</h1>
            <p style={{ color: "#6b7280", marginTop: "4px" }}>Manage partnerships and track payments</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{
            background: "#8b5cf6", border: "none", borderRadius: "8px",
            padding: "10px 20px", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer",
          }}>
            + Add Deal
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          {statCards.map(s => (
            <div key={s.label} style={{
              background: "#111127", border: "1px solid #1e1e3a",
              borderRadius: "12px", padding: "20px",
            }}>
              <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: "8px" }}>{s.label}</div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: 500,
              cursor: "pointer", border: "none",
              background: filter === f ? "#8b5cf6" : "#111127",
              color: filter === f ? "#fff" : "#9ca3af",
              borderBottom: filter === f ? "none" : "1px solid #1e1e3a",
              transition: "all 0.15s",
            }}>
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: "60px" }}>Loading deals...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: "60px" }}>No deals found</div>
        ) : (
          <div style={{ background: "#111127", border: "1px solid #1e1e3a", borderRadius: "12px", overflow: "hidden" }}>
            {/* Table Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 80px",
              padding: "12px 20px", background: "#0a0a14",
              borderBottom: "1px solid #1e1e3a",
              fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase",
            }}>
              <div>Brand</div>
              <div>Type</div>
              <div>Amount</div>
              <div>Status</div>
              <div>Due</div>
              <div>Action</div>
            </div>

            {/* Table Rows */}
            {filtered.map(deal => (
              <div key={deal.id} style={{
                display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 80px",
                padding: "14px 20px", alignItems: "center",
                borderBottom: "1px solid #1e1e3a",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#16162a")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#fff" }}>{deal.brand}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>{deal.contact}</div>
                </div>
                <div style={{ fontSize: "13px", color: "#9ca3af" }}>{deal.type}</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: deal.amount > 0 ? "#10b981" : "#6b7280" }}>
                  {deal.amount > 0 ? `₹${deal.amount.toLocaleString("en-IN")}` : "—"}
                </div>
                <div>
                  <span style={{
                    fontSize: "11px", padding: "3px 10px", borderRadius: "12px",
                    background: `${STATUS_COLORS[deal.status]}20`,
                    color: STATUS_COLORS[deal.status], fontWeight: 500,
                  }}>
                    {STATUS_LABELS[deal.status]}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>{deal.dueDate}</div>
                <div>
                  <button
                    onClick={() => handleDelete(deal.id)}
                    style={{
                      background: "transparent", border: "none",
                      color: "#ef4444", fontSize: "13px", cursor: "pointer",
                      padding: "4px 8px", borderRadius: "4px",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#ef444420")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAdd && <AddDealModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      </main>
    </div>
  );
}
