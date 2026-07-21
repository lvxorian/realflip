import type { ReactNode } from "react";

export default function ReportLayout({ children }: { children: ReactNode }) {
  return <div className="p-8 print:p-0">{children}</div>;
}
