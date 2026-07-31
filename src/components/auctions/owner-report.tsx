import { formatPrice } from "@/lib/utils";

export interface OwnerReportData {
  title: string;
  address?: string | null;
  caseNumber?: string | null;
  auctionDate?: string | null;
  oc?: number | null;
  np?: number | null;
  td: number;
  tc: number;
  asIsTmv: number;
  tbp: number;
  nco: number;
  auctionPayout: number;
  negotiationAdvantage: number;
}

function formatDateCz(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Report pro majitele nemovitosti (dlužníka) – transparentní rozpad kupní ceny
 * a srovnání s dražbou. Bez investičních údajů (ROI, marže, sourcing fee).
 */
export function OwnerReportContent({ data }: { data: OwnerReportData }) {
  return (
    <div id="auction-print-owner" className="text-black">
      <div className="mb-6 pb-4 border-b border-black/20">
        <h1 className="text-lg font-bold">Návrh výkupu nemovitosti před dražbou</h1>
        <p className="text-sm">{data.title}</p>
        {data.address && <p className="text-sm">{data.address}</p>}
        {(data.caseNumber || data.auctionDate) && (
          <p className="text-xs mt-1">
            {data.caseNumber ? `Spisová značka: ${data.caseNumber}` : ""}
            {data.caseNumber && data.auctionDate ? " · " : ""}
            {data.auctionDate ? `Termín dražby: ${formatDateCz(data.auctionDate)}` : ""}
          </p>
        )}
        <p className="text-xs mt-1">Vygenerováno {new Date().toLocaleDateString("cs-CZ")}</p>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div className="border border-black/30 p-3 rounded">
          <p className="text-xs mb-1">Tržní hodnota nemovitosti (100 %)</p>
          <p className="text-lg font-mono font-bold">{formatPrice(data.asIsTmv)}</p>
        </div>
        <div className="border border-black/30 p-3 rounded">
          <p className="text-xs mb-1">Navrhovaná kupní cena (70 % trhu)</p>
          <p className="text-lg font-mono font-bold">{formatPrice(data.tbp)}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm font-semibold mb-1">Rozpad kupní ceny</p>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4">Úhrada dluhů a pohledávek</td>
              <td className="py-1 font-mono text-right">{formatPrice(data.td)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Náklady řízení a převodu</td>
              <td className="py-1 font-mono text-right">{formatPrice(data.tc)}</td>
            </tr>
            <tr className="font-semibold border-t border-black/20">
              <td className="py-1.5 pr-4">K výplatě vlastníkovi (na ruku)</td>
              <td className="py-1.5 font-mono text-right">{formatPrice(data.nco)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.np != null && data.np > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-1">Srovnání s dražbou</p>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 pr-4">V dražbě byste obdrželi (nejnižší podání − dluhy)</td>
                <td className="py-1 font-mono text-right">{formatPrice(Math.max(0, data.auctionPayout))}</td>
              </tr>
              <tr>
                <td className="py-1 pr-4">S tímto návrhem obdržíte</td>
                <td className="py-1 font-mono text-right">{formatPrice(data.nco)}</td>
              </tr>
              <tr className="font-semibold border-t border-black/20">
                <td className="py-1.5 pr-4">Rozdíl ve váš prospěch</td>
                <td className="py-1.5 font-mono text-right">
                  {data.negotiationAdvantage > 0 ? "+" : ""}{formatPrice(data.negotiationAdvantage)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 border-2 border-black p-4 text-xs leading-relaxed">
        <p className="font-semibold mb-1">Co to pro vás znamená:</p>
        <p>
          Z navrhované kupní ceny se nejprve uhradí Vaše dluhy a pohledávky a náklady řízení.
          Zbývající částka {formatPrice(data.nco)} Vám zůstane na ruku. Platba probíhá
          přes advokátní úschovu, uhrazením dluhů se exekuce zastaví a od dražby se upustí.
          Prodej probíhá za součinnosti a se souhlasem soudního exekutora, podmínky se
          nastavují předem – máte tak kontrolu nad celým průběhem i výslednou částkou,
          na rozdíl od dražby, jejíž výsledek závisí na průběhu licitace.
        </p>
      </div>
    </div>
  );
}
