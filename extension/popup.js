// Constants
const SUPABASE_URL = "https://olihoxfxihhdcskcimeh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saWhveGZ4aWhoZGNza2NpbWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc2MzM2MDMsImV4cCI6MjA1MzIwOTYwM30.ISD1XBqSvgRUzF-ZMgpSlvmim-nw2LKP8j1rhR226i0";
const APP_URL = "http://localhost:5173";
const BACKEND_URL = "http://localhost:8000";

// DOM Elements
const authBlock = document.getElementById("authBlock");
const loginForm = document.getElementById("loginForm");
const googleAuth = document.getElementById("googleAuth");
const mainContent = document.getElementById("mainContent");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const googleAuthError = document.getElementById("googleAuthError");
const settingsBtn = document.getElementById("settingsBtn");
const generateQuoteBtn = document.getElementById("generateQuoteBtn");
const generateExcelBtn = document.getElementById("generateExcelBtn");
const quoteResult = document.getElementById("quoteResult");
const quoteText = document.getElementById("quoteText");
const priceListUpload = document.getElementById("priceListUpload");
const priceListUploadError = document.getElementById("priceListUploadError");
const quotationUpload = document.getElementById("quotationUpload");
const quotationUploadError = document.getElementById("quotationUploadError");
const mainInterface = document.getElementById("mainInterface");
const priceListUploadBtn = document.getElementById("uploadPriceList");
const priceListpriceListFileInput = document.getElementById("priceListFile");
const priceListuploadPriceListContainer = document.getElementById("priceList");
const priceListInput = document.getElementById("priceListUpload");
const quoteGeneration = document.getElementById("quoteGeneration");
const quotePdfGeneration = document.getElementById("quotePdfGeneration");

function extractProductsAndCompany(data) {
  let products = [];
  let companyName = "";
  try {
    const content = data.quotation;
    const parsedData = JSON.parse(
      content.replace(/```json\n?|\n?```/g, "").trim()
    );
    products = parsedData.products || [];
    companyName = parsedData.companyName || "";

    // If no products were found, add a default empty product
    if (products.length === 0) {
      products = [
        {
          srNo: 1,
          description: "",
          make: "",
          code: "",
          range: "",
          rate: "",
          remark: "",
        },
      ];
    }
  } catch (error) {
    console.error("Error parsing data:", error);
    products = [
      {
        srNo: 1,
        description: "Could not parse products",
        make: "",
        code: "",
        range: "",
        rate: "",
        remark: "",
      },
    ];
    companyName = "";
  }
  return { products, companyName };
}

function formatEmailReply(reply) {
  // Split the reply into lines
  const lines = reply.split("\n");

  // Process each line
  const formattedLines = lines.map((line) => {
    // Add extra spacing after product sections
    if (line.trim().startsWith("Delivery Time:")) {
      return line + "<br><br>";
    }
    // Add spacing after the greeting
    if (line.includes("sir") || line.includes("madam")) {
      return line + "<br><br>";
    }
    // Add spacing after "We are pleased to quote the following:"
    if (line.includes("pleased to quote")) {
      return line + "<br><br>";
    }
    // Keep other lines as is
    return line;
  });

  // Join the lines back together with proper HTML line breaks
  let formattedReply = formattedLines.join("<br>");

  // Ensure proper spacing between products
  formattedReply = formattedReply.replace(/(<br>){3,}/g, "<br><br>"); // Remove excessive line breaks

  // Add extra spacing before the closing line
  formattedReply = formattedReply.replace(
    /(Looking forward to your response\.)/,
    "<br>$1"
  );

  return formattedReply;
}

