// AdSpy & Funnel Cloner - Dead Simple, Ultra-Lightweight Content Script

// Setup toast notifications system safely
function showToast(message, type = "success") {
  try {
    let container = document.getElementById("adspy-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "adspy-toast-container";
      container.className = "adspy-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `adspy-toast ${type}`;
    let icon = type === "warning" ? "⚠️" : type === "error" ? "❌" : "🚀";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 50);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3000);
  } catch (err) {
    console.error("Toast error:", err);
  }
}

// Safely extract caption text with zero DOM-climbing loops
function getAdCaption(videoEl, platform) {
  try {
    if (platform === "tiktok") {
      // Direct, fast selector query on the video container card
      const parentCard = videoEl.closest('article, div[class*="ItemContainer"], div[data-e2e="recommend-list-item"]');
      if (parentCard) {
        const desc = parentCard.querySelector('[data-e2e="video-desc"], [data-e2e="ad-desc"], [class*="DivDesc"], [class*="FormatText"]');
        if (desc && desc.textContent) return desc.textContent.trim();
      }
      const globalDesc = document.querySelector('[data-e2e="video-desc"]');
      if (globalDesc && globalDesc.textContent) return globalDesc.textContent.trim();
    } else if (platform === "facebook") {
      const parentCard = videoEl.closest('div[class*="_8o0y"], div[class*="fb_ads_library_card"]');
      if (parentCard) {
        const fbText = parentCard.querySelector('[class*="_1o0y"], [style*="white-space: pre-wrap"]');
        if (fbText && fbText.textContent) return fbText.textContent.trim();
      }
    }
  } catch (err) {
    console.error("Caption extraction error:", err);
  }
  return "No ad caption found.";
}

// Lightweight, bulletproof URL resolution targeting TikTok feed cards
function getVideoPageUrl(videoEl) {
  try {
    // 1. Single page detail view check
    if (window.location.href.includes('/video/')) {
      return window.location.href;
    }

    // 2. Climb up and scan sub-tree anchors using regex matching TikTok post format
    let current = videoEl.parentElement;
    const maxLevels = 8; // Scan wider relative hierarchy on feed items
    for (let i = 0; i < maxLevels && current; i++) {
      const anchors = current.querySelectorAll('a');
      for (let j = 0; j < anchors.length; j++) {
        const href = anchors[j].getAttribute('href') || '';
        // Match /@username/video/123456 or /video/123456
        if (href.includes('/video/') && /\/video\/[0-9]+/i.test(href)) {
          if (href.startsWith('/')) {
            return `https://www.tiktok.com${href}`;
          }
          return href;
        }
      }
      current = current.parentElement;
    }

    // 3. Fallback: Search inside closest feed post container (article, list-item or custom card wrapper)
    const card = videoEl.closest('article, div[data-e2e="recommend-list-item"], div[class*="ItemContainer"], div[class*="VideoCard"]');
    if (card) {
      const anchors = card.querySelectorAll('a');
      for (let i = 0; i < anchors.length; i++) {
        const href = anchors[i].getAttribute('href') || '';
        if (href.includes('/video/') && /\/video\/[0-9]+/i.test(href)) {
          if (href.startsWith('/')) {
            return `https://www.tiktok.com${href}`;
          }
          return href;
        }
      }

      // 4. Advanced reconstruction fallback: Match profile link (/@username) and find numerical video ID inside page HTML
      const avatarLink = card.querySelector('a[href*="/@"]');
      if (avatarLink) {
        const href = avatarLink.getAttribute('href') || '';
        const usernameMatch = href.match(/\/(@[^\/\?]+)/);
        const idMatch = card.innerHTML.match(/\d{18,21}/); // TikTok video IDs are 19-digit identifiers
        
        if (usernameMatch && usernameMatch[1] && idMatch && idMatch[0]) {
          return `https://www.tiktok.com/${usernameMatch[1]}/video/${idMatch[0]}`;
        }
      }
    }
  } catch (err) {
    console.error("URL resolving error:", err);
  }
  return null;
}

// Copy text to clipboard
function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast("Ad copy copied!"))
        .catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  } catch (err) {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    showToast("Ad copy copied!");
  } catch (err) {
    console.error("Fallback copy failed:", err);
  }
}

