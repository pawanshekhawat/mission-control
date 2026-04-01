import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "brand-deals.json");

const VALID_STATUSES = ["active", "negotiating", "pending", "completed"];
const VALID_TYPES = ["Sponsored Reel","Sponsored Post","Long-term Partnership","Product Seeding","Affiliate","Brand Integration"];

async function readDeals() {
  const data = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

async function writeDeals(deals: unknown[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(deals, null, 2));
}

function validateDeal(body: Record<string, unknown>) {
  if (!body.brand || typeof body.brand !== "string" || body.brand.trim().length === 0) {
    return "brand is required and must be a non-empty string";
  }
  if (!body.contact || typeof body.contact !== "string" || !body.contact.includes("@")) {
    return "contact must be a valid email address";
  }
  if (body.type && !VALID_TYPES.includes(body.type as string)) {
    return `type must be one of: ${VALID_TYPES.join(", ")}`;
  }
  if (body.status && !VALID_STATUSES.includes(body.status as string)) {
    return `status must be one of: ${VALID_STATUSES.join(", ")}`;
  }
  if (body.amount !== undefined && (typeof body.amount !== "number" || body.amount < 0)) {
    return "amount must be a non-negative number";
  }
  return null;
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
    const validationError = validateDeal(body);
    if (validationError) {
      return NextResponse.json({ error: `Validation failed: ${validationError}` }, { status: 400 });
    }
    const deals = await readDeals();
    const newDeal = {
      id: Date.now().toString(),
      brand: (body.brand as string).trim(),
      contact: (body.contact as string).trim().toLowerCase(),
      type: (body.type as string) || "Sponsored Reel",
      amount: typeof body.amount === "number" ? body.amount : 0,
      status: (body.status as string) || "negotiating",
      dueDate: (body.dueDate as string) || "",
      notes: body.notes?.trim() || "",
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
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required for update" }, { status: 400 });
    }
    if (body.status && !VALID_STATUSES.includes(body.status as string)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    if (body.type && !VALID_TYPES.includes(body.type as string)) {
      return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }
    if (body.amount !== undefined && (typeof body.amount !== "number" || body.amount < 0)) {
      return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
    }
    const deals = await readDeals();
    const index = deals.findIndex((d: { id: string }) => d.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    deals[index] = { ...deals[index], ...body };
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
    if (!id) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }
    const deals = await readDeals();
    const filtered = deals.filter((d: { id: string }) => d.id !== id);
    if (filtered.length === deals.length) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    await writeDeals(filtered);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 });
  }
}