async function generateAndInsertReply(backend_url) {
  // Helper function defined inside generateAndInsertReply so it's available in the webpage context
  function formatEmailReply(reply) {
    // Split the reply into lines
    const lines = reply.split("\n");

    // Process each line
    const formattedLines = lines.map((line) => {
      // Add extra spacing after product sections
      if (line.trim().startsWith("Delivery Time:")) {
        return line + "<br><br>";
      }
      // Add spacing after the greeting
      if (line.includes("sir") || line.includes("madam")) {
        return line + "<br><br>";
      }
      // Add spacing after "We are pleased to quote the following:"
      if (line.includes("pleased to quote")) {
        return line + "<br><br>";
      }
      // Keep other lines as is
      return line;
    });

    // Join the lines back together with proper HTML line breaks
    let formattedReply = formattedLines.join("<br>");

    // Ensure proper spacing between products
    formattedReply = formattedReply.replace(/(<br>){3,}/g, "<br><br>"); // Remove excessive line breaks

    // Add extra spacing before the closing line
    formattedReply = formattedReply.replace(
      /(Looking forward to your response\.)/,
      "<br>$1"
    );

    return formattedReply;
  }

  try {
    const emailContainers = document.querySelectorAll(".gs");
    console.log("Found email containers:", emailContainers.length);

    if (emailContainers.length === 0) {
      return {
        error:
          "No email content found. Please make sure you have an email open.",
      };
    }

    let emailContent = "";
    emailContainers.forEach((container) => {
      emailContent += container.innerText + "\n";
    });
    console.log(
      "Email content extracted:",
      emailContent.substring(0, 100) + "..."
    );

    if (!emailContent.trim()) {
      return { error: "Email content appears to be empty." };
    }

    // Find and click reply button
    const replyButtons = document.querySelectorAll('[role="button"]');
    console.log("Found buttons:", replyButtons.length);

    let replyButton;
    for (const button of replyButtons) {
      if (button.getAttribute("aria-label")?.toLowerCase().includes("reply")) {
        replyButton = button;
        break;
      }
    }

    if (!replyButton) {
      return { error: "Reply button not found." };
    }

    console.log("Found reply button, clicking it");
    replyButton.click();

    try {
      console.log("Making API call to OpenAI");
      const { access_token } = await new Promise((resolve) => {
        chrome.storage.local.get(["access_token"], (result) => {
          resolve(result);
        });
      });

      const response = await fetch(
        `${backend_url}/api/quotation/generate-quotation-text`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_content: emailContent,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", errorText);
        return { error: `API Error: ${response.status} - ${errorText}` };
      }

      const data = await response.json();
      console.log("API response received:", data);
      const generatedReply = data.quotation;

      // Format the reply with proper spacing and structure
      const formattedReply = formatEmailReply(generatedReply);
      console.log("Formatted reply:", formattedReply);

      // More reliable way to find and insert into reply box
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 20;

        const insertReplyText = () => {
          const messageBody = document.querySelector('[role="textbox"]');
          console.log("Attempt", attempts + 1, "to find textbox");

          if (messageBody) {
            console.log("Found textbox, inserting reply");
            messageBody.innerHTML = formattedReply;
            messageBody.dispatchEvent(new Event("input", { bubbles: true }));
            resolve({ success: true });
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(insertReplyText, 500);
          } else {
            resolve({
              error: "Could not find reply textbox after multiple attempts.",
            });
          }
        };

        setTimeout(insertReplyText, 1000);
      });
    } catch (error) {
      console.error("API or insertion error:", error);
      return { error: "API Error: " + error.message };
    }
  } catch (error) {
    console.error("General error:", error);
    return { error: "Error: " + error.message };
  }
}

// Check if user is already logged in
chrome.storage.local.get(["session", "flag"], function (result) {
  if (result.session) {
    if (result.flag) {
      showMainContent(result.flag);
    } else {
      showMainContent();
    }
  }
});

// Login handler
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || "Login failed");
    }

    // Store session
    chrome.storage.local.set({ session: data }, function () {
      showMainContent();
    });
  } catch (error) {
    loginError.textContent = error.message;
  }
});

googleAuth.addEventListener("click", async () => {
  try {
    const url = new URL(
      `${BACKEND_URL}/api/authentication/google?from_chrome_ext=true`
    );

    window.open(url.href, "_blank");
  } catch (error) {
    googleAuthError.textContent = error.message;
  }
});

