# Round 2 Falsification Search：靜態網站改版計畫

狀態：**已獲實作指示，本機實作及驗收完成，等待研究者審閱；尚未部署**。日期：2026-11-04 America/Chicago。

## 1. 目標與範圍

受眾對 agent、影片與測試略有概念，但不知道這個實驗的問題、組件分工或結果。網站應讓訪客在約一分鐘內回答：我們測什麼？怎麼找到反例？四個組件各做什麼？實際找到什麼？點哪裡能看證據？

主敘事改為 Round 2 falsification search，以 frozen V5.3 為被測系統。四個組件各有獨立頁面；短首頁負責串起全程。保留 How it works、實際 replay、Gemma 輸入／輸出、Pi + Nemotron 工具動作。V4.2 移至 Archive，既有能力批次和受控 diagnostics 與 Round 2 清楚分開。

使用者已指示「去做吧」，本次執行靜態改版並完成本機預覽供研究者審閱；公開部署及 live demo 更新各等明確指示。所有互動僅瀏覽已保存資料，不生成影片、不發模型請求、不改 SUT／evaluator／研究紀錄。沿用 React/Vite、GitHub Pages 與 hash routing，不另建託管平台。

本計畫承接使用者本次要求，取代本站 AGENTS.md 舊 Scope 中「不新增 overview」及兩頁限制；實作時同步更新該 Scope。其資料邊界、誠實呈現及禁止 auto-push 規則繼續適用。網站文案沿用 English；計畫及 README.zh-TW.md 使用繁體中文。

## 2. 已核對的現況與證據

本站 HEAD：`928371111ecc4b0ff33eb9cde3c6d532763b3529`；規劃前有 untracked `.hypothesis/`，保留不處理。執行入口 `app/src/main.tsx` → `App.tsx`，既有 router 預設進 run replay。實作前再次記錄完整 HEAD／dirty。

| 證據 | 本次閱讀位置與用途 |
|---|---|
| 現有導航 | `app/src/router.ts:9–28`、`app/src/App.tsx`：run／case／architecture，首頁預設 replay |
| 現有說明頁 | `app/src/v53/ArchitecturePage.tsx:55–70`：系統說明與舊能力測量在同頁 |
| 既有 agent replay | `app/src/v53/Investigation.tsx:1–6,45–98`：可保留動作／回覆／host continuation 的區分 |
| Round 2 結果 | `/workspace/experiments/falsification-search/rounds/round-02/RESULTS.zh-TW.md:3–81` |
| Random／CE 實作 | 該輪 `runtime/policies.py:15–40,55–88` |
| Thompson 實作 | 該輪 `extension96/policy96.py:13–44` |
| Forge request／產物 | 該輪 `runtime/campaign.py:203–251`；研究 `scripts/fs_io.py:67–69` |
| Property 欄位 | `/workspace/experiments/video-agent-capability/evaluator/property_evaluator_v2.py:18–31,72–121` |
| 實際案例卡 | Round 2 新 campaign `reports/cases/f2-r002-thompson-4.zh-TW.md:3–23`，有參數、FN/FP、Pi、matching 與 overlay |
| 固定問題 | `/workspace/experiments/falsification-search/config/protocol.json:22`，實作時須再與 campaign query hash 綁定 |

此處定位供開發查證，不是公開網站的來源路徑。尚未逐一檢查 288 runs 的全部 ledger／Gemma images／Pi messages；案例選取及新 exporter 必須先做離線 inventory，不能宣稱所有 traces 都已適配現有 viewer。

## 3. 資訊架構

主導航：**Overview · Video Agent · Properties · Scenario Forge · Samplers**。另有清楚可見的 **Explore deeper** 次導航，通往 How it works、Run traces、Previous studies、Architecture archive、Evidence & scope；頁尾亦保留入口。手機用可存取的選單，不縮小文字硬塞。

### 兩層閱讀：第一次理解與深入討論

第一層是 Overview 與四個組件頁，服務初次接觸本研究的訪客。每頁用白話問題、簡圖與一個實例交代最重要的訊息，完整看完不需要展開技術資料。

