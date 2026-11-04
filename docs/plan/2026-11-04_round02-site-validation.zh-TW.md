# Round 2 靜態改版：本機驗收

日期：2026-11-04 America/Chicago。狀態：**本機驗收完成；研究者其後核准靜態發布，live demo未修改**。

## 交付

- Overview＋Video Agent／Properties／Scenario Forge／Samplers 五個主要頁。
- How it works、Run traces、Previous studies、Evidence & scope；V4.2架構與舊A48／B28 replay保留，標示歷史範圍。
- 288筆搜尋摘要、4個完整案例、72組保存的batch狀態、6個候選cell。新資料約5.6MiB；只有四例附影片及詳細trace。
- 圖片／影片／定義／圖表皆由本站提供；移除外部字型請求。
- README.md／README.zh-TW.md／AGENTS.md與改版計畫已同步。

## 代表例與解讀

| Run | 用途 | 已核對的觀察 |
|---|---|---|
| f2-r002-thompson-4 | 有Pi的FP | appearance investigation；reported 3、expected 2；target_split=1，identity_wrong_different與agent_adopted_wrong均0，不講成身分誤判因果鏈 |
| f2-r023-ce-2 | 無Pi的FP | Pi未啟動；rule_FP=1、answer_FP=1 |
| f2-r002-random-2 | FN | 2.05m/s、gap24；其餘分層由實際保存counts呈現 |
| f2-r001-random-3 | 正常對照 | 22個Y bits全0；不宣稱一般能力保證 |

## 驗收結果

| 檢查 | 結果 |
|---|---|
| TypeScript／Vite production build | 通過 |
| 既有 bundle validator | 21／21通過 |
| 既有 build_experiment.py --check | V5.3／V4.2數字與原報告一致 |
| 新export schema／validator | 288個Y與counts、事件總數、slot唯一性、4例媒體／模型呼叫數、72組狀態與source／asset SHA一致 |
| Leak guard | 所有新JSON通過，未放寬規則 |
| 隔離 | 絕對路徑agent_user.sh --check通過；content、app/public、app/dist維持700 |
| Chromium路由 | 主要五頁、深入頁、V4.2、舊架構／run／B7 case、四例新run皆可載入 |
| 場景瀏覽 | weather／bin／gap／method可篩選，reload後保留選擇 |
| Samplers | FN／FP切換、heatmap格子下鑽、CE／Random／Thompson狀態可查看 |
| Replay | 四例影片metadata正常、960×540、34–36秒；frame slider、track／vehicle overlay與GT展開正常 |
| Gemma／Pi | 真實圖片可載入；有Pi例可讀initial context與cases；無Pi例明示未啟動 |
| 無效路由 | 未發布run與不存在頁面有可返回的明確訊息 |
| 手機／dark mode | 400px，主要五頁與案例在light／dark無整頁橫向溢出；桌面1440px截圖已查看 |
| 瀏覽器錯誤 | 驗收未見JavaScript runtime或HTTP 4xx／5xx錯誤 |

## 本機審閱與限制

預覽只允許container loopback `http://127.0.0.1:5173/#/`。外部裝置的localhost不是此容器；需使用能進入此容器的port forwarding。預覽啟動指令在README.zh-TW.md。截圖在docs/shots/（不進Git）。

完整Gemma prompt body未匯出；頁面提供ledger intent／resolved args與真實input images／output text，明確說明這個限制。其餘284個runs只有摘要，沒有虛構完整trace。未新增模型／Forge執行，沒有獨立confirmation。

測過Chromium，未做Safari／Firefox或實體手機測試。未新增公開preview hosting，不宣稱外部訪客已能連線。

自動審查曾阻擋資料匯出與bridge監聽：前者在強制權限與逐檔不可讀驗證後完成，後者改採loopback預覽。發現agent_user.sh會切換工作目錄，因此本站所有驗權限指令已改用絕對路徑。沒有放寬publish_guard。

## 後續發布核准與修訂

2026-11-04研究者核准將既有Ground Truth相關資訊公開並push發布。主標改以falsification search與failure patterns為主，副標保留實際video agent應用。桌面流程有可見回饋箭頭，手機依Samplers→Forge→Video Agent→Evaluator順時針排列。正式`/isr-video-agent/` base path build通過；CI另驗公開資產schema／hash／leak guard，不依賴lab私有來源。原lab完整validator繼續核對sources與Unix隔離。部署完成與否以對應commit的GitHub Actions結果為準。

## Verifiable Video Agent 文案修訂

依研究者要求，以Verifiable Video Agent作網站展示名稱，主導航與回圈同步；system頁首明示Runtime Verifier在SUT內。新增runtime檢查範圍、其語意正確性限制，以及整套系統受測的說明。三種Verifier／Evaluator維持分開，沒有改變Round 2 FN／FP reward或任何SUT程式。

來源核對：measured SUT `efa176bc3536a9350dc12a9a909d55b63d1b6b69` 的 `inspection/runtime_verifier_v5.py:11–44`（答案shape／source與工具schema檢查）；`inspection/v5.py:175–242`（visual dispatch、case citations、finalize）；`inspection/runtime_verifier_v41.py:11–49`（基底工具／deadline／delivery檢查）。正式例f2-r023-ce-2的host_finalized、Post-hoc pass、answer_FP=1已從發布bundle核對，不將finalization標成獨立traffic-truth pass。

本修訂驗收：正式base-path build、完整Round 2 validator、主導航名稱、Verifier置前內容、實例三種檢查結果、400px light／dark與無HTTP／runtime錯誤均通過；未更動資料或SUT。

## 首頁數字文案修訂

依研究者確認，三組數字改為288 Video tests、48 Condition combinations、3 Search methods。48的附註為4 weather presets × 4 speed ranges × 3 vehicle gaps；3的附註為Random／CE／Thompson與每方法96次。288不加each tested once，首頁不再用cells或staging gaps；Scenario Forge保留實際參數定義與研究範圍。