// Handle action button click
function handleActionClick(btn, videoEl, platform) {
  try {
    if (btn.disabled) return;
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Processing...";

    // 1. Copy caption text
    const caption = getAdCaption(videoEl, platform);
    copyTextToClipboard(caption);

    // 2. Construct download payload
    const filename = `${platform}_cloned_ad_${Date.now()}.mp4`;
    let messagePayload = {
      action: "DOWNLOAD_VIDEO",
      platform: platform,
      filename: filename
    };

    // Grab whatever local stream url is available inside the video DOM element
    let videoUrl = videoEl.getAttribute("src") || "";
    if (!videoUrl && videoEl.querySelector("source")) {
      videoUrl = videoEl.querySelector("source").getAttribute("src") || "";
    }

    if (platform === "tiktok") {
      const videoPageUrl = getVideoPageUrl(videoEl);
      if (!videoPageUrl) {
        // Fallback: If no post link is resolved, pass video.src directly so background can download direct CDN link or backup blob
        showToast("Post link not found, downloading active video stream source...", "warning");
        messagePayload.videoPageUrl = null;
        messagePayload.videoUrl = videoUrl;
      } else {
        messagePayload.videoPageUrl = videoPageUrl;
        showToast("Fetching high-quality stream...", "success");
      }
    } else {
      messagePayload.videoUrl = videoUrl;
    }

    // 3. Request download
    chrome.runtime.sendMessage(messagePayload, (response) => {
      btn.innerHTML = originalText;
      btn.disabled = false;

      if (!response) {
        showToast("Error communicating with worker.", "error");
        return;
      }
      
      if (response.limitReached) {
        showToast(response.error, "warning");
        alert("🚀 AdSpy Limit: You have reached the free 3-download limit. Please open the extension popup to activate premium!");
      } else if (response.success) {
        showToast("Direct MP4 download complete!", "success");
      } else {
        showToast(response.error || "Failed to download.", "error");
      }
    });

  } catch (err) {
    console.error("Button click error:", err);
    btn.disabled = false;
  }
}

// Inject button into TikTok wrapper safely without touching layout/playback structures
function injectTikTokButtons() {
  try {
    const videos = document.querySelectorAll("video");
    for (let i = 0; i < videos.length; i++) {
      const videoEl = videos[i];
      const container = videoEl.parentElement;
      if (!container) continue;

      // Prevent duplicate injection
      if (videoEl.dataset.adspyInjected && container.querySelector(".adspy-tiktok-btn")) {
        continue;
      }

      // Mark first to avoid layout trigger loops
      videoEl.dataset.adspyInjected = "true";

      const btn = document.createElement("button");
      btn.className = "adspy-tiktok-btn";
      btn.innerHTML = "🚀 Copy with AI";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleActionClick(btn, videoEl, "tiktok");
      });

      // Safely append to the immediate video container parent
      container.appendChild(btn);
    }
  } catch (err) {
    console.error("TikTok injection failed safely:", err);
  }
}

// Inject button into Facebook Ads Library video cards safely
function injectFacebookButtons() {
  try {
    const fbVideos = document.querySelectorAll("video");
    for (let i = 0; i < fbVideos.length; i++) {
      const videoEl = fbVideos[i];
      const container = videoEl.parentElement;
      if (!container || container.querySelector(".adspy-facebook-btn")) continue;

      const btn = document.createElement("button");
      btn.className = "adspy-facebook-btn";
      btn.innerHTML = "🚀 AI Copy";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleActionClick(btn, videoEl, "facebook");
      });

      container.appendChild(btn);
    }
  } catch (err) {
    console.error("Facebook injection failed safely:", err);
  }
}

// Purge injected UI elements if premium license is inactive or deactivated
function removeInjectedButtons() {
  try {
    const injectedTikTokBtns = document.querySelectorAll(".adspy-tiktok-btn");
    injectedTikTokBtns.forEach(btn => btn.remove());

    const injectedFacebookBtns = document.querySelectorAll(".adspy-facebook-btn");
    injectedFacebookBtns.forEach(btn => btn.remove());

    // Reset injection tracking markers so they can be injected again on subsequent purchase/activation
    const videos = document.querySelectorAll("video");
    videos.forEach(videoEl => {
      delete videoEl.dataset.adspyInjected;
    });
  } catch (err) {
    console.error("Failed to remove injected buttons safely:", err);
  }
}

// Global safe runner
function runScanner() {
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      // Content script context invalidated, stop periodic tasks
      return;
    }

    // Retrieve active license state before showing/injecting UI features
    chrome.storage.local.get("isPremium", (result) => {
      if (chrome.runtime.lastError) {
        console.warn("Could not query license state from extension storage:", chrome.runtime.lastError.message);
        return;
      }

      const isPremium = !!result.isPremium;
      if (!isPremium) {
        // If premium is deactivated or false, remove existing buttons immediately
        removeInjectedButtons();
        return;
      }

      // Check current host URL and execute platform-specific UI button injectors
      const host = window.location.host;
      if (host.includes("tiktok.com")) {
        injectTikTokButtons();
      } else if (host.includes("facebook.com")) {
        injectFacebookButtons();
      }
    });
  } catch (err) {
    console.error("Global scanner failed safely:", err);
  }
}

// Initialize on interval ONLY to maximize performance and minimize repaint triggers
setInterval(runScanner, 3000);

// Run once immediately on load safely
setTimeout(runScanner, 1000);
