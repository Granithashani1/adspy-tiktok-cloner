// AdSpy & Funnel Cloner - Service Worker (Lemon Squeezy Direct Integration)
const LEMON_SQUEEZY_API_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiJjNDljY2UwZDYwZTVkMWNlZjMzMmY5MGI3OWY3YTkyMmEyYTY5YjE3NjEzNWRmMjE4NzA3OTBiOGRkYWZhZDliZWNhN2NiNTBiMzRkNmIxNCIsImlhdCI6MTc4MzAxMzc0MS4wMjc1MDgsIm5iZiI6MTc4MzAxMzc0MS4wMjc1MTEsImV4cCI6MTc5ODg0ODAwMC4wMjEzNTUsInN1YiI6Ijc1MDk0MzEiLCJzY29wZXMiOltdfQ.birF-uvvNPhCX-FaqVIThUZ-OLvQxysC74CdkF0uiHvsj02csGMMRX6-3ZI_1tmtYJmie6p-ye7aTJ1b5KrS6sAcRBxZu-41bWX3TI4RSzYRWU8RgYydz6qLuedzxltVCHV3mqT59LHXlLfmNggWehjKF9rPr3DXDBOqTRph2JM1tRiT8l47uaD_sUmR5PcPXFLi2DFussPmXAztZuBc4DL7O0Kwzx8ttKkUoAMBI5NGCEiWbFccl2xNoL8_mm_ZRwtzaXfisDj4UEbQ23kZ0t6JXwRGJ1Dxdgl5-GGV4yzETqUwyac3Q39yGT-U0XO4f5g6U1_wr16zkP5LobLSld731Y7A5yDqNm_G3uhOGQdgakyQC21z7SRAQA5b1T_vBP7hA-HCJAFG9MfTmoE5EzOXpgR-dQqubbcl7ak2BKmwQa7ThzE1PMbtle7TYnwH2tyoUHw3OGMUz4bthaARYnNCv8mE88oYcguXWIZg4UgjCz7bAwrG4xZZuTQBIk8znEOImUYLwFni_eZlQM7P-J7H5PhzIRluYOiNmZKaLAJVt60quo8n5r9fNGtbNyfTp5gl6dMcr2iJnPt5H_LQ4AcMIq4_qAwhGITn5PzdCklBEJC2AXvDXSvCPGVctCUVPCOgGM75NVn4hdTQO_GlUC4Ok-m7coai_GAXMgZ1mtU";
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
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);
    
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
  chrome.storage.local.get(["isPremium"], (result) => {
    if (result.isPremium === undefined) {
      chrome.storage.local.set({ isPremium: false });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  setupDeclarativeRules();
});

// Listener for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "activateLicense") {
    activateLemonSqueezyLicense(message.licenseKey)
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

// Verify Lemon Squeezy license key via direct API integration
async function activateLemonSqueezyLicense(licenseKey) {
  if (!licenseKey || licenseKey.trim() === "") {
    throw new Error("License key cannot be empty.");
  }

  const keyCleaned = licenseKey.trim();

  // Developer bypass & quick test key
  if (keyCleaned.toUpperCase() === "PREMIUM-TEST-1234") {
    await chrome.storage.local.set({
      isPremium: true,
      licenseKey: keyCleaned
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
        license_key: keyCleaned
      }).toString()
    });

    const data = await response.json();

    // Check activated property from Lemon Squeezy response
    if (response.ok && data.activated) {
      await chrome.storage.local.set({
        isPremium: true,
        licenseKey: keyCleaned
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
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const subarr = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, subarr);
  }
  return btoa(binary);
}

// Fetch protected streams as base64 data URLs
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
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html") || arrayBuffer.byteLength < 5000) {
    throw new Error("Resolved stream is invalid HTML or too small to be a video.");
  }

  const base64 = arrayBufferToBase64(arrayBuffer);
  return `data:video/mp4;base64,${base64}`;
}

// Resolve TikTok direct watermark-free .mp4 URL via public downloader API
async function resolveTikTokVideoUrl(videoPageUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

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
      const videoCdnUrl = res.data.play || res.data.wmplay;
      if (videoCdnUrl) {
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

// Safely open fallback tab
function openFallbackTab(url) {
  try {
    chrome.tabs.create({ url: url, active: true });
  } catch (err) {
    console.error("Failed to open backup tab:", err);
  }
}

// Handle video download and verify premium access
async function handleVideoDownload(message) {
  const { platform, filename } = message;

  return new Promise((resolve) => {
    chrome.storage.local.get(["isPremium"], async (result) => {
      const isPremium = !!result.isPremium;

      if (!isPremium) {
        resolve({
          success: false,
          limitReached: true,
          error: "License activation required. Please open the extension popup to activate your premium license key."
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
              directCdnUrl = await resolveTikTokVideoUrl(videoPageUrl);
            } catch (err) {
              console.warn("API bridge failed, fallback to new tab:", err);
              openFallbackTab(videoPageUrl);
              usedTabFallback = true;
            }
          } else {
            directCdnUrl = message.videoUrl;
          }
        } else {
          directCdnUrl = message.videoUrl;
        }

        if (usedTabFallback) {
          resolve({ success: true, isPremium: true });
          return;
        }

        if (!directCdnUrl || directCdnUrl.startsWith("blob:")) {
          throw new Error("No absolute download link could be resolved.");
        }

        const localDataUrl = await fetchStreamAsDataUrl(directCdnUrl);

        chrome.downloads.download({
          url: localDataUrl,
          filename: filename || "cloned_ad_video.mp4",
          saveAs: false
        }, () => {
          resolve({ success: true, isPremium: true });
        });

      } catch (err) {
        console.error("Download handling error:", err);
        const fallbackUrl = message.videoPageUrl || message.videoUrl || "https://www.tiktok.com";
        openFallbackTab(fallbackUrl);
        resolve({ success: true, isPremium: true });
      }
    });
  });
}
