import { db } from "@/db";
import { users } from "@/db/schema";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

const registerSchema = z.object({
  name: z.string().min(1, "JmĂ©no je povinnĂ©"),
  email: z.string().email("NeplatnĂ˝ email"),
  password: z.string().min(8, "Heslo musĂ­ mĂ­t alespoĹ 8 znakĹŻ"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "NeplatnĂˇ data" },
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
        { error: "Tento email je jiĹľ registrovĂˇn" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const now = ts();
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
      { error: "InternĂ­ chyba serveru" },
      { status: 500 }
    );
  }
}
