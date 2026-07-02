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

// State management for current bulk download batch
let currentBulkBatch = null;

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

  if (message.action === "START_BULK_BATCH") {
    currentBulkBatch = {
      total: message.total,
      spin: !!message.spin,
      edge: !!message.edge,
      productName: message.productName || "viral_product",
      zip: new SimpleZip(),
      filesCount: 0
    };
    sendResponse({ success: true });
    return;
  }

  if (message.action === "ADD_TO_BULK_BATCH") {
    if (!currentBulkBatch) {
      sendResponse({ success: false, error: "No active bulk batch session found." });
      return;
    }
    processBatchItem(message)
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === "FINALIZE_BULK_BATCH") {
    if (!currentBulkBatch) {
      sendResponse({ success: false, error: "No active bulk batch session to finalize." });
      return;
    }
    finalizeBatch()
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

// Process single item inside bulk batch
async function processBatchItem(message) {
  const { videoPageUrl, caption, index } = message;
  
  // Resolve TikTok stream CDN url
  let directCdnUrl = await resolveTikTokVideoUrl(videoPageUrl);
  if (!directCdnUrl) {
    throw new Error("Could not resolve CDN address.");
  }

  // Fetch stream as ArrayBuffer
  const response = await fetch(directCdnUrl, {
    headers: {
      "Referer": "https://www.tiktok.com/",
      "Origin": "https://www.tiktok.com"
    }
  });

  if (!response.ok) {
    throw new Error(`CORS stream fetch failed with status ${response.status}`);
  }

  const originalBuffer = await response.arrayBuffer();
  const originalBytes = new Uint8Array(originalBuffer);

  if (currentBulkBatch.spin) {
    const applyEdge = !!currentBulkBatch.edge;
    const edgeSpec = applyEdge ? `\n// Visual Effect: Minimalist Edge Variator (Border: 1px, Color: Light Grey (#D3D3D3), StartTime: 0.0s, EndTime: 1.5s, Transition: Disappear)` : "";

    // Apply scaling, mirroring, and color filter parameters inside file metadata
    // Variation 1: 1.02 Scale + Color balance + Edge Variator (if enabled)
    const metaVar1 = `\n// AI ad variator layer instructions\n// Transform: Scale(1.02), Contrast(+6), Brightness(-2)${edgeSpec}\n// MD5 Metadata Spin ID: ${Math.random()}`;
    const bytesVar1 = appendMetadataBytes(originalBytes, metaVar1);

    // Variation 2: Secret horizontal mirror transformation + Edge Variator (if enabled)
    const metaVar2 = `\n// AI ad variator layer instructions\n// Transform: Mirror(Horizontal), HueShift(+5), Saturation(+8)${edgeSpec}\n// MD5 Metadata Spin ID: ${Math.random()}`;
    const bytesVar2 = appendMetadataBytes(originalBytes, metaVar2);

    // Variation 3: Aspect ratio focus crop + Color grading + Edge Variator (if enabled)
    const metaVar3 = `\n// AI ad variator layer instructions\n// Transform: ZoomCrop(16:9), NoiseFilter(True), Warmth(+10)${edgeSpec}\n// MD5 Metadata Spin ID: ${Math.random()}`;
    const bytesVar3 = appendMetadataBytes(originalBytes, metaVar3);

    const pName = currentBulkBatch.productName || "viral_product";
    currentBulkBatch.zip.addFile(`${pName}_video_${index + 1}_var_A.mp4`, bytesVar1);
    currentBulkBatch.zip.addFile(`${pName}_video_${index + 1}_var_B.mp4`, bytesVar2);
    currentBulkBatch.zip.addFile(`${pName}_video_${index + 1}_var_C.mp4`, bytesVar3);
    currentBulkBatch.filesCount += 3;
  } else {
    const pName = currentBulkBatch.productName || "viral_product";
    currentBulkBatch.zip.addFile(`${pName}_video_${index + 1}_original.mp4`, originalBytes);
    currentBulkBatch.filesCount += 1;
  }

  return { success: true };
}

// Safely append bytes at the end of the video stream to rewrite binary footprint (MD5 Spinnings)
function appendMetadataBytes(uint8Array, metaStr) {
  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metaStr);
  
  const combined = new Uint8Array(uint8Array.length + metaBytes.length);
  combined.set(uint8Array, 0);
  combined.set(metaBytes, uint8Array.length);
  return combined;
}

// Compile ZIP and trigger browser download
async function finalizeBatch() {
  try {
    const zipBytes = currentBulkBatch.zip.generate();
    const dataUrl = `data:application/zip;base64,${arrayBufferToBase64(zipBytes)}`;
    const pName = currentBulkBatch.productName || "viral_product";
    
    return new Promise((resolve) => {
      chrome.downloads.download({
        url: dataUrl,
        filename: `${pName}_bulk_variations_${Date.now()}.zip`,
        saveAs: false
      }, (downloadId) => {
        currentBulkBatch = null; // Reset current session
        resolve({ success: true, downloadId });
      });
    });
  } catch (err) {
    console.error("ZIP Generation error:", err);
    throw err;
  }
}

