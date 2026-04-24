"""
Master ingredient list.
Each entry: (name_zh, name_en, group, usda_keywords, tw_id_or_name, notes)
- usda_keywords: all must match USDA description (case-insensitive). Shortest match wins.
- tw_id_or_name: Taiwan TFDA 整合編號 if known, else search by sample name.
- For supplements/products not in USDA/TW, set usda_keywords=None and provide manual data.
"""

# group → category ordering for UI
GROUPS = ["牛肉","豬肉","雞肉","鴨肉","羊肉","火雞","兔肉","海鮮","蛋類","乳品","蔬菜","水果","穀物","油脂","豆類","補充品","調味","飼料"]

INGREDIENTS = [
    # --- 牛肉 ---
    ("牛菲力", "Beef tenderloin", "牛肉", ["beef","tenderloin","separable lean only","all grades","raw"], None, ""),
    ("牛後腿", "Beef round", "牛肉", ["beef","round","top round","separable lean only","all grades","raw"], None, ""),
    ("牛腱肉", "Beef shank", "牛肉", ["beef","shank","crosscuts","separable lean only","choice","raw"], None, ""),
    ("牛肝", "Beef liver", "牛肉", ["beef","variety","liver","raw"], None, ""),
    ("牛心", "Beef heart", "牛肉", ["beef","variety","heart","raw"], None, "濃縮牛磺酸"),

    # --- 豬肉 ---
    ("豬里肌", "Pork loin", "豬肉", ["pork","fresh","loin","center loin","separable lean only","raw"], None, ""),
    ("豬後腿", "Pork leg", "豬肉", ["pork","fresh","leg","ham","separable lean only","raw"], None, ""),
    ("豬腱", "Pork shank", "豬肉", ["pork","fresh","leg","shank half","separable lean only","raw"], None, ""),
    ("豬心", "Pork heart", "豬肉", ["pork","variety","heart","raw"], None, ""),
    ("豬肝", "Pork liver", "豬肉", ["pork","variety","liver","raw"], None, ""),

    # --- 雞肉 ---
    ("雞胸肉", "Chicken breast", "雞肉", ["chicken","broiler","breast","meat only","raw"], None, ""),
    ("雞腿肉", "Chicken thigh", "雞肉", ["chicken","broiler","thigh","meat only","raw"], None, ""),
    ("雞胗", "Chicken gizzard", "雞肉", ["chicken","gizzard","all classes","raw"], None, ""),
    ("雞肝", "Chicken liver", "雞肉", ["chicken","liver","all classes","raw"], None, ""),
    ("雞心", "Chicken heart", "雞肉", ["chicken","heart","all classes","raw"], None, ""),

    # --- 鴨/羊/火雞/兔(新增) ---
    ("鴨胸肉", "Duck breast", "鴨肉", ["duck","breast","meat only","raw"], None, ""),
    ("羊肉", "Lamb shoulder", "羊肉", ["lamb","shoulder","arm","separable lean only","raw"], None, ""),
    ("火雞胸肉", "Turkey breast", "火雞", ["turkey","breast","meat only","raw"], None, ""),
    ("兔肉", "Rabbit", "兔肉", ["game meat","rabbit","domesticated","composite of cuts","raw"], None, "低脂低敏"),

    # --- 海鮮 ---
    ("鮭魚", "Salmon", "海鮮", ["fish","salmon","atlantic","wild","raw"], None, ""),
    ("鯖魚", "Mackerel", "海鮮", ["fish","mackerel","atlantic","raw"], None, ""),
    ("鯛魚", "Sea bream", "海鮮", ["fish","snapper","mixed species","raw"], None, "USDA 無台灣鯛,用 snapper 代"),
    ("白帶魚", "Cutlassfish", "海鮮", None, "J0413801", "USDA 無,僅台灣有"),
    ("龍膽石斑", "Grouper", "海鮮", ["fish","grouper","mixed species","raw"], None, ""),
    ("吻仔魚", "Whitebait", "海鮮", None, "J0400501", "USDA 無,僅台灣有"),
    ("牡蠣", "Oyster", "海鮮", ["mollusks","oyster","eastern","wild","raw"], None, ""),
    ("干貝", "Scallop", "海鮮", ["mollusks","scallop","mixed species","raw"], None, ""),
    ("沙丁魚", "Sardine", "海鮮", ["fish","sardine","atlantic","canned","oil","drained solids"], None, "罐裝油漬(瀝油)"),
    ("鱈魚", "Cod", "海鮮", ["fish","cod","atlantic","raw"], None, ""),

    # --- 蛋類 ---
    ("雞蛋", "Chicken egg", "蛋類", ["egg","whole","raw","fresh"], None, ""),
    ("鵪鶉蛋", "Quail egg", "蛋類", ["egg","quail","whole","raw","fresh"], None, ""),

    # --- 乳品(新增) ---
    ("無糖優格", "Plain yogurt", "乳品", ["yogurt","plain","whole milk"], None, "選全脂無糖"),
    ("茅屋起司", "Cottage cheese", "乳品", ["cheese","cottage","creamed","large or small curd"], None, "低鹽版較佳"),

    # --- 蔬菜 ---
    ("高麗菜", "Cabbage", "蔬菜", ["cabbage","raw"], None, ""),
    ("大白菜", "Napa cabbage", "蔬菜", ["cabbage","chinese","pe-tsai","raw"], None, ""),
    ("青江菜", "Bok choy", "蔬菜", ["cabbage","chinese","pak-choi","raw"], None, ""),
    ("綠花椰菜", "Broccoli", "蔬菜", ["broccoli","raw"], None, ""),
    ("白花椰菜", "Cauliflower", "蔬菜", ["cauliflower","raw"], None, ""),
    ("紅蘿蔔", "Carrot", "蔬菜", ["carrots","raw"], None, ""),
    ("白蘿蔔", "Daikon", "蔬菜", ["radishes","oriental","raw"], None, ""),
    ("櫛瓜", "Zucchini", "蔬菜", ["squash","summer","zucchini","includes skin","raw"], None, ""),
    ("絲瓜", "Luffa", "蔬菜", None, "B0313000", "USDA 無,用台灣"),
    ("冬瓜", "Winter melon", "蔬菜", ["gourd","white-flowered","calabash","raw"], None, ""),
    ("大黃瓜", "Cucumber", "蔬菜", ["cucumber","with peel","raw"], None, ""),
    ("牛番茄", "Tomato", "蔬菜", ["tomatoes","red","ripe","raw","year round average"], None, ""),
    ("蘑菇", "White mushroom", "蔬菜", ["mushrooms","white","raw"], None, ""),
    ("香菇", "Shiitake", "蔬菜", ["mushrooms","shiitake","raw"], None, ""),
    ("黑木耳", "Wood ear", "蔬菜", None, "G0100101", "僅台灣有"),
    ("圓茄子", "Eggplant", "蔬菜", ["eggplant","raw"], None, ""),
    ("甜菜根", "Beet", "蔬菜", ["beets","raw"], None, ""),
    ("秋葵", "Okra", "蔬菜", ["okra","raw"], None, ""),
    ("羽衣甘藍", "Kale", "蔬菜", ["kale","raw"], None, ""),
    ("菠菜", "Spinach", "蔬菜", ["spinach","raw"], None, ""),
    ("地瓜葉", "Sweet potato leaves", "蔬菜", None, "E3100101", "USDA 無,用台灣"),
    ("西洋芹", "Celery", "蔬菜", ["celery","raw"], None, ""),
    ("甜椒", "Bell pepper", "蔬菜", ["peppers","sweet","red","raw"], None, ""),
    ("海帶結", "Kelp knot", "蔬菜", ["seaweed","kelp","raw"], None, ""),
    ("南瓜", "Pumpkin", "蔬菜", ["pumpkin","raw"], None, "新增,纖維好"),
    ("蘆筍", "Asparagus", "蔬菜", ["asparagus","raw"], None, "新增"),

    # --- 水果 ---
    ("蘋果", "Apple", "水果", ["apples","raw","with skin","includes foods"], None, ""),
    ("梨子", "Pear", "水果", ["pears","raw"], None, ""),
    ("藍莓", "Blueberry", "水果", ["blueberries","raw"], None, "新增,抗氧化"),
    ("香蕉", "Banana", "水果", ["bananas","raw"], None, "新增"),

    # --- 穀物 ---
    ("生白米", "White rice (raw)", "穀物", ["rice","white","long-grain","regular","raw","unenriched"], None, ""),
    ("生糙米", "Brown rice (raw)", "穀物", ["rice","brown","long-grain","raw"], None, ""),
    ("生胚芽米", "Germ rice", "穀物", None, "A05010", "台灣資料(胚芽稉米平均值)"),
    ("生大麥", "Pearled barley (raw)", "穀物", ["barley","pearled","raw"], None, ""),
    ("藜麥", "Quinoa (raw)", "穀物", ["quinoa","uncooked"], None, "新增,完整蛋白"),
    ("燕麥", "Oats", "穀物", ["cereals","oats","regular and quick","not fortified","dry"], None, "新增,β-葡聚醣"),

    # --- 地瓜類(歸穀物) ---
    ("馬鈴薯", "Potato", "穀物", ["potatoes","flesh and skin","raw"], None, ""),
    ("紅肉地瓜", "Red sweet potato", "穀物", ["sweet potato","raw","unprepared"], None, ""),
    ("金時地瓜", "Golden sweet potato", "穀物", None, "B0400501", "台灣資料(金時甘藷)"),

    # --- 豆類(新增) ---
    ("豆腐", "Firm tofu", "豆類", ["tofu","raw","firm","calcium sulfate"], None, "新增,植物蛋白"),

    # --- 油脂 ---
    ("橄欖油", "Olive oil", "油脂", ["oil","olive","salad or cooking"], None, ""),
    ("葵花油", "Sunflower oil", "油脂", ["oil","sunflower","linoleic"], None, ""),
    ("黑芝麻粉", "Black sesame powder", "油脂", ["seeds","sesame","whole","roasted and toasted"], None, ""),

    # --- 調味 ---
    ("鹽", "Salt", "調味", ["salt","table","iodized"], None, ""),

    # --- 補充品(手動,不從 USDA) ---
    # 保留原版三種飼料商品 + 兩個家常補充品
    ("蛋殼粉", "Eggshell powder", "補充品", None, None, "manual"),
    ("啤酒酵母粉", "Brewer's yeast", "補充品", None, None, "manual"),
    ("海帶粉", "Kelp powder", "補充品", None, None, "manual"),
]

