"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

const AGENTS = [
  { name: "Lucas", emoji: "🔨", color: "#3b82f6" },
  { name: "Sophia", emoji: "✍️", color: "#10b981" },
  { name: "Noah", emoji: "🔭", color: "#f59e0b" },
  { name: "Michael", emoji: "🧪", color: "#ef4444" },
  { name: "Olivia", emoji: "💼", color: "#f97316" },
  { name: "William", emoji: "⚙️", color: "#6366f1" },
  { name: "Ethan", emoji: "👑", color: "#8b5cf6" },
];

type Task = {
  id: string;
  title: string;
  description: string;
  agent: string;
  agentEmoji: string;
  agentColor: string;
  priority: "high" | "medium" | "low";
  status: "backlog" | "in-progress" | "review" | "completed";
  createdAt: string;
};

type Column = {
  id: string;
  label: string;
  color: string;
};

const COLUMNS: Column[] = [
  { id: "backlog", label: "Backlog", color: "#6b7280" },
  { id: "in-progress", label: "In Progress", color: "#f59e0b" },
  { id: "review", label: "Review", color: "#3b82f6" },
  { id: "completed", label: "Completed", color: "#10b981" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#6b7280",
};

type NewTask = {
  title: string;
  description: string;
  agent: string;
  priority: "high" | "medium" | "low";
};

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState<NewTask>({
    title: "",
    description: "",
    agent: "",
    priority: "medium",
  });

  useState(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        setTasks(data);
        setLoading(false);
      });
  });

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const taskId = draggableId;
    const newStatus = destination.droppableId as Task["status"];

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const agent = AGENTS.find((a) => a.name === newTask.agent);
    const task: NewTask & { status: "backlog"; agentEmoji: string; agentColor: string } = {
      ...newTask,
      status: "backlog",
      agentEmoji: agent?.emoji ?? "👤",
      agentColor: agent?.color ?? "#6b7280",
    };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    const created: Task = await res.json();
    setTasks((prev) => [...prev, created]);
    setShowModal(false);
    setNewTask({ title: "", description: "", agent: "", priority: "medium" });
  };

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
  };

  const getTasksByColumn = (colId: string) => tasks.filter((t) => t.status === colId);

  return (
    <div style={{ height: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
            Tasks
          </h1>
          <p style={{ color: "#6b7280", marginTop: "4px" }}>
            Drag tasks between columns to update status
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: "#8b5cf6",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Task
        </button>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div style={{ color: "#6b7280", textAlign: "center", padding: "60px" }}>
          Loading tasks...
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              height: "calc(100vh - 220px)",
            }}
          >
            {COLUMNS.map((col) => {
              const colTasks = getTasksByColumn(col.id);
              return (
                <div
                  key={col.id}
                  style={{
                    background: "#111127",
                    borderRadius: "12px",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      padding: "16px",
                      borderBottom: `2px solid ${col.color}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>
                      {col.label}
                    </span>
                    <span
                      style={{
                        background: `${col.color}30`,
                        color: col.color,
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "10px",
                      }}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task Cards */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          flex: 1,
                          padding: "12px",
                          overflowY: "auto",
                          background: snapshot.isDraggingOver ? "#1e1e3a" : "transparent",
                          transition: "background 0.2s",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  background: "#0a0a14",
                                  border: "1px solid #1e1e3a",
                                  borderRadius: "8px",
                                  padding: "14px",
                                  cursor: snapshot.isDragging ? "grabbing" : "grab",
                                  transform: snapshot.isDragging
                                    ? provided.draggableProps.style?.transform
                                    : "none",
                                  boxShadow: snapshot.isDragging
                                    ? "0 8px 24px rgba(0,0,0,0.4)"
                                    : "none",
                                }}
                              >
                                {/* Agent Row */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    marginBottom: "8px",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "24px",
                                      height: "24px",
                                      borderRadius: "6px",
                                      background: `${task.agentColor}20`,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "12px",
                                    }}
                                  >
                                    {task.agentEmoji}
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: task.agentColor,
                                      fontWeight: 500,
                                    }}
                                  >
                                    {task.agent}
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: "auto",
                                      fontSize: "10px",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      background: `${PRIORITY_COLORS[task.priority]}20`,
                                      color: PRIORITY_COLORS[task.priority],
                                    }}
                                  >
                                    {task.priority}
                                  </span>
                                </div>

                                {/* Title */}
                                <div
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "#fff",
                                    marginBottom: "6px",
                                  }}
                                >
                                  {task.title}
                                </div>

                                {/* Description */}
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#6b7280",
                                    marginBottom: "10px",
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {task.description}
                                </div>

                                {/* Actions */}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <button
                                    onClick={() => handleDelete(task.id)}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "#ef4444",
                                      fontSize: "11px",
                                      cursor: "pointer",
                                      padding: "2px 6px",
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Add Task Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#111127",
              border: "1px solid #1e1e3a",
              borderRadius: "12px",
              padding: "28px",
              width: "440px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#fff", marginBottom: "20px" }}>
              Add New Task
            </h2>
            <form onSubmit={handleAddTask} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input
                type="text"
                placeholder="Task title"
                required
                value={newTask.title}
                onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                style={{
                  background: "#0a0a14",
                  border: "1px solid #1e1e3a",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <textarea
                placeholder="Description"
                required
                value={newTask.description}
                onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                style={{
                  background: "#0a0a14",
                  border: "1px solid #1e1e3a",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                  resize: "vertical",
                  minHeight: "80px",
                }}
              />
              <select
                required
                value={newTask.agent}
                onChange={(e) => setNewTask((p) => ({ ...p, agent: e.target.value }))}
                style={{
                  background: "#0a0a14",
                  border: "1px solid #1e1e3a",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: newTask.agent ? "#fff" : "#6b7280",
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                <option value="">Assign to agent...</option>
                {AGENTS.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </select>
              <select
                value={newTask.priority}
                onChange={(e) =>
                  setNewTask((p) => ({ ...p, priority: e.target.value as NewTask["priority"] }))
                }
                style={{
                  background: "#0a0a14",
                  border: "1px solid #1e1e3a",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: "#8b5cf6",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Create Task
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1px solid #1e1e3a",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#9ca3af",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
