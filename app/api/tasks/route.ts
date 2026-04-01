import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "tasks.json");

const VALID_AGENTS = ["Ethan","Lucas","Sophia","Noah","Michael","Olivia","William"];
const VALID_STATUSES = ["backlog","in-progress","review","completed"];
const VALID_PRIORITIES = ["low","medium","high","urgent"];

async function readTasks() {
  const data = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

async function writeTasks(tasks: unknown[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2));
}

function validateTask(body: Record<string, unknown>) {
  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
    return "title is required and must be a non-empty string";
  }
  if (body.agent && !VALID_AGENTS.includes(body.agent as string)) {
    return `agent must be one of: ${VALID_AGENTS.join(", ")}`;
  }
  if (body.status && !VALID_STATUSES.includes(body.status as string)) {
    return `status must be one of: ${VALID_STATUSES.join(", ")}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority as string)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(", ")}`;
  }
  return null;
}

export async function GET() {
  try {
    const tasks = await readTasks();
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationError = validateTask(body);
    if (validationError) {
      return NextResponse.json({ error: `Validation failed: ${validationError}` }, { status: 400 });
    }
    const tasks = await readTasks();
    const newTask = {
      id: Date.now().toString(),
      title: (body.title as string).trim(),
      description: body.description?.trim() || "",
      agent: body.agent || "Ethan",
      agentEmoji: body.agentEmoji || "👑",
      agentColor: body.agentColor || "#8b5cf6",
      priority: (body.priority as string) || "medium",
      status: (body.status as string) || "backlog",
      createdAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    await writeTasks(tasks);
    return NextResponse.json(newTask, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required for update" }, { status: 400 });
    }
    if (body.status && !VALID_STATUSES.includes(body.status as string)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    if (body.priority && !VALID_PRIORITIES.includes(body.priority as string)) {
      return NextResponse.json({ error: `priority must be one of: ${VALID_PRIORITIES.join(", ")}` }, { status: 400 });
    }
    const tasks = await readTasks();
    const index = tasks.findIndex((t: { id: string }) => t.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    tasks[index] = { ...tasks[index], ...body };
    await writeTasks(tasks);
    return NextResponse.json(tasks[index]);
  } catch {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }
    const tasks = await readTasks();
    const filtered = tasks.filter((t: { id: string }) => t.id !== id);
    if (filtered.length === tasks.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    await writeTasks(filtered);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
