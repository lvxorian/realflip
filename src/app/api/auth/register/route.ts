import { db } from "@/db";
import { users } from "@/db/schema";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

const registerSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  email: z.string().email("Neplatný email"),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Neplatná data" },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      return NextResponse.json(
        { error: "Tento email je již registrován" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const now = new Date();
    await db.insert(users).values({
      id: generateId(),
      name,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
