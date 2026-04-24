"""
Build ingredients.json from USDA SR Legacy/Foundation Foods + Taiwan TFDA CSVs.

Outputs:
  data/ingredients.json  — per-gram nutrition for each ingredient
  data/build_report.txt  — picked FDC IDs, descriptions, missing nutrients (for review)
"""
import csv, json, sys, re
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
USDA_SR = ROOT / "raw" / "sr_legacy" / "FoodData_Central_sr_legacy_food_csv_2018-04"
USDA_FD = ROOT / "raw" / "foundation" / "FoodData_Central_foundation_food_csv_2025-12-18"
TW_CSV = ROOT / "raw" / "tw_tfda" / "20_2.csv"
OUT_JSON = ROOT / "data" / "ingredients.json"
OUT_REPORT = ROOT / "data" / "build_report.txt"

sys.path.insert(0, str(Path(__file__).parent))
from ingredients_list import INGREDIENTS, MANUAL_DATA, GROUPS

# USDA nutrient_id → our schema key. Units are notes for per-100g conversion.
USDA_NUTRIENT_MAP = {
    1008: ("kcal",    1/100),   # KCAL per 100g → per 1g
    1003: ("protein", 1/100),   # G
    1004: ("fat",     1/100),   # G
    1005: ("carb",    1/100),   # G
    1079: ("fiber",   1/100),   # G
    1051: ("water",   1/100),   # G
    1087: ("ca",      1/100),   # MG per 100g → mg per 1g (divide 100)
    1091: ("p",       1/100),
    1092: ("k",       1/100),
    1093: ("na",      1/100),
    1090: ("mg",      1/100),
    1089: ("fe",      1/100),
    1095: ("zn",      1/100),
    1098: ("cu",      1/100),
    1101: ("mn",      1/100),
    1100: ("i",       1/100),   # UG per 100g → µg per 1g
    1103: ("se",      1/100),
    1104: ("vitA_IU", 1/100),
    1106: ("vitA_RAE",1/100),
    1110: ("vitD_IU", 1/100),
    1114: ("vitD_ug", 1/100),
    1109: ("vitE_mg", 1/100),
    1165: ("b1",      1/100),
    1166: ("b2",      1/100),
    1167: ("b3",      1/100),
    1170: ("b5",      1/100),
    1175: ("b6",      1/100),
    1177: ("b9",      1/100),
    1178: ("b12",     1/100),
    1180: ("choline", 1/100),
    1269: ("_la",     1/100),   # PUFA 18:2 (linoleic, omega-6)
    1404: ("_ala",    1/100),   # PUFA 18:3 n-3 (ALA, omega-3)
    1278: ("_epa",    1/100),   # EPA
    1272: ("_dha",    1/100),   # DHA
    1220: ("arg",     1/100),
    1221: ("his",     1/100),
    1212: ("ile",     1/100),
    1213: ("leu",     1/100),
    1214: ("lys",     1/100),
    1215: ("met",     1/100),
    1216: ("cys",     1/100),
    1217: ("phe",     1/100),
    1218: ("tyr",     1/100),
    1211: ("thr",     1/100),
    1210: ("trp",     1/100),
    1219: ("val",     1/100),
    1234: ("taurine", 1/100),
}

