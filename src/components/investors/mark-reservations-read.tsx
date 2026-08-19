"use client";

import { useEffect } from "react";

/** Po zobrazení detailu investora označí jeho rezervační notifikace jako přečtené. */
export function MarkReservationsRead({ investorId }: { investorId: string }) {
  useEffect(() => {
    fetch("/api/investors/unread-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ investorId }),
    }).catch(() => {});
  }, [investorId]);

  return null;
}
