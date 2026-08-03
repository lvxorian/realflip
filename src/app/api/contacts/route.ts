import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { generateId, ts } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Jméno je povinné" }, { status: 400 });
    }

    const phone = typeof body.phone === "string" ? body.phone.trim() : null;
    const email = typeof body.email === "string" ? body.email.trim() : null;
    const type = typeof body.type === "string" && ["agent", "owner", "debtor"].includes(body.type) ? body.type : "owner";
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown): t is string => typeof t === "string") : [];
    const now = ts();

    const id = generateId();
    await db.insert(contacts).values({
      id,
      name,
      phone,
      email,
      type,
      tags: JSON.stringify(tags),
      notes,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id, name, phone, email, type, tags, notes, createdAt: now, updatedAt: now }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        email: contacts.email,
        type: contacts.type,
        tags: contacts.tags,
        notes: contacts.notes,
      })
      .from(contacts)
      .orderBy(desc(contacts.createdAt));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