第二層是我們自己、同事與深入討論者使用的網站內細節頁。Archive 意指有版本／實驗範圍標籤的歷史內容，仍可在網站導航找到並完整閱讀，不是移除、只留 Git tag 或要求下載原始碼。這些頁面也維持 self-contained，說明資料來源、指標定義與限制，不假定讀者看過本聊天。

| 深入頁面 | 收錄內容 | 入口 |
|---|---|---|
| How it works | 跨組件 call sequence、資料流、信任邊界；連到各組件的完整架構 | Explore deeper；Overview 的流程說明 |
| Run traces | 已發布案例的逐步 tool calls、Gemma 輸入／輸出、Nemotron recorded replies、答案與獨立評估 | Explore deeper；各組件的 View trace |
| Previous studies | 原 A48／B28、受控 diagnostics、結果範圍與既有 replay | Explore deeper；相關結果旁的 Previous study |
| Architecture archive | V4.2 原架構、replay、歷史結果及與 V5.3 的設計比較；明示 V4.2 未參與 Round 2 | Explore deeper；Video Agent 的 Earlier architecture |
| Evidence & scope | 版本／來源摘要、指標詳細定義、方法限制與發布資料範圍 | Explore deeper；各圖表來源入口 |

短補充（例如名詞、公式、單個欄位）用原頁展開；長內容（完整架構、整段 trace、歷史比較）放獨立可 deep-link 的細節頁。每個主要頁面放一個與當前內容相關的深入入口，不把整個技術附錄塞進 accordion。細節頁提供 breadcrumb／返回對應組件，保留選中的 run 與 filters。

| 路由（規劃） | 主要問題 | 首屏最重要的內容 |
|---|---|---|
| `#/` | 我們在做什麼、找到什麼？ | 一句實驗目標、搜尋循環、288 runs 的 FN/FP 結果、代表案例入口 |
| `#/system` | 影片如何變成答案？ | 任務問題、V5.3 pipeline、host／Gemma／Pi + Nemotron 分工 |
| `#/properties` | 如何知道哪裡錯了？ | 漏報與多報的直觀例子、L0–L6、實際 case 的 outcome |
| `#/forge` | 影片怎麼來、改哪些條件？ | 四 weather × 四 speed bins × 三 gap；已錄製結果選擇器 |
| `#/samplers` | 下一個測什麼由誰決定？ | 三方法的選點與更新差異、相同 96 次預算下的實測 |
| `#/how-it-works` | 四個組件怎樣接起來？ | 單一 run 的跨組件步驟、輸入輸出與 ground truth 邊界 |
| `#/search/run/<public-id>` | 這次到底發生什麼？ | 一個 Round 2 真實 run 的影片、答案、評估及可展開 trace |
| `#/previous-studies` | 舊能力測試和本輪有何不同？ | A48／B28 的原始範圍及舊 replay 入口 |
| `#/archive/v4.2` | 以前的 agent 架構長什麼樣？ | 六工具架構、歷史結果、未做本輪搜尋的明確標籤 |

現有 `#/run/...`、`#/case/...`、`#/architecture`、`#/architecture/v4.2` 保持可用，使用兼容路由或明示歷史入口，不把舊 clip 重新標成 Round 2。舊 `t`／`stage` deep links 保留。無效連結顯示可返回入口，不默默選另一筆 run。

首頁是導讀，不再是所有 panel 的容器；四個組件頁才是主要內容。How it works 解釋跨組件串接；Video Agent 主頁保留簡化 pipeline，完整系統架構移到可由該頁進入的細節頁。共用圖表與定義使用單一資料來源，避免複製後漂移。

## 4. 首頁：先看懂問題，再看一個例子

建議標題：**Finding when a video agent gets traffic wrong**。

短介紹：We vary a simulated traffic scene, run a fixed video agent, and check whether it misses or overcounts wrong-way vehicles.

內容依序：

