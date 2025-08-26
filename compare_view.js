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
 * Enhanced tokenizer that better handles HTML structure
 * @param {string} str The string to tokenize.
 * @returns {string[]} An array of tokens.
 */
function tokenize(str) {
  // More sophisticated regex to handle HTML tags, attributes, text content, and whitespace
  const re = /(<[^>]+>)|(\w+(?:=["'][^"']*["'])?)|(\s+)|([^\w\s<>]+)/g;
  const tokens = str.match(re) || [];
  return tokens.filter(token => token); // Remove empty tokens
}

/**
 * Improved diff algorithm with better change detection
 */
function diffTokens(aStr, bStr) {
  const A = tokenize(aStr);
  const B = tokenize(bStr);
  const n = A.length;
  const m = B.length;

  // Initialize DP table for LCS
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

  // Backtrack to construct the diff
  const diff = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      diff.push(['equal', A[i]]);
      i++;
      j++;
    } else {
      // Look ahead to find the end of the differing block
      let iEnd = i, jEnd = j;
      while(iEnd < n && jEnd < m && A[iEnd] !== B[jEnd]) {
        if (dp[iEnd+1][j] > dp[i][jEnd+1]) {
          iEnd++;
        } else {
          jEnd++;
        }
      }
      
      const deleted = A.slice(i, iEnd).join('');
      const added = B.slice(j, jEnd).join('');
      
      if (deleted) diff.push(['delete', deleted]);
      if (added) diff.push(['insert', added]);
      
      i = iEnd;
      j = jEnd;
    }
  }

  if (i < n) diff.push(['delete', A.slice(i).join('')]);
  if (j < m) diff.push(['insert', B.slice(j).join('')]);

  return diff;
}


// --- Main Logic ---
let allChanges = []; // Stores all identified changes
let filteredChanges = []; // Stores changes that match the current search filter
let currentIndex = -1;

// --- DOM Elements ---
const baselinePane = document.getElementById('baseline');
const currentPane = document.getElementById('current');
const prevBtn = document.getElementById('prevChange');
const nextBtn = document.getElementById('nextChange');
const counterEl = document.getElementById('changeCounter');
const searchInput = document.getElementById('searchInput');

/**
 * Renders the side-by-side diff view, grouping related changes and adding placeholders.
 * @param {string} baselineHTML The original HTML.
 * @param {string} currentHTML The new HTML.
 */
function renderSideBySide(baselineHTML, currentHTML) {
  const diff = diffTokens(baselineHTML, currentHTML);
  
  let baselineContent = '';
  let currentContent = '';
  allChanges = [];
  let changeCounter = 0;

  for (let i = 0; i < diff.length; i++) {
    const [type, value] = diff[i];
    
    // Check for a delete/insert pair, which represents a "change"
    if (type === 'delete' && i + 1 < diff.length && diff[i + 1][0] === 'insert') {
      const escapedDelValue = esc(value);
      const [_nextType, nextValue] = diff[i + 1];
      const escapedAddValue = esc(nextValue);

      const delId = `change-${changeCounter}-del`;
      const addId = `change-${changeCounter}-add`;

      baselineContent += `<span class="diff-deleted" id="${delId}">${escapedDelValue}</span>`;
      currentContent += `<span class="diff-added" id="${addId}">${escapedAddValue}</span>`;

      allChanges.push({ type: 'change', delId, addId });
      
      i++; // Skip the next element as it has been processed
      changeCounter++;
    } else if (type === 'delete') {
      const escapedValue = esc(value);
      const delId = `change-${changeCounter}-del`;
      const addId = `change-${changeCounter}-add`; // ID for the placeholder

      baselineContent += `<span class="diff-deleted" id="${delId}">${escapedValue}</span>`;
      currentContent += `<span class="diff-placeholder" id="${addId}">&nbsp;</span>`; // Placeholder

      allChanges.push({ type: 'delete', delId, addId });
      changeCounter++;
    } else if (type === 'insert') {
      const escapedValue = esc(value);
      const addId = `change-${changeCounter}-add`;
      const delId = `change-${changeCounter}-del`; // ID for the placeholder

      baselineContent += `<span class="diff-deleted" id="${delId}">${escapedDelValue}</span>\n`;
      currentContent += `<span class="diff-added" id="${addId}">${escapedAddValue}</span>\n`;

      allChanges.push({ type: 'insert', delId, addId });
      changeCounter++;
    } else { // 'equal'
      const escapedValue = esc(value);
      baselineContent += escapedValue;
      currentContent += escapedValue;
    }
  }

  baselinePane.innerHTML = baselineContent;
  currentPane.innerHTML = currentContent;

  // Initially, all changes are visible
  filteredChanges = [...allChanges];
  updateNavigation();
}

/**
 * Utility: get all matching node.outerHTML from an HTML string using XPath
 */
function getNodesByXPath(htmlString, xpath) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const result = document.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const matches = [];
  
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i);
    if (node.outerHTML) {
      matches.push(node.outerHTML.toLowerCase());
    }
  }
  return matches;
}

/**
 * Filters changes based on the search input and updates the view.
 * Supports both plain text search and XPath queries.
 */
