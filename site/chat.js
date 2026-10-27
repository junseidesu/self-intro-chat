const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendButton = document.getElementById("send");

// 会話はこの配列だけで持つ（リロードで消える）
const history = [];

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  // HTML として解釈させない（XSS 対策）
  div.textContent = text;
  log.appendChild(div);
  div.scrollIntoView({ block: "end" });
  return div;
}

async function send(text) {
  history.push({ role: "user", content: text });
  addBubble("user", text);
  sendButton.disabled = true;

  try {
    const res = await fetch(window.CHAT_CONFIG.workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    history.push({ role: "assistant", content: data.text });
    addBubble("assistant", data.text);
  } catch (err) {
    // 失敗した質問は履歴から外す（次の送信に壊れた履歴を含めない）
    history.pop();
    console.error(err);
    addBubble("error", "送信できませんでした。少し時間をおいてもう一度お試しください。");
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
