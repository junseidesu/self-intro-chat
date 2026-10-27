# DESIGN: 自己紹介AIチャット

最終更新: 2026-10-27 / 状態: 下書き / 対応PRD: docs/PRD.md

## 1. 用語集
| 日本語 | コード上の名前 | 意味 |
|---|---|---|
| プロフィール | `profile` / `profile.md` | AIが答える根拠になる、僕についての情報 |
| 指示文 | `systemPrompt` / `prompt.md` | AIの話し方・答えてよい範囲を決める文 |
| メッセージ | `Message` | 会話の1発言（訪問者 or AI） |
| 会話 | `history` | メッセージの並び。ブラウザのメモリ上だけにある |
| 中継サーバー | `worker` | Cloudflare Workers。APIキーを持ち、Claude APIを呼ぶ |
| 質問例 | `suggestions` | 最初に表示するボタン |

## 2. ドメインの規則（不変条件）
- APIキーはWorkerのSecretにだけ存在する。サイト側のコード・リポジトリには絶対に入れない
- AIの回答の根拠は profile.md だけ。書いていないことは作らない
- 会話は `user` と `assistant` が交互に並び、先頭と末尾は `user`（Claude APIの要件）
- 訪問者の1メッセージは500文字まで、AIの回答（送り返されてくる分）は3000文字まで。Workerに送る会話は直近10メッセージまで
- 回答の長さは最大1024トークン（`max_tokens`。考える量は effort `low` で抑える）
- 制限（回数・1日上限・文字数）に引っかかったリクエストはClaude APIを呼ばない

## 3. 状態遷移（チャット画面）
```
待機中 ──送信──▶ 送信中 ──最初の文字が届く──▶ 受信中 ──完了──▶ 待機中
                   │                            │
                   └──────失敗/制限──────────────┴──▶ エラー表示 ──▶ 待機中
```
- 送信中・受信中は送信ボタンを押せない（二重送信を防ぐ）
- エラーで終わった質問は会話に残さない（次の送信に壊れた履歴を含めない）

## 4. データモデル
永続データはない。会話はブラウザのメモリ上の配列だけ。

### Message
| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| role | `"user"` \| `"assistant"` | ✓ | 誰の発言か |
| content | string | ✓ | 本文（user は500文字まで） |

### Worker への要求 `POST /chat`
```json
{ "messages": [ { "role": "user", "content": "趣味は？" } ] }
```
Worker は受け取ったデータを必ず検証する（形・役割の並び・文字数・件数）。

### Worker からの応答
- 成功: `text/event-stream`（SSE）で本文の断片を順に送る。`data: {"text":"..."}` を繰り返し、最後に `data: {"done":true}`
- Claude 呼び出し前の失敗: JSON `{ "error": "rate_limited" | "daily_limit" | "invalid_request" | "forbidden_origin" }` と HTTP ステータス（429 / 400 / 403）
- Claude 呼び出し中の失敗: SSE は始まっているので、`data: {"error":"upstream_error" | "refusal"}` を送って閉じる。画面は途中までの回答を消してエラーを表示する
- `done` が来ないまま切れたら、画面は失敗として扱う

## 5. 画面と URL
| 画面 | URL | 目的 | 主な要素 |
|---|---|---|---|
| トップ | `/`（github.io） | 自己紹介＋チャット | 見出し（名前・一言・リンク）、会話欄、質問例、入力欄 |

1画面だけ。各状態:
- 空: 「AIに僕のことを聞いてみてください」の案内＋質問例ボタン
- 読み込み中: 回答欄に「…」の表示、送信ボタン無効
- エラー: 回答欄に赤字で理由（制限中／通信失敗）と「もう一度送る」案内
- 通常: 会話の吹き出しが並ぶ。新しい発言で一番下までスクロール

## 6. 状態管理
| 状態 | 種類 | 置き場所 |
|---|---|---|
| 会話 `history` | 画面内の状態 | `chat.js` のモジュール変数（リロードで消える） |
| 送信中フラグ | UI状態 | `chat.js` |
| 入力中の文字 | フォーム状態 | `<textarea>` そのもの |
| profile.md / 指示文 | 設定 | Worker にビルド時に同梱 |
| 1日の利用回数 | サーバー状態 | Cloudflare KV（日付ごとのキー） |

