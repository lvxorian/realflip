import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ts } from "@/lib/utils";

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const update: Record<string, unknown> = { updatedAt: ts() };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Jméno nemůže být prázdné" }, { status: 400 });
      }
      update.name = name;
    }

    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Neplatný email" }, { status: 400 });
      }
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
        .then((r) => r[0]);
      if (existing && existing.id !== session.user.id) {
        return NextResponse.json({ error: "Tento email už používá jiný účet" }, { status: 409 });
      }
      update.email = email;
    }

    if (body.password !== undefined && body.password !== "") {
      if (typeof body.password !== "string" || body.password.length < 8) {
        return NextResponse.json({ error: "Heslo musí mít alespoň 8 znaků" }, { status: 400 });
      }
      // změna hesla vyžaduje potvrzení aktuálním heslem (ochrana při odcizení session)
      if (typeof body.currentPassword !== "string" || !body.currentPassword) {
        return NextResponse.json(
          { error: "Pro změnu hesla zadejte aktuální heslo" },
          { status: 400 }
        );
      }
      const me = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1)
        .then((r) => r[0]);
      const { compare, hash } = await import("bcryptjs");
      const ok = me?.passwordHash
        ? await compare(body.currentPassword, me.passwordHash)
        : false;
      if (!ok) {
        return NextResponse.json({ error: "Aktuální heslo není správně" }, { status: 403 });
      }
      update.passwordHash = await hash(body.password, 12); // sladěno s register (cost 12)
    }

    await db
      .update(users)
      .set(update)
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
