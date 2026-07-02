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

// Bulk download overlay and scraper logic
function createAutomationOverlay() {
  try {
    let overlay = document.getElementById("adspy-bulk-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "adspy-bulk-overlay";
      overlay.style.position = "fixed";
      overlay.style.top = "20px";
      overlay.style.right = "20px";
      overlay.style.width = "340px";
      overlay.style.backgroundColor = "rgba(21, 24, 33, 0.96)";
      overlay.style.border = "1px solid rgba(0, 242, 254, 0.3)";
      overlay.style.borderRadius = "16px";
      overlay.style.padding = "20px";
      overlay.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.6)";
      overlay.style.zIndex = "999999";
      overlay.style.fontFamily = "'Inter', sans-serif";
      overlay.style.color = "#ffffff";
      overlay.style.display = "flex";
      overlay.style.flexDirection = "column";
      overlay.style.gap = "12px";

      overlay.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px; filter: drop-shadow(0 0 6px #00f2fe);">🤖</span>
            <h3 style="font-size: 14px; font-weight: 700; color: #00f2fe; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Bulk Viral Scraper</h3>
          </div>
          <button id="adspy-bulk-close" style="background: none; border: none; color: #8b949e; cursor: pointer; font-size: 14px; font-weight: bold;">✕</button>
        </div>
        <p id="bulk-progress-text" style="font-size: 12px; color: #8b949e; line-height: 1.4; margin: 0;">
          Waiting for search results to load...
        </p>
        <div style="width: 100%; height: 6px; background-color: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
          <div id="bulk-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #ff007f, #7f00ff); transition: width 0.3s ease;"></div>
        </div>
        <div id="bulk-log-container" style="max-height: 120px; overflow-y: auto; font-size: 10px; font-family: monospace; color: #a2aab2; background-color: rgba(0,0,0,0.4); padding: 10px; border-radius: 8px; display: flex; flex-direction: column; gap: 4px;">
          <div>[System] Automation bot initialized.</div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById("adspy-bulk-close").addEventListener("click", () => {
        overlay.remove();
      });
    }
  } catch (err) {
    console.error("Failed to create overlay:", err);
  }
}

function updateAutomationProgress(percent, text, logMsg) {
  try {
    const pBar = document.getElementById("bulk-progress-bar");
    const pText = document.getElementById("bulk-progress-text");
    const pLog = document.getElementById("bulk-log-container");

    if (pBar) pBar.style.width = `${percent}%`;
    if (pText) pText.textContent = text;
    if (pLog && logMsg) {
      const div = document.createElement("div");
      div.style.borderLeft = "2px solid #00f2fe";
      div.style.paddingLeft = "6px";
      div.style.margin = "2px 0";
      div.textContent = `[Log] ${logMsg}`;
      pLog.appendChild(div);
      pLog.scrollTop = pLog.scrollHeight;
    }
  } catch (err) {
    console.error("Failed to update progress:", err);
  }
}