function filterAndNavigate() {
  const searchTerm = searchInput.value.trim();

  if (!searchTerm) {
    // Reset → show all
    filteredChanges = [...allChanges];
    allChanges.forEach(change => {
      const delEl = document.getElementById(change.delId);
      const addEl = document.getElementById(change.addId);
      if (delEl) delEl.classList.remove('filtered-out');
      if (addEl) addEl.classList.remove('filtered-out');
    });
  } else if (searchTerm.startsWith("//")) {
    // XPath mode
    // Get full baseline/current HTML text
    const baselineHTML = baselinePane.textContent;
    const currentHTML = currentPane.textContent;

    // Get matching nodes
    const baselineMatches = getNodesByXPath(baselineHTML, searchTerm);
    const currentMatches = getNodesByXPath(currentHTML, searchTerm);
    const allMatches = baselineMatches.concat(currentMatches);

    filteredChanges = allChanges.filter(change => {
      const delEl = document.getElementById(change.delId);
      const addEl = document.getElementById(change.addId);
      if (!delEl && !addEl) return false;

      const delText = delEl ? delEl.textContent.toLowerCase() : '';
      const addText = addEl ? addEl.textContent.toLowerCase() : '';

      const isMatch = allMatches.some(match =>
        delText.includes(match) || addText.includes(match)
      );

      // Use CSS class instead of direct display manipulation
      if (delEl) {
        if (isMatch) {
          delEl.classList.remove('filtered-out');
        } else {
          delEl.classList.add('filtered-out');
        }
      }
      if (addEl) {
        if (isMatch) {
          addEl.classList.remove('filtered-out');
        } else {
          addEl.classList.add('filtered-out');
        }
      }

      return isMatch;
    });
  } else {
    // Plain text search mode
    const term = searchTerm.toLowerCase();
    filteredChanges = allChanges.filter(change => {
      const delEl = document.getElementById(change.delId);
      const addEl = document.getElementById(change.addId);

      const delText = delEl ? delEl.textContent.toLowerCase() : '';
      const addText = addEl ? addEl.textContent.toLowerCase() : '';

      const isMatch = delText.includes(term) || addText.includes(term);

      // Use CSS class instead of direct display manipulation
      if (delEl) {
        if (isMatch) {
          delEl.classList.remove('filtered-out');
        } else {
          delEl.classList.add('filtered-out');
        }
      }
      if (addEl) {
        if (isMatch) {
          addEl.classList.remove('filtered-out');
        } else {
          addEl.classList.add('filtered-out');
        }
      }

      return isMatch;
    });
  }

  // Reset navigation
  currentIndex = -1;
  updateNavigation();
}

/**
 * Updates the navigation controls (buttons, counter) and highlighting.
 * Works with the `filteredChanges` array.
 */
function updateNavigation() {
  const totalChanges = filteredChanges.length;
  counterEl.textContent = `${currentIndex < 0 ? 0 : currentIndex + 1} / ${totalChanges}`;
  prevBtn.disabled = currentIndex <= 0;
  nextBtn.disabled = currentIndex >= totalChanges - 1;

  // Remove previous highlights from all elements
  document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));

  if (currentIndex >= 0 && currentIndex < totalChanges) {
    const change = filteredChanges[currentIndex];
    
    const delEl = change.delId ? document.getElementById(change.delId) : null;
    const addEl = change.addId ? document.getElementById(change.addId) : null;

    let targetElement = null;

    if (delEl) {
      delEl.classList.add('highlight');
      targetElement = delEl; // Prioritize this element for scrolling calculation
    }
    if (addEl) {
      addEl.classList.add('highlight');
      if (!targetElement) {
        targetElement = addEl; // Fallback to this one if no deletion element
      }
    }

    // If we have an element to scroll to, calculate its position and sync both panes
    if (targetElement) {
      // Temporarily disable manual scroll listeners to prevent loops during programmatic scroll
      activePane = null; 

      const paneContainer = targetElement.parentElement;
      // Calculate the ideal scroll position to center the element
      const scrollPosition = targetElement.offsetTop - (paneContainer.clientHeight / 2) + (targetElement.clientHeight / 2);

      // Programmatically scroll both panes to the same calculated position
      baselinePane.scrollTo({ top: scrollPosition, behavior: 'smooth' });
      currentPane.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['baselineData', 'currentData'], (data) => {
    // ADDED: Clean up storage after reading the data.
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
 * Updates URL information in the header
 */
function updateURLInfo(url) {
  const urlInfo = document.getElementById('urlInfo');
  if (urlInfo && url) {
    urlInfo.textContent = url;
  }
}

/**
 * Calculates and displays statistics about the comparison
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

// --- Scroll Synchronization (Improved Method) ---
let activePane = null;

baselinePane.addEventListener('mouseenter', () => {
  activePane = baselinePane;
});

currentPane.addEventListener('mouseenter', () => {
  activePane = currentPane;
});

baselinePane.addEventListener('scroll', () => {
  if (activePane === baselinePane) {
    currentPane.scrollTop = baselinePane.scrollTop;
  }
});

currentPane.addEventListener('scroll', () => {
  if (activePane === currentPane) {
    baselinePane.scrollTop = currentPane.scrollTop;
  }
});
