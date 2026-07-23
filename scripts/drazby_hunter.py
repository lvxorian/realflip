#!/usr/bin/env python3
"""Dražby Hunter — Off-Market opportunity scraper.

Fetches auction listings from Portál dražeb (www.portaldrazeb.cz) 
for real estate auctions (exekuce / insolvence) and sends results 
to the RealFlip Off-Market API.

Requires: requests
"""

import logging
import os
import sys
from typing import Any

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("drazby_hunter")

# --- Configuration -----------------------------------------------------------

DRAZBY_API_BASE = os.getenv(
    "DRAZBY_API_BASE",
    "https://www.portaldrazeb.cz/drazby",
)
API_URL = os.getenv(
    "OFF_MARKET_API_URL",
    "http://localhost:3000/api/off-market/leads",
)
API_TOKEN = os.getenv("OFF_MARKET_API_TOKEN")

# Map Czech cities/municipalities to their kraj (fallback when API has no region)
CITY_TO_REGION = {
    "zajecí": "jihomoravský kraj",
    "lovosice": "ústecký kraj",
    "vrbětice": "zlínský kraj",
    "radovesice": "ústecký kraj",
    "blatná": "jihočeský kraj",
    "zábřeh": "olomoucký kraj",
    "velké karlovice": "zlínský kraj",
    "chrudim": "pardubický kraj",
    "teplice": "ústecký kraj",
    "zaječí": "jihomoravský kraj",
    "neštěmice": "ústecký kraj",
}

ENDPOINTS = [
    "pripravovane.json",
    "probihajici.json",
]


def fetch_auctions(endpoint: str) -> list[dict[str, Any]]:
    """Fetch auction listings from Portál dražeb.

    Args:
        endpoint: API endpoint path (e.g. 'pripravovane.json').

    Returns:
        List of real estate auction dicts.
    """
    url = f"{DRAZBY_API_BASE}/{endpoint}"
    log.info("Nacitam drazby z: %s", url)

    try:
        resp = requests.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
            },
            timeout=30,
        )
    except requests.RequestException as e:
        log.error("Network chyba: %s", e)
        return []

    if not resp.ok:
        log.error("API chyba: HTTP %d", resp.status_code)
        return []

    try:
        data = resp.json()
    except ValueError as e:
        log.error("JSON chyba: %s", e)
        return []

    # API returns object with numeric keys (PHP-style)
    items = list(data.values()) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    items = [i for i in items if isinstance(i, dict) and i.get("item")]

    # Filter only real estate
    real_estates = [i for i in items if i.get("item", {}).get("category", {}).get("type") == "real"]

    log.info("%s: nacteno %d polozek, z toho %d nemovitosti", endpoint, len(items), len(real_estates))
    return real_estates


def map_auction_to_lead(auction: dict[str, Any], source: str) -> dict[str, Any]:
    """Map auction API response to Off-Market lead format.

    Args:
        auction: Raw auction dict from the API.
        source: Source endpoint name for tracking.

    Returns:
        Lead dict ready for API submission.
    """
    item = auction.get("item", {})
    title = item.get("title", "")

    loc = auction.get("location_district") or item.get("location_district") or {}

    county_name = auction.get("location_county_name") or ""
    if not county_name and isinstance(loc.get("county"), dict):
        county_name = loc["county"].get("county_name", "")

    city = ""
    if isinstance(loc.get("city"), dict):
        city = loc["city"].get("city_name", "")

    district = loc.get("district_name", "")

    # Fallback: extract location from title
    if not city and not district and title:
        import re
        # Pattern: "okres X"
        m = re.search(r'okres\s+([A-ZÁ-Ž][a-zá-ž]+(?:\s+[A-ZÁ-Ž][a-zá-ž]+)?)', title)
        if m:
            district = m.group(1)
            if not county_name:
                county_name = district
        else:
            # Pattern: last significant word = city/municipality
            # "Rodinný dům Zaječí, podíl 1/10" → "Zaječí"
            # "Pozemky Lovosice" → "Lovosice"
            before_comma = title.split(",")[0].strip()
            words = before_comma.split()
            candidates = [w for w in words if len(w) > 2 and w[0].isupper()
                         and not re.match(r'^\d', w) and '/' not in w
                         and w.lower() not in ('s', 'v', 'u', 'o', 'k', 'z', 'za', 'na', 'pro')]
            if candidates:
                city = candidates[-1]
            else:
                # Fallback: last word from full title
                words_all = title.split()
                if words_all:
                    last = words_all[-1].strip(",. ")
                    if len(last) > 2 and last[0].isupper() and '/' not in last:
                        city = last

    # Fallback: look up city in region map
    if not county_name and city:
        county_name = CITY_TO_REGION.get(city.lower(), "")

    return {
        "debtorName": item.get("title", "Neznama nemovitost"),
        "caseNumber": auction.get("number", ""),
        "address": city or None,
        "region": county_name.lower() if county_name else None,
        "rawData": {
            "source": source,
            "link": auction.get("link"),
            "estimatedPrice": auction.get("estimated_price"),
            "itemPrice": auction.get("item_price"),
            "status": auction.get("status"),
            "startAt": auction.get("start_at"),
            "auctioneer": auction.get("auctioneer_office", {}).get("title"),
            "district": district,
            "category": item.get("category"),
        },
    }


def send_to_api(leads: list[dict[str, Any]]) -> None:
    """Send leads to the RealFlip Off-Market API.

    Args:
        leads: List of lead dicts to insert.
    """
    if not API_TOKEN:
        log.error("OFF_MARKET_API_TOKEN neni nastaven — nelze odeslat data")
        return

    log.info("Odesilam %d zaznamu na %s", len(leads), API_URL)

    try:
        resp = requests.post(
            API_URL,
            json=leads,
            headers={
                "Authorization": f"Bearer {API_TOKEN}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
    except requests.RequestException as e:
        log.error("Network chyba pri odesilani: %s", e)
        sys.exit(1)

    if resp.ok:
        result = resp.json()
        log.info(
            "API odpoved: inserted=%d, skipped=%d",
            result.get("inserted", 0),
            result.get("skipped", 0),
        )
    else:
        log.error(
            "API chyba: HTTP %d, response=%s",
            resp.status_code,
            resp.text[:500],
        )
        sys.exit(1)


def main() -> None:
    """Main entry point."""
    log.info("=== Drazby Hunter spusten ===")

    if not API_URL:
        log.error("OFF_MARKET_API_URL neni nastaven")
        sys.exit(1)

    all_leads: list[dict[str, Any]] = []

    for endpoint in ENDPOINTS:
        try:
            auctions = fetch_auctions(endpoint)
            for auction in auctions:
                lead = map_auction_to_lead(auction, endpoint)
                if lead.get("caseNumber"):
                    all_leads.append(lead)
        except Exception as e:
            log.error("Chyba pro endpoint %s: %s", endpoint, e, exc_info=True)
            continue

    if all_leads:
        send_to_api(all_leads)
        log.info("Celkem odeslano: %d zaznamu", len(all_leads))
    else:
        log.warning("Zadne zaznamy k odeslani")

    log.info("=== Drazby Hunter dokoncen ===")


if __name__ == "__main__":
    main()