# ----- Load USDA -----
def load_usda():
    print("Loading USDA data...")
    foods = {}   # fdc_id → (desc, source)
    for source, dir_ in [("SR", USDA_SR), ("FD", USDA_FD)]:
        with open(dir_ / "food.csv", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                foods[r["fdc_id"]] = (r["description"], source)
    # food_nutrient: fdc_id → {nutrient_id: amount}
    nutrients = defaultdict(dict)
    for source, dir_ in [("SR", USDA_SR), ("FD", USDA_FD)]:
        with open(dir_ / "food_nutrient.csv", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                try:
                    nid = int(r["nutrient_id"])
                    if nid in USDA_NUTRIENT_MAP:
                        amt = float(r["amount"]) if r["amount"] else 0
                        # FD has multiple sample rows per food; take max (or avg). Use running mean.
                        key = r["fdc_id"]
                        cur = nutrients[key].get(nid)
                        if cur is None:
                            nutrients[key][nid] = amt
                        else:
                            # simple average of samples
                            nutrients[key][nid] = (cur + amt) / 2
                except (ValueError, KeyError):
                    pass
    print(f"  {len(foods)} foods, {len(nutrients)} with nutrient data")
    return foods, nutrients

# ----- Load Taiwan -----
def load_tw():
    """Return {food_id: (sample_name, english_name, {analysis_item: amount_per_100g_float})}"""
    print("Loading Taiwan TFDA data...")
    tw = {}
    with open(TW_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            fid = r["整合編號"]
            if fid not in tw:
                tw[fid] = {
                    "name": r["樣品名稱"],
                    "en": r["樣品英文名稱"],
                    "data": {},
                }
            amt_str = (r.get("每100克含量") or "").strip()
            item = r["分析項"]
            try:
                amt = float(amt_str) if amt_str else None
            except ValueError:
                amt = None
            if amt is not None:
                tw[fid]["data"][item] = amt
    print(f"  {len(tw)} Taiwan foods")
    return tw

# TW analysis_item → our schema key (per 100g)
TW_NUTRIENT_MAP = {
    "熱量": ("kcal", 1/100),
    "修正熱量": ("kcal", 1/100),
    "粗蛋白": ("protein", 1/100),
    "粗脂肪": ("fat", 1/100),
    "總碳水化合物": ("carb", 1/100),
    "膳食纖維": ("fiber", 1/100),
    "水分": ("water", 1/100),
    "鈣": ("ca", 1/100),
    "磷": ("p", 1/100),
    "鉀": ("k", 1/100),
    "鈉": ("na", 1/100),
    "鎂": ("mg", 1/100),
    "鐵": ("fe", 1/100),
    "鋅": ("zn", 1/100),
    "銅": ("cu", 1/100),
    "錳": ("mn", 1/100),
    "碘": ("i", 1/100),
    "硒": ("se", 1/100),
    "維生素A總量(IU)": ("vitA_IU", 1/100),
    "視網醇當量(RE)": ("vitA_RAE", 1/100),
    "維生素E總量": ("vitE_mg", 1/100),
    "α-生育酚": ("vitE_mg", 1/100),
    "維生素B1": ("b1", 1/100),
    "維生素B2": ("b2", 1/100),
    "菸鹼素": ("b3", 1/100),
    "維生素B6": ("b6", 1/100),
    "葉酸": ("b9", 1/100),
    "維生素B12": ("b12", 1/100),
    "膽鹼": ("choline", 1/100),
    "牛磺酸": ("taurine", 1/100),
}

def pick_usda_id(foods, keywords):
    """Pick shortest SR description containing all keywords. Fall back to FD."""
    if not keywords:
        return None
    kws = [k.lower() for k in keywords]
    sr_matches, fd_matches = [], []
    for fid, (desc, src) in foods.items():
        dl = desc.lower()
        if all(k in dl for k in kws):
            (sr_matches if src == "SR" else fd_matches).append((fid, desc))
    sr_matches.sort(key=lambda x: len(x[1]))
    fd_matches.sort(key=lambda x: len(x[1]))
    matches = sr_matches + fd_matches
    return matches[0] if matches else None

def extract_usda_nutrients(fdc_id, all_nutrients):
    """Return dict of schema_key → per-gram value."""
    raw = all_nutrients.get(fdc_id, {})
    out = {}
    for nid, (key, scale) in USDA_NUTRIENT_MAP.items():
        if nid in raw:
            out[key] = raw[nid] * scale
    # derive omega6 / omega3
    la = out.pop("_la", 0)
    ala = out.pop("_ala", 0)
    epa = out.pop("_epa", 0)
    dha = out.pop("_dha", 0)
    out["omega6"] = la
    out["omega3"] = ala + epa + dha
    return out

def extract_tw_nutrients(tw_entry):
    data = tw_entry["data"]
    out = {}
    for item, (key, scale) in TW_NUTRIENT_MAP.items():
        if item in data:
            # Only set if not already (USDA takes priority when merging)
            out[key] = data[item] * scale
    return out

def merge_nutrients(primary, secondary):
    """Fill primary with secondary values where primary is missing/zero."""
    merged = dict(secondary)
    merged.update({k: v for k, v in primary.items() if v is not None})
    return merged

# Reference schema fields — ensure every output ingredient has these keys.
SCHEMA_FIELDS = [
    "kcal","protein","fat","carb","fiber","water",
    "ca","p","k","na","mg","fe","zn","cu","mn","i","se",
    "vitA_IU","vitA_RAE","vitD_ug","vitD_IU","vitE_mg",
    "b1","b2","b3","b5","b6","b9","b12","choline",
    "omega6","omega3",
    "arg","his","ile","leu","lys","met","cys","phe","tyr","thr","trp","val",
    "taurine",
]

def round_val(v, key):
    if v is None:
        return 0
    # Reasonable precision: macros to 4 decimals (per-g), micros more
    if key in ("kcal","ca","p","k","na","mg","vitA_IU","vitD_IU","choline"):
        return round(v, 3)
    if key in ("i","se","b9","b12","vitA_RAE","vitD_ug"):
        return round(v, 4)
    return round(v, 5)

def main():
    foods, all_nutrients = load_usda()
    tw = load_tw()
    # TW name → food_id index for fallback search
    tw_name_idx = {v["name"]: k for k, v in tw.items()}

    output = []
    report = ["# Build report", ""]
    missing_count = 0

    for (zh, en, group, kws, tw_id, note) in INGREDIENTS:
        entry = {"name": zh, "en": en, "group": group}
        usda_nut = {}
        tw_nut = {}
        picked_desc = None

        # Try USDA
        if kws:
            pick = pick_usda_id(foods, kws)
            if pick:
                fid, desc = pick
                picked_desc = desc
                usda_nut = extract_usda_nutrients(fid, all_nutrients)
                entry["_usda_fdc"] = fid

        # Try Taiwan
        tw_entry = None
        if tw_id and tw_id in tw:
            tw_entry = tw[tw_id]
        elif zh in tw_name_idx:
            tw_entry = tw[tw_name_idx[zh]]
        if tw_entry:
            tw_nut = extract_tw_nutrients(tw_entry)
            entry["_tw_id"] = [k for k,v in tw.items() if v is tw_entry][0]

        # Manual override
        manual = MANUAL_DATA.get(zh, {})

        # Merge priority: manual > usda > tw
        merged = {**tw_nut, **usda_nut, **manual}

        # Fill in schema fields
        for f in SCHEMA_FIELDS:
            entry[f] = round_val(merged.get(f, 0), f)

        # Convert vitD IU if only µg available (1 µg = 40 IU)
        if entry["vitD_IU"] == 0 and entry.get("vitD_ug", 0) > 0:
            entry["vitD_IU"] = round(entry["vitD_ug"] * 40, 3)
        # Remove internal field
        entry.pop("vitD_ug", None)

        output.append(entry)

        # Report
        line = f"{zh:10s} ({en}) [{group}]  usda={picked_desc or 'n/a'}"
        if tw_entry:
            line += f"  tw={tw_entry['name']}"
        if not picked_desc and not tw_entry and zh not in MANUAL_DATA:
            line += "  ⚠️  NO DATA"
            missing_count += 1
        report.append(line)

    # Write outputs
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=1)
    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(report))
    print(f"\nWrote {len(output)} ingredients to {OUT_JSON}")
    print(f"Build report: {OUT_REPORT}")
    if missing_count:
        print(f"⚠️  {missing_count} ingredients with no USDA/TW match — review build_report.txt")

if __name__ == "__main__":
    main()