// Extractor function for top 10 search results on TikTok search page
function extractTop10SearchVideos() {
  try {
    const videoUrls = new Set();
    const anchors = document.querySelectorAll('a');
    for (let i = 0; i < anchors.length; i++) {
      const href = anchors[i].getAttribute('href') || '';
      if (href.includes('/video/') && /\/video\/[0-9]+/i.test(href)) {
        let absoluteUrl = href;
        if (href.startsWith('/')) {
          absoluteUrl = `https://www.tiktok.com${href}`;
        }
        const cleanUrl = absoluteUrl.split('?')[0];
        videoUrls.add(cleanUrl);
        if (videoUrls.size >= 10) break;
      }
    }
    return Array.from(videoUrls);
  } catch (err) {
    console.error("Extraction error:", err);
    return [];
  }
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function executeBulkDownload() {
  createAutomationOverlay();
  updateAutomationProgress(5, "Waiting for search results to render...", "Locating target feed items...");
  
  // Parse optional parameters from URL hash
  const hash = window.location.hash;
  const spinEnabled = hash.includes("spin=true");
  const edgeEnabled = hash.includes("edge=true");

  // Extract search query from URL to use as product name
  const urlParams = new URLSearchParams(window.location.search);
  const qParam = urlParams.get('q') || 'viral_product';
  const productName = qParam.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  updateAutomationProgress(8, "Verifying parameters...", `Product: "${qParam}", Visual Auto-Spin: ${spinEnabled ? "ON ✓" : "OFF"}, Edge Variator: ${edgeEnabled ? "ON ✓" : "OFF"}`);

  // Wait up to 5 seconds for results to load
  let videos = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    videos = extractTop10SearchVideos();
    if (videos.length >= 3) break;
    await delay(1000);
  }
  
  if (videos.length === 0) {
    updateAutomationProgress(100, "No videos found.", "Failed to find any TikTok videos. Try scrolling or using a different query.");
    return;
  }
  
  updateAutomationProgress(15, `Found ${videos.length} viral videos. Initializing background batch...`, "Preparing file bundle structure...");

  // Start batch session in the background
  try {
    const startBatchRes = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "START_BULK_BATCH",
        total: videos.length,
        spin: spinEnabled,
        edge: edgeEnabled,
        productName: productName
      }, (res) => resolve(res));
    });

    if (!startBatchRes || !startBatchRes.success) {
      throw new Error((startBatchRes && startBatchRes.error) ? startBatchRes.error : "Failed to start bulk batch.");
    }
  } catch (err) {
    updateAutomationProgress(100, "Initialization failed ❌", `Batch Error: ${err.message}`);
    return;
  }

  await delay(1000);

  let successCount = 0;
  for (let i = 0; i < videos.length; i++) {
    if (!document.getElementById("adspy-bulk-overlay")) {
      console.log("Bulk download cancelled by user.");
      return;
    }

    const videoUrl = videos[i];
    const progressPercent = Math.round(15 + ((i + 1) / videos.length) * 75); // 15% to 90%
    
    // Attempt to resolve ad caption (original copy text) for AI overlays
    let caption = "No ad caption found.";
    try {
      const allVideos = document.querySelectorAll("video");
      for (let vEl of allVideos) {
        const vPageUrl = getVideoPageUrl(vEl);
        if (vPageUrl && vPageUrl.split('?')[0] === videoUrl) {
          caption = getAdCaption(vEl, "tiktok");
          break;
        }
      }
      if (caption === "No ad caption found." && allVideos.length > 0) {
        caption = getAdCaption(allVideos[0], "tiktok");
      }
    } catch (cErr) {
      console.error("Caption extraction during bulk run:", cErr);
    }

    updateAutomationProgress(
      progressPercent, 
      `Processing video ${i + 1} of ${videos.length}...`, 
      `Extracted caption details: "${caption.substring(0, 30)}..."`
    );

    try {
      updateAutomationProgress(
        progressPercent,
        `Resolving direct CDN link #${i + 1}...`,
        `Analyzing DOM card container index ${i}...`
      );

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: "ADD_TO_BULK_BATCH",
          videoPageUrl: videoUrl,
          caption: caption,
          index: i
        }, (res) => resolve(res));
      });

      if (response && response.success) {
        successCount++;
        const suffixMsg = spinEnabled ? "(3 variations generated) ✓" : "(Downloaded raw) ✓";
        updateAutomationProgress(progressPercent, `Processed video ${i + 1} ${suffixMsg}`, `Successfully processed file bundle #${i + 1}`);
      } else {
        const err = (response && response.error) ? response.error : "Unknown error";
        updateAutomationProgress(progressPercent, `Video ${i + 1} failed ❌`, `Failed bundle #${i + 1}: ${err}`);
      }
    } catch (err) {
      updateAutomationProgress(progressPercent, `Video ${i + 1} error ❌`, `Error: ${err.message}`);
    }

    // Wait 2.5 seconds to balance requests
    await delay(2500);
  }

  // Finalize batch and compile zip archive
  updateAutomationProgress(92, "Assembling ZIP file archive...", "Generating Central Directory Headers...");
  
  try {
    const finalizeRes = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "FINALIZE_BULK_BATCH"
      }, (res) => resolve(res));
    });

    if (finalizeRes && finalizeRes.success) {
      const totalCreated = spinEnabled ? successCount * 3 : successCount;
      updateAutomationProgress(
        100, 
        `Complete! Generated ${totalCreated} variations.`, 
        `ZIP archive downloaded successfully (saved ${successCount} bundles, total ${totalCreated} files).`
      );
    } else {
      const err = (finalizeRes && finalizeRes.error) ? finalizeRes.error : "ZIP generation failed";
      throw new Error(err);
    }
  } catch (err) {
    updateAutomationProgress(100, "ZIP packaging failed ❌", `Compilation Error: ${err.message}`);
  }
}

// Check for bulk downloader instruction in URL on load
function checkBulkDownloadTrigger() {
  try {
    if (window.location.hash.includes("bulk_download=true")) {
      chrome.storage.local.get("isPremium", (result) => {
        if (chrome.runtime.lastError) return;
        if (result.isPremium) {
          executeBulkDownload();
        } else {
          alert("🚀 Bulk Download is a Premium Only feature! Please activate your license key to unlock it.");
        }
      });
    }
  } catch (err) {
    console.error("Bulk download check failed safely:", err);
  }
}

// Initialize on interval ONLY to maximize performance and minimize repaint triggers
setInterval(runScanner, 3000);

// Run once immediately on load safely
setTimeout(() => {
  runScanner();
  checkBulkDownloadTrigger();
}, 1000);
