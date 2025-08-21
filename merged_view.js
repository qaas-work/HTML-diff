/**
 * Enhanced HTML tokenizer that preserves structure
 */
function tokenizeHTML(str) {
  const tokens = [];
  const regex = /<[^>]+>|[^<]+/g;
  let match;
  
  while ((match = regex.exec(str)) !== null) {
    const token = match[0];
    if (token.trim()) {
      tokens.push({
        content: token,
        isTag: token.startsWith('<'),
        isClosingTag: token.startsWith('</'),
        tagName: token.startsWith('<') ? getTagName(token) : null
      });
    }
  }
  
  return tokens;
}

/**
 * Extract tag name from HTML tag
 */
function getTagName(tag) {
  const match = tag.match(/<\/?(\w+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract attributes from HTML opening tag
 */
function getAttributes(tag) {
  const attrs = {};
  // More robust attribute parsing
  const attrRegex = /(\w+)(?:\s*=\s*["']([^"']*?)["']|\s*=\s*([^\s>]+)|(?=\s|>))/g;
  let match;
  
  while ((match = attrRegex.exec(tag)) !== null) {
    attrs[match[1].toLowerCase()] = match[2] || match[3] || '';
  }
  
  return attrs;
}

/**
 * Check if two opening tags represent the same element with different attributes
 */
function isAttributeModification(oldToken, newToken) {
  if (!oldToken.isTag || !newToken.isTag || 
      oldToken.isClosingTag || newToken.isClosingTag) {
    return false;
  }
  
  const oldTagName = oldToken.tagName;
  const newTagName = newToken.tagName;
  
  return oldTagName === newTagName && oldToken.content !== newToken.content;
}

/**
 * Enhanced diff algorithm that detects adds, deletes, and modifications
 */
function diffHTMLTokens(baselineHTML, currentHTML) {
  const baseTokens = tokenizeHTML(baselineHTML);
  const currentTokens = tokenizeHTML(currentHTML);
  
  const n = baseTokens.length;
  const m = currentTokens.length;
  
  // Build LCS table
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (baseTokens[i].content === currentTokens[j].content) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to create diff
  const diff = [];
  let i = 0, j = 0;
  
  while (i < n || j < m) {
    if (i < n && j < m && baseTokens[i].content === currentTokens[j].content) {
      // Exact match
      diff.push(['equal', currentTokens[j].content]);
      i++;
      j++;
    } else if (i < n && j < m && isAttributeModification(baseTokens[i], currentTokens[j])) {
      // Same tag but different attributes = modification
      diff.push(['modify', currentTokens[j].content]);
      i++;
      j++;
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      // Addition in current
      diff.push(['add', currentTokens[j].content]);
      j++;
    } else if (i < n) {
      // Deletion from baseline (we'll mark these in the current version)
      diff.push(['delete', baseTokens[i].content]);
      i++;
    }
  }
  
  return diff;
}

/**
 * Apply diff classes to HTML elements
 */
function applyDiffHighlighting(diff) {
  let resultHTML = '';
  let changeId = 0;
  
  diff.forEach(([type, content]) => {
    if (type === 'equal') {
      resultHTML += content;
    } else if (type === 'add') {
      if (content.startsWith('<') && !content.startsWith('</')) {
        // Opening tag - add class to it
        const modifiedTag = addClassToTag(content, 'diff-added', `diff-change-${changeId++}`);
        resultHTML += modifiedTag;
      } else if (content.startsWith('</')) {
        // Closing tag - just add it
        resultHTML += content;
      } else {
        // Text content - wrap it
        resultHTML += `<span class="diff-added" data-diff-id="diff-change-${changeId++}">${content}</span>`;
      }
    } else if (type === 'delete') {
      if (content.startsWith('<') && !content.startsWith('</')) {
        // Opening tag - add class to it
        const modifiedTag = addClassToTag(content, 'diff-deleted', `diff-change-${changeId++}`);
        resultHTML += modifiedTag;
      } else if (content.startsWith('</')) {
        // Closing tag - just add it
        resultHTML += content;
      } else {
        // Text content - wrap it  
        resultHTML += `<span class="diff-deleted" data-diff-id="diff-change-${changeId++}">${content}</span>`;
      }
    } else if (type === 'modify') {
      if (content.startsWith('<') && !content.startsWith('</')) {
        // Modified opening tag
        const modifiedTag = addClassToTag(content, 'diff-modified', `diff-change-${changeId++}`);
        resultHTML += modifiedTag;
      } else {
        resultHTML += content;
      }
    }
  });
  
  return resultHTML;
}

/**
 * Add CSS class to an HTML tag
 */
function addClassToTag(tag, className, dataId) {
  // Handle self-closing tags and regular opening tags
  const selfClosing = tag.endsWith('/>');
  const tagEnd = selfClosing ? '/>' : '>';
  const tagWithoutEnd = tag.slice(0, tag.lastIndexOf(tagEnd));
  
  // Check if class attribute already exists
  const classMatch = tagWithoutEnd.match(/class=["']([^"']*)["']/i);
  
  if (classMatch) {
    // Add to existing class
    const existingClasses = classMatch[1];
    const newTag = tagWithoutEnd.replace(
      /class=["']([^"']*)["']/i, 
      `class="${existingClasses} ${className}"`
    );
    return `${newTag} data-diff-id="${dataId}"${tagEnd}`;
  } else {
    // Add new class attribute
    return `${tagWithoutEnd} class="${className}" data-diff-id="${dataId}"${tagEnd}`;
  }
}

/**
 * Calculate statistics from diff
 */
function calculateStats(diff) {
  const stats = { added: 0, deleted: 0, modified: 0 };
  
  diff.forEach(([type]) => {
    if (type === 'add') stats.added++;
    else if (type === 'delete') stats.deleted++;
    else if (type === 'modify') stats.modified++;
  });
  
  return stats;
}

/**
 * Create and inject the floating legend
 */
function createFloatingLegend(stats) {
  const legend = document.createElement('div');
  legend.className = 'diff-legend-overlay';
  legend.innerHTML = `
    <h4>HTML Changes</h4>
    <div class="diff-legend-item diff-legend-added">
      <div class="diff-legend-color"></div>
      <span>Added Elements</span>
    </div>
    <div class="diff-legend-item diff-legend-deleted">
      <div class="diff-legend-color"></div>
      <span>Deleted Elements</span>
    </div>
    <div class="diff-legend-item diff-legend-modified">
      <div class="diff-legend-color"></div>
      <span>Modified Elements</span>
    </div>
    <div class="diff-stats">
      <div style="color: #4dd058;">+${stats.added} added</div>
      <div style="color: #ff5252;">-${stats.deleted} deleted</div>
      <div style="color: #9c27b0;">~${stats.modified} modified</div>
    </div>
  `;
  
  return legend;
}

/**
 * Main function to render the merged view
 */
function renderMergedPage(baselineHTML, currentHTML, url) {
  try {
    // Compute the diff
    const diff = diffHTMLTokens(baselineHTML, currentHTML);
    console.log('Computed diff with', diff.length, 'operations');
    
    // Apply highlighting to create the merged HTML
    const highlightedHTML = applyDiffHighlighting(diff);
    
    // Parse the highlighted HTML
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(highlightedHTML, 'text/html');
    
    // Add our diff styles to the document head
    const style = newDoc.createElement('style');
    style.textContent = `
      .diff-added {
        background-color: rgba(77, 208, 88, 0.3) !important;
        outline: 2px solid #4dd058 !important;
        outline-offset: 1px !important;
      }
      
      .diff-deleted {
        background-color: rgba(255, 82, 82, 0.3) !important;
        outline: 2px solid #ff5252 !important;
        outline-offset: 1px !important;
        opacity: 0.6 !important;
      }
      
      .diff-modified {
        background-color: rgba(156, 39, 176, 0.3) !important;
        outline: 2px solid #9c27b0 !important;
        outline-offset: 1px !important;
      }
      
      .diff-legend-overlay {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: rgba(30, 30, 30, 0.95) !important;
        color: white !important;
        padding: 15px !important;
        border-radius: 8px !important;
        z-index: 999999 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
        font-size: 14px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        min-width: 200px !important;
      }

      .diff-legend-overlay h4 {
        margin: 0 0 10px 0 !important;
        font-size: 16px !important;
        color: #007acc !important;
      }

      .diff-legend-item {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 5px 0 !important;
      }

      .diff-legend-color {
        width: 16px !important;
        height: 16px !important;
        border-radius: 3px !important;
        border: 1px solid !important;
      }

      .diff-legend-added .diff-legend-color {
        background-color: rgba(77, 208, 88, 0.3) !important;
        border-color: #4dd058 !important;
      }

      .diff-legend-deleted .diff-legend-color {
        background-color: rgba(255, 82, 82, 0.3) !important;
        border-color: #ff5252 !important;
      }

      .diff-legend-modified .diff-legend-color {
        background-color: rgba(156, 39, 176, 0.3) !important;
        border-color: #9c27b0 !important;
      }

      .diff-stats {
        margin-top: 15px !important;
        padding-top: 10px !important;
        border-top: 1px solid #444 !important;
        font-size: 12px !important;
        color: #ccc !important;
      }
    `;
    newDoc.head.appendChild(style);
    
    // Add base tag for relative URLs
    if (url) {
      const base = newDoc.createElement('base');
      base.href = url;
      newDoc.head.insertBefore(base, newDoc.head.firstChild);
    }
    
    // Calculate stats and create legend
    const stats = calculateStats(diff);
    const legend = createFloatingLegend(stats);
    newDoc.body.appendChild(legend);
    
    // Replace the current document
    document.open();
    document.write(newDoc.documentElement.outerHTML);
    document.close();
    
    console.log('Rendered merged view with stats:', stats);
    
  } catch (error) {
    console.error('Error rendering merged view:', error);
    document.body.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
        <h2 style="color: #d9534f;">Error Processing Changes</h2>
        <p>There was an error processing the HTML changes. Please try again.</p>
        <pre style="background: #f5f5f5; padding: 15px; text-align: left; margin: 20px 0;">${error.message}</pre>
      </div>
    `;
  }
}

// Main execution
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['baselineData', 'currentData'], (data) => {
    // Clean up storage
    chrome.storage.local.remove(['baselineData', 'currentData']);

    const { baselineData, currentData } = data;

    if (!baselineData || !currentData) {
      document.body.innerHTML = `
        <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
          <h2>No Comparison Data</h2>
          <p>Please capture a baseline and try the comparison again.</p>
        </div>
      `;
      return;
    }

    const baseline = baselineData.html || '';
    const current = currentData.html || '';
    
    if (!baseline || !current) {
      document.body.innerHTML = `
        <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
          <h2>Invalid Data</h2>
          <p>Both baseline and current HTML are required for comparison.</p>
        </div>
      `;
      return;
    }

    // Small delay to show loading, then render
    setTimeout(() => {
      renderMergedPage(baseline, current, baselineData.url);
    }, 100);
  });
});