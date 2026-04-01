import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "brand-deals.json");

async function readDeals() {
  const data = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

async function writeDeals(deals: unknown[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(deals, null, 2));
}

export async function GET() {
  try {
    const deals = await readDeals();
    return NextResponse.json(deals);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deals = await readDeals();
    const newDeal = {
      id: Date.now().toString(),
      ...body,
      createdAt: new Date().toISOString(),
    };
    deals.push(newDeal);
    await writeDeals(deals);
    return NextResponse.json(newDeal, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    const deals = await readDeals();
    const index = deals.findIndex((d: { id: string }) => d.id === id);
    if (index === -1) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    deals[index] = { ...deals[index], ...updates };
    await writeDeals(deals);
    return NextResponse.json(deals[index]);
  } catch {
    return NextResponse.json({ error: "Failed to update deal" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const deals = await readDeals();
    const filtered = deals.filter((d: { id: string }) => d.id !== id);
    await writeDeals(filtered);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 });
  }
}
