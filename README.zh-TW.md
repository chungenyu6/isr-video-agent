# ISR Falsification Search：靜態網站

網站以 **Round 2／frozen V5.3** 為主線。研究者於2026-11-04核准發布既有Ground Truth證據與靜態改版。

正式網址：[ISR Falsification Search](https://chungenyu6.github.io/isr-video-agent/)。Live demo 本次未修改。

| 層次 | 頁面 |
|---|---|
| 初次閱讀 | Overview、Verifiable Video Agent、Properties、Scenario Forge、Samplers |
| 深入探索 | How it works、Run traces、Previous studies、Architecture archive、Evidence & scope |

參數選擇器只瀏覽已保存的結果，不生成影片或執行模型。V4.2、原 A48／B28 與舊 deep links 保留，各自標示實驗範圍。

[改版計畫](docs/plan/2026-11-04_round02-falsification-site.zh-TW.md)／[本次驗收](docs/plan/2026-11-04_round02-site-validation.zh-TW.md)。

## 本機預覽

在此容器內：

```bash
cd /workspace/demos/isr-video-agent-demo/app
npm run dev -- --host 127.0.0.1 --port 5173
```

開啟 `http://127.0.0.1:5173/#/`。這是容器內的 loopback，不是外部電腦的 localhost；從外部觀看須透過能進入此容器的連接埠轉送。沒有公開 preview URL，也未將服務開到容器 bridge。

主要路由：`#/`、`#/system`、`#/properties`、`#/forge`、`#/samplers`。
深入路由：`#/how-it-works`、`#/traces`、`#/previous-studies`、`#/archive/v4.2`、`#/evidence`。

## 資料與重建

`content/search/` 包含288筆正式搜尋摘要、4個完整 replay（影片／tracking／Gemma inputs & outputs／Pi tools）、72組保存的 batch 狀態及 publication manifest。另有14支smoke，不計入搜尋表。只有4個代表案例發布完整 replay，其餘提供摘要。

```bash
cd /workspace/demos/isr-video-agent-demo
python3 -B tools/export_round02.py
python3 -B tools/validate_round02.py
python3 -B tools/validate_bundle.py bundles/*/
python3 -B tools/build_experiment.py --check
cd app
npm run build
```

匯出只讀 frozen 研究來源，沒有 inference。新的 exporter 另有 schema，不改既有 exporter 的讀取範圍。manifest 綁 source SHA、原片 SHA、proxy SHA 與資產 SHA；來源變動時 validator 會失敗。影片 proxy 保留原 frame count、尺寸及 fps。

Gemma 卡提供 ledger 的 intent、resolved arguments、實際圖片與原文回覆；完整 prompt body 未從 raw request 匯出，不能宣稱畫面上的 arguments 就是完整 prompt。

Private local review 資料必須維持 `tested-agent-user` 不可讀，`.git`、`content`、`app/public`、`app/dist` 為700；每次 sync／build 後以**絕對路徑**驗權限：

```bash
bash /workspace/video-agent/sandbox/agent_user.sh --check \
  /workspace/demos/isr-video-agent-demo/bundles \
  /workspace/demos/isr-video-agent-demo/content \
  /workspace/demos/isr-video-agent-demo/app/public \
  /workspace/demos/isr-video-agent-demo/app/dist
```

本次發布已獲授權；push main 會部署既有 GitHub Pages。CI執行 `python tools/validate_round02.py --portable`，檢查公開資產；lab的完整驗證另核對private source SHA與agent隔離。Live demo 本次完全不動。

## Verifiable Video Agent 的展示用語

名稱強調SUT內建Runtime Verifier與可檢視的執行紀錄，不表示交通答案已被證明正確。Runtime Verifier、Post-hoc Verifier與Property Evaluator分開展示；搜尋測試的是包含Runtime Verifier的整套frozen系統。Round 2的sampler回饋仍只有final-answer FN／FP事件，沒有把Verifier pass當成正確性分數。

## 共用系統概念圖與首頁搜尋曲線

Overview與Verifiable Video Agent共用`AgentConcept`：真實Round 2影片幀＋實際detector boxes，配上偵測／追蹤、分組、symbolic traffic rules、conditional Pi＋Nemotron調查、Gemma主動檢視與Runtime Verifier圖示。示例為f2-r001-random-3的frame155；畫面標註program-selected candidate，不混入GT。這是架構示意，並不表示該正常對照run啟動了Pi。

首頁並排FP／FN累積曲線，資料沿用288筆結果，顯示不同y軸尺度與分期採樣限制。Samplers頁共用曲線元件。概念圖使用原生HTML／SVG以維持手機可讀與可存取性；沒有AI合成車輛畫面。

`export_round02.py`從既有發布proxy抽出示例原幀，`illustration.json`綁proxy／image SHA與實際boxes；manifest涵蓋新增資產。`validate_round02.py`檢查截圖標註與原run的tracking／opposing phases一致。不新增模型或Forge執行。
