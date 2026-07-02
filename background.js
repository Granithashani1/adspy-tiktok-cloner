// AdSpy & Funnel Cloner - Service Worker (Lightweight, TikWM API Bridge & failproof downloads)
const LEMON_SQUEEZY_API_URL = "https://api.lemonsqueezy.com/v1/licenses/activate";

// Inject dynamic DeclarativeNetRequest rules to spoof Referer/Origin headers on TikTok/TikWM CDNs
async function setupDeclarativeRules() {
  const rules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "Referer", operation: "set", value: "https://www.tiktok.com/" },
          { header: "Origin", operation: "set", value: "https://www.tiktok.com" }
        ]
      },
      condition: {
        urlFilter: "tiktokcdn.com",
        resourceTypes: ["xmlhttprequest", "other", "main_frame", "sub_frame"]
      }
    },
    {
      id: 2,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "Referer", operation: "set", value: "https://www.tiktok.com/" },
          { header: "Origin", operation: "set", value: "https://www.tiktok.com" }
        ]
      },
      condition: {
        urlFilter: "byteoversea.com",
        resourceTypes: ["xmlhttprequest", "other", "main_frame", "sub_frame"]
      }
    },
    {
      id: 3,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "Referer", operation: "set", value: "https://www.tiktok.com/" },
          { header: "Origin", operation: "set", value: "https://www.tiktok.com" }
        ]
      },
      condition: {
        urlFilter: "ibyteimg.com",
        resourceTypes: ["xmlhttprequest", "other", "main_frame", "sub_frame"]
      }
    }
  ];

  try {
    // Read currently configured dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);
    
    // Atomically swap the rule definitions
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules
    });
    console.log("DeclarativeNetRequest rule modifications applied successfully.");
  } catch (err) {
    console.error("Failed to inject DNR rules:", err);
  }
}

// Set initial state on install
chrome.runtime.onInstalled.addListener(() => {
  setupDeclarativeRules();
  chrome.storage.local.get(["isPremium", "downloadCount"], (result) => {
    if (result.isPremium === undefined) {
      chrome.storage.local.set({ isPremium: false });
    }
    if (result.downloadCount === undefined) {
      chrome.storage.local.set({ downloadCount: 0 });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  setupDeclarativeRules();
});

// Listener for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "VERIFY_LICENSE") {
    verifyLicenseKey(message.licenseKey)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === "DOWNLOAD_VIDEO") {
    handleVideoDownload(message)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Verify Lemon Squeezy license key
async function verifyLicenseKey(licenseKey) {
  if (!licenseKey || licenseKey.trim() === "") {
    throw new Error("License key cannot be empty.");
  }

  // Developer bypass & quick test key
  if (licenseKey.trim().toUpperCase() === "PREMIUM-TEST-1234") {
    await chrome.storage.local.set({
      isPremium: true,
      licenseKey: licenseKey.trim()
    });
    return { success: true, message: "Developer Premium Activated!" };
  }

  try {
    const response = await fetch(LEMON_SQUEEZY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        license_key: licenseKey.trim()
      })
    });

    const data = await response.json();

    if (response.ok && data.activated) {
      await chrome.storage.local.set({
        isPremium: true,
        licenseKey: licenseKey.trim()
      });
      return { success: true, message: "Premium license verified successfully!" };
    } else {
      const errMsg = data.error || (data.message ? data.message : "Invalid license key.");
      return { success: false, error: errMsg };
    }
  } catch (err) {
    console.error("License validation request failed:", err);
    throw new Error("Network error during validation. Please check your internet connection.");
  }
}

// Convert ArrayBuffer to Base64 in chunks to prevent stack overflows
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  const chunk = 8192; // Process in standard chunk sizes
  for (let i = 0; i < len; i += chunk) {
    const subarr = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, subarr);
  }
  return btoa(binary);
}

