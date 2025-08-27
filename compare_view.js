/**
 * Escapes special HTML characters to prevent them from being interpreted as HTML.
 * @param {string} s The string to escape.
 * @returns {string} The escaped string.
 */
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Enhanced tokenizer that better handles HTML structure.
 * @param {string} str The string to tokenize.
 * @returns {string[]} An array of tokens.
 */
function tokenize(str) {
  const re = /(<[^>]+>)|(\w+(?:=["'][^"']*["'])?)|(\s+)|([^\w\s<>]+)/g;
  const tokens = str.match(re) || [];
  return tokens.filter(token => token);
}

/**
 * Improved diff algorithm with better change detection.
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

  while (i < n && j < m) {
    if (A[i] === B[j]) {
      diff.push(['equal', A[i]]);
      i++; j++;
    } else {
      let iEnd = i, jEnd = j;
      while (iEnd < n && jEnd < m && A[iEnd] !== B[jEnd]) {
        if (dp[iEnd + 1][j] > dp[i][jEnd + 1]) {
          iEnd++;
        } else {
          jEnd++;
        }
      }
      const deleted = A.slice(i, iEnd).join('');
      const added = B.slice(j, jEnd).join('');
      if (deleted) diff.push(['delete', deleted]);
      if (added) diff.push(['insert', added]);
      i = iEnd; j = jEnd;
    }
  }

  if (i < n) diff.push(['delete', A.slice(i).join('')]);
  if (j < m) diff.push(['insert', B.slice(j).join('')]);

  return diff;
}

// --- Globals ---
let allChanges = [];
let filteredChanges = [];
let currentIndex = -1;
let fullBaselineHTML = '';
let fullCurrentHTML = '';

// --- DOM Elements ---
const baselinePane = document.getElementById('baseline');
const currentPane = document.getElementById('current');
const prevBtn = document.getElementById('prevChange');
const nextBtn = document.getElementById('nextChange');
const counterEl = document.getElementById('changeCounter');
const searchInput = document.getElementById('searchInput');

/**
 * Renders the side-by-side diff view.
 */
function renderSideBySide(baselineHTML, currentHTML) {
  const diff = diffTokens(baselineHTML, currentHTML);

  let baselineContent = '';
  let currentContent = '';
  allChanges = [];
  let changeCounter = 0;

  for (let i = 0; i < diff.length; i++) {
    const [type, value] = diff[i];

    if (type === 'delete' && i + 1 < diff.length && diff[i + 1][0] === 'insert') {
      const delId = `change-${changeCounter}-del`;
      const addId = `change-${changeCounter}-add`;
      baselineContent += `<span class="diff-deleted" id="${delId}">${esc(value)}</span>`;
      currentContent += `<span class="diff-added" id="${addId}">${esc(diff[i + 1][1])}</span>`;
      allChanges.push({ type: 'change', delId, addId });
      i++; changeCounter++;
    } else if (type === 'delete') {
      const delId = `change-${changeCounter}-del`;
      const addId = `change-${changeCounter}-add`;
      baselineContent += `<span class="diff-deleted" id="${delId}">${esc(value)}</span>`;
      currentContent += `<span class="diff-placeholder" id="${addId}">&nbsp;</span>`;
      allChanges.push({ type: 'delete', delId, addId });
      changeCounter++;
    } else if (type === 'insert') {
      const addId = `change-${changeCounter}-add`;
      const delId = `change-${changeCounter}-del`;
      baselineContent += `<span class="diff-placeholder" id="${delId}">&nbsp;</span>`;
      currentContent += `<span class="diff-added" id="${addId}">${esc(value)}</span>`;
      allChanges.push({ type: 'insert', delId, addId });
      changeCounter++;
    } else {
      baselineContent += esc(value);
      currentContent += esc(value);
    }
  }

  baselinePane.innerHTML = baselineContent;
  currentPane.innerHTML = currentContent;
  filteredChanges = [...allChanges];
  updateNavigation();
}

/**
 * Utility: get all matching node.outerHTML from an HTML string using XPath
 */
function getNodesByXPath(htmlString, xpath) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  // Fix: use doc.evaluate instead of document.evaluate
  const result = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const matches = [];
  
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i);
    if (node && node.outerHTML) {
      matches.push(node.outerHTML.toLowerCase());
    }
  }
  return matches;
}

/**
 * Filters changes based on the search input and updates the view.
 * Now supports both plain text search and XPath queries.
 */
function filterAndNavigate() {
  const searchTerm = searchInput.value.trim();

  if (!searchTerm) {
    // Reset → show all
    filteredChanges = [...allChanges];
    updateDisplayForFilter();
  } else if (searchTerm.startsWith("//")) {
    // XPath mode
    // Use the original HTML strings, not the textContent of the panes
    const baselineMatches = getNodesByXPath(fullBaselineHTML, searchTerm);
    const currentMatches = getNodesByXPath(fullCurrentHTML, searchTerm);
    const allMatches = baselineMatches.concat(currentMatches);

    filteredChanges = allChanges.filter(change => {
      const delEl = document.getElementById(change.delId);
      const addEl = document.getElementById(change.addId);
      if (!delEl && !addEl) return false;

      const delText = delEl ? delEl.textContent.toLowerCase() : '';
      const addText = addEl ? addEl.textContent.toLowerCase() : '';

      const isMatch = allMatches.some(match =>
        match.includes(delText) || match.includes(addText)
      );

      return isMatch;
    });
    updateDisplayForFilter();
  } else {
    // Plain text search mode
    const term = searchTerm.toLowerCase();
    filteredChanges = allChanges.filter(change => {
      const delEl = document.getElementById(change.delId);
      const addEl = document.getElementById(change.addId);

      const delText = delEl ? delEl.textContent.toLowerCase() : '';
      const addText = addEl ? addEl.textContent.toLowerCase() : '';

      const isMatch = delText.includes(term) || addText.includes(term);
      return isMatch;
    });
    updateDisplayForFilter();
  }

  // Reset navigation
  currentIndex = -1;
  updateNavigation();
}

