// Constants
const SUPABASE_URL = "https://olihoxfxihhdcskcimeh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saWhveGZ4aWhoZGNza2NpbWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc2MzM2MDMsImV4cCI6MjA1MzIwOTYwM30.ISD1XBqSvgRUzF-ZMgpSlvmim-nw2LKP8j1rhR226i0";
const APP_URL = "http://localhost:5173";
const BACKEND_URL = "http://localhost:8000";

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    console.log("Active tab changed:", tab);
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    if (changeInfo.status == "loading") {
      let url = new URL(changeInfo.url);
      let queryParams = new URLSearchParams(url.search);
      let code = queryParams.get("code");
      let fromChromeExt = queryParams.get("from_chrome_ext");

      if (fromChromeExt == "True" && code) {
        chrome.tabs.remove(tabId, () => {
          console.log(`Closed tab with id: ${tabId}`);
        });
        const response = await fetch(
          `${BACKEND_URL}/api/authentication/verify-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code: code }),
          }
        );

        const result = await response.json();

        chrome.storage.local.set(
          {
            session: result["session"],
            access_token: result["access_token"],
            refresh_token: result["refresh_token"],
          },
          function () {}
        );
      }
    }
  }
});

setInterval(async () => {
  const { access_token, refresh_token } = await new Promise((resolve) => {
    chrome.storage.local.get(["access_token", "refresh_token"], (result) => {
      resolve(result);
    });
  });

  if (access_token && refresh_token) {
    const response = await fetch(
      `${BACKEND_URL}/api/authentication/refresh-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refresh_token }),
      }
    );

    const result = await response.json();

    chrome.storage.local.set(
      {
        access_token: result["access_token"],
        refresh_token: result["refresh_token"],
        session: result["session"],
      },
      function () {}
    );
  }
}, 3600000);
