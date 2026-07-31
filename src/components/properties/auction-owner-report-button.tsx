import Link from "next/link";
import { Scales } from "@phosphor-icons/react/dist/ssr";

interface AuctionOwnerReportButtonProps {
  propertyId: string;
}

export function AuctionOwnerReportButton({ propertyId }: AuctionOwnerReportButtonProps) {
  return (
    <Link
      href={`/report/${propertyId}?type=owner`}
      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-xs font-medium text-foreground/80 transition-colors hover:bg-card-hover"
    >
      <Scales size={14} weight="duotone" />
      Report pro majitele (PDF)
    </Link>
  );
}