1. 一句目標，附「Recorded experiment · Round 2 · frozen V5.3」。
2. 可點擊四組件的循環：Samplers → Scenario Forge → Video Agent → Property Evaluator → Samplers。前向是影片／答案，回饋是 FN/FP 事件；ground truth 另一路只進 evaluator。
3. 精簡數字：288 search runs、48 condition cells、三方法各 96；FN／FP 定義貼近表格。
4. 三列表：Random FN 1/96、FP 7/96；CE 2/96、10/96；Thompson 0/96、7/96。說明它們是發生事件的 run 數，同一 run 可能有多種事件，不相加當失敗率。
5. 一個主要 FP 案例入口，另有「See a missed vehicle」及成功對照。先用一句可證明的觀察帶路，詳細訊息點進案例。
6. 簡短範圍：固定場景、adaptive search、沒有獨立 confirmation。6 個 FP 候選 cell 是搜尋產物，不是已確認 high-risk 結論。

首頁不放完整 L0–L6 表、所有模型呼叫、48 格熱圖、GPU 圖、版本 leaderboard 或逐 run 大表。

## 5. Video Agent：最重要的是誰負責哪一步

首屏顯示實際固定任務，另附一句白話版本：

> How many vehicles, if any, move opposite to the prevailing nearby traffic in the same roadway area? List their colors, and state whether the total count remains uncertain.

圖示 pipeline：Track → Group → Traffic rule → Look → Investigate when needed → Assemble。清楚標 host program、Gemma、Pi + Nemotron；不讓人誤會每次都由 LLM 開始，也不將 Pi harness 當成另一個模型。

主互動：選一個真實 Round 2 run，依階段觀看 detector boxes → tracks → vehicle groups → wrong-way candidates → answer。每步只顯示一個重點，完整細節展開。保留「一個 track 不是保證一台實體車」及 `count_complete` 的簡短說明。

Gemma 卡：**What it was shown / What it was asked / What it returned**，同時顯示實際 crops、問題與原文。Pi + Nemotron 卡：**Tool call / Tool result / Recorded reply / Decision**，host 的 continuation 獨立標記；thinking off，不補寫內部推理。

主頁不混入 ground truth；答案之後可點「Evaluate this answer」跳到同一 run 的 Property Evaluator 區。無 Pi 時顯示「Pi was not started」，不可捏造 investigation。

以 View architecture 連到系統細節頁，保留元件／信任邊界、call sequence、data/decision flow 三視角；主頁只展開短解釋。Round 2 measured commit 用 manifest 綁定，不能直接套用舊 A48 freeze。舊 44/48 和 5/6 在 Previous studies 中連同範圍成對展示，不當成 Round 2 數字。

## 6. Property Evaluator：先懂 FN/FP，再看 22 欄

最重要的訊息：**答案是否錯誤，以及觀察到哪一層有問題，是兩件事。** Evaluator 是 oracle-reading 的 after-run 評估，不是 SUT 的交通規則或 Runtime Verifier。

首屏先用真實案例的 GT／answer 車輛對照解釋 FN（漏報）與 FP（多報），與實際欄位名稱並列：`F_FN = int(answer_FN > 0)`、`F_FP = int(answer_FP > 0)`。計數可能大於 1；事件是是否至少一次。

預設顯示七個可展開層級；完整 22 欄在本頁可查：

| 層級 | 白話問題 | 欄位 |
|---|---|---|
| L0 | 有沒有合法答案？ | `no_submission`, `invalid_submission` |
| L1 | target 有被追蹤到嗎？ | `missed_targets` |
| L2 | 身分與計數單位有沒有被拆／合錯？ | `target_fragmented`, `target_split`, `target_merged` |
| L3 | 交通規則選車及檢視覆蓋如何？ | `rule_FN`, `rule_FP`, `coverage_gap` |
| L4 | 視覺描述與身分比對如何？ | `color_FN`, `color_FP`, `identity_wrong_same`, `identity_wrong_different` |
| L5 | agent 的採納與引用如何？ | `unsupported_claims`, `missing_support`, `agent_adopted_wrong` |
| L6 | 最終答案有什麼問題？ | `answer_FN`, `answer_FP`, `answer_color_miss`, `abstention`, `unknown`, `count_complete_overclaim` |

