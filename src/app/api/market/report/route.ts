import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCachedReport, getOrGenerateReport } from "@/lib/market/report";

const RANGES = ["1q", "1y", "3y", "5y"];
const REGION_RE = /^(cr|praha|stredocesky|jihocesky|plzensky|karlovarsky|ustecky|liberecky|kralovehradecky|pardubicky|vysocina|jihomoravsky|olomoucky|zlinsky|moravskoslezsky)$/;

function parse(req: Request): { regionKey: string; range: string; force: boolean } {
  const url = new URL(req.url);
  const regionKey = REGION_RE.test(url.searchParams.get("region") ?? "") ? url.searchParams.get("region")! : "cr";
  const range = RANGES.includes(url.searchParams.get("range") ?? "") ? url.searchParams.get("range")! : "1y";
  const force = url.searchParams.get("force") === "1";
  return { regionKey, range, force };
}

export async function GET(req: Request) {
  const { regionKey, range } = parse(req);
  const report = await getCachedReport(regionKey, range);
  if (!report) {
    return NextResponse.json({ error: "Zpráva není k dispozici" }, { status: 404 });
  }
  return NextResponse.json(report);
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret ? req.headers.get("x-cron-secret") === cronSecret : false;
  if (!isCron) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const { regionKey, range } = parse(req);
  const report = await getOrGenerateReport(regionKey, range, true);
  if (!report) {
    return NextResponse.json({ error: "Zpráva není k dispozici" }, { status: 404 });
  }
  return NextResponse.json(report);
}
