chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureHTML") {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      func: () => ({
        html: document.documentElement.outerHTML,
        url: location.href
      })
    }, (results) => {
      if (!results || !results[0] || !results[0].result) {
        sendResponse({ status: "error", data: null });
        return;
      }
      // Just send the captured data back, don't save anything here.
      sendResponse({ status: "ok", data: results[0].result });
    });

    return true; // Keep the message channel open for the async response.
  }
});