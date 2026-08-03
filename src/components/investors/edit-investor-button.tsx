"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PencilSimple } from "@phosphor-icons/react";
import { InvestorModal, type InvestorFormValue } from "@/components/investors/investor-modal";

export function EditInvestorButton({ investor }: { investor: InvestorFormValue }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setOpen(true)}>
        <PencilSimple size={13} weight="bold" />
        Upravit
      </Button>
      <InvestorModal
        open={open}
        investor={investor}
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
        onDeleted={() => router.push("/investors")}
      />
    </>
  );
}
