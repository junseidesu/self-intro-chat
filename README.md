# 自己紹介AIチャット

訪問者が「僕」について質問すると、AI（Claude）が `worker/profile.md` の内容だけをもとに答える自己紹介サイト。

```
ブラウザ ──▶ GitHub Pages（site/）
   │
   └─ 質問 ──▶ Cloudflare Workers（worker/。APIキーはここだけ）──▶ Claude API
```

- 画面: `site/`（素の HTML/CSS/JS。GitHub Actions で Pages に公開）
- 中継: `worker/`（Cloudflare Workers + TypeScript）
- 設計と経緯: `docs/`（PRD / DESIGN / PLAN）

## 自分の情報に書き換える

| 何を | どこで | 反映方法 |
|---|---|---|
| AI が答える内容 | `worker/profile.md` | `npm --prefix worker run deploy` |
| AI の話し方・ルール | `worker/prompt.md` | `npm --prefix worker run deploy` |
| 見出し（名前・ひとこと・リンク・アイコン） | `site/index.html` | `git push` |
| 質問例のボタン | `site/index.html` の `#suggestions` | `git push` |

`profile.md` に書いたことは、チャットで聞けば誰でも引き出せます。公開してよいことだけを書いてください。
`site/` の CSS/JS を変えたら、`index.html` の `?v=` の数字を上げてください。

## ローカルで動かす

`worker/.dev.vars` に `ANTHROPIC_API_KEY=sk-ant-...` を書いておく（Git には入らない）。

```bash
npm --prefix worker install
npm --prefix worker run dev
python -m http.server 5500 --directory site
```

http://localhost:5500 を開く。確認は `npm --prefix worker run check`（型チェック＋テスト）。

## 公開（初回）

1. **Anthropic Console** で利用額の月上限を設定しておく（乱用時の最後の歯止め）
2. **Worker を公開**
   ```bash
   cd worker
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put ANTHROPIC_API_KEY
   ```
   `deploy` の最後に出る `https://self-intro-chat.<名前>.workers.dev` を控える。
3. **画面の設定を合わせる**
   - `site/config.js` の `workerUrl` を `https://self-intro-chat.<名前>.workers.dev/chat` にする
   - `worker/wrangler.toml` の `ALLOWED_ORIGINS` に `https://<GitHubユーザー名>.github.io` を足し、もう一度 `npx wrangler deploy`
4. **GitHub に公開**: 公開リポジトリを作って push し、リポジトリの Settings → Pages → Source を「GitHub Actions」にする。Actions が終わると `https://<GitHubユーザー名>.github.io/<リポジトリ名>/` で見られる

## 制限

| 何を | 値 | 変える場所 |
|---|---|---|
| 同じ IP からの回数 | 1分に10回 | `worker/wrangler.toml` の `[[ratelimits]]` |
| サイト全体の回数 | 1日200回（日本時間） | `worker/wrangler.toml` の `DAILY_LIMIT` |
| 1回の質問の長さ | 500文字 | `worker/src/validate.ts` と `site/index.html` の `maxlength` |
| 1回の回答の長さ | 1024トークン | `worker/src/claude.ts` の `MAX_TOKENS` |
