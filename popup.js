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
