from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8000/"

failures: list[str] = []
checked: list[tuple[str, int]] = []

for html_path in sorted(ROOT.rglob("*.html")):
    relative_page = html_path.relative_to(ROOT).as_posix()
    page_url = urljoin(BASE, relative_page)
    response = requests.get(page_url, timeout=10)
    checked.append((page_url, response.status_code))
    if response.status_code != 200:
        failures.append(f"page {relative_page}: HTTP {response.status_code}")
        continue

    soup = BeautifulSoup(response.text, "html.parser")
    refs = [tag.get("src") for tag in soup.find_all("script")]
    refs += [tag.get("href") for tag in soup.find_all("link", rel=lambda value: value and "stylesheet" in value)]
    for ref in refs:
        if not ref or ref.startswith(("http://", "https://", "//", "data:")):
            continue
        asset_url = urljoin(page_url, ref)
        asset_response = requests.get(asset_url, timeout=10)
        checked.append((asset_url, asset_response.status_code))
        if asset_response.status_code != 200:
            failures.append(f"{relative_page} -> {ref}: HTTP {asset_response.status_code}")

print(f"Checked {len(checked)} pages/assets")
for page_url, status in checked:
    if status != 200:
        print(f"FAIL {status} {page_url}")
if failures:
    print("Failures:")
    print("\n".join(failures))
    raise SystemExit(1)
print("All local page and asset references resolved with HTTP 200")
