"use client";

import { useState, useEffect, useRef } from "react";

type Task = {
  id: string;
  title: string;
  agent: string;
  status: "backlog" | "in-progress" | "review" | "completed";
};

type AgentData = {
  name: string;
  emoji: string;
  role: string;
  color: string;
  status: "working" | "idle" | "on-break";
  currentTask: string;
  completedCount: number;
};

const AGENTS_META: Record<string, Omit<AgentData, "currentTask" | "completedCount">> = {
  Ethan: { name: "Ethan", emoji: "👑", role: "Team Lead", color: "#8b5cf6", status: "working" },
  Lucas: { name: "Lucas", emoji: "🔨", role: "Builder", color: "#3b82f6", status: "working" },
  Sophia: { name: "Sophia", emoji: "✍️", role: "Content Strategist", color: "#10b981", status: "idle" },
  Noah: { name: "Noah", emoji: "🔭", role: "Research Analyst", color: "#f59e0b", status: "idle" },
  Michael: { name: "Michael", emoji: "🧪", role: "QA Engineer", color: "#ef4444", status: "idle" },
  Olivia: { name: "Olivia", emoji: "💼", role: "Brand Manager", color: "#f97316", status: "working" },
  William: { name: "William", emoji: "⚙️", role: "Operations", color: "#6366f1", status: "working" },
};

const STATUS_LABELS = { working: "🟢 Working", idle: "🟡 Idle", "on-break": "🔵 On Break" };

export default function TeamGrid() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        setTasks(data);
        setLoading(false);
      });
  }, []);

  const getAgentData = (agentName: string): AgentData => {
    const meta = AGENTS_META[agentName];
    const agentTasks = tasks.filter((t) => t.agent === agentName);
    const inProgressTask = agentTasks.find((t) => t.status === "in-progress");
    const completedCount = agentTasks.filter((t) => t.status === "completed").length;
    return {
      ...meta,
      currentTask: inProgressTask?.title ?? "No active task",
      completedCount,
    };
  };

  const agents = Object.keys(AGENTS_META).filter((n) => n !== "Ethan").map(getAgentData);
  const ethan = getAgentData("Ethan");
  const totalTasks = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "in-progress").length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const activeAgents = agents.filter((a) => a.status === "working").length;

  const cardStyle = (color: string, isLead = false): React.CSSProperties => ({
    background: "rgba(17, 17, 39, 0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${color}40`,
    borderLeft: `4px solid ${color}`,
    borderRadius: "12px",
    padding: isLead ? "28px" : "18px",
    position: "relative",
    overflow: "visible",
    transition: "box-shadow 0.2s, transform 0.2s",
  });

  const AgentCard = ({ agent, isLead = false }: { agent: AgentData; isLead?: boolean }) => (
    <div
      style={{
        ...cardStyle(agent.color, isLead),
        boxShadow: isLead ? `0 0 40px ${agent.color}30, 0 0 80px ${agent.color}15` : `0 4px 20px rgba(0,0,0,0.3)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${agent.color}30`;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = isLead
          ? `0 0 40px ${agent.color}30, 0 0 80px ${agent.color}15`
          : `0 4px 20px rgba(0,0,0,0.3)`;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {isLead && (
        <div
          style={{
            position: "absolute",
            top: "-1px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "60%",
            height: "2px",
            background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)`,
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: isLead ? "16px" : "10px" }}>
        <div
          style={{
            width: isLead ? "48px" : "38px",
            height: isLead ? "48px" : "38px",
            borderRadius: "10px",
            background: `${agent.color}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: isLead ? "22px" : "18px",
            border: `1px solid ${agent.color}40`,
          }}
        >
          {agent.emoji}
        </div>
        <div>
          <div style={{ fontSize: isLead ? "18px" : "15px", fontWeight: 600, color: "#fff" }}>
            {agent.name}
          </div>
          <div style={{ fontSize: isLead ? "13px" : "11px", color: agent.color }}>
            {agent.role}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span
            style={{
              fontSize: "11px",
              padding: "3px 8px",
              borderRadius: "20px",
              background: "rgba(255,255,255,0.05)",
              color: "#9ca3af",
            }}
          >
            {STATUS_LABELS[agent.status]}
          </span>
        </div>
      </div>

      {isLead ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            {[
              { label: "Total Tasks", value: totalTasks },
              { label: "In Progress", value: inProgress },
              { label: "Completed", value: completed },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#0a0a14",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "24px", fontWeight: 700, color: agent.color }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280" }}>
            Managing <span style={{ color: agent.color, fontWeight: 600 }}>{activeAgents}</span> active agents
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
            Current task
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#ffffff",
              marginBottom: "8px",
              lineHeight: 1.4,
              minHeight: "36px",
            }}
          >
            {agent.currentTask}
          </div>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>
            <span style={{ color: "#10b981", fontWeight: 600 }}>{agent.completedCount}</span> tasks completed
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ height: "100%" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff", margin: 0 }}>Team</h1>
        <p style={{ color: "#6b7280", marginTop: "4px" }}>
          {loading ? "Loading..." : `${agents.length} agents reporting to Ethan 👑`}
        </p>
      </div>

      <div ref={gridRef} style={{ position: "relative" }}>
        {/* Ethan's Lead Card */}
        <div style={{ marginBottom: "32px" }}>
          <AgentCard agent={ethan} isLead />
        </div>

        {/* Connection lines SVG */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
          }}
          preserveAspectRatio="none"
        >
          <line x1="50%" y1="100%" x2="16.67%" y2="100%" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
          <line x1="50%" y1="100%" x2="50%" y2="100%" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
          <line x1="50%" y1="100%" x2="83.33%" y2="100%" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
          <line x1="16.67%" y1="100%" x2="8.33%" y2="100%" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
          <line x1="16.67%" y1="100%" x2="25%" y2="100%" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
          <line x1="83.33%" y1="100%" x2="75%" y2="100%" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
          <line x1="83.33%" y1="100%" x2="91.67%" y2="100%" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
        </svg>

        {/* Agent Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {agents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
