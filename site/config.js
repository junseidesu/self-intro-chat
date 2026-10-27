// Worker の URL（秘密ではない）。ローカルで開いたときは手元の wrangler dev を使う
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

window.CHAT_CONFIG = {
  workerUrl: isLocal
    ? "http://localhost:8787/chat"
    : "https://self-intro-chat.selfchat.workers.dev/chat",
};