每欄提供一句定義、該 run 的 count／Y bit、來源說明及限制。主搜尋只用 L6 FN/FP 更新 sampler；其他欄位不是 reward。`target_fragmented` 是資訊性標記，不能渲染成自動失敗；`identity_unparsed`／`identity_unevaluable` 是額外資訊，不冒充 22 欄之一。缺失／無法判定不顯示成 0 或綠色通過。

頁面用三個分離卡說明 Runtime Verifier（當下合法性）、Post-hoc Verifier（事後完整性）、Property Evaluator（與 oracle 比較）。Verifier pass 不等於答案正確，`count_complete=false` 也不等於數量錯誤。共現 flags 只作定位線索，不自動畫成因果鏈。

## 7. Scenario Forge：最重要的是可變／固定條件與產物

第一屏左右對照：條件選擇器與對應的已保存影片。參數只提供本輪真正使用的範圍：

- Weather：ClearNoon、ClearSunset、HardRainNoon、HardRainSunset。
- Speed bins：[2,7)、[7,12)、[12,17)、[17,22] m/s；選到 run 時顯示實際 requested／realized speed，而不是假設 bin 中點。
- Gap：12／18／24 m，明示為畫面外 staging slot spacing，不能叫每幀實際車距或直接等同可見密度。

選 cell 後列出已保存 runs，再選 run；不存在的組合顯示「No recorded run」，不能替代成鄰近片。介面標「Browse recorded scenarios」，沒有 Generate 按鈕。已測同 cell 仍可能是不同實際速度，不能宣稱 matched control。

固定條件另有一小卡：scene seed 9943、35 s、12 車／2 逆向、960×540／10 fps、固定 camera／geometry；不混用舊能力資料集的 20 s 影片。

How generated：選參數 → 組 request → POST 建立 job → GET 等待 → 下載 video／GT／trace／metadata → 對齊與場景檢查 → 交影片給 SUT。公開只顯示經篩選的 request 範例與 API 相對路徑，不含 endpoint、token、內部路徑或完整 debug 檔。

輸出分兩路：video 給 SUT；GT／simulator trace 給評估端，不進模型可見內容。Forge 的 GT 是 simulator／adapter 資料，不是 Gemma 的猜測。完整部署 hash 未知，Evidence & scope 誠實保留此 provenance 限制。

## 8. Samplers：最重要的是如何選下一個條件

導航名稱採 **Samplers**；頁內副標可寫 Search methods。避免 Optimizer 暗示正在訓練／修改 V5.3 或已找到全域最佳解。

| 方法 | 一句解釋 | 互動展示 |
|---|---|---|
| Random | 每次均勻抽 weather、speed bin、gap，再於 bin 內抽速度 | 真實 pick 與條件分布；沒有學習後權重 |
| CE | FN／FP 各有三軸權重；遇到相應失敗才提高被選 levels 的權重 | 保存 batch 前後權重與實際事件；標為本實作的 CE-style update |
| Thompson | 每 cell 的 FN／FP 用 Beta posterior 抽樣，兼顧不確定與已觀察失敗 | 保存 posterior／pick；不是永遠選最高平均值 |

進階說明：CE 四次 batch 前二導航 FN、後二 FP，事件發生時各軸 `w *= 0.9; w[selected] += 0.1`；Thompson 每事件 Beta(1+k,1+n-k)，各 draw 選 top2，同 batch 不先更新；每有效 run 同時更新兩事件。動畫只重播保存狀態；未保存的 random draws 不自行生成後假裝歷史。

主要比較圖：累積 FN／FP 事件曲線，可切換事件，三方法同圖；橫軸是各 arm slot，圖註不是同步 wall-clock，64 次 prefix／後續追加清楚標記。配合小表顯示事件數、cell coverage 44/48、43/48、48/48、首事件 slot。成本／calls 放進階區。

48-cell 圖用 method／weather／FN-FP 選擇器，單張 speed×gap 圖顯示 k/n；未測灰色，0/n 與無資料分開。點格子開已保存案例。顯示的是 adaptive sample event fraction，不是已確認風險或 causal weather effect。

