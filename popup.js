// AdSpy & Funnel Cloner - Popup Controller (Gated Premium Logic)

document.addEventListener("DOMContentLoaded", () => {
  const activationView = document.getElementById("activation-view");
  const dashboardView = document.getElementById("dashboard-view");
  const tierBadge = document.getElementById("tier-badge");

  const licenseInput = document.getElementById("license-input");
  const activateBtn = document.getElementById("activate-btn");
  const statusMessage = document.getElementById("status-message");
  const deactivateBtn = document.getElementById("deactivate-btn");

  // Load and render initial states
  updatePopupState();

  // Activate license click handler
  activateBtn.addEventListener("click", () => {
    const key = licenseInput.value.trim();
    if (!key) {
      showStatus("Please enter a valid license key.", "error");
      return;
    }

    activateBtn.disabled = true;
    activateBtn.textContent = "Verifying...";
    hideStatus();

    // Send verify message to background worker using the requested 'activateLicense' action
    chrome.runtime.sendMessage(
      { action: "activateLicense", licenseKey: key },
      (response) => {
        activateBtn.disabled = false;
        activateBtn.textContent = "Activate Premium";

        if (response && response.success) {
          showStatus(response.message || "License successfully activated!", "success");
          licenseInput.value = "";
          
          // Switch to dashboard view after a short delay so user sees success state
          setTimeout(() => {
            updatePopupState();
          }, 1200);
        } else {
          showStatus(response ? response.error : "Failed to verify key. Please try again.", "error");
        }
      }
    );
  });

  // Deactivate license click handler
  deactivateBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to deactivate your license key on this device?")) {
      chrome.storage.local.set({ isPremium: false, licenseKey: "" }, () => {
        updatePopupState();
        showStatus("License deactivated successfully.", "success");
      });
    }
  });

  // Bulk Download of Viral Videos click handler
  const bulkSearchInput = document.getElementById("bulk-search-input");
  const bulkDownloadBtn = document.getElementById("bulk-download-btn");
  const bulkStatus = document.getElementById("bulk-status");

  if (bulkDownloadBtn) {
    bulkDownloadBtn.addEventListener("click", () => {
      const query = bulkSearchInput.value.trim();
      if (!query) {
        showBulkStatus("Please enter a product name.", "error");
        return;
      }

      const spin = document.getElementById("variate-spin")?.checked ? "true" : "false";
      const edge = document.getElementById("variate-edge")?.checked ? "true" : "false";

      showBulkStatus("Opening TikTok scanner in a new tab...", "success");

      // Open a new TikTok search tab with bulk_download and AI variation instructions
      const searchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}#bulk_download=true&spin=${spin}&edge=${edge}`;
      chrome.tabs.create({ url: searchUrl, active: true });
    });
  }

  function showBulkStatus(text, type) {
    if (bulkStatus) {
      bulkStatus.textContent = text;
      bulkStatus.className = `status-box ${type}`;
      bulkStatus.classList.remove("hidden");
    }
  }

  // Query chrome local storage and render updated tier configurations
  function updatePopupState() {
    chrome.storage.local.get(["isPremium", "licenseKey"], (result) => {
      const isPremium = !!result.isPremium;

      if (isPremium) {
        // Toggle view containers
        activationView.classList.add("hidden");
        dashboardView.classList.remove("hidden");

        // Update header badge
        tierBadge.textContent = "Premium";
        tierBadge.className = "badge premium";
        
        hideStatus();
      } else {
        // Toggle view containers
        activationView.classList.remove("hidden");
        dashboardView.classList.add("hidden");

        // Update header badge
        tierBadge.textContent = "Free Tier";
        tierBadge.className = "badge free";
      }
    });
  }

  function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = `status-box ${type}`;
    statusMessage.classList.remove("hidden");
  }

  function hideStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "status-box hidden";
  }
});
