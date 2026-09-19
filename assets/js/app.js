/**
 * Twibbon Video Generator Engine - PKKMB SADAJIWA IDE LPKIA 2026
 * v8.0 - Multi-Photo (1-3 Videos) + High-Concurrency Server Engine
 * 
 * Fitur Unggulan:
 * - Dukungan 1 s/d 3 Foto Mahasiswa Baru sekaligus.
 * - Render 1 s/d 3 Video MP4 High Definition (1080x1350 @ 30fps).
 * - Server Queue Locking (Anti-Server Down di shared hosting cPanel).
 * - Fallback cerdas ke browser jika koneksi terganggu.
 */

// Global App State
const state = {
  photos: [
    { id: 1, rawSrc: null, fileName: '', croppedCanvas: null },
    { id: 2, rawSrc: null, fileName: '', croppedCanvas: null },
    { id: 3, rawSrc: null, fileName: '', croppedCanvas: null }
  ],
  activeCropIndex: 0,
  activePreviewIndex: 0,
  cropper: null,
  frameImg: new Image(),
  processedFrameCanvas: null,
  introVideo: document.createElement('video'),
  hasCustomVideo: true,
  isVideoLoaded: false,
  isFrameLoaded: false,
  isRendering: false,
  previewCanvas: null,
  previewCtx: null,
  renderCanvas: null,
  renderCtx: null,
  animFrameId: null,
  totalVideoDuration: 10,
  holdPhotoDuration: 5,
  aspectRatio: 1080 / 1350,
  canvasSize: { width: 1080, height: 1350 }
};

// DOM Elements
const el = {
  fileInput: document.getElementById('file-input'),
  slotInputs: [
    document.getElementById('slot-input-1'),
    document.getElementById('slot-input-2'),
    document.getElementById('slot-input-3')
  ],
  btnProceedCrop: document.getElementById('btn-proceed-crop'),
  photoCountBadge: document.getElementById('photo-count-badge'),
  uploadDropzone: document.getElementById('upload-dropzone'),

  cropperSection: document.getElementById('cropper-section'),
  cropperImage: document.getElementById('cropper-image'),
  cropperFrameOverlay: document.getElementById('cropper-frame-overlay'),
  toggleFrameGuide: document.getElementById('toggle-frame-guide'),
  cropTabs: [
    document.getElementById('crop-tab-1'),
    document.getElementById('crop-tab-2'),
    document.getElementById('crop-tab-3')
  ],
  cropIndicatorText: document.getElementById('crop-indicator-text'),
  zoomSlider: document.getElementById('zoom-slider'),
  zoomLevelText: document.getElementById('zoom-level-text'),
  btnCropConfirm: document.getElementById('btn-crop-confirm'),
  btnReupload: document.getElementById('btn-reupload'),
  btnRotateLeft: document.getElementById('btn-rotate-left'),
  btnRotateRight: document.getElementById('btn-rotate-right'),
  btnResetCrop: document.getElementById('btn-reset-crop'),

  previewSection: document.getElementById('preview-section'),
  previewTabs: [
    document.getElementById('prev-tab-1'),
    document.getElementById('prev-tab-2'),
    document.getElementById('prev-tab-3')
  ],
  previewCanvas: document.getElementById('preview-canvas'),
  previewTimeDisplay: document.getElementById('preview-time-display'),
  previewProgressBar: document.getElementById('preview-progress-bar'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  btnReplay: document.getElementById('btn-replay'),
  btnRecrop: document.getElementById('btn-recrop'),

  btnDownloadAllVideos: document.getElementById('btn-download-all-videos'),
  btnDownloadAllText: document.getElementById('btn-download-all-text'),
  btnDlVideo1: document.getElementById('btn-dl-video-1'),
  btnDlVideo2: document.getElementById('btn-dl-video-2'),
  btnDlVideo3: document.getElementById('btn-dl-video-3'),
  btnDownloadPhoto: document.getElementById('btn-download-photo'),

  processingModal: document.getElementById('processing-modal'),
  processingTitleText: document.getElementById('processing-title-text'),
  processingProgressFill: document.getElementById('processing-progress-fill'),
  processingStatusText: document.getElementById('processing-status-text'),
  processingPercentText: document.getElementById('processing-percent-text')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
  initCanvases();
  loadDefaultAssets();
  bindEvents();
});