必留一句限制：分期擴充、單一固定場景、每方法 96 次，沒有獨立 confirmation，不能判定一般方法優越性。Thompson 零 FN 只代表此次未觀察到。

## 9. 代表案例與閱讀層次

首頁最多三個案例入口，不上 288 張卡。預設主打 FP，其次 FN、成功對照。離線盤點後選 3–4 個深度 replay：

1. 有 Pi 的 FP，保留實際 Gemma observation、工具回覆與最終答案，僅在 evidence 支持時解釋車輛身分鏈。
2. 無 Pi 的 FP，防止訪客誤以為所有錯誤都來自 agent。Round 2 報告記錄此類 3 次。
3. 一個低速／gap24 的 FN，找出漏在哪裡；若證據不足直接標未知。
4. 一個沒有 FN/FP 的 run，示範正常路徑；不稱完全所有 properties 通過，除非逐欄吻合。

每案例上方固定三件事：條件、系統回答、評估結果。影片預設無 GT，點「Compare with ground truth」才加獨立圖層。下方三級揭露：一段已驗證摘要 → stage timeline → 完整已發布 tool／Gemma／Nemotron trace。

同一 public run ID 在四頁共用並可 deep-link，返回後保留 filters。詳細 trace 是 lazy-load，首頁不下載全部 ledger／影片。所有 288 筆僅提供精簡可篩選索引與安全摘要；完整 replay 先做選定代表例。非代表例清楚標「summary only」，不給空白 trace 按鈕。

保留 6 個候選 cell 的可查清單與每格 k/n；不是要求全部做深度 replay。公開每個媒體與 GT 片段前先列入 publish inventory，確認與來源 video hash 對齊。既有 12 clips 的發布範圍不自動當作所有新素材已審閱。

## 10. 視覺及 self-contained 原則

- 沿用品牌與基本色彩；大標題、短句、一個主視覺、充足留白。每頁第一屏只回答一個核心問題。
- 正常文字與對比度可讀；錯誤／未知不能只靠紅綠，並帶文字標籤。手機 400 px 不橫向溢出。
- 頁內預設短，進階資料折疊；主要 CTA 是看一個實際例子，不是下載 raw log。
- 名詞第一次出現就解釋：wrong-way、FN／FP、track／vehicle、oracle、Pi、cell。頁尾簡短 glossary。
- 看懂方法與結論不需要看本聊天、讀內部文件或登入實驗機；影片、圖表、定義及案例皆使用本站靜態資產。
- 不依賴 runtime API／內網／模型服務；網站有網頁主機即可運作，不等同必須支援 file:// 離線模式。
- 公開 provenance 放 Evidence & scope 的摺疊區，可查版本、測量範圍及來源摘要，不把內部實作路徑塞進產品主流程。

## 11. 資料匯出與工程工作

保留現有 exporter 的限制，新增 **Round 2 專用 allowlist exporter 與 schema**，不直接將研究 raw directory 複製到網站，也不把 Round 2 偽裝成舊 A48 bundle。舊 exporter 不擴大讀取禁區。

規劃產物：

- experiment summary：scope、三方法結果、48-cell summaries、public run index、來源 hashes。
- properties glossary：22 欄定義、型別與 failure／information 分類，從 evaluator 已核對定義建立。
- selected run bundles：只取 viewer 所需 tracking／vehicle snapshots／visual responses／Pi 已完成訊息／answer／Y 與 verifier summaries；去除內部來源、provider errors、endpoint、secret。
- scenarios：安全參數、proxy videos、已選 GT overlays；與 source SHA 綁定。
- sampler history：保存 picks、權重／posterior；不用新隨機模擬取代歷史。
- publication manifest：每個 public asset 的來源 hash、轉換步驟、來源 campaign／run identity；private source mapping 不放瀏覽器。

query／prompt inventory 僅引用既有來源，不讀取或發布禁用的 raw requests、TRACE、agent-command、worker-request、tokens。Gemma／Nemotron 可見內容以允許的 ledger／finished messages 為證據；無法重建就標缺失。

