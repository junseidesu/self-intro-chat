const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendButton = document.getElementById("send");

// 会話はこの配列だけで持つ（リロードで消える）
const history = [];

// Worker は10件まで受け付ける。先頭を user にするため奇数の9件に切り詰める
const MAX_SENT_MESSAGES = 9;

function recentHistory() {
  return history.slice(-MAX_SENT_MESSAGES);
}

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  // HTML として解釈させない（XSS 対策）
  div.textContent = text;
  log.appendChild(div);
  div.scrollIntoView({ block: "end" });
  return div;
}

const ERROR_MESSAGES = {
  refusal: "すみません、その質問にはお答えできません。",
  default: "送信できませんでした。少し時間をおいてもう一度お試しください。",
};

class ChatError extends Error {}

// Worker からの SSE を読み、届いた文字ごとに onText を呼ぶ。全文を返す
async function readStream(res, onText) {
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const event of events) {
      if (!event.startsWith("data: ")) continue;
      const data = JSON.parse(event.slice("data: ".length));
      if (data.error) throw new ChatError(data.error);
      if (data.done) return full;
      full += data.text;
      onText(full);
    }
  }
  // done が来ないまま切れた
  throw new ChatError("stream_closed");
}

async function send(text) {
  history.push({ role: "user", content: text });
  addBubble("user", text);
  sendButton.disabled = true;
  const bubble = addBubble("assistant loading", "…");

  try {
    const res = await fetch(window.CHAT_CONFIG.workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: recentHistory() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ChatError(data.error ?? `HTTP ${res.status}`);
    }
    const answer = await readStream(res, (soFar) => {
      bubble.classList.remove("loading");
      bubble.textContent = soFar;
      bubble.scrollIntoView({ block: "end" });
    });
    history.push({ role: "assistant", content: answer });
  } catch (err) {
    // 失敗した質問と途中までの回答は消す（次の送信に壊れた履歴を含めない）
    history.pop();
    bubble.remove();
    console.error(err);
    const key = err instanceof ChatError ? err.message : "default";
    addBubble("error", ERROR_MESSAGES[key] ?? ERROR_MESSAGES.default);
  } finally {
    sendButton.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || sendButton.disabled) return;
  input.value = "";
  send(text);
});