function initCanvases() {
  state.previewCanvas = el.previewCanvas;
  state.previewCtx = state.previewCanvas.getContext('2d');
  state.previewCanvas.width = state.canvasSize.width;
  state.previewCanvas.height = state.canvasSize.height;

  state.renderCanvas = document.createElement('canvas');
  state.renderCtx = state.renderCanvas.getContext('2d');
  state.renderCanvas.width = state.canvasSize.width;
  state.renderCanvas.height = state.canvasSize.height;
}

function loadDefaultAssets() {
  state.frameImg.crossOrigin = 'anonymous';
  var frameCandidates = [
    'assets/images/twibon.svg',
    'assets/twibon.svg',
    'twibon.svg',
    'assets/images/frame.png',
    'assets/frame.png'
  ];
  loadFirstAvailableImage(frameCandidates, 0);

  state.introVideo.crossOrigin = 'anonymous';
  state.introVideo.playsInline = true;
  state.introVideo.muted = true;
  state.introVideo.preload = 'auto';
  var videoCandidates = [
    'assets/videos/Framenaur.mp4',
    'assets/Framenaur.mp4',
    'Framenaur.mp4'
  ];
  loadFirstAvailableVideo(videoCandidates, 0);
}

function loadFirstAvailableImage(candidates, index) {
  if (index >= candidates.length) {
    console.warn('File frame twibbon tidak ditemukan.');
    return;
  }
  var testImg = new Image();
  testImg.crossOrigin = 'anonymous';
  testImg.src = candidates[index];
  testImg.onload = function() {
    state.frameImg.src = candidates[index];
    state.isFrameLoaded = true;
    state.aspectRatio = 1080 / 1350;
    state.canvasSize = { width: 1080, height: 1350 };
    if (state.previewCanvas) {
      state.previewCanvas.width = 1080;
      state.previewCanvas.height = 1350;
    }
    if (state.renderCanvas) {
      state.renderCanvas.width = 1080;
      state.renderCanvas.height = 1350;
    }
    state.processedFrameCanvas = applyChromaKey(testImg);
    var transparentFrameDataUrl = state.processedFrameCanvas.toDataURL();
    if (el.cropperFrameOverlay) {
      el.cropperFrameOverlay.src = transparentFrameDataUrl;
    }
    console.log('Frame twibbon aktif: ' + candidates[index]);
  };
  testImg.onerror = function() {
    loadFirstAvailableImage(candidates, index + 1);
  };
}