Round 2 兩個 campaign 必須合併並去重：parent Random／CE64 + extension Random／CE32／Thompson96。正式288與smoke14分開；不能從新增160的目錄誤報整輪結果。測量 SUT `efa176bc3536a9350dc12a9a909d55b63d1b6b69`、evaluator `836f4f57dac36f031e8fc62aefe74d035726550c`、serving `a5f40e153d6ab9834a897785abdb8e6810fd7403`；資料以 campaign manifest 為最終核對，不與舊 A48 的 `476ef72` 混同。

同步更新本站 README.md、README.zh-TW.md、AGENTS.md、網站資料來源／run guide；標示舊頁與新頁的範圍。只修改 demo repository，不動 study／SUT／serving／live demo。源資料以 read-only、Python -B 讀取。

## 12. 實作階段與驗收

| 階段 | 交付 | 狀態 |
|---|---|---|
| P0 | 現況與來源查證、資訊架構與本計畫 | 完成；未做逐 run 全量 trace inventory |
| P1 | 代表例 evidence inventory、公開資產清單、資料 schema 與數字綁定 | 已完成 |
| P2 | 首頁＋四個組件頁的本機首版、How it works、Archive 路由 | 已完成 |
| P3 | 安全匯出、選定 replay、參數瀏覽、搜尋圖與交叉連結 | 已完成 |
| P4 | 數字／邊界／build／瀏覽器驗收、README／AGENTS 更新 | 已完成，見同目錄site-validation文件 |
| P5 | 提供本機預覽及變更說明，研究者審閱 | 本機頁面／截圖已備妥，等待審閱 |
| P6 | 獲明確指示後發布靜態網站；live demo 另案 | 未授權執行 |

P2 可先以已核對 summary 做版面，但所有未接上的媒體標為待接資料；交 P5 時主要路徑不得留 placeholder。

驗收清單：

1. 新訪客只讀首頁可說明目標、四組件與一個反例；每元件頁首屏有清楚輸入／作用／輸出。深入內容與歷史內容在網站導航可找到；不用先讀它們也能理解主要五頁。完整架構／trace／舊 replay 不因改版消失。
2. summary 與原報告一致：288 search；各96；FN 1/2/0、FP 7/10/7；6候選；smoke14另列。不得由 FN+FP 算總失敗率。
3. 22欄順序／counts／Y 與既有 evaluator 輸出吻合；資訊性／未知不當錯誤或通過；Verifier 不當 correctness。
4. selected cases 的影片／frame／crops／引用／答案／Y 對同一 run；無 Pi run 不出現虛構對話；所有摘要可追到已發布證據。
5. filters 只回傳真實已保存 runs；0/n／未測、exact speed／bin、gap語意正確；三方法分期限制可見。
6. 新 schema、數字對帳與 publish_guard；驗全部 public assets 無內部 paths／credentials。保留舊 `validate_bundle.py`、`build_experiment.py --check` 檢查原資料。
7. `npm run build`；桌面與400px、light/dark、鍵盤操作、深連結／刷新／舊路由／媒體／折疊／失效資料驗收；有測不到的瀏覽器部分明列。
8. 新增 published data 後跑 `bash /workspace/video-agent/sandbox/agent_user.sh --check bundles content app/public`，如另增資料根目錄也納入。測試只做離線匯出／前端，不啟動新模型或 Forge job。
9. 提交可審閱的本機結果與精簡驗收紀錄；沒有 push／公開部署、沒有更新 live demo。

## 13. 開發交接

依本計畫先做 Round 2 的離線資料與代表案例 inventory，再在既有靜態網站加入 Overview、Video Agent、Properties、Scenario Forge、Samplers，保留 How it works 與歷史 deep links。以四元件分工和一個真實反例作主線，trace 逐層展開；V4.2 移 Archive，A48/B28 移 Previous studies。新素材用獨立 allowlist 匯出與 hash binding，所有數字對照 Round 2 兩批既有資料，禁止新增模型／Forge 執行。完成本機預覽、資料邊界及前端驗收並回報變更／證據／限制後停止；公開部署與 live demo 更新等研究者另行指示。
