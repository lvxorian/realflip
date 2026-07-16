"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash } from "@phosphor-icons/react";

export function DeleteDealButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Opravdu chcete odstranit tento projekt z portfolia?")) return;
    setDeleting(true);
    await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
    router.push("/portfolio");
  }

  return (
    <Button variant="secondary" onClick={handleDelete} loading={deleting} className="text-xs gap-1.5">
      <Trash size={12} weight="bold" />
      Odebrat z portfolia
    </Button>
  );
}
