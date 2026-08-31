import { listNotificationBatches, getNotificationBatch, getCompanyDetail } from "../src/lib/ares/ares-client";

(async () => {
  const batches = await listNotificationBatches();
  console.log("batches:", batches.length, "latest:", batches[0]?.cisloDavky, batches[0]?.datumUvolneniDavky, "changes:", batches[0]?.pocetZmen);
  const notify = await getNotificationBatch(batches[0].cisloDavky);
  console.log("notifs in latest batch:", notify.length);
  const d = await getCompanyDetail("01292790");
  console.log("--- ICO 01292790 ---");
  console.log("name:", d.name);
  console.log("legalForm:", d.legalForm);
  console.log("sidlo:", d.sidlo);
  console.log("status:", d.status, "spis:", d.spisovaZnacka, "court:", d.court);
  console.log("isLiquidating:", d.isLiquidating, "hasExecution:", d.hasExecution);
  console.log("liquidationDate:", d.liquidationDate ? new Date(d.liquidationDate).toISOString() : null);
  console.log("reasoning:", d.liquidationReasoning?.slice(0, 120));
  const d2 = await getCompanyDetail("00172472");
  console.log("--- ICO 00172472 (normal) ---");
  console.log("name:", d2.name, "isLiquidating:", d2.isLiquidating, "hasExecution:", d2.hasExecution, "status:", d2.status);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
