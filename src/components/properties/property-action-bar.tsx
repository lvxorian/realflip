"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Phone, ShareNetwork, Check } from "@phosphor-icons/react";
import { FavoriteButton } from "@/components/ui/favorite-button";

interface PropertyActionBarProps {
  propertyId: string;
  title: string;
  url: string | null;
  phone: string | null;
  initialFavorited: boolean;
}

/**
 * Pevný spodní akční bar na mobilu (nad globální bottom nav): Zavolat,
 * Sdílet (Web Share API s fallbackem na schránku) a Oblíbené.
 * Nativní mobilní vzor realitních aplikací.
 */
export function PropertyActionBar({ propertyId, title, url, phone, initialFavorited }: PropertyActionBarProps) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const shareUrl = url ?? window.location.href;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch (err) {
        // Uživatel zrušil sdílení → tiše nic (nemá smysl házet chybu).
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Odkaz zkopírován do schránky");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Sdílení se nezdařilo");
    }
  };

  return (
    <div className="lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+4rem)] inset-x-0 z-30 px-3 pb-2">
      <div className="glass-strong rounded-2xl border border-border/50 p-2 flex items-center gap-2">
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="flex-1 h-11 rounded-xl bg-accent text-white flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            <Phone size={18} weight="fill" />
            Zavolat
          </a>
        ) : (
          <span className="flex-1 h-11 rounded-xl bg-accent/40 text-white/70 flex items-center justify-center gap-2 text-sm font-semibold">
            <Phone size={18} weight="fill" />
            Zavolat
          </span>
        )}
        <button
          onClick={share}
          aria-label="Sdílet nemovitost"
          className="h-11 w-11 shrink-0 rounded-xl glass flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          {copied ? (
            <Check size={18} weight="bold" className="text-accent" />
          ) : (
            <ShareNetwork size={18} weight="bold" />
          )}
        </button>
        <FavoriteButton
          propertyId={propertyId}
          initialFavorited={initialFavorited}
          size={18}
          className="h-11 w-11 shrink-0 rounded-xl glass"
        />
      </div>
    </div>
  );
}
