"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { House, ArrowRight } from "@phosphor-icons/react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registrace selhala");
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Chyba připojení");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full">
      {/* Left — decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-accent/20 via-background to-emerald-500/10 items-center justify-center">
        <div className="absolute inset-0 property-image-shimmer opacity-40" />
        <div className="relative text-center max-w-md px-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/20 border border-accent/30">
            <House size={32} weight="fill" className="text-accent" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-3">Začněte investovat</h2>
          <p className="text-muted text-sm leading-relaxed">
            14 dní zdarma. Sledujte 10+ realitních portálů, analyzujte inzeráty pomocí AI a najděte podhodnocené nemovitosti dřív než konkurence.
          </p>
        </div>
      </div>

      {/* Right — register form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-grid">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="glass-strong rounded-[2.5rem] p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20">
                <House size={24} weight="fill" className="text-accent" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Vytvořit účet</h1>
              <p className="text-sm text-muted mt-1">14 dní zdarma, bez závazků</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Jméno"
                placeholder="Vaše jméno"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="vas@email.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Heslo"
                type="password"
                placeholder="••••••••••••"
                helper="Minimálně 6 znaků"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-danger"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" loading={loading} className="w-full h-12 rounded-xl text-base gap-2">
                Registrovat se
                <ArrowRight size={16} weight="bold" />
              </Button>
            </form>

            <p className="text-center text-sm text-muted mt-6">
              Už máte účet?{" "}
              <Link href="/login" className="text-accent hover:text-accent-hover transition-colors">
                Přihlaste se
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
