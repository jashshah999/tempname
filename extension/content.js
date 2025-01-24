// Create and inject styles
const style = document.createElement('style');
style.textContent = `
  .excel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .excel-container {
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(234, 179, 8, 0.2);
    border-radius: 8px;
    width: 90%;
    max-width: 1200px;
    height: 90vh;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .excel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid rgba(234, 179, 8, 0.2);
  }

  .excel-title {
    color: #eab308;
    font-size: 1rem;
    font-weight: 600;
  }

  .excel-close {
    color: #9ca3af;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    font-size: 1.5rem;
    line-height: 1;
  }

  .excel-content {
    flex: 1;
    overflow: auto;
    padding: 1rem;
  }

  .excel-table {
    border-collapse: collapse;
    width: 100%;
    color: #fff;
  }

  .excel-table th,
  .excel-table td {
    border: 1px solid rgba(234, 179, 8, 0.2);
    padding: 0.5rem;
    text-align: left;
  }

  .excel-table th {
    background: rgba(234, 179, 8, 0.1);
    color: #eab308;
    font-weight: 600;
  }

  .excel-table tr:hover td {
    background: rgba(234, 179, 8, 0.05);
  }
`;
document.head.appendChild(style);

// Handle messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_EXCEL_EDITOR') {
    showExcelEditor(message.data);
  }
});

function showExcelEditor(data) {
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.className = 'excel-overlay';

  // Create Excel container
  const container = document.createElement('div');
  container.className = 'excel-container';

  // Create header
  const header = document.createElement('div');
  header.className = 'excel-header';

  const title = document.createElement('div');
  title.className = 'excel-title';
  title.textContent = 'Excel Quote Editor';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'excel-close';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Create content
  const content = document.createElement('div');
  content.className = 'excel-content';

  // Create table
  const table = document.createElement('table');
  table.className = 'excel-table';

  data.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    row.forEach((cell) => {
      const td = rowIndex === 0 ? document.createElement('th') : document.createElement('td');
      td.textContent = cell.value;
      td.style.width = `${cell.width}px`;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  content.appendChild(table);
  container.appendChild(header);
  container.appendChild(content);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
}