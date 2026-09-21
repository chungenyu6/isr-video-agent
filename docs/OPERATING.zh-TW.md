# Live mode 操作手冊

給研究者本人用。對外說明在 `README.md`（英文）。

## 兩個網站，別搞混

| | 位置 | 有「Run live」 | 需要 GPU |
|---|---|---|---|
| **公開站台** | https://chungenyu6.github.io/video-agent-failure-demo/ | ✗ | ✗ |
| **Live 站台** | 這台機器的 port **8090** | ✓ | ✓ |

Live 站台同時包含 56 個正式 run 的回放**和**即時執行。Port 8090 而不是 8080，因為 Phase 0 舊站的 live server 用 8080。

## 啟動

```bash
cd /home/video-agent-failure-demo
bash live.sh                        # 127.0.0.1:8090（預設）
LIVE_HOST=0.0.0.0 bash live.sh      # 要從 host 用 ssh -L 連進 container 時才需要
```

`live.sh` 會依序：同步資料 → 以 base `/` 建置 `app/dist-live` → 執行 `live/setup_boundary.sh` → 啟動 uvicorn。

背景執行：

```bash
setsid bash live.sh > /tmp/live-failure-demo.log 2>&1 &
```

## 連線

```bash
# 在筆電上（container IP 會變，先在 container 裡 hostname -I 查）
ssh -L 8090:<container-ip>:8090 <user>@<host>
```

然後開 **http://localhost:8090/#/live**。走這條路時必須用 `LIVE_HOST=0.0.0.0` 啟動，否則 tunnel 會連到沒有服務在聽的介面。

## 關掉

前景：Ctrl+C。背景：找出 uvicorn 的 PID 再 `kill <pid>`，確認：

```bash
curl -s -m 3 http://127.0.0.1:8090/api/status || echo stopped
```

## 每次 live run 會檢查什麼（任何一項不過就拒絕啟動）

1. 實驗 repo 的凍結檔案（prompt、tools、schema、config、sampling extension、V0、enhanced、policy）hash 必須和 56 個正式 run 記錄的完全一致。
2. `phase0agent` 讀不到任何 GT：實驗的 `data/labels`、以及這個 repo 的 `content/`、`bundles/`、`app/` 內的副本。
3. 兩個模型端點 `:8001`、`:8002` 的 `/health` 必須回 200。

一次只允許一個 run（`live/state/.lock`）。Hard timeout 300 秒，和正式 run 相同。

## Live run 放在哪

| 路徑 | 內容 | 版控 |
|---|---|---|
| `live/runs/<run_id>/` | 完整 run 目錄（結束後 root 700） | ✗ gitignored |
| `live/bundles/<run_id>/` | 給 viewer 的 bundle | ✗ |
| `live/state/<token>.json` | 進度與結果 | ✗ |

**Live run 不是實驗證據**：不寫入實驗 manifest、不佔 64-run 預算、永遠不會出現在公開站台（CI 會檢查 bundles/ 只有 56 個正式 run）。

清理舊的 live run（不影響正式實驗）：

```bash
rm -rf live/runs/fd-pi-live-* live/bundles/fd-pi-live-* live/state/*.json live/state/*.log
```

## GPU 上的模型

Live mode **不管理**模型服務，只檢查它們。目前的配置（同正式實驗）：

| 服務 | Port | GPU |
|---|---|---|
| Qwen3-Coder-30B-A3B（controller） | 8001 | 1, 2 |
| Qwen3-VL-30B-A3B（vision） | 8002 | 3, 5 |

GPU 0 和 4 不屬於這個實驗，不要動。模型沒起來時，Run live 分頁頂端會出現紅色警告，按鈕會停用。

## 權限邊界做了什麼

`live/setup_boundary.sh`（冪等）：repo 根目錄與 `live/` 設為 711（只能穿越、不能列目錄），`live/runs` 755，其餘目錄 700。這是**實驗正確性邊界**，不是 sandbox：沒有 syscall filtering、network namespace 或 resource limit。