function applyChromaKey(sourceImage) {
  var c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  var ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceImage, 0, 0, c.width, c.height);

  var imgData = ctx.getImageData(0, 0, c.width, c.height);
  var data = imgData.data;
  var len = data.length;

  for (var i = 0; i < len; i += 4) {
    var r = data[i];
    var g = data[i + 1];
    var b = data[i + 2];

    if (g > 140 && g > r * 1.35 && g > b * 1.35) {
      data[i + 3] = 0;
    } else if (g > 100 && g > r * 1.15 && g > b * 1.15) {
      var diff = g - Math.max(r, b);
      var factor = Math.max(0, 1 - (diff / 60));
      data[i + 3] = Math.round(data[i + 3] * factor);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
}

function loadFirstAvailableVideo(candidates, index) {
  if (index >= candidates.length) {
    console.warn('Video intro tidak ditemukan.');
    return;
  }
  state.introVideo.src = candidates[index];
  state.introVideo.onloadedmetadata = function() {
    state.isVideoLoaded = true;
    state.totalVideoDuration = state.introVideo.duration || 10;
    console.log('Video intro aktif: ' + candidates[index] + ' (' + state.totalVideoDuration.toFixed(1) + 's)');
  };
  state.introVideo.onerror = function() {
    loadFirstAvailableVideo(candidates, index + 1);
  };
}

// Event Bindings
function bindEvents() {
  // Individual Slot File Inputs
  el.slotInputs.forEach(function(input, idx) {
    if (input) {
      input.addEventListener('change', function(e) {
        if (e.target.files && e.target.files[0]) {
          handleFileForSlot(idx, e.target.files[0]);
        }
      });
    }
  });

  // Multi-File Input (Pilih Sekaligus)
  if (el.fileInput) {
    el.fileInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files.length > 0) {
        var files = Array.from(e.target.files).slice(0, 3);
        files.forEach(function(file, i) {
          handleFileForSlot(i, file);
        });
      }
    });
  }

  // Change / Remove Buttons for slots
  [1, 2, 3].forEach(function(num) {
    var btnChange = document.getElementById('btn-change-slot-' + num);
    var btnRemove = document.getElementById('btn-remove-slot-' + num);
    if (btnChange) {
      btnChange.addEventListener('click', function(e) {
        e.stopPropagation();
        el.slotInputs[num - 1].click();
      });
    }
    if (btnRemove) {
      btnRemove.addEventListener('click', function(e) {
        e.stopPropagation();
        removeSlot(num - 1);
      });
    }
  });

  // Proceed to Cropper
  if (el.btnProceedCrop) {
    el.btnProceedCrop.addEventListener('click', function() {
      if (!state.photos[0].rawSrc) return;
      openCropper(0);
    });
  }

  // Cropper Tabs
  el.cropTabs.forEach(function(tab, idx) {
    if (tab) {
      tab.addEventListener('click', function() {
        if (state.photos[idx].rawSrc) {
          saveCurrentCropperState();
          openCropper(idx);
        }
      });
    }
  });

  // Zoom & Rotate Controls
  if (el.zoomSlider) {
    el.zoomSlider.addEventListener('input', function(e) {
      if (state.cropper) {
        state.cropper.zoomTo(parseFloat(e.target.value));
        if (el.zoomLevelText) el.zoomLevelText.textContent = Math.round(e.target.value * 100) + '%';
      }
    });
  }
  if (el.btnRotateLeft) {
    el.btnRotateLeft.addEventListener('click', function() {
      if (state.cropper) state.cropper.rotate(-90);
    });
  }
  if (el.btnRotateRight) {
    el.btnRotateRight.addEventListener('click', function() {
      if (state.cropper) state.cropper.rotate(90);
    });
  }
  if (el.btnResetCrop) {
    el.btnResetCrop.addEventListener('click', function() {
      if (state.cropper) {
        state.cropper.reset();
        if (el.zoomSlider) el.zoomSlider.value = 1;
        if (el.zoomLevelText) el.zoomLevelText.textContent = '100%';
      }
    });
  }
  if (el.toggleFrameGuide) {
    el.toggleFrameGuide.addEventListener('change', function(e) {
      el.cropperFrameOverlay.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  // Cropper Action Buttons
  el.btnCropConfirm.addEventListener('click', confirmCropAndProceed);
  el.btnReupload.addEventListener('click', backToUpload);
  el.btnRecrop.addEventListener('click', backToCropper);

  // Preview Tabs
  el.previewTabs.forEach(function(tab, idx) {
    if (tab) {
      tab.addEventListener('click', function() {
        if (state.photos[idx].croppedCanvas) {
          switchPreviewTab(idx);
        }
      });
    }
  });

  // Preview Player Controls
  el.btnPlayPause.addEventListener('click', togglePreviewPlayback);
  el.btnReplay.addEventListener('click', restartPreviewPlayback);

  // Download Action Buttons
  if (el.btnDownloadAllVideos) {
    el.btnDownloadAllVideos.addEventListener('click', function() {
      startBatchVideoExport(null); // Render semua video
    });
  }
  if (el.btnDlVideo1) {
    el.btnDlVideo1.addEventListener('click', function() {
      startBatchVideoExport(0); // Hanya Foto 1
    });
  }
  if (el.btnDlVideo2) {
    el.btnDlVideo2.addEventListener('click', function() {
      startBatchVideoExport(1); // Hanya Foto 2
    });
  }
  if (el.btnDlVideo3) {
    el.btnDlVideo3.addEventListener('click', function() {
      startBatchVideoExport(2); // Hanya Foto 3
    });
  }
  if (el.btnDownloadPhoto) {
    el.btnDownloadPhoto.addEventListener('click', exportStaticPhoto);
  }
}

// Wizard Step Navigation
function setStep(step) {
  var p1 = document.getElementById('step-1-pill');
  var p2 = document.getElementById('step-2-pill');
  var p3 = document.getElementById('step-3-pill');
  if (p1 && p2 && p3) {
    p1.className = step === 1 ? 'step-item active' : 'step-item completed';
    p2.className = step === 2 ? 'step-item active' : (step > 2 ? 'step-item completed' : 'step-item');
    p3.className = step === 3 ? 'step-item active' : 'step-item';
  }
}

// Handle Photo Files for Slots
function handleFileForSlot(slotIndex, file) {
  if (!file.type.startsWith('image/')) {
    Swal.fire({ icon: 'error', title: 'Format Salah', text: 'Harap pilih file gambar (JPG, PNG, WEBP).', confirmButtonColor: '#162b3d' });
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    state.photos[slotIndex].rawSrc = e.target.result;
    state.photos[slotIndex].fileName = file.name;
    state.photos[slotIndex].croppedCanvas = null; // reset crop
    updateSlotUI();
  };
  reader.readAsDataURL(file);
}

function removeSlot(slotIndex) {
  state.photos[slotIndex].rawSrc = null;
  state.photos[slotIndex].fileName = '';
  state.photos[slotIndex].croppedCanvas = null;
  el.slotInputs[slotIndex].value = '';
  updateSlotUI();
}

function updateSlotUI() {
  var activeCount = 0;
  state.photos.forEach(function(photo, i) {
    var num = i + 1;
    var emptyDiv = document.getElementById('slot-empty-' + num);
    var filledDiv = document.getElementById('slot-filled-' + num);
    var thumbImg = document.getElementById('slot-thumb-' + num);
    var nameSpan = document.getElementById('slot-name-' + num);

    if (photo.rawSrc) {
      activeCount++;
      if (emptyDiv) emptyDiv.classList.add('hidden');
      if (filledDiv) filledDiv.classList.remove('hidden');
      if (thumbImg) thumbImg.src = photo.rawSrc;
      if (nameSpan) nameSpan.textContent = photo.fileName || ('Foto ' + num);
    } else {
      if (emptyDiv) emptyDiv.classList.remove('hidden');
      if (filledDiv) filledDiv.classList.add('hidden');
      if (thumbImg) thumbImg.src = '';
    }
  });

  if (el.photoCountBadge) {
    el.photoCountBadge.textContent = activeCount;
  }
  if (el.btnProceedCrop) {
    // Foto 1 wajib diisi untuk lanjut
    el.btnProceedCrop.disabled = !state.photos[0].rawSrc;
  }
}

// Cropper Operations
function openCropper(photoIndex) {
  state.activeCropIndex = photoIndex;
  setStep(2);

  el.uploadDropzone.classList.add('hidden');
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');

  // Update tabs visibility & active state
  var totalActive = 0;
  state.photos.forEach(function(photo, i) {
    var tab = el.cropTabs[i];
    if (tab) {
      if (photo.rawSrc) {
        totalActive++;
        tab.classList.remove('hidden');
        if (i === photoIndex) {
          tab.className = 'px-3 py-1.5 text-xs font-bold rounded flex items-center bg-[#162b3d] text-white shadow-sm';
        } else {
          tab.className = 'px-3 py-1.5 text-xs font-bold rounded flex items-center bg-slate-100 text-slate-700 hover:bg-slate-200';
        }
      } else {
        tab.classList.add('hidden');
      }
    }
  });

  if (el.cropIndicatorText) {
    el.cropIndicatorText.textContent = 'Mengatur Foto ' + (photoIndex + 1) + ' dari ' + totalActive;
  }

  // Load target photo to cropper
  var targetPhoto = state.photos[photoIndex];
  el.cropperImage.src = targetPhoto.rawSrc;

  if (state.cropper) {
    state.cropper.destroy();
  }

  state.cropper = new Cropper(el.cropperImage, {
    aspectRatio: 1080 / 1350,
    viewMode: 0,
    dragMode: 'move',
    autoCropArea: 1,
    restore: false,
    guides: false,
    center: false,
    highlight: false,
    cropBoxMovable: false,
    cropBoxResizable: false,
    toggleDragModeOnDblclick: false,
    zoomOnTouch: true,
    zoomOnWheel: true,
    wheelZoomRatio: 0.05,
    ready: function() {
      if (el.zoomSlider) el.zoomSlider.value = 1;
      if (el.zoomLevelText) el.zoomLevelText.textContent = '100%';
    },
    zoom: function(e) {
      if (el.zoomSlider && e.detail && e.detail.ratio) {
        var ratio = Math.min(3, Math.max(0.2, e.detail.ratio));
        el.zoomSlider.value = ratio;
        if (el.zoomLevelText) el.zoomLevelText.textContent = Math.round(ratio * 100) + '%';
      }
    }
  });
}

function saveCurrentCropperState() {
  if (state.cropper && state.photos[state.activeCropIndex].rawSrc) {
    state.photos[state.activeCropIndex].croppedCanvas = state.cropper.getCroppedCanvas({
      width: state.canvasSize.width,
      height: state.canvasSize.height,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
  }
}

function confirmCropAndProceed() {
  saveCurrentCropperState();

  // Pastikan semua foto yang di-upload sudah memiliki croppedCanvas
  state.photos.forEach(function(photo) {
    if (photo.rawSrc && !photo.croppedCanvas) {
      // Jika belum sempat dibuka tabnya, buat canvas default
      var img = new Image();
      img.src = photo.rawSrc;
      var c = document.createElement('canvas');
      c.width = state.canvasSize.width;
      c.height = state.canvasSize.height;
      var ctx = c.getContext('2d');
      drawCoverMedia(ctx, img, c.width, c.height);
      photo.croppedCanvas = c;
    }
  });

  setStep(3);
  el.cropperSection.classList.add('hidden');
  el.previewSection.classList.remove('hidden');

  setupPreviewAndDownloadUI();
  switchPreviewTab(0);
}

function backToCropper() {
  setStep(2);
  stopPreviewPlayer();
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');
}

function backToUpload() {
  setStep(1);
  stopPreviewPlayer();
  if (state.cropper) state.cropper.destroy();
  el.cropperSection.classList.add('hidden');
  el.previewSection.classList.add('hidden');
  el.uploadDropzone.classList.remove('hidden');
}

// Preview & Download Operations
function setupPreviewAndDownloadUI() {
  var filledCount = state.photos.filter(function(p) { return p.rawSrc; }).length;

  // Setup Preview Tabs
  state.photos.forEach(function(photo, i) {
    var tab = el.previewTabs[i];
    if (tab) {
      if (photo.rawSrc) {
        tab.classList.remove('hidden');
      } else {
        tab.classList.add('hidden');
      }
    }
  });

  // Setup Download Buttons
  if (el.btnDownloadAllText) {
    el.btnDownloadAllText.textContent = filledCount > 1 
      ? ('Download Semua Video Sekaligus (' + filledCount + ' Video MP4)') 
      : 'Download Video Twibbon (MP4)';
  }

  if (el.btnDlVideo1) el.btnDlVideo1.style.display = state.photos[0].rawSrc ? 'block' : 'none';
  if (el.btnDlVideo2) el.btnDlVideo2.style.display = state.photos[1].rawSrc ? 'block' : 'none';
  if (el.btnDlVideo3) el.btnDlVideo3.style.display = state.photos[2].rawSrc ? 'block' : 'none';
}

function switchPreviewTab(index) {
  state.activePreviewIndex = index;

  el.previewTabs.forEach(function(tab, i) {
    if (tab) {
      if (i === index) {
        tab.className = 'px-3 py-1.5 text-xs font-bold rounded flex items-center bg-[#162b3d] text-white shadow-sm';
      } else {
        tab.className = 'px-3 py-1.5 text-xs font-bold rounded flex items-center bg-slate-100 text-slate-700 hover:bg-slate-200';
      }
    }
  });

  startPreviewPlayer();
}

/* ============================================================
 * PREVIEW ANIMATION ENGINE
 * ============================================================ */
var previewState = {
  isPlaying: false,
  currentTime: 0,
  introDuration: 10,
  totalDuration: 15,
  startTime: 0
};

function startPreviewPlayer() {
  stopPreviewPlayer();
  var introDuration = state.introVideo.duration && !isNaN(state.introVideo.duration) ? state.introVideo.duration : 10.0;
  previewState.introDuration = introDuration;
  previewState.totalDuration = introDuration + state.holdPhotoDuration;
  previewState.currentTime = 0;
  previewState.isPlaying = true;
  previewState.startTime = performance.now();
  state.introVideo.currentTime = 0;
  state.introVideo.play().catch(function() {});
  updatePlayButtonIcon(true);
  runPreviewLoop();
}

function runPreviewLoop() {
  if (!previewState.isPlaying) return;
  var now = performance.now();
  var elapsed = (now - previewState.startTime) / 1000;
  previewState.currentTime = elapsed;
  if (previewState.currentTime >= previewState.totalDuration) {
    previewState.currentTime = 0;
    previewState.startTime = performance.now();
    state.introVideo.currentTime = 0;
    state.introVideo.play().catch(function() {});
  }
  renderFrameToCanvas(state.previewCtx, previewState.currentTime, previewState.introDuration);
  updatePreviewUI();
  state.animFrameId = requestAnimationFrame(runPreviewLoop);
}

function togglePreviewPlayback() {
  if (previewState.isPlaying) {
    previewState.isPlaying = false;
    state.introVideo.pause();
    updatePlayButtonIcon(false);
  } else {
    previewState.isPlaying = true;
    previewState.startTime = performance.now() - (previewState.currentTime * 1000);
    state.introVideo.currentTime = Math.min(previewState.currentTime, state.introVideo.duration || 0);
    if (previewState.currentTime < previewState.introDuration) {
      state.introVideo.play().catch(function() {});
    }
    updatePlayButtonIcon(true);
    runPreviewLoop();
  }
}

function restartPreviewPlayback() { startPreviewPlayer(); }

function stopPreviewPlayer() {
  previewState.isPlaying = false;
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  state.introVideo.pause();
}

function updatePlayButtonIcon(isPlaying) {
  if (!el.btnPlayPause) return;
  el.btnPlayPause.innerHTML = isPlaying
    ? '<svg class="w-4 h-4 mr-1 text-[#162b3d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Pause'
    : '<svg class="w-4 h-4 mr-1 text-[#162b3d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Play';
}

function updatePreviewUI() {
  var current = previewState.currentTime.toFixed(1);
  var total = previewState.totalDuration.toFixed(1);
  if (el.previewTimeDisplay) el.previewTimeDisplay.textContent = current + 's / ' + total + 's';
  if (el.previewProgressBar) {
    var percent = Math.min(100, (previewState.currentTime / previewState.totalDuration) * 100);
    el.previewProgressBar.style.width = percent + '%';
  }
}

function drawCoverMedia(ctx, media, targetW, targetH) {
  var srcW = media.videoWidth || media.naturalWidth || media.width || targetW;
  var srcH = media.videoHeight || media.naturalHeight || media.height || targetH;
  var srcRatio = srcW / srcH;
  var targetRatio = targetW / targetH;
  var renderW, renderH, offsetX, offsetY;
  if (srcRatio > targetRatio) {
    renderH = targetH; renderW = targetH * srcRatio;
    offsetX = (targetW - renderW) / 2; offsetY = 0;
  } else {
    renderW = targetW; renderH = targetW / srcRatio;
    offsetX = 0; offsetY = (targetH - renderH) / 2;
  }
  ctx.drawImage(media, offsetX, offsetY, renderW, renderH);
}

function renderFrameToCanvas(ctx, time, introDuration) {
  var width = state.canvasSize.width;
  var height = state.canvasSize.height;
  var crossfadeDuration = 0.6;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#162b3d';
  ctx.fillRect(0, 0, width, height);

  var activePhoto = state.photos[state.activePreviewIndex];
  var croppedCanvas = activePhoto ? activePhoto.croppedCanvas : null;
  var fadeStartTime = Math.max(0, introDuration - crossfadeDuration);

  if (time < fadeStartTime) {
    drawCoverMedia(ctx, state.introVideo, width, height);
  } else if (time >= fadeStartTime && time < introDuration) {
    drawCoverMedia(ctx, state.introVideo, width, height);
    var progress = (time - fadeStartTime) / crossfadeDuration;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, progress));
    if (croppedCanvas) ctx.drawImage(croppedCanvas, 0, 0, width, height);
    if (state.isFrameLoaded) ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
    ctx.restore();
  } else {
    if (croppedCanvas) ctx.drawImage(croppedCanvas, 0, 0, width, height);
    if (state.isFrameLoaded) ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
  }
}

/* ============================================================
 * VIDEO EXPORT ENGINE (Multi-Video Batch or Single)
 * ============================================================ */
async function startBatchVideoExport(specificSlot) {
  if (state.isRendering) return;

  var targets = [];
  if (specificSlot !== null && specificSlot !== undefined) {
    var p = state.photos[specificSlot];
    if (p && p.croppedCanvas) targets.push(p);
  } else {
    targets = state.photos.filter(function(p) { return p.rawSrc && p.croppedCanvas; });
  }

  if (targets.length === 0) {
    Swal.fire({ icon: 'warning', title: 'Belum Ada Foto', text: 'Silakan upload dan atur posisi foto terlebih dahulu.', confirmButtonColor: '#162b3d' });
    return;
  }

  state.isRendering = true;
  stopPreviewPlayer();
  el.processingModal.classList.remove('hidden');

  var total = targets.length;
  var successCount = 0;

  for (var i = 0; i < total; i++) {
    var photo = targets[i];
    var currentNum = i + 1;

    if (el.processingTitleText) {
      el.processingTitleText.textContent = total > 1 
        ? ('Membuat Video ' + currentNum + ' dari ' + total + ' (Foto ' + photo.id + ')...')
        : 'Sedang Membuat Video Twibbon...';
    }

    try {
      await renderSinglePhotoVideo(photo, currentNum, total);
      successCount++;
      // Jeda 500ms antar video agar browser & server bernapas
      if (i < total - 1) {
        await new Promise(function(r) { setTimeout(r, 500); });
      }
    } catch (err) {
      console.error('Gagal render video foto ' + photo.id + ':', err);
    }
  }

  el.processingModal.classList.add('hidden');
  state.isRendering = false;
  startPreviewPlayer();

  if (successCount === total) {
    Swal.fire({
      icon: 'success',
      title: 'Semua Video Berhasil Diunduh! 🎉',
      html: 'Total <b>' + successCount + ' video MP4</b> telah berhasil dirender dengan kualitas HD 30fps.',
      confirmButtonColor: '#162b3d'
    });
  } else if (successCount > 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Sebagian Video Selesai',
      html: '<b>' + successCount + ' dari ' + total + ' video</b> berhasil diunduh.',
      confirmButtonColor: '#162b3d'
    });
  } else {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Membuat Video',
      text: 'Terjadi kendala saat memproses video ke server. Silakan coba kembali.',
      confirmButtonColor: '#162b3d'
    });
  }
}