// Settings button handler
settingsBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${APP_URL}/dashboard` });
});

generateQuoteBtn.addEventListener("click", async () => {
  try {
    generateQuoteBtn.classList.add("processing");
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [BACKEND_URL],
      function: generateAndInsertReply,
    });

    if (result[0].result && result[0].result.error) {
      generateQuoteBtn.classList.remove("processing");
      quoteGeneration.textContent = result[0].result.error;
    }
    generateQuoteBtn.classList.remove("processing");
  } catch (error) {
    generateQuoteBtn.classList.remove("processing");
    quoteGeneration.textContent = error.message;
  }
});

// Generate Quote button handler
generateExcelBtn.addEventListener("click", async () => {
  try {
    generateExcelBtn.classList.add("processing");

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    let emailContent = "";

    const emailText = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          const emailContainers = document.querySelectorAll(".gs");
          console.log("Found email containers:", emailContainers.length);

          if (emailContainers.length === 0) {
            return {
              error:
                "No email content found. Please make sure you have an email open.",
            };
          }

          let emailText = "";
          emailContainers.forEach((container) => {
            emailText += container.innerText + "\n";
          });

          console.log("Email content:", emailText.substring(0, 100) + "...");

          if (!emailText.trim()) {
            return { error: "Email content appears to be empty." };
          }

          return { emailText };
        } catch (error) {
          generateExcelBtn.classList.remove("processing");
          quotePdfGeneration.textContent = error.message;
        }
      },
      args: [],
    });

    const { access_token } = await new Promise((resolve) => {
      chrome.storage.local.get(["access_token"], (result) => {
        resolve(result);
      });
    });

    const response = await fetch(
      `${BACKEND_URL}/api/quotation/generate-quotation-pdf`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_content: emailText[0].result.emailText,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error:", errorText);
      return {
        error: `API Error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    console.log("API Response:", data);

    const extractData = extractProductsAndCompany(data);
    console.log("Extracted data:", extractData);

    const productsResult = {
      products: extractData.products,
      companyName: extractData.companyName,
      emailContent: emailText,
    };

    if (productsResult.error) {
      generateExcelBtn.classList.remove("processing");
      quotePdfGeneration.textContent = productsResult.error;
      return;
    }

    if (!productsResult) {
      generateExcelBtn.classList.remove("processing");
      quotePdfGeneration.textContent = `Failed to extract product information from the email.`;
      return;
    }

    const {
      products,
      companyName,
      emailContent: extractedEmail,
    } = productsResult;
    emailContent = extractedEmail;

    // Inject required libraries
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/jspdf.umd.min.js"],
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/jspdf.plugin.autotable.min.js"],
    });

    // Get the image URLs
    const headerUrl = chrome.runtime.getURL("images/header.jpg");
    const footerUrl = chrome.runtime.getURL("images/footer.jpg");

    // Generate PDF with products (not updated products)
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (
        products,
        companyName,
        headerUrl,
        footerUrl,
        emailContent
      ) => {
        try {
          // Create a global variable to store the callback
          window.__quotationCallback = null;

          // Helper function to load image as base64
          const loadImage = async (url) => {
            return new Promise((resolve, reject) => {
              fetch(url)
                .then((response) => response.blob())
                .then((blob) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                })
                .catch(reject);
            });
          };

          // Load images
          const headerBase64 = await loadImage(headerUrl);
          const footerBase64 = await loadImage(footerUrl);

          // Create editable interface in the current tab
          const editorDiv = document.createElement("div");
          editorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
          `;

          const editorContent = document.createElement("div");
          editorContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            width: 800px;
            max-height: 90vh;
            overflow-y: auto;
          `;

          // Create email preview button and container (add this right after creating editorContent)
          const emailPreviewBtn = document.createElement("button");
          emailPreviewBtn.textContent = "Show Email";
          emailPreviewBtn.style.cssText = `
            background: #805AD5;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            margin-bottom: 15px;
            display: block;
            width: 100%;
          `;

          const emailPreviewContainer = document.createElement("div");
          emailPreviewContainer.style.cssText = `
            display: none;
            margin: 15px 0;
            padding: 15px;
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 6px;
            max-height: 200px;
            overflow-y: auto;
            white-space: pre-wrap;
          `;

          // Add click handler for email preview
          emailPreviewBtn.onclick = () => {
            const isVisible = emailPreviewContainer.style.display === "block";
            emailPreviewContainer.style.display = isVisible ? "none" : "block";
            emailPreviewBtn.textContent = isVisible
              ? "Show Email"
              : "Hide Email";

            // Only set content if we're showing the container
            if (!isVisible) {
              emailPreviewContainer.textContent = emailContent;
            }
          };

          // Add the button and container to the editor content
          editorContent.appendChild(emailPreviewBtn);
          editorContent.appendChild(emailPreviewContainer);

          // Create company name input field
          const companyDiv = document.createElement("div");
          companyDiv.style.cssText = `
            margin-bottom: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
          `;

          const companyLabel = document.createElement("label");
          companyLabel.textContent = "Company Name: ";
          companyLabel.style.cssText = `
            font-weight: 500;
            margin-right: 10px;
          `;

          const companyInput = document.createElement("input");
          companyInput.type = "text";
          companyInput.value = companyName; // Use the passed companyName
          companyInput.style.cssText = `
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 300px;
          `;

          // Make it more obvious that it's editable
          companyInput.addEventListener("focus", function () {
            this.style.borderColor = "#4299E1";
            this.style.boxShadow = "0 0 0 2px rgba(66, 153, 225, 0.2)";
          });

          companyInput.addEventListener("blur", function () {
            this.style.borderColor = "#ddd";
            this.style.boxShadow = "none";
          });

          // Add a small edit icon next to the input
          const companyInputWrapper = document.createElement("div");
          companyInputWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
          `;

          const editIcon = document.createElement("span");
          editIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
          `;
          editIcon.style.color = "#718096";

          companyInputWrapper.appendChild(companyInput);
          companyInputWrapper.appendChild(editIcon);

          // Update the company div to use the wrapper
          companyDiv.appendChild(companyLabel);
          companyDiv.appendChild(companyInputWrapper);
          editorContent.appendChild(companyDiv);

          // Add quotation number input field to the editor
          const quotationDiv = document.createElement("div");
          quotationDiv.style.cssText = `
            margin-bottom: 15px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          `;

          // Left side - Quotation number
          const quotationLeftDiv = document.createElement("div");
          quotationLeftDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
          `;

          const quotationLabel = document.createElement("label");
          quotationLabel.textContent = "Quotation No: ";
          quotationLabel.style.cssText = `
            font-weight: 500;
            margin-right: 10px;
          `;

          const quotationInput = document.createElement("input");
          quotationInput.type = "text";
          quotationInput.value =
            "QTN/" +
            new Date().getFullYear() +
            "/" +
            String(Math.floor(Math.random() * 1000)).padStart(3, "0");
          quotationInput.style.cssText = `
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 200px;
          `;

          const quotationInputWrapper = document.createElement("div");
          quotationInputWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
          `;

          const quotationEditIcon = document.createElement("span");
          quotationEditIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
          `;
          quotationEditIcon.style.color = "#718096";

          quotationInputWrapper.appendChild(quotationInput);
          quotationInputWrapper.appendChild(quotationEditIcon);
          quotationLeftDiv.appendChild(quotationLabel);
          quotationLeftDiv.appendChild(quotationInputWrapper);

          // Right side - Date
          const dateDiv = document.createElement("div");
          dateDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
          `;

          const dateLabel = document.createElement("label");
          dateLabel.textContent = "Date: ";
          dateLabel.style.cssText = `
            font-weight: 500;
            margin-right: 10px;
          `;

          const dateInput = document.createElement("input");
          dateInput.type = "text";
          const today = new Date().toLocaleDateString("en-GB"); // Format as DD/MM/YYYY
          dateInput.value = today;
          dateInput.style.cssText = `
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 120px;
          `;

          const dateInputWrapper = document.createElement("div");
          dateInputWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
          `;

          const dateEditIcon = document.createElement("span");
          dateEditIcon.innerHTML = quotationEditIcon.innerHTML; // Reuse the same edit icon
          dateEditIcon.style.color = "#718096";

          dateInputWrapper.appendChild(dateInput);
          dateInputWrapper.appendChild(dateEditIcon);
          dateDiv.appendChild(dateLabel);
          dateDiv.appendChild(dateInputWrapper);

          // Add both sections to the quotation div
          quotationDiv.appendChild(quotationLeftDiv);
          quotationDiv.appendChild(dateDiv);

          // Insert quotation div before company div in the editor
          editorContent.insertBefore(quotationDiv, companyDiv);

          // Create table
          const table = document.createElement("table");
          table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          `;

          // Add table header
          const thead = `
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 12px; background: #f8f9fa;">Sr No</th>
                <th style="border: 1px solid #ddd; padding: 12px; background: #f8f9fa;">Description</th>
                <th style="border: 1px solid #ddd; padding: 12px; background: #f8f9fa;">Make</th>
                <th style="border: 1px solid #ddd; padding: 12px; background: #f8f9fa;">Code</th>
                <th style="border: 1px solid #ddd; padding: 12px; background: #f8f9fa;">Range</th>
                <th style="border: 1px solid #ddd; padding: 12px; background: #f8f9fa;">Rate</th>
                <th style="border: 1px solid #ddd; padding: 12px; background: #f8f9fa;">Remark</th>
              </tr>
            </thead>
          `;

          // Update the tbody creation to match new structure
          let tbodyContent = products
            .map(
              (p) => `
            <tr>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                p.srNo
              }</td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                p.description || ""
              }</td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                p.make || ""
              }</td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                p.code || ""
              }</td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                p.range || ""
              }</td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                p.rate || ""
              }</td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                p.remark || ""
              }</td>
            </tr>
          `
            )
            .join("");

          // Update the empty rows creation
          const currentRows = products.length;
          for (let i = currentRows; i < 3; i++) {
            tbodyContent += `
              <tr>
                <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                  i + 1
                }</td>
                <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
                <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
                <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
                <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
                <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
                <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
              </tr>
            `;
          }

          table.innerHTML = thead + tbodyContent;
          editorContent.appendChild(table);

          // Add table controls div above the table
          const tableControls = document.createElement("div");
          tableControls.style.cssText = `
            margin-bottom: 15px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            display: flex;
            gap: 10px;
          `;

          // Add Row button
          const addRowBtn = document.createElement("button");
          addRowBtn.textContent = "+ Add Row";
          addRowBtn.style.cssText = `
            background: #48BB78;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
          `;

          // Delete Row button
          const deleteRowBtn = document.createElement("button");
          deleteRowBtn.textContent = "- Delete Row";
          deleteRowBtn.style.cssText = `
            background: #F56565;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
          `;

          // Add row handler
          addRowBtn.onclick = () => {
            const tbody = table.querySelector("tbody");
            const newRow = document.createElement("tr");
            const lastRow = tbody.lastElementChild;
            const lastSrNo = lastRow
              ? parseInt(lastRow.cells[0].textContent) || 0
              : 0;

            newRow.innerHTML = `
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;">${
                lastSrNo + 1
              }</td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
              <td contenteditable="true" style="border: 1px solid #ddd; padding: 12px;"></td>
            `;
            tbody.appendChild(newRow);
          };

          // Delete row handler
          deleteRowBtn.onclick = () => {
            const tbody = table.querySelector("tbody");
            if (tbody.children.length > 1) {
              tbody.removeChild(tbody.lastElementChild);
            }
          };

          // Add buttons to controls
          tableControls.appendChild(addRowBtn);
          tableControls.appendChild(deleteRowBtn);

          // Add controls before table
          editorContent.appendChild(tableControls);
          editorContent.appendChild(table);

          // Update table styles for better UX
          table.style.cssText += `
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 20px;
          `;

          // Add hover effect to table rows
          const style = document.createElement("style");
          style.textContent = `
            #quotationTable tr:hover {
              background-color: #f5f5f5;
            }
            #quotationTable td:focus {
              outline: 2px solid #4299E1;
              outline-offset: -2px;
            }
          `;
          document.head.appendChild(style);
          table.id = "quotationTable";

          // Create terms editor section
          const termsDiv = document.createElement("div");
          termsDiv.style.cssText = `
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
          `;

          // Company name section
          const companyNoteDiv = document.createElement("div");
          companyNoteDiv.style.marginBottom = "15px";

          const companyNoteLabel = document.createElement("div");
          companyNoteLabel.textContent = "Company Note:";
          companyNoteLabel.style.fontWeight = "bold";
          companyNoteLabel.style.marginBottom = "5px";

          const companyNoteInput = document.createElement("input");
          companyNoteInput.type = "text";
          companyNoteInput.value = "Bombay Tools Supplying Agency (1942).";
          companyNoteInput.style.cssText = `
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 10px;
          `;

          companyNoteDiv.appendChild(companyNoteLabel);
          companyNoteDiv.appendChild(companyNoteInput);
          termsDiv.appendChild(companyNoteDiv);

          // Terms and conditions section
          const termsLabel = document.createElement("div");
          termsLabel.textContent = "Terms and Conditions:";
          termsLabel.style.fontWeight = "bold";
          termsLabel.style.marginBottom = "5px";
          termsDiv.appendChild(termsLabel);

          const defaultTerms = [
            "GST: 18%",
            "Packing and Forwarding: Nil",
            "Freight: Extra At Actual.",
            "Delivery: 7-10 Days",
            "Payment: 100% Against Proforma Invoice.",
          ];

          const termsContainer = document.createElement("div");
          termsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 5px;
          `;

          defaultTerms.forEach((term) => {
            const termInput = document.createElement("input");
            termInput.type = "text";
            termInput.value = term;
            termInput.style.cssText = `
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
            `;
            termsContainer.appendChild(termInput);
          });

          termsDiv.appendChild(termsContainer);
          editorContent.appendChild(termsDiv);

          // Add save button
          const saveBtn = document.createElement("button");
          saveBtn.textContent = "Save & Update Email";
          saveBtn.style.cssText = `
            background: #4299E1;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            margin-top: 20px;
            margin-left: 10px;
            float: right;
          `;

          // Add cancel button
          const cancelBtn = document.createElement("button");
          cancelBtn.textContent = "Cancel";
          cancelBtn.style.cssText = `
            background: #E53E3E;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            margin-top: 20px;
            float: right;
          `;

          // Add cancel button click handler
          cancelBtn.onclick = () => {
            editorDiv.remove();
            if (window.__quotationCallback) {
              window.__quotationCallback({ success: false, cancelled: true });
            }
          };

          editorContent.appendChild(saveBtn);
          editorContent.appendChild(cancelBtn);
          editorDiv.appendChild(editorContent);
          document.body.appendChild(editorDiv);

          // Update the save button click handler
          saveBtn.onclick = async () => {
            try {
              // Get updated data with new structure
              const tableData = [];
              table.querySelectorAll("tbody tr").forEach((row) => {
                const cells = row.cells;
                tableData.push({
                  srNo: cells[0].textContent,
                  description: cells[1].textContent,
                  make: cells[2].textContent,
                  code: cells[3].textContent,
                  range: cells[4].textContent,
                  rate: cells[5].textContent,
                  remark: cells[6].textContent,
                });
              });

              // Get the updated company note and terms
              const updatedCompanyNote = companyNoteInput.value;
              const updatedTerms = Array.from(
                termsContainer.querySelectorAll("input")
              ).map((input) => input.value);

              // Generate new PDF
              const newDoc = new jspdf.jsPDF();

              // Add header
              newDoc.addImage(headerBase64, "JPEG", 0, 0, 210, 39);

              // Add quotation number
              newDoc.setFontSize(12);
              newDoc.setFont(undefined, "bold");
              newDoc.text(`Quotation No: ${quotationInput.value}`, 20, 45);

              // Add date
              newDoc.setFontSize(12);
              newDoc.setFont(undefined, "bold");
              newDoc.text(`Date: ${dateInput.value}`, 150, 45);

              // Move company name down
              newDoc.text(`To: ${companyInput.value}`, 20, 55);

              // Update table position with maxY limit to leave space for terms
              newDoc.autoTable({
                startY: 65,
                head: [
                  [
                    "Sr No",
                    "Description",
                    "Make",
                    "Code",
                    "Range",
                    "Rate",
                    "Remark",
                  ],
                ],
                body: tableData.map((p) => [
                  p.srNo,
                  p.description,
                  p.make,
                  p.code,
                  p.range,
                  p.rate,
                  p.remark,
                ]),
                styles: {
                  fontSize: 10,
                  cellPadding: 5,
                  lineColor: [0, 0, 0],
                  lineWidth: 0.1,
                },
                headStyles: {
                  fillColor: [255, 255, 255],
                  textColor: [0, 0, 0],
                  fontStyle: "bold",
                  halign: "center",
                },
                bodyStyles: {
                  halign: "center",
                },
                columnStyles: {
                  0: { cellWidth: 15 }, // Sr No
                  1: { cellWidth: 45 }, // Description
                  2: { cellWidth: 25 }, // Make
                  3: { cellWidth: 20 }, // Code
                  4: { cellWidth: 25 }, // Range
                  5: { cellWidth: 20 }, // Rate
                  6: { cellWidth: 30 }, // Remark
                },
                theme: "grid",
                // Add margin at bottom to ensure space for terms
                margin: { bottom: 60 },
              });

              // Get final Y position after table
              let finalY = newDoc.previousAutoTable.finalY || 60;

              // Check if there's enough space for terms (need at least 100 units)
              const pageHeight = newDoc.internal.pageSize.height;
              const requiredSpace = 100; // Space needed for terms and conditions

              if (pageHeight - finalY < requiredSpace) {
                // Not enough space, add new page
                newDoc.addPage();
                finalY = 20; // Reset Y position to top of new page
              }

              // Add terms and conditions with consistent spacing
              newDoc.setFontSize(10);
              newDoc.setFont(undefined, "bold");
              newDoc.text("Please Note Our Company Name:", 20, finalY + 20);
              newDoc.setFont(undefined, "normal");
              newDoc.text(updatedCompanyNote, 20, finalY + 30);

              newDoc.setFont(undefined, "bold");
              newDoc.text("Terms and Conditions:", 20, finalY + 45);
              newDoc.setFont(undefined, "normal");

              // Add terms with proper spacing
              updatedTerms.forEach((term, index) => {
                const yPos = finalY + 55 + index * 10;

                // Check if we need a new page for this term
                if (yPos > pageHeight - 50) {
                  // Leave space for footer
                  newDoc.addPage();
                  finalY = 20 - 55 - index * 10; // Reset Y position and adjust for current term position
                }

                newDoc.text(term, 20, yPos);
              });

              // Ensure footer is on the last page
              const lastPage = newDoc.internal.getNumberOfPages();
              newDoc.setPage(lastPage);
              newDoc.addImage(
                footerBase64,
                "JPEG",
                0,
                newDoc.internal.pageSize.height - 39,
                210,
                39
              );

              // Just open in new tab
              window.open(URL.createObjectURL(newDoc.output("blob")), "_blank");

              // Remove editor
              editorDiv.remove();

              // Create email reply with attachment
              const replyButtons = document.querySelectorAll('[role="button"]');
              let replyButton;
              for (const button of replyButtons) {
                if (
                  button
                    .getAttribute("aria-label")
                    ?.toLowerCase()
                    .includes("reply")
                ) {
                  replyButton = button;
                  break;
                }
              }

              if (replyButton) {
                replyButton.click();
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }

              const composeArea = document.querySelector('[role="textbox"]');
              if (composeArea) {
                const message = `To ${companyName},<br><br>Please find attached your quotation.`;
                composeArea.innerHTML = message;
                composeArea.dispatchEvent(
                  new Event("input", { bubbles: true })
                );

                await new Promise((resolve) => setTimeout(resolve, 1000));

                const attachmentInput = document.querySelector(
                  'input[type="file"][name="Filedata"]'
                );
                if (attachmentInput) {
                  const file = new File(
                    [newDoc.output("blob")],
                    `quotation_${companyInput.value
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, "_")
                      .replace(/_+/g, "_")
                      .replace(/^_|_$/g, "")}.pdf`
                  );
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  attachmentInput.files = dataTransfer.files;
                  attachmentInput.dispatchEvent(
                    new Event("change", { bubbles: true })
                  );
                }
              }

              // Notify the extension that we're done
              if (window.__quotationCallback) {
                window.__quotationCallback({ success: true });
              }
            } catch (error) {
              console.error("Error in save handler:", error);
              if (window.__quotationCallback) {
                window.__quotationCallback({ error: error.message });
              }
            }
          };

          // Return a promise that will be resolved when the save button is clicked
          return new Promise((resolve) => {
            window.__quotationCallback = resolve;
          });
        } catch (error) {
          console.error("PDF generation error:", error);
          return { error: error.message };
        }
      },
      args: [products, companyName, headerUrl, footerUrl, emailContent],
    });

    // Keep checking the result
    const checkResult = setInterval(async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const checkStatus = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.__quotationCallback !== null,
        });

        if (!checkStatus[0].result) {
          // Process is complete
          clearInterval(checkResult);
          if (result[0].result && result[0].result.error) {
            showError(result[0].result.error);
          } else {
            showStatus("Quote generated successfully!", "success");
          }
          setButtonsLoading(false);
        }
      } catch (error) {
        clearInterval(checkResult);
        console.error("Error checking result:", error);
        showError(error.message);
        setButtonsLoading(false);
      }
    }, 1000);

    // Clear the interval after 30 seconds (timeout)
    setTimeout(() => {
      clearInterval(checkResult);
    }, 30000);
  } catch (error) {
    generateExcelBtn.classList.remove("processing");
    quotePdfGeneration.textContent = error.message;
  }
});

// Generate Excel button handler
// generateExcelBtn.addEventListener("click", async () => {
//   // Get the current active tab
//   window.open("http://localhost:5173", "_blank");
//   // const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

//   // // Create sample Excel data
//   // const excelData = [
//   //   ["Item", "Description", "Quantity", "Unit Price", "Total"],
//   //   ["Product A", "High-quality widget", "2", "100", "200"],
//   //   ["Product B", "Premium gadget", "3", "150", "450"],
//   //   ["Product C", "Deluxe item", "1", "200", "200"],
//   //   ["", "", "", "Subtotal", "850"],
//   //   ["", "", "", "Tax (18%)", "153"],
//   //   ["", "", "", "Total", "1003"],
//   // ].map((row) =>
//   //   row.map((cell) => ({
//   //     value: cell.toString(),
//   //     width: 120,
//   //   }))
//   // );

//   // // Inject the content script
//   // await chrome.scripting.executeScript({
//   //   target: { tabId: tab.id },
//   //   files: ["content.js"],
//   // });

//   // // Send the Excel data to the content script
//   // chrome.tabs.sendMessage(tab.id, {
//   //   type: "SHOW_EXCEL_EDITOR",
//   //   data: excelData,
//   // });

//   // // Close the popup
//   // window.close();
// });

function showMainContent(flag = 0) {
  authBlock.style.display = "none";
  mainContent.style.display = "block";
  if (flag == 1) {
    showquotationUpload();
  } else if (flag == 2) {
    showMainInterface();
  } else {
    showPriceListUpload();
  }
}

function showPriceListUpload() {
  mainInterface.style.display = "none";
  quotationUpload.style.display = "none";
  priceListUpload.style.display = "block";
}

function showquotationUpload() {
  mainInterface.style.display = "none";
  priceListUpload.style.display = "none";
  quotationUpload.style.display = "block";
}

function showMainInterface() {
  priceListUpload.style.display = "none";
  quotationUpload.style.display = "none";
  mainInterface.style.display = "block";
}

document.addEventListener("DOMContentLoaded", function () {
  const priceListUploadContainer = document.getElementById("priceList");
  const priceListFileInput = document.getElementById("priceListInput");
  const priceListErrorMsg = document.getElementById("priceListUploadError");
  const nextButton = document.getElementById("uploadPriceList");
  const customPriceListFileLabel = document.getElementById(
    "priceListCustomField"
  );

  const quotationUploadContainer = document.getElementById("quotationUpload");
  const quotationFileInput = document.getElementById("quotationInput");
  const quotationErrorMsg = document.getElementById("quotationUploadError");
  const submitButton = document.getElementById("uploadQuotation");
  const customQuotationFileLabel = document.getElementById(
    "quotationCustomField"
  );

  function updatePriceListLabel() {
    if (priceListFileInput.files.length === 0) {
      customPriceListFileLabel.textContent =
        "Drag & Drop or Click to Upload Files";
    } else if (priceListFileInput.files.length === 1) {
      customPriceListFileLabel.textContent = priceListFileInput.files[0].name;
    } else {
      customPriceListFileLabel.textContent = `${priceListFileInput.files.length} files selected`;
    }
  }

  function updateQuotationLabel() {
    if (quotationFileInput.files.length === 0) {
      customQuotationFileLabel.textContent =
        "Drag & Drop or Click to Upload Files";
    } else if (quotationFileInput.files.length === 1) {
      customQuotationFileLabel.textContent = quotationFileInput.files[0].name;
    } else {
      customQuotationFileLabel.textContent = `${quotationFileInput.files.length} files selected`;
    }
  }

  // Clicking the container opens the file explorer.
  quotationUploadContainer.addEventListener("click", () => {
    quotationFileInput.click();
  });

  priceListUploadContainer.addEventListener("click", () => {
    priceListFileInput.click();
  });

  // Add dragover event to style the drop area.
  priceListUploadContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    priceListUploadContainer.classList.add("dragover");
  });

  quotationUploadContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    quotationUploadContainer.classList.add("dragover");
  });

  // Remove styling when dragging leaves.
  priceListUploadContainer.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    priceListUploadContainer.classList.remove("dragover");
  });

  quotationUploadContainer.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    quotationUploadContainer.classList.remove("dragover");
  });

  // Handle dropped files.
  priceListUploadContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    priceListUploadContainer.classList.remove("dragover");

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Note: priceListFileInput.files is read-only in many browsers. This assignment may not work everywhere.
      priceListFileInput.files = e.dataTransfer.files;
      console.log("Files dropped:", priceListFileInput.files);
      updatePriceListLabel();
      e.dataTransfer.clearData();
    }
  });

  quotationUploadContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    quotationUploadContainer.classList.remove("dragover");

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Note: priceListFileInput.files is read-only in many browsers. This assignment may not work everywhere.
      quotationFileInput.files = e.dataTransfer.files;
      console.log("Files dropped:", quotationFileInput.files);
      updateQuotationLabel();
      e.dataTransfer.clearData();
    }
  });

  // Log file selection from the file explorer.
  priceListFileInput.addEventListener("change", () => {
    if (priceListFileInput.files.length > 0) {
      console.log("Files selected:", priceListFileInput.files);
      priceListErrorMsg.textContent = "";
    }
    updatePriceListLabel();
  });

  quotationFileInput.addEventListener("change", () => {
    if (quotationFileInput.files.length > 0) {
      console.log("Files selected:", quotationFileInput.files);
      quotationErrorMsg.textContent = "";
    }
    updateQuotationLabel();
  });

  // Next button click simulates file upload processing.
  nextButton.addEventListener("click", () => {
    if (priceListFileInput.files.length === 0) {
      priceListErrorMsg.textContent = "Please select at least one file.";
      return;
    }

    const formData = new FormData();
    Array.from(priceListFileInput.files).forEach((file) => {
      formData.append("price_list_files", file);
    });

    chrome.storage.local.get(["access_token"], function (result) {
      if (result.access_token) {
        fetch(`${BACKEND_URL}/api/rag/update-price-list-files`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${result.access_token}`,
          },
          body: formData,
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.error || data.detail) {
              priceListErrorMsg.textContent = data.error;
              return;
            }
            chrome.storage.local.set(
              {
                flag: 1,
              },
              function () {}
            );
            showquotationUpload();
          })
          .catch((error) => {
            priceListErrorMsg.textContent = `Upload failed: ${error.message}`;
          });
      }
    });
  });

  submitButton.addEventListener("click", () => {
    if (quotationFileInput.files.length === 0) {
      quotationErrorMsg.textContent = "Please select at least one file.";
      return;
    }

    const formData = new FormData();
    Array.from(quotationFileInput.files).forEach((file) => {
      formData.append("quotations", file);
    });

    chrome.storage.local.get(["access_token"], function (result) {
      if (result.access_token) {
        fetch(`${BACKEND_URL}/api/rag/upload-quotation`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${result.access_token}`,
          },
          body: formData,
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.error || data.detail) {
              quotationErrorMsg.textContent = data.error;
              return;
            }
            chrome.storage.local.set(
              {
                flag: 2,
              },
              function () {}
            );
            showMainInterface();
          })
          .catch((error) => {
            quotationErrorMsg.textContent = `Upload failed: ${error.message}`;
          });
      }
    });
  });
});
