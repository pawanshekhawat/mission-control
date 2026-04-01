import Sidebar from "./components/Sidebar";
import tasksData from "../data/tasks.json";

const agents = [
  { name: "Ethan", emoji: "👑", color: "#8b5cf6", role: "Team Lead", task: "Coordinating team" },
  { name: "Lucas", emoji: "🔨", color: "#3b82f6", role: "Builder", task: "Building Kailash Command" },
  { name: "Sophia", emoji: "✍️", color: "#10b981", role: "Content Strategist", task: "Reel script pending" },
  { name: "Noah", emoji: "🔭", color: "#f59e0b", role: "Research Analyst", task: "Competitor analysis done" },
  { name: "Michael", emoji: "🧪", color: "#ef4444", role: "QA Engineer", task: "Waiting for build" },
  { name: "Olivia", emoji: "💼", color: "#f97316", role: "Brand Manager", task: "2 deals in pipeline" },
  { name: "William", emoji: "⚙️", color: "#6366f1", role: "Operations", task: "Monitoring cron jobs" },
];

const statusColors: Record<string, string> = {
  completed: "#10b981",
  "in-progress": "#f59e0b",
  pending: "#6b7280",
};

const priorityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#6b7280",
};

export default function Dashboard() {
  const totalTasks = tasksData.length;
  const inProgress = tasksData.filter((t) => t.status === "in-progress").length;
  const completed = tasksData.filter((t) => t.status === "completed").length;
  const recentTasks = tasksData.slice(0, 5);

  return (
    <div className="flex h-full" style={{ background: "#0a0a14" }}>
      <Sidebar />

      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
            }}
          >
            Dashboard
          </h1>
          <p style={{ color: "#6b7280", marginTop: "4px" }}>
            Welcome to Kailash Command — your mission control center.
          </p>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {[
            { label: "Total Tasks", value: totalTasks, color: "#8b5cf6" },
            { label: "In Progress", value: inProgress, color: "#f59e0b" },
            { label: "Completed", value: completed, color: "#10b981" },
            { label: "Team Members", value: agents.length, color: "#3b82f6" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "#111127",
                border: "1px solid #1e1e3a",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: "8px" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "36px", fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
          {/* Active Tasks Feed */}
          <div
            style={{
              background: "#111127",
              border: "1px solid #1e1e3a",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#ffffff",
                marginBottom: "16px",
              }}
            >
              📋 Active Tasks
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    background: "#0a0a14",
                    border: "1px solid #1e1e3a",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#ffffff",
                        marginBottom: "4px",
                      }}
                    >
                      {task.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      {task.agentEmoji} {task.agent}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        background: `${statusColors[task.status]}20`,
                        color: statusColors[task.status],
                        fontWeight: 500,
                      }}
                    >
                      {task.status.replace("-", " ")}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: `${priorityColors[task.priority]}20`,
                        color: priorityColors[task.priority],
                      }}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Team Status */}
            <div
              style={{
                background: "#111127",
                border: "1px solid #1e1e3a",
                borderRadius: "12px",
                padding: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#ffffff",
                  marginBottom: "16px",
                }}
              >
                👥 Team Status
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {agents.map((agent) => (
                  <div
                    key={agent.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 0",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: `${agent.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                      }}
                    >
                      {agent.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#ffffff" }}>
                        {agent.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>
                        {agent.task}
                      </div>
                    </div>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#10b981",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Task Assignment */}
            <div
              style={{
                background: "#111127",
                border: "1px solid #1e1e3a",
                borderRadius: "12px",
                padding: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#ffffff",
                  marginBottom: "16px",
                }}
              >
                ⚡ Quick Task
              </h2>
              <form style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  type="text"
                  placeholder="Task title..."
                  style={{
                    background: "#0a0a14",
                    border: "1px solid #1e1e3a",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                <select
                  style={{
                    background: "#0a0a14",
                    border: "1px solid #1e1e3a",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    color: "#9ca3af",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value="">Assign to...</option>
                  <option value="Lucas">🔨 Lucas</option>
                  <option value="Sophia">✍️ Sophia</option>
                  <option value="Noah">🔭 Noah</option>
                  <option value="Michael">🧪 Michael</option>
                  <option value="Olivia">💼 Olivia</option>
                  <option value="William">⚙️ William</option>
                </select>
                <button
                  type="button"
                  style={{
                    background: "#8b5cf6",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Assign Task
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
