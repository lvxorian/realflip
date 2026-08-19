import type { Metadata } from "next";
import { INVESTOR_BRAND } from "@/lib/investor-brand";

export const metadata: Metadata = {
  title: `VOP – ${INVESTOR_BRAND}`,
  description: "Všeobecné obchodní podmínky portálu Brickon.cz",
};

export default function VopPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-20">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Všeobecné obchodní podmínky portálu {INVESTOR_BRAND.toLowerCase()}.cz
        </h1>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight">1. Základní ustanovení</h2>

            <p className="mt-3">
              <strong>1.1.</strong> Tyto Všeobecné obchodní podmínky (dále jen „VOP“) upravují práva a povinnosti mezi
              provozovatelem webového portálu a softwarové aplikace na doméně brickon.cz (dále jen „Provozovatel“) a
              uživateli těchto služeb (dále jen „Uživatel“).
            </p>

            <div className="mt-3 rounded-xl border border-border/40 bg-card/60 p-4 text-xs space-y-1">
              <p><strong>Provozovatel:</strong> Lukas Çakmak</p>
              <p><strong>IČO:</strong> 07942664</p>
              <p><strong>Sídlo / Adresa:</strong> Kamenná 202/30, Cheb 35002</p>
              <p><strong>E-mail:</strong> cakmak@tuta.com</p>
            </div>

            <p className="mt-3">
              <strong>1.2.</strong> Používáním portálu brickon.cz Uživatel vyjadřuje bezvýhradný souhlas s těmito VOP a
              zavazuje se jimi řídit.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              2. Charakter služby a vyloučení odpovědnosti (Disclaimer)
            </h2>

            <p className="mt-3">
              <strong>2.1.</strong> Webový portál brickon.cz poskytuje softwarové nástroje, kalkulačky a analytická data
              sloužící výhradně k modelování finančních odhadů a orientačních výpočtů investic do nemovitostí (zejména
              výnosů z pronájmu, strategií typu flip, cash-flow a návratnosti).
            </p>

            <p className="mt-3">
              <strong>2.2. Vyloučení investičního poradenství a garance výnosu:</strong> Veškeré výpočty, tržní data a
              výstupy z kalkulaček na portálu brickon.cz jsou finančním odhadem na základě analýzy trhu a interních
              výpočtů. Nejedná se o garantovaný výnos ani investiční doporučení či nabídku podle zákona č. 256/2004 Sb., o
              podnikání na kapitálovém trhu.
            </p>

            <p className="mt-3">
              <strong>2.3. Orientační povaha dat:</strong> Veškeré algoritmy a odhady (včetně automatických koeficientů
              pro fondy oprav, odhadů nájmů, cen za m² či nákladů na rekonstrukci) mají pouze modelový charakter.
              Provozovatel nezaručuje přesnost, úplnost ani aktuálnost prezentovaných dat a nenese odpovědnost za
              odchylky od reálného tržního vývoje.
            </p>

            <p className="mt-3">
              <strong>2.4. Odpovědnost Uživatele (Due Diligence):</strong> Uživatel bere na vědomí, že jakékoliv
              investiční rozhodnutí činí výhradně na základě vlastního uvážení a na základě vlastního prověření
              faktického, technického a právního stavu nemovitosti. Provozovatel nenese žádnou odpovědnost za finanční
              ztráty, ušlý zisk nebo škody vzniklé v souvislosti s využitím výpočtů z portálu brickon.cz.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight">3. Individuální služby a partnerství</h2>

            <p className="mt-3">
              <strong>3.1.</strong> Používáním aplikace brickon.cz nevzniká automaticky nárok na poskytnutí individuálních
              zprostředkovatelských či investičních služeb ze strany Provozovatele.
            </p>

            <p className="mt-3">
              <strong>3.2.</strong> Případné individuální obchodní vztahy (zejména vyhledávání nemovitostí na míru /
              sourcing fee, řízení rekonstrukcí či společné realizace projektů na bázi dělení zisku) podléhají výhradně
              samostatným písemným smlouvám uzavřeným mezi Provozovatelem a Uživatelem mimo tento webový portál.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight">4. Užívání služby a autorská práva</h2>

            <p className="mt-3">
              <strong>4.1.</strong> Uživatel se zavazuje užívat službu brickon.cz pouze v souladu s platnými právními
              předpisy České republiky a těmito VOP.
            </p>

            <p className="mt-3">
              <strong>4.2.</strong> Veškerý obsah portálu brickon.cz, zejména softwarový kód, výpočetní logika, algoritmy,
              grafické rozhraní, databáze a značka brickon.cz, je duševním vlastnictvím Provozovatele a podléhá
              autorskoprávní ochraně.
            </p>

            <p className="mt-3">
              <strong>4.3.</strong> Bez předchozího písemného souhlasu Provozovatele je zakázáno automatizované stahování
              dat (scraping), zpětné inženýrství výpočetních modelů nebo komerční šíření funkcí a dat portálu třetím
              stranám.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight">5. Ochrana osobních údajů</h2>

            <p className="mt-3">
              <strong>5.1.</strong> Nakládání s osobními údaji Uživatele se řídí platnými právními předpisy, zejména
              nařízením GDPR (EU 2016/679). Podrobné informace o zpracování osobních údajů a souborech cookies jsou
              dostupné v samostatném dokumentu Zásady ochrany osobních údajů umístěném na portálu brickon.cz.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight">6. Závěrečná ustanovení</h2>

            <p className="mt-3">
              <strong>6.1.</strong> Provozovatel si vyhrazuje právo tyto VOP kdykoliv v přiměřeném rozsahu změnit nebo
              doplnit. Nová verze VOP nabývá účinnosti dnem jejího zveřejnění na portálu brickon.cz.
            </p>

            <p className="mt-3">
              <strong>6.2.</strong> Tyto VOP jsou platné a účinné od 19. 8. 2026.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
