// Constants
const SUPABASE_URL = 'https://olihoxfxihhdcskcimeh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saWhveGZ4aWhoZGNza2NpbWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc2MzM2MDMsImV4cCI6MjA1MzIwOTYwM30.ISD1XBqSvgRUzF-ZMgpSlvmim-nw2LKP8j1rhR226i0';
const APP_URL = 'http://localhost:5173';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const mainContent = document.getElementById('mainContent');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const settingsBtn = document.getElementById('settingsBtn');
const generateQuoteBtn = document.getElementById('generateQuoteBtn');
const generateExcelBtn = document.getElementById('generateExcelBtn');
const quoteResult = document.getElementById('quoteResult');
const quoteText = document.getElementById('quoteText');

// Check if user is already logged in
chrome.storage.local.get(['session'], function(result) {
  if (result.session) {
    showMainContent();
  }
});

// Login handler
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || 'Login failed');
    }

    // Store session
    chrome.storage.local.set({ session: data }, function() {
      showMainContent();
    });
  } catch (error) {
    loginError.textContent = error.message;
  }
});

// Settings button handler
settingsBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: `${APP_URL}/dashboard` });
});

// Generate Quote button handler
generateQuoteBtn.addEventListener('click', () => {
  const quotes = [
    "Thank you for your interest. Based on your requirements, we estimate the total cost to be $1,500.",
    "We're pleased to provide a quote of $2,750 for the requested services.",
    "Our comprehensive solution package is quoted at $3,200 with all features included.",
    "For the specified requirements, we quote a total of $1,850 with a 30-day warranty."
  ];
  
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  quoteText.textContent = randomQuote;
  quoteResult.style.display = 'block';
});

// Generate Excel button handler
generateExcelBtn.addEventListener('click', async () => {
  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Create sample Excel data
  const excelData = [
    ['Item', 'Description', 'Quantity', 'Unit Price', 'Total'],
    ['Product A', 'High-quality widget', '2', '100', '200'],
    ['Product B', 'Premium gadget', '3', '150', '450'],
    ['Product C', 'Deluxe item', '1', '200', '200'],
    ['', '', '', 'Subtotal', '850'],
    ['', '', '', 'Tax (18%)', '153'],
    ['', '', '', 'Total', '1003']
  ].map(row => row.map(cell => ({
    value: cell.toString(),
    width: 120
  })));

  // Inject the content script
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  // Send the Excel data to the content script
  chrome.tabs.sendMessage(tab.id, {
    type: 'SHOW_EXCEL_EDITOR',
    data: excelData
  });

  // Close the popup
  window.close();
});

function showMainContent() {
  loginForm.style.display = 'none';
  mainContent.style.display = 'block';
}