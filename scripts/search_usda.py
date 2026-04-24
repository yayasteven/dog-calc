"""
Interactive USDA FDC search helper.
Usage: python search_usda.py <keyword> [keyword2 ...]
Prints candidate foods with their FDC IDs so we can pick the right one.
"""
import csv, sys, io
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
USDA_DIR = ROOT / "raw" / "sr_legacy" / "FoodData_Central_sr_legacy_food_csv_2018-04"
FOUNDATION_DIR = ROOT / "raw" / "foundation" / "FoodData_Central_foundation_food_csv_2025-12-18"

def search(keywords, limit=15):
    keywords = [k.lower() for k in keywords]
    sr_results, fd_results = [], []
    for source_name, source_dir, bucket in [
        ("SR", USDA_DIR, sr_results),
        ("FD", FOUNDATION_DIR, fd_results),
    ]:
        with open(source_dir / "food.csv", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                desc = row["description"].lower()
                if all(k in desc for k in keywords):
                    bucket.append((source_name, row["fdc_id"], row["description"]))
    # Foundation Foods often has duplicate sample-level entries; dedupe by description.
    seen = set()
    fd_unique = []
    for r in fd_results:
        if r[2] not in seen:
            seen.add(r[2])
            fd_unique.append(r)
    sr_results.sort(key=lambda r: len(r[2]))
    fd_unique.sort(key=lambda r: len(r[2]))
    return (sr_results + fd_unique)[:limit]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python search_usda.py <keyword> [keyword2 ...]")
        sys.exit(1)
    for src, fid, desc in search(sys.argv[1:]):
        print(f"  [{src}] {fid:>7}  {desc}")
