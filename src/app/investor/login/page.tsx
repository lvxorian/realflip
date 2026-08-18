"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrickonLogo } from "@/components/investor/brickon-logo";
import { Eye, EyeSlash, ArrowRight, LockSimple } from "@phosphor-icons/react";
import { INVESTOR_BRAND } from "@/lib/investor-brand";

export default function InvestorLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/investor-portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Přihlášení se nezdařilo.");
      setLoading(false);
      return;
    }
    router.replace("/investor");
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-accent/20 via-background to-emerald-500/10 items-center justify-center">
        <div className="absolute inset-0 property-image-shimmer opacity-40" />
        <div className="relative flex items-center justify-center">
          <BrickonLogo size={160} tone="light" className="logo-spin" />
        </div>
      </div>

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
                <LockSimple size={24} weight="fill" className="text-accent" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight uppercase">{INVESTOR_BRAND}</h1>
              <p className="text-sm text-muted mt-1">Váš soukromý přístup k nabídkám</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Přihlašovací jméno"
                placeholder="např. jan"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />

              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    label="Heslo"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[38px] text-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

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
                Přihlásit se
                <ArrowRight size={16} weight="bold" />
              </Button>
            </form>

            <p className="text-center text-xs text-muted mt-6">
              Nemáte přístupové údaje?{" "}
              <Link href="/" className="text-accent hover:text-accent-hover transition-colors">
                Kontaktujte nás
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
