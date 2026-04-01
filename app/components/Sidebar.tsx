"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", emoji: "🏠" },
  { href: "/tasks", label: "Tasks", emoji: "📋" },
  { href: "/team", label: "Team", emoji: "👥" },
  { href: "/office", label: "Office (3D)", emoji: "🗼" },
  { href: "/brand-deals", label: "Brand Deals", emoji: "💼" },
  { href: "/content", label: "Content", emoji: "✍️" },
  { href: "/settings", label: "Settings", emoji: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "240px",
        minHeight: "100vh",
        background: "#111127",
        borderRight: "1px solid #1e1e3a",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 20px", marginBottom: "32px" }}>
        <div
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#8b5cf6",
            letterSpacing: "0.05em",
          }}
        >
          KAUSHAL
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#6b7280",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Command
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 20px",
                color: isActive ? "#ffffff" : "#9ca3af",
                background: isActive ? "rgba(139, 92, 246, 0.15)" : "transparent",
                borderLeft: isActive ? "3px solid #8b5cf6" : "3px solid transparent",
                fontSize: "14px",
                fontWeight: isActive ? 500 : 400,
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "16px" }}>{item.emoji}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid #1e1e3a",
          marginTop: "16px",
        }}
      >
        <div style={{ fontSize: "12px", color: "#6b7280" }}>
          <div style={{ color: "#8b5cf6", fontWeight: 600 }}>Ethan 👑</div>
          <div>Team Lead Active</div>
        </div>
      </div>
    </aside>
  );
}
