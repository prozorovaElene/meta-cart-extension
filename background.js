// background.js (Manifest V3 service worker)
// Responsibilities:
//   1. OAuth-style sign-in using chrome.identity.launchWebAuthFlow
//   2. Store/retrieve the access token + backend base URL in chrome.storage.local
//   3. Relay CART_ITEM_CAPTURED messages from content scripts to the backend API

const DEFAULT_BACKEND_URL = "https://your-backend.example.com"; // set the real one via the options page

async function getBackendUrl() {
  const { backendUrl } = await chrome.storage.local.get("backendUrl");
  return backendUrl || DEFAULT_BACKEND_URL;
}

async function getToken() {
  const { authToken } = await chrome.storage.local.get("authToken");
  return authToken || null;
}

async function setToken(token) {
  await chrome.storage.local.set({ authToken: token });
}

async function clearToken() {
  await chrome.storage.local.remove("authToken");
}

// --- OAuth-style sign-in flow ---
// Expected backend contract:
//   GET {backendUrl}/extension/authorize?redirect_uri=<redirectUri>&client_id=unified-cart-extension
//   -> user logs in / approves on your website
//   -> your site redirects to `${redirectUri}#access_token=<TOKEN>` (or ?access_token=)
async function signIn() {
  const backendUrl = await getBackendUrl();
  const redirectUri = chrome.identity.getRedirectURL(); // e.g. https://<extension-id>.chromiumapp.org/
  const authUrl =
    `${backendUrl}/extension/authorize` +
    `?client_id=unified-cart-extension` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectedTo) => {
      if (chrome.runtime.lastError || !redirectedTo) {
        const message = chrome.runtime.lastError ? chrome.runtime.lastError.message : "No redirect received";
        reject(new Error(message));
        return;
      }
      try {
        const parsed = new URL(redirectedTo);
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
        const queryParams = parsed.searchParams;
        const token = hashParams.get("access_token") || queryParams.get("access_token");
        if (!token) {
          reject(new Error("No access_token found in redirect"));
          return;
        }
        setToken(token).then(() => resolve(token));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function signOut() {
  await clearToken();
}

// --- Relay captured cart items to the backend ---
// Expected backend contract:
//   POST {backendUrl}/api/cart-items
//   Headers: Authorization: Bearer <token>
//   Body: { url, domain, title, price, currency, image, capturedAt }
async function sendCartItem(payload) {
  const token = await getToken();
  if (!token) {
    return { ok: false, needsAuth: true };
  }
  const backendUrl = await getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/api/cart-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      await clearToken();
      return { ok: false, needsAuth: true };
    }
    if (!response.ok) {
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CART_ITEM_CAPTURED") {
    sendCartItem(message.payload).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  if (message.type === "SIGN_IN") {
    signIn()
      .then((token) => sendResponse({ ok: true, token }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message.type === "SIGN_OUT") {
    signOut().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "GET_AUTH_STATUS") {
    getToken().then((token) => sendResponse({ signedIn: !!token }));
    return true;
  }
});