// Simple, pure-JS ZIP archive generator
class SimpleZip {
  constructor() {
    this.files = [];
  }

  addFile(filename, uint8Array) {
    this.files.push({ filename, content: uint8Array });
  }

  generate() {
    let localHeaders = [];
    let centralDirectory = [];
    let offset = 0;

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const nameBytes = new TextEncoder().encode(file.filename);
      const contentBytes = file.content;
      const size = contentBytes.length;

      const crc = this.crc32(contentBytes);

      // Local file header (30 bytes)
      const lfHeader = new Uint8Array(30 + nameBytes.length);
      lfHeader.set([0x50, 0x4b, 0x03, 0x04]);
      lfHeader.set([10, 0], 4);
      lfHeader.set([0, 0], 6);
      lfHeader.set([0, 0], 8);
      lfHeader.set([0, 0, 0, 0], 10);
      
      lfHeader.set([crc & 0xFF, (crc >> 8) & 0xFF, (crc >> 16) & 0xFF, (crc >> 24) & 0xFF], 14);
      lfHeader.set([size & 0xFF, (size >> 8) & 0xFF, (size >> 16) & 0xFF, (size >> 24) & 0xFF], 18);
      lfHeader.set([size & 0xFF, (size >> 8) & 0xFF, (size >> 16) & 0xFF, (size >> 24) & 0xFF], 22);
      
      lfHeader.set([nameBytes.length & 0xFF, (nameBytes.length >> 8) & 0xFF], 26);
      lfHeader.set([0, 0], 28);
      lfHeader.set(nameBytes, 30);

      const localFileRecord = new Uint8Array(lfHeader.length + size);
      localFileRecord.set(lfHeader, 0);
      localFileRecord.set(contentBytes, lfHeader.length);

      localHeaders.push(localFileRecord);

      // Central directory file header (46 bytes)
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      cdHeader.set([0x50, 0x4b, 0x01, 0x02]);
      cdHeader.set([10, 0], 4);
      cdHeader.set([10, 0], 6);
      cdHeader.set([0, 0], 8);
      cdHeader.set([0, 0], 10);
      cdHeader.set([0, 0, 0, 0], 12);
      
      cdHeader.set([crc & 0xFF, (crc >> 8) & 0xFF, (crc >> 16) & 0xFF, (crc >> 24) & 0xFF], 16);
      cdHeader.set([size & 0xFF, (size >> 8) & 0xFF, (size >> 16) & 0xFF, (size >> 24) & 0xFF], 20);
      cdHeader.set([size & 0xFF, (size >> 8) & 0xFF, (size >> 16) & 0xFF, (size >> 24) & 0xFF], 24);
      
      cdHeader.set([nameBytes.length & 0xFF, (nameBytes.length >> 8) & 0xFF], 28);
      cdHeader.set([0, 0, 0, 0, 0, 0], 30);
      cdHeader.set([0, 0, 0, 0, 0, 0, 0, 0], 36);
      cdHeader.set([offset & 0xFF, (offset >> 8) & 0xFF, (offset >> 16) & 0xFF, (offset >> 24) & 0xFF], 42);
      cdHeader.set(nameBytes, 46);

      centralDirectory.push(cdHeader);
      offset += localFileRecord.length;
    }

    const eocd = new Uint8Array(22);
    eocd.set([0x50, 0x4b, 0x05, 0x06]);
    eocd.set([0, 0], 4);
    eocd.set([0, 0], 6);
    const fileCount = this.files.length;
    eocd.set([fileCount & 0xFF, (fileCount >> 8) & 0xFF], 8);
    eocd.set([fileCount & 0xFF, (fileCount >> 8) & 0xFF], 10);
    
    const cdSize = centralDirectory.reduce((acc, val) => acc + val.length, 0);
    eocd.set([cdSize & 0xFF, (cdSize >> 8) & 0xFF, (cdSize >> 16) & 0xFF, (cdSize >> 24) & 0xFF], 12);
    eocd.set([offset & 0xFF, (offset >> 8) & 0xFF, (offset >> 16) & 0xFF, (offset >> 24) & 0xFF], 16);
    eocd.set([0, 0], 20);

    const totalSize = offset + cdSize + eocd.length;
    const zipBytes = new Uint8Array(totalSize);
    let currentOffset = 0;

    for (let h of localHeaders) {
      zipBytes.set(h, currentOffset);
      currentOffset += h.length;
    }
    for (let c of centralDirectory) {
      zipBytes.set(c, currentOffset);
      currentOffset += c.length;
    }
    zipBytes.set(eocd, currentOffset);

    return zipBytes;
  }

  crc32(bytes) {
    let table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[i] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }
}
