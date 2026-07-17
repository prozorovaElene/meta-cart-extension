const input = document.getElementById("backendUrl");
const saveBtn = document.getElementById("saveBtn");
const savedMsg = document.getElementById("savedMsg");

chrome.storage.local.get("backendUrl", ({ backendUrl }) => {
  if (backendUrl) input.value = backendUrl;
});

saveBtn.addEventListener("click", () => {
  const value = input.value.trim().replace(/\/$/, "");
  chrome.storage.local.set({ backendUrl: value }, () => {
    savedMsg.style.display = "inline";
    setTimeout(() => (savedMsg.style.display = "none"), 1500);
  });
});
