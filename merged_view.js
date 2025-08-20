/**
 * Tokenizer for HTML structure.
 */
function tokenize(str) {
  const re = /(<[^>]+>)|(\w+(?:=['"][^'"]*['"])?)|(\s+)|([^\w\s<>]+)/g;
  return str.match(re) || [];
}

/**
 * Diffs two strings using the LCS algorithm on their tokens.
 */
function diffTokens(aStr, bStr) {
  const A = tokenize(aStr);
  const B = tokenize(bStr);
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (A[i] === B[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) {
      diff.push(['equal', A[i]]);
      i++;
      j++;
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      diff.push(['insert', B[j]]);
      j++;
    } else if (i < n) {
      diff.push(['delete', A[i]]);
      i++;
    }
  }
  return diff;
}

/**
 * Builds a single HTML string with <ins> and <del> tags to show changes.
 */
function buildMergedHTML(aStr, bStr) {
  const diff = diffTokens(aStr, bStr);
  let html = '';
  diff.forEach(([type, value]) => {
    if (type === 'equal') {
      html += value;
    } else if (type === 'delete') {
      html += `<del class="diff-deleted">${value}</del>`;
    } else if (type === 'insert') {
      html += `<ins class="diff-added">${value}</ins>`;
    }
  });
  return html;
}

/**
 * Renders the merged view into the current document.
 */
function renderMergedView(mergedHTML, url) {
  const parser = new DOMParser();
  const newDoc = parser.parseFromString(mergedHTML, 'text/html');

  // Create a <style> element with our forceful CSS rules
  const style = newDoc.createElement('style');
  style.textContent = `
    del.diff-deleted > *, .diff-deleted {
      background-color: rgba(255, 82, 82, 0.15) !important;
      outline: 1px dashed rgba(255, 82, 82, 0.8) !important;
    }
    ins.diff-added > *, .diff-added {
      background-color: rgba(77, 208, 88, 0.15) !important;
      outline: 1px dashed rgba(77, 208, 88, 0.8) !important;
    }
  `;
  newDoc.head.appendChild(style);
  
  // Add a <base> tag to fix relative links (CSS, images, etc.)
  const base = newDoc.createElement('base');
  base.href = url;
  newDoc.head.prepend(base);

  // Replace the current document with the new one
  document.replaceChild(newDoc.documentElement, document.documentElement);
}

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['baselineData', 'currentData'], (data) => {
    // ADDED: Clean up storage after reading the data.
    chrome.storage.local.remove(['baselineData', 'currentData']);

    const { baselineData, currentData } = data;

    if (!baselineData || !currentData || !baselineData.html || !currentData.html) {
      document.body.innerHTML = '<p style="font-family: sans-serif; padding: 2em; text-align: center; color: #555;">Could not load comparison data. Please capture a new baseline and try again.</p>';
      return;
    }

    try {
      const mergedHTML = buildMergedHTML(baselineData.html, currentData.html);
      renderMergedView(mergedHTML, baselineData.url);
    } catch (e) {
      console.error("Error building merged view:", e);
      document.body.innerHTML = `<p style="font-family: sans-serif; padding: 2em; text-align: center; color: #d9534f;">An error occurred while generating the diff view. Check the console for details.</p>`;
    }
  });
});
