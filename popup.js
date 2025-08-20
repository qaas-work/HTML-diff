const baselineInfoEl = document.getElementById("baselineInfo");
const messageBoxEl = document.getElementById("messageBox");

/**
 * Shows a temporary message at the bottom of the popup.
 */
function showMessage(text, type = 'success') {
  messageBoxEl.textContent = text;
  messageBoxEl.className = type;
  messageBoxEl.classList.add('show');
  setTimeout(() => {
    messageBoxEl.classList.remove('show');
  }, 3000);
}

/**
 * Refreshes info based on the current tab's URL.
 */
async function refreshBaselineInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  chrome.storage.local.get("baselines", (data) => {
    const baselines = data.baselines || {};
    const baselineForCurrentUrl = baselines[tab.url];

    if (baselineForCurrentUrl) {
      const when = new Date(baselineForCurrentUrl.capturedAt).toLocaleString();
      baselineInfoEl.innerHTML = `<strong>Baseline for this URL captured:</strong><br><em>${when}</em>`;
    } else {
      baselineInfoEl.textContent = "No baseline captured for this URL.";
    }
  });
}

/**
 * Common handler for launching a comparison view.
 * This version uses async/await to prevent race conditions.
 */
async function handleComparison(viewPage) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      throw new Error("Cannot get current tab info.");
    }

    // 1. Capture the current page's HTML using a Promise for async/await
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: "captureHTML", tabId: tab.id }, resolve);
    });

    if (response?.status !== 'ok' || !response.data) {
      throw new Error("Failed to capture current HTML.");
    }
    const currentData = { html: response.data.html, url: response.data.url };

    // 2. Get the corresponding baseline from storage
    const storageData = await chrome.storage.local.get("baselines");
    const baselines = storageData.baselines || {};
    const baselineData = baselines[tab.url];

    if (!baselineData) {
      throw new Error("No baseline found for this URL. Please capture one first.");
    }

    // 3. Save both for the comparison view to use and wait for it to finish
    await chrome.storage.local.set({ baselineData, currentData });

    // 4. NOW it's safe to open the comparison view
    chrome.tabs.create({ url: chrome.runtime.getURL(viewPage) });

  } catch (error) {
    showMessage(error.message, 'error');
    console.error("Comparison handling error:", error);
  }
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', refreshBaselineInfo);

// CAPTURE/UPDATE BUTTON
document.getElementById("captureBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.runtime.sendMessage({ action: "captureHTML", tabId: tab.id }, (response) => {
    if (response?.status === 'ok' && response.data.url) {
      const { html, url } = response.data;
      
      // Read-modify-write to chrome.storage.local
      chrome.storage.local.get("baselines", (data) => {
        const baselines = data.baselines || {};
        baselines[url] = {
          html: html,
          capturedAt: Date.now()
        };
        chrome.storage.local.set({ baselines }, () => {
          showMessage("Baseline saved for this URL!");
          refreshBaselineInfo();
        });
      });
    } else {
      showMessage("Failed to capture baseline.", 'error');
    }
  });
});

// COMPARISON BUTTONS
document.getElementById("compareBtn").addEventListener("click", () => handleComparison("compare_view.html"));
document.getElementById("viewChangesBtn").addEventListener("click", () => handleComparison("merged_view.html"));

// NEW "Manage Baselines" BUTTON
document.getElementById("manageBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("baselines_list.html") });
});