# Manual supplement data (per 1g) — curated from product labels / published analyses
MANUAL_DATA = {
    "蛋殼粉": {
        # 蛋殼約 38-40% 鈣
        "kcal": 0, "protein": 0.03, "fat": 0, "carb": 0, "fiber": 0, "water": 0.02,
        "ca": 380, "p": 1.2,
    },
    "啤酒酵母粉": {
        # 每 100g: ~380 kcal, 蛋白 48g, 高 B 群
        "kcal": 3.80, "protein": 0.48, "fat": 0.01, "carb": 0.39, "fiber": 0.27, "water": 0.05,
        "ca": 0.3, "p": 14.3, "k": 19.5, "na": 0.77, "mg": 1.31, "fe": 0.18, "zn": 0.08, "cu": 0.035, "mn": 0.03, "se": 2.08,
        "b1": 0.12, "b2": 0.043, "b3": 0.416, "b5": 0.12, "b6": 0.014, "b9": 30, "b12": 0.00005,
    },
    "海帶粉": {
        # 每 100g: ~45 kcal, 高碘高礦物
        "kcal": 0.45, "protein": 0.017, "fat": 0.006, "carb": 0.097, "fiber": 0.013, "water": 0.815,
        "ca": 1.68, "p": 0.42, "k": 0.89, "na": 2.33, "mg": 1.21, "fe": 0.028, "zn": 0.012,
        "i": 1500,  # 碘非常高,µg/g
    },
}