/**
 * A helper function to update the display based on the filtered changes.
 */
function updateDisplayForFilter() {
  allChanges.forEach(change => {
    const delEl = document.getElementById(change.delId);
    const addEl = document.getElementById(change.addId);
    
    const isFiltered = filteredChanges.some(fc => fc.delId === change.delId);
    
    if (delEl) delEl.style.display = isFiltered ? 'block' : 'none';
    if (addEl) addEl.style.display = isFiltered ? 'block' : 'none';
  });
}

/**
 * Updates navigation controls and highlights.
 */
function updateNavigation() {
  const totalChanges = filteredChanges.length;
  counterEl.textContent = `${currentIndex < 0 ? 0 : currentIndex + 1} / ${totalChanges}`;
  prevBtn.disabled = currentIndex <= 0;
  nextBtn.disabled = currentIndex >= totalChanges - 1;

  document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));

  if (currentIndex >= 0 && currentIndex < totalChanges) {
    const change = filteredChanges[currentIndex];
    const delEl = document.getElementById(change.delId);
    const addEl = document.getElementById(change.addId);
    let targetElement = null;

    if (delEl) {
      delEl.classList.add('highlight');
      targetElement = delEl;
    }
    if (addEl) {
      addEl.classList.add('highlight');
      if (!targetElement) targetElement = addEl;
    }

    if (targetElement) {
      activePane = null;
      const paneContainer = targetElement.parentElement;
      const scrollPosition = targetElement.offsetTop - (paneContainer.clientHeight / 2) + (targetElement.clientHeight / 2);
      baselinePane.scrollTo({ top: scrollPosition, behavior: 'smooth' });
      currentPane.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['baselineData', 'currentData'], (data) => {
    chrome.storage.local.remove(['baselineData', 'currentData']);
    const { baselineData, currentData } = data;

    if (!baselineData || !currentData) {
      document.body.innerHTML = '<div class="empty-state">Comparison data not found. Please try again.</div>';
      return;
    }

    const baseline = baselineData.html || '';
    const current = currentData.html || '';

    updateURLInfo(baselineData.url);

    if (!baseline) {
      baselinePane.textContent = "No baseline HTML was found for this URL.";
      return;
    }
    if (!current) {
      currentPane.textContent = "No current HTML captured in this session.";
      return;
    }

    // Store the original, un-escaped HTML strings in global variables for later use
    fullBaselineHTML = baseline;
    fullCurrentHTML = current;

    try {
      renderSideBySide(baseline, current);
      calculateStatistics(baseline, current);
    } catch (e) {
      console.error("Diff rendering error:", e);
      baselinePane.innerHTML = esc(baseline);
      currentPane.innerHTML = esc(current);
    }
  });
});

/**
 * Updates URL information in the header.
 */
function updateURLInfo(url) {
  const urlInfo = document.getElementById('urlInfo');
  if (urlInfo && url) urlInfo.textContent = url;
}

/**
 * Calculates and displays statistics about the comparison.
 */
function calculateStatistics(baseline, current) {
  const stats = {
    baselineSize: baseline.length,
    currentSize: current.length,
    sizeDifference: current.length - baseline.length,
    baselineLines: (baseline.match(/\n/g) || []).length + 1,
    currentLines: (current.match(/\n/g) || []).length + 1
  };

  const statsEl = document.getElementById('statistics');
  if (statsEl) {
    const diffSign = stats.sizeDifference > 0 ? '+' : '';
    statsEl.innerHTML = `
      <div>Baseline: ${stats.baselineSize.toLocaleString()} chars, ${stats.baselineLines.toLocaleString()} lines</div>
      <div>Current: ${stats.currentSize.toLocaleString()} chars, ${stats.currentLines.toLocaleString()} lines (${diffSign}${stats.sizeDifference.toLocaleString()})</div>
    `;
  }
}

// --- Event Listeners ---
prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    updateNavigation();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < filteredChanges.length - 1) {
    currentIndex++;
    updateNavigation();
  }
});

searchInput.addEventListener('input', filterAndNavigate);

// --- Scroll Sync ---
let activePane = null;

baselinePane.addEventListener('mouseenter', () => { activePane = baselinePane; });
currentPane.addEventListener('mouseenter', () => { activePane = currentPane; });

baselinePane.addEventListener('scroll', () => {
  if (activePane === baselinePane) currentPane.scrollTop = baselinePane.scrollTop;
});
currentPane.addEventListener('scroll', () => {
  if (activePane === currentPane) baselinePane.scrollTop = currentPane.scrollTop;
});