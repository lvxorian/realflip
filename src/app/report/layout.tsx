import type { ReactNode } from "react";
import "../globals.css";

export default function ReportLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body className="bg-white text-gray-900 p-8 print:p-0">{children}</body>
    </html>
  );
}
