# 狗狗鮮食營養計算器

基於 AAFCO 2016 成犬維持標準 + USDA FoodData Central (SR Legacy / Foundation Foods) + 台灣 TFDA 食品營養成分資料庫。

## 功能

- **80 種食材**,涵蓋肉類、海鮮、蛋奶、蔬果、穀物、油脂、補充品
- **RER / DER 自動計算**,含活動係數 + 生命階段 + 疾病狀況調整
- **AAFCO 營養素狀態檢查**(OK / 不足 / 超上限)
- **補充建議** —— 每個「不足」營養素顯示 top 3 食材建議克數,可點擊直接加入
- **多寵 profile** —— 切換寵物,各自獨立食譜
- **多份食譜** per 寵物(例如一般 / 減肥 / 外出)
- **分享連結** —— 一鍵產生 URL + 純文字分享
- **反推 DER** —— 一鍵依比例縮放到每日需求
- 鈣磷比、Omega-6:3 比評估
- 乾物比(DMB)計算

## 本地執行

直接用瀏覽器開 `index.html` 就能跑,或起個本地伺服器:

```bash
python -m http.server 8000
# 開 http://localhost:8000
```

## 重新建置食材資料庫

若要更新 USDA 或台灣資料,或新增食材:

1. **下載原始資料**
   - USDA SR Legacy: <https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip>
   - USDA Foundation Foods: <https://fdc.nal.usda.gov/download-datasets/>(選最新 Foundation Foods CSV)
   - 台灣 TFDA: <https://data.gov.tw/dataset/8543>(下載 CSV)
   - 解壓到 `raw/sr_legacy/` / `raw/foundation/` / `raw/tw_tfda/`
2. **編輯食材清單** `scripts/ingredients_list.py` —— 加入想要的食材 + 搜尋關鍵字 / TFDA 編號
3. **執行** `python scripts/build_data.py`
   - 輸出 `data/ingredients.json`
   - 輸出 `data/build_report.txt`(顯示每個食材對應到哪筆 USDA / TW 資料,便於檢查)

## 檔案結構

```
.
├── index.html              # UI 框架
├── app.js                  # 主邏輯(state / render / share / gap suggest)
├── styles.css              # 樣式
├── data/
│   ├── ingredients.json    # 食材營養資料(每公克)
│   └── aafco.json          # AAFCO 標準 + 生命階段 / 疾病 override
├── scripts/
│   ├── ingredients_list.py # 食材清單(中英名 + USDA 關鍵字 + TFDA ID)
│   ├── build_data.py       # 資料建置工具
│   └── search_usda.py      # 互動式 USDA 搜尋(助於找新食材的 FDC ID)
└── raw/                    # 原始 CSV(.gitignore,不進版控)
```

## 資料來源

- AAFCO 2016 Dog Nutrient Profiles (Adult Maintenance / Growth & Reproduction)
- USDA FoodData Central (SR Legacy 2018-04 + Foundation Foods 2025-12)
- 衛福部食藥署台灣食品營養成分資料庫

## 免責聲明

本工具僅供參考,實際鮮食配方建議諮詢獸醫或犬貓營養師。AAFCO 是美國飼料管理協會的最低營養標準,能指出明顯缺乏但不能保證完美。個別疾病(腎病、胰臟炎、肝病等)的營養需求請以獸醫處方為準。
