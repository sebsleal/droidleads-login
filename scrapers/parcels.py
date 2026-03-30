"""
Miami-Dade GeoProp parcel layer query for storm-first pre-permit leads.
Queries all parcels in a given set of ZIP codes to find properties
that may have storm damage before any permit is filed.
"""
import time
import requests
from typing import Any

PARCEL_URL = (
    "https://gisfs.miamidade.gov/mdarcgis/rest/services/"
    "MD_PA_PropertySearch/MapServer/8/query"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
}

# Miami-Dade ZIP codes by general area (for storm targeting)
MIAMI_DADE_ZIPS = [
    33101, 33125, 33126, 33127, 33128, 33129, 33130, 33131, 33132,
    33133, 33134, 33135, 33136, 33137, 33138, 33139, 33140, 33141,
    33142, 33143, 33144, 33145, 33146, 33147, 33149, 33150, 33154,
    33155, 33156, 33157, 33158, 33160, 33161, 33162, 33163, 33165,
    33166, 33167, 33168, 33169, 33170, 33172, 33173, 33174, 33175,
    33176, 33177, 33178, 33179, 33180, 33181, 33182, 33183, 33184,
    33185, 33186, 33187, 33189, 33190, 33193, 33194, 33196,
]


def fetch_parcels_by_zip(
    zip_codes: list[int],
    limit_per_zip: int = 100,
    delay: float = 0.3,
) -> list[dict[str, Any]]:
    """Fetch residential parcels for given ZIP codes from the GeoProp layer."""
    results = []
    for z in zip_codes:
        params = {
            "where": f"zip_code = {int(z)}",
            "outFields": "FOLIO,address,zip_code",
            "returnGeometry": "false",
            "resultRecordCount": limit_per_zip,
            "f": "json",
        }
        try:
            r = requests.get(PARCEL_URL, params=params, headers=HEADERS, timeout=15)
            r.raise_for_status()
            data = r.json()
            features = data.get("features") or []
            for feat in features:
                attrs = feat.get("attributes") or {}
                folio = str(attrs.get("FOLIO") or "").strip()
                address = str(attrs.get("address") or "").strip().title()
                if folio and address:
                    results.append({
                        "folioNumber": folio,
                        "propertyAddress": address,
                        "zip": str(z),
                    })
        except Exception as e:
            print(f"  [Parcels] ZIP {z} failed: {e}")
        time.sleep(delay)
    return results