function renderSinglePhotoVideo(photo, currentIdx, totalCount) {
  return new Promise(function(resolve, reject) {
    updateExportProgress(5, 'Menyiapkan gambar twibbon (Foto ' + photo.id + ')...');

    // Buat canvas komposit 1080x1350
    var exportCanvas = document.createElement('canvas');
    exportCanvas.width = state.canvasSize.width;
    exportCanvas.height = state.canvasSize.height;
    var ctx = exportCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(photo.croppedCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    if (state.isFrameLoaded) {
      ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, exportCanvas.width, exportCanvas.height);
    }

    // Export sebagai JPEG kualitas 0.95 (~500KB)
    exportCanvas.toBlob(async function(blob) {
      if (!blob) {
        return reject(new Error('Gagal membuat blob gambar'));
      }

      updateExportProgress(15, 'Mengirim ke antrean server (Foto ' + photo.id + ')...');

      var formData = new FormData();
      formData.append('image', blob, 'twibbon_composite_' + photo.id + '.jpg');
      formData.append('holdDuration', state.holdPhotoDuration || 5);

      var curPercent = 15;
      var timer = setInterval(function() {
        if (curPercent < 85) {
          curPercent += Math.floor(Math.random() * 5) + 3;
          if (curPercent > 85) curPercent = 85;
          updateExportProgress(curPercent, 'Server sedang merender Video ' + currentIdx + ' dari ' + totalCount + ' (30fps HD)...');
        }
      }, 400);

      try {
        var response = await fetch('api/render.php', {
          method: 'POST',
          body: formData
        });

        clearInterval(timer);

        if (!response.ok) {
          var errData = {};
          try { errData = await response.json(); } catch(e) {}
          throw new Error(errData.message || ('Server error ' + response.status));
        }

        updateExportProgress(92, 'Mengunduh file MP4 Video ' + photo.id + '...');

        var videoBlob = await response.blob();
        var filename = 'Twibbon_PKKMB_LPKIA_Foto_' + photo.id + '_' + Date.now() + '.mp4';
        downloadBlob(videoBlob, filename);

        updateExportProgress(100, 'Selesai Video ' + photo.id + '!');
        setTimeout(resolve, 300);

      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, 'image/jpeg', 0.95);
  });
}

function updateExportProgress(percent, text) {
  if (el.processingProgressFill) el.processingProgressFill.style.width = percent + '%';
  if (el.processingPercentText) el.processingPercentText.textContent = percent + '%';
  if (el.processingStatusText) el.processingStatusText.textContent = text;
}

/* ============================================================
 * STATIC PHOTO EXPORT (PNG)
 * ============================================================ */
function exportStaticPhoto() {
  var activePhoto = state.photos[state.activePreviewIndex];
  if (!activePhoto || !activePhoto.croppedCanvas) return;

  var exportCanvas = document.createElement('canvas');
  exportCanvas.width = state.canvasSize.width;
  exportCanvas.height = state.canvasSize.height;
  var ctx = exportCanvas.getContext('2d');
  ctx.drawImage(activePhoto.croppedCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
  if (state.isFrameLoaded) {
    ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, exportCanvas.width, exportCanvas.height);
  }

  exportCanvas.toBlob(function(blob) {
    var filename = 'Twibbon_Foto_' + activePhoto.id + '_' + Date.now() + '.png';
    downloadBlob(blob, filename);
    Swal.fire({ 
      icon: 'success', 
      title: 'Foto Twibbon Diunduh', 
      text: 'File ' + filename + ' berhasil disimpan.', 
      confirmButtonColor: '#162b3d' 
    });
  }, 'image/png');
}

function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}
