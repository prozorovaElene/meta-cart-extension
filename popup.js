const signedOutView = document.getElementById("signedOutView");
const signedInView = document.getElementById("signedInView");
const errorBox = document.getElementById("errorBox");

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function render(signedIn) {
  signedOutView.classList.toggle("hidden", signedIn);
  signedInView.classList.toggle("hidden", !signedIn);
}

function refreshStatus() {
  chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, (res) => {
    render(!!(res && res.signedIn));
  });
}

document.getElementById("signInBtn").addEventListener("click", () => {
  clearError();
  chrome.runtime.sendMessage({ type: "SIGN_IN" }, (res) => {
    if (res && res.ok) {
      render(true);
    } else {
      showError((res && res.error) || "Sign in failed.");
    }
  });
});

document.getElementById("signOutBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "SIGN_OUT" }, () => {
    render(false);
  });
});

document.getElementById("optionsLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

refreshStatus();
