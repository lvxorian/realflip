#!/usr/bin/env python3
"""ISIR Hunter — Off-Market opportunity scraper.

Queries the Czech Insolvency Register (ISIR) SOAP API for insolvency proceedings
in configured regions and sends results to the RealFlip Off-Market API.

Requires: requests, zeep
"""

import json
import logging
import os
import sys
from typing import Any

import requests
from zeep import Client, Settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("isir_hunter")

# --- Configuration -----------------------------------------------------------

ISIR_WSDL = os.getenv(
    "ISIR_WSDL",
    "https://isir.justice.cz/isir_ws/services/IsirPub001?wsdl",
)
API_URL = os.getenv(
    "OFF_MARKET_API_URL",
    "http://localhost:3000/api/off-market/leads",
)
API_TOKEN = os.getenv("OFF_MARKET_API_TOKEN")

REGIONS_ENV_FALLBACK = [
    r.strip() for r in os.getenv("ISIR_REGIONS", "cheb,plzen,karlovy vary").split(",")
    if r.strip()
]


def fetch_regions() -> list[str]:
    """Fetch region list from the Off-Market API, fall back to env var."""
    regions_url = API_URL.rstrip("/leads") + "/regions"

    if API_TOKEN:
        try:
            log.info("Stahuji regiony z API: %s", regions_url)
            resp = requests.get(
                regions_url,
                headers={"Authorization": f"Bearer {API_TOKEN}"},
                timeout=15,
            )
            if resp.ok:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    log.info("Nacteno %d regionu z API", len(data))
                    return data
                log.warning("API vratilo prazdny seznam regionu")
            else:
                log.warning("API regiony: HTTP %d, fallback na env", resp.status_code)
        except requests.RequestException as e:
            log.warning("Nelze nacist regiony z API: %s, fallback na env", e)

    log.info("Pouzivam regiony z env fallback: %s", REGIONS_ENV_FALLBACK)
    return REGIONS_ENV_FALLBACK


def query_isir(region: str) -> list[dict[str, Any]]:
    """Query ISIR SOAP API for insolvency proceedings in a region.

    Args:
        region: Czech region/okres name (e.g. 'cheb').

    Returns:
        List of parsed lead dicts with debtorName, caseNumber, address, region.
    """
    log.info("Dotaz na ISIR: region=%s, wsdl=%s", region, ISIR_WSDL)

    settings = Settings(strict=False, xml_huge_tree=True, raw_response=False)
    client = Client(ISIR_WSDL, settings=settings)

    try:
        response = client.service.findListOfProceedings(
            region=region,
        )
    except Exception as e:
        log.error("SOAP chyba pro region %s: %s", region, e)
        raise

    leads: list[dict[str, Any]] = []
    items = getattr(response, "item", []) or getattr(response, "items", []) or []

    for item in items:
        try:
            debtor_name = (
                getattr(item, "debtor_name", None)
                or getattr(item, "debtorName", None)
                or ""
            )
            case_number = (
                getattr(item, "case_number", None)
                or getattr(item, "caseNumber", None)
                or ""
            )
            address = (
                getattr(item, "address", None)
                or getattr(item, "debtorAddress", None)
                or ""
            )

            if not debtor_name or not case_number:
                continue

            leads.append({
                "debtorName": debtor_name.strip(),
                "caseNumber": case_number.strip(),
                "address": address.strip() or None,
                "region": region,
                "rawData": _serialize_item(item),
            })
        except Exception as e:
            log.warning("Chyba parsování záznamu: %s", e)
            continue

    log.info("Region %s: nalezeno %d záznamů", region, len(leads))
    return leads


def _serialize_item(item: Any) -> dict[str, Any]:
    """Convert a SOAP object to a plain dict for rawData storage."""
    try:
        if hasattr(item, "__values__"):
            return dict(item.__values__)
        return {"_type": str(type(item).__name__)}
    except Exception:
        return {}


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
    log.info("=== ISIR Hunter spusten ===")

    if not API_URL:
        log.error("OFF_MARKET_API_URL neni nastaven")
        sys.exit(1)

    regions = fetch_regions()
    log.info("Regiony: %s", ", ".join(regions))
    all_leads: list[dict[str, Any]] = []

    for region in regions:
        try:
            leads = query_isir(region)
            all_leads.extend(leads)
        except Exception as e:
            log.error("Chyba pro region %s: %s", region, e, exc_info=True)
            continue

    if all_leads:
        send_to_api(all_leads)
        log.info("Celkem odeslano: %d zaznamu", len(all_leads))
    else:
        log.warning("Zadne zaznamy k odeslani")

    log.info("=== ISIR Hunter dokoncen ===")


if __name__ == "__main__":
    main()