## 7. アーキテクチャ
```
site/                     # GitHub Pages に公開される（静的ファイルだけ）
  index.html
  style.css
  chat.js                 # 画面の操作、SSEの読み取り
  config.js               # Worker の URL（秘密ではない）
worker/                   # Cloudflare Workers
  src/
    index.ts              # 入口: CORS → 制限 → 検証 → Claude 呼び出し → SSE 返却
    validate.ts           # 要求の検証（純粋関数・テスト対象）
    limits.ts             # 回数制限・1日上限
    prompt.ts             # profile.md と prompt.md から指示文を組み立てる
  profile.md              # 僕の情報（ここを編集して再デプロイ）
  prompt.md               # AIへの指示
  test/
  wrangler.toml
.github/workflows/pages.yml  # site/ を GitHub Pages に公開
docs/
```
依存の向き: `index.ts` → `validate` / `limits` / `prompt`（この3つは互いに依存しない）

## 8. 技術構成
- サイト: 素の HTML / CSS / JavaScript（ビルドなし）
- 中継: Cloudflare Workers + TypeScript（strict）、Wrangler でデプロイ
- AI: Claude API、`@anthropic-ai/sdk`、モデルは `claude-haiku-5-5`、effort `low`
- 制限: Workers Rate Limiting（IPごと 10回/分、`IP_RATE_LIMITER`）、KV（全体 1日200回、`USAGE`。日本時間の日付ごとに数える）
  - 処理の順番: Origin 確認 → IP の回数制限 → 中身の検証 → 1日の上限（正しい要求だけ数える） → Claude 呼び出し
  - どちらの制限も厳密ではない（Rate Limiting は Cloudflare の拠点ごと、KV は読んで書くまでに割り込まれうる）。多少超えても月額上限で止まる
- テスト: Vitest（Worker の検証・制限・指示文の組み立て）
- 公開先: サイト → GitHub Pages（Actions で `site/` を公開）、中継 → Cloudflare Workers（`*.workers.dev`）

## 9. 非機能要件
- 性能: 回答が2秒以内に出始める（ストリーミング）
- a11y: 入力欄にラベル、Enterで送信・Shift+Enterで改行、新しい回答を `aria-live` で読み上げ
- レスポンシブ: 幅360pxのスマホで崩れない。入力欄は画面下に固定
- セキュリティ:
  - APIキーは `wrangler secret` でだけ設定
  - CORS は GitHub Pages のURL（と開発用の localhost）だけ許可
  - AIの回答は `textContent` で表示し、HTMLとして解釈しない（XSS対策）
  - Anthropic Console で**月の利用額の上限**を設定する（最後の砦）
- 想定する脅威と対策:
  | 脅威 | 対策 |
  |---|---|
  | キーを盗まれる | ブラウザに出さない。リポジトリに `.dev.vars` を入れない（.gitignore） |
  | 大量送信で課金される | IPごとの回数制限、1日上限、月額上限、回答長上限 |
  | 長文を送って入力トークンを増やす | 1メッセージ500字、10メッセージまで |
  | 指示を上書きさせて無関係な用途に使う | 指示文で範囲外を断る＋回答長上限で被害を小さくする |
  | CORSを無視した直接アクセス（curl等） | CORSでは防げないので、回数制限と上限で被害を抑える。必要ならTurnstileを追加（Should） |

## 10. 決定記録（ADR）
### ADR-001 中継サーバーに Cloudflare Workers
- 状況: GitHub Pages は静的ファイルしか置けず、APIキーを隠せない
- 決定: Cloudflare Workers に中継を置き、キーはSecretに保存
- 代替案: Vercel/Netlify Functions（同等だがサイトもそちらに移す流れになりやすい）、訪問者にキーを入力させる（使い物にならない）
- 影響: Cloudflare アカウントが必要。profile.md を変えたら Worker の再デプロイが必要

### ADR-002 サイトはビルドなしの素の HTML/JS
- 状況: 1画面で、状態は会話の配列だけ
- 決定: React等は使わない
- 代替案: Vite + React（この規模では過剰）
- 影響: 画面が増えたら見直す

### ADR-003 profile.md は全文を毎回AIに渡す（検索の仕組みは作らない）
- 状況: 情報量は数千字程度
- 決定: 指示文に全文を入れる
- 代替案: RAG（ベクトル検索）。分量が少ないうちは精度もコストも不利
- 影響: profile.md が数万字を超えたら見直す

### ADR-004 profile.md は公開情報として扱う
- 状況: 公開チャットなので、書いた内容は質問すれば引き出せる
- 決定: profile.md は公開リポジトリに置いてよい情報だけを書く
- 影響: 隠したい情報は書かない

## 11. 仮定
- Cloudflare の無料プランで Rate Limiting と KV が使える範囲に収まる
- 1日の上限200回・IPごと10回/分は仮の値。公開後に様子を見て調整
