import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "tasks.json");

async function readTasks() {
  const data = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

async function writeTasks(tasks: unknown[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2));
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
    const tasks = await readTasks();
    const newTask = {
      id: Date.now().toString(),
      ...body,
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
    const { id, ...updates } = body;
    const tasks = await readTasks();
    const index = tasks.findIndex((t: { id: string }) => t.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    tasks[index] = { ...tasks[index], ...updates };
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
    const tasks = await readTasks();
    const filtered = tasks.filter((t: { id: string }) => t.id !== id);
    await writeTasks(filtered);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