// Fetch the protected stream bytes background-side with spoofed headers and convert to Base64 Data URL
async function fetchStreamAsDataUrl(url) {
  const response = await fetch(url, {
    headers: {
      "Referer": "https://www.tiktok.com/",
      "Origin": "https://www.tiktok.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to stream video file (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  
  // Verify that we received an actual video instead of HTML webpage data
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html") || arrayBuffer.byteLength < 5000) {
    throw new Error("Resolved stream is invalid HTML or too small to be a video.");
  }

  const base64 = arrayBufferToBase64(arrayBuffer);
  return `data:video/mp4;base64,${base64}`;
}

// Resolve TikTok direct watermark-free .mp4 URL via public downloader API (tikwm.com API bridge)
async function resolveTikTokVideoUrl(videoPageUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for fast failover

  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoPageUrl)}`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json"
      }
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API bridge responded with HTTP ${response.status}`);
    }
    
    const res = await response.json();
    if (res && res.code === 0 && res.data) {
      // Pull un-watermarked high quality direct play link
      const videoCdnUrl = res.data.play || res.data.wmplay;
      if (videoCdnUrl) {
        // Form absolute path if relative
        if (videoCdnUrl.startsWith("/")) {
          return `https://www.tikwm.com${videoCdnUrl}`;
        }
        return videoCdnUrl;
      }
    }
    
    throw new Error(res.msg || "Invalid format returned by public downloader API.");
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("resolveTikTokVideoUrl error:", err);
    throw err;
  }
}

// Safely open target URL in a minimal, clean tab as a safe fallback
function openFallbackTab(url) {
  try {
    chrome.tabs.create({ url: url, active: true });
  } catch (err) {
    console.error("Failed to open backup tab:", err);
  }
}

// Handle video download and free trial limitations
async function handleVideoDownload(message) {
  const { platform, filename } = message;

  return new Promise((resolve) => {
    chrome.storage.local.get(["isPremium", "downloadCount"], async (result) => {
      const isPremium = !!result.isPremium;
      const downloadCount = result.downloadCount || 0;

      if (!isPremium && downloadCount >= 3) {
        resolve({
          success: false,
          limitReached: true,
          error: "Free limit reached. Upgrade to Premium for unlimited downloads!"
        });
        return;
      }

      try {
        let directCdnUrl = null;
        let usedTabFallback = false;

        if (platform === "tiktok") {
          const { videoPageUrl } = message;
          if (videoPageUrl) {
            try {
              // Attempt to retrieve direct play URL from public API bridge
              directCdnUrl = await resolveTikTokVideoUrl(videoPageUrl);
            } catch (err) {
              console.warn("API bridge failed, falling back to open tab link:", err);
              // Fallback to opening link directly as safe failover
              openFallbackTab(videoPageUrl);
              usedTabFallback = true;
            }
          } else {
            // Backup direct URL fallback passed from content
            directCdnUrl = message.videoUrl;
          }
        } else {
          // Facebook video direct path
          directCdnUrl = message.videoUrl;
        }

        if (usedTabFallback) {
          incrementCountAndResolve(isPremium, downloadCount, resolve);
          return;
        }

        if (!directCdnUrl || directCdnUrl.startsWith("blob:")) {
          throw new Error("No absolute download link could be resolved.");
        }

        // Perform streaming fetch in background and convert to Base64 Data URL.
        const localDataUrl = await fetchStreamAsDataUrl(directCdnUrl);

        chrome.downloads.download({
          url: localDataUrl,
          filename: filename || "cloned_ad_video.mp4",
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            // If download block occurs, open the raw source in a fallback tab
            console.warn("Direct download block: ", chrome.runtime.lastError.message);
            openFallbackTab(directCdnUrl);
            incrementCountAndResolve(isPremium, downloadCount, resolve);
          } else {
            incrementCountAndResolve(isPremium, downloadCount, resolve);
          }
        });

      } catch (err) {
        console.error("Download handling error:", err);
        // Direct backup fallback: open whatever url we have in a new tab
        const fallbackUrl = message.videoPageUrl || message.videoUrl || "https://www.tiktok.com";
        openFallbackTab(fallbackUrl);
        incrementCountAndResolve(isPremium, downloadCount, resolve);
      }
    });
  });
}

function incrementCountAndResolve(isPremium, downloadCount, resolve) {
  if (!isPremium) {
    const newCount = downloadCount + 1;
    chrome.storage.local.set({ downloadCount: newCount }, () => {
      resolve({
        success: true,
        isPremium: false,
        remaining: 3 - newCount
      });
    });
  } else {
    resolve({
      success: true,
      isPremium: true
    });
  }
}
