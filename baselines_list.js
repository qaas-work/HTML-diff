document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('baselinesList');
  const emptyMessageEl = document.getElementById('emptyMessage');

  function renderBaselines() {
    chrome.storage.local.get('baselines', (data) => {
      const baselines = data.baselines || {};
      const urls = Object.keys(baselines);

      // Clear previous list
      listEl.innerHTML = '';

      if (urls.length === 0) {
        emptyMessageEl.style.display = 'block';
        return;
      }
      
      emptyMessageEl.style.display = 'none';

      urls.forEach(url => {
        const baselineData = baselines[url];
        const listItem = document.createElement('li');
        listItem.className = 'baseline-item';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'baseline-info';

        const urlP = document.createElement('p');
        urlP.className = 'url';
        urlP.textContent = url;

        const dateP = document.createElement('p');
        dateP.className = 'date';
        dateP.textContent = `Captured: ${new Date(baselineData.capturedAt).toLocaleString()}`;

        infoDiv.appendChild(urlP);
        infoDiv.appendChild(dateP);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.dataset.url = url; // Store URL in data attribute

        deleteBtn.addEventListener('click', handleDelete);

        listItem.appendChild(infoDiv);
        listItem.appendChild(deleteBtn);
        listEl.appendChild(listItem);
      });
    });
  }

  function handleDelete(event) {
    const urlToDelete = event.target.dataset.url;
    if (!urlToDelete || !confirm(`Are you sure you want to delete the baseline for:\n${urlToDelete}?`)) {
      return;
    }

    chrome.storage.local.get('baselines', (data) => {
      let baselines = data.baselines || {};
      delete baselines[urlToDelete]; // Remove the item
      chrome.storage.local.set({ baselines }, () => {
        // Rerender the list to show the change
        renderBaselines(); 
      });
    });
  }

  // Initial render
  renderBaselines();
});