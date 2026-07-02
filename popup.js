// AdSpy & Funnel Cloner - Popup Controller

document.addEventListener("DOMContentLoaded", () => {
  const licenseInput = document.getElementById("license-input");
  const activateBtn = document.getElementById("activate-btn");
  const statusMessage = document.getElementById("status-message");
  const downloadCountVal = document.getElementById("download-count");
  const upgradePromo = document.getElementById("upgrade-promo");
  const tierBadge = document.getElementById("tier-badge");

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

    // Send verify message to background worker
    chrome.runtime.sendMessage(
      { action: "VERIFY_LICENSE", licenseKey: key },
      (response) => {
        activateBtn.disabled = false;
        activateBtn.textContent = "Activate Premium";

        if (response && response.success) {
          showStatus(response.message || "License successfully activated!", "success");
          licenseInput.value = "";
          updatePopupState();
        } else {
          showStatus(response ? response.error : "Failed to verify key. Please try again.", "error");
        }
      }
    );
  });

  // Query chrome local storage and render updated tier configurations
  function updatePopupState() {
    chrome.storage.local.get(["isPremium", "downloadCount", "licenseKey"], (result) => {
      const isPremium = !!result.isPremium;
      const count = result.downloadCount || 0;

      // Update tier badge
      if (isPremium) {
        tierBadge.textContent = "Premium Activated";
        tierBadge.className = "badge premium";
        
        // Disable license verification input if already activated
        licenseInput.disabled = true;
        licenseInput.placeholder = "Premium Active " + (result.licenseKey ? `(${maskLicense(result.licenseKey)})` : "");
        activateBtn.disabled = true;
        activateBtn.textContent = "Activated ✓";
        activateBtn.style.background = "rgba(255, 255, 255, 0.08)";
        activateBtn.style.color = "var(--text-secondary)";
        activateBtn.style.cursor = "default";
        activateBtn.style.boxShadow = "none";

        // Hide upgrade recommendations
        upgradePromo.classList.add("hidden");
        downloadCountVal.textContent = "Unlimited";
        downloadCountVal.parentElement.classList.add("active-val");
      } else {
        tierBadge.textContent = "Free Tier";
        tierBadge.className = "badge free";
        
        // Render current remaining limits
        downloadCountVal.textContent = `${count} / 3`;
        if (count >= 3) {
          downloadCountVal.style.color = "var(--danger-red)";
        } else {
          downloadCountVal.style.color = "var(--text-primary)";
        }
        
        upgradePromo.classList.remove("hidden");
      }
    });
  }

  function maskLicense(key) {
    if (key.length <= 8) return "****";
    return key.substring(0, 4) + "..." + key.substring(key.length - 4);
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
