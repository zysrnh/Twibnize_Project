/**
 * Twibbon Video Generator Engine - PKKMB SADAJIWA IDE LPKIA 2026
 * v7.0 - Server-Side FFmpeg Engine (Ultra Smooth 30fps HD)
 * 
 * Strategi:
 * - UTAMA: Kirim foto composite ke backend PHP (/api/render.php).
 *   FFmpeg di server merender video 1080x1350 @ 30fps dengan crossfade 0.6s.
 *   Hasil 100% mulus tanpa drop frame di semua HP (iOS & Android).
 * - FALLBACK: WebCodecs patient offline rendering / MediaRecorder jika server offline.
 */

// Global App State
const state = {
  cropper: null,
  rawImageSrc: null,
  croppedCanvas: null,
  frameImg: new Image(),
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
  uploadDropzone: document.getElementById('upload-dropzone'),
  cropperSection: document.getElementById('cropper-section'),
  cropperImage: document.getElementById('cropper-image'),
  cropperFrameOverlay: document.getElementById('cropper-frame-overlay'),
  toggleFrameGuide: document.getElementById('toggle-frame-guide'),
  zoomSlider: document.getElementById('zoom-slider'),
  zoomLevelText: document.getElementById('zoom-level-text'),
  btnCropConfirm: document.getElementById('btn-crop-confirm'),
  btnReupload: document.getElementById('btn-reupload'),
  btnRotateLeft: document.getElementById('btn-rotate-left'),
  btnRotateRight: document.getElementById('btn-rotate-right'),
  btnResetCrop: document.getElementById('btn-reset-crop'),

  previewSection: document.getElementById('preview-section'),
  previewCanvas: document.getElementById('preview-canvas'),
  previewTimeDisplay: document.getElementById('preview-time-display'),
  previewProgressBar: document.getElementById('preview-progress-bar'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  btnReplay: document.getElementById('btn-replay'),
  btnRecrop: document.getElementById('btn-recrop'),
  btnDownloadVideo: document.getElementById('btn-download-video'),
  btnDownloadPhoto: document.getElementById('btn-download-photo'),

  processingModal: document.getElementById('processing-modal'),
  processingProgressFill: document.getElementById('processing-progress-fill'),
  processingStatusText: document.getElementById('processing-status-text'),
  processingPercentText: document.getElementById('processing-percent-text'),

  customVideoInput: document.getElementById('custom-video-input'),
  customFrameInput: document.getElementById('custom-frame-input'),
  inputHoldDuration: document.getElementById('input-hold-duration'),
  videoStatusBadge: document.getElementById('video-status-badge')
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
    'Framenaur.mp4',
    'assets/videos/twibbon_ppkkmb.mp4'
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
    console.log('Menggunakan frame twibbon: ' + candidates[index] + ' (1080x1350 - 4:5)');
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
  ctx.drawImage(sourceImage, 0, 0, 1080, 1350);
  try {
    var imgData = ctx.getImageData(0, 0, 1080, 1350);
    var data = imgData.data;
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i], g = data[i + 1], b = data[i + 2];
      var maxRB = Math.max(r, b);
      if (g > 70 && g > maxRB * 1.25) {
        var diff = g - maxRB;
        if (diff > 35) {
          data[i + 3] = 0;
        } else {
          data[i + 3] = Math.round(255 * (1 - (diff / 35)));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Gagal membaca pixel untuk chroma key:', e);
  }
  return c;
}

function loadFirstAvailableVideo(candidates, index) {
  if (index >= candidates.length) {
    console.warn('Video intro tidak ditemukan pada path default.');
    return;
  }
  var vSrc = candidates[index];
  var testVid = document.createElement('video');
  testVid.crossOrigin = 'anonymous';
  testVid.playsInline = true;
  testVid.muted = true;
  testVid.src = vSrc;
  testVid.onloadedmetadata = function() {
    state.introVideo.src = vSrc;
    state.isVideoLoaded = true;
    state.hasCustomVideo = true;
    state.totalVideoDuration = testVid.duration || 10;
    updateVideoStatusBadge(true, 'Video Siap (' + vSrc + ' - ' + testVid.duration.toFixed(1) + 's)');
    console.log('Menggunakan video: ' + vSrc + ' (' + testVid.duration.toFixed(1) + 's)');
  };
  testVid.onerror = function() {
    loadFirstAvailableVideo(candidates, index + 1);
  };
}

function updateVideoStatusBadge(isCustom, text) {
  if (!el.videoStatusBadge) return;
  if (isCustom) {
    el.videoStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
    el.videoStatusBadge.innerHTML = '<span class="w-2 h-2 mr-1.5 bg-emerald-500 rounded-full"></span> ' + text;
  } else {
    el.videoStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300';
    el.videoStatusBadge.innerHTML = '<span class="w-2 h-2 mr-1.5 bg-amber-500 rounded-full"></span> ' + text;
  }
}

function bindEvents() {
  el.fileInput.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) handleUserFile(e.target.files[0]);
  });
  el.uploadDropzone.addEventListener('dragover', function(e) {
    e.preventDefault();
    el.uploadDropzone.classList.add('border-[#b69861]', 'bg-amber-50/20');
  });
  el.uploadDropzone.addEventListener('dragleave', function() {
    el.uploadDropzone.classList.remove('border-[#b69861]', 'bg-amber-50/20');
  });
  el.uploadDropzone.addEventListener('drop', function(e) {
    e.preventDefault();
    el.uploadDropzone.classList.remove('border-[#b69861]', 'bg-amber-50/20');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleUserFile(e.dataTransfer.files[0]);
  });
  if (el.zoomSlider) {
    el.zoomSlider.addEventListener('input', function(e) {
      if (state.cropper) {
        var val = parseFloat(e.target.value);
        state.cropper.zoomTo(val);
        if (el.zoomLevelText) el.zoomLevelText.textContent = Math.round(val * 100) + '%';
      }
    });
  }
  el.btnRotateLeft.addEventListener('click', function() { if (state.cropper) state.cropper.rotate(-90); });
  el.btnRotateRight.addEventListener('click', function() { if (state.cropper) state.cropper.rotate(90); });
  el.btnResetCrop.addEventListener('click', function() {
    if (state.cropper) {
      state.cropper.reset();
      if (el.zoomSlider) el.zoomSlider.value = 1;
      if (el.zoomLevelText) el.zoomLevelText.textContent = '100%';
    }
  });
  if (el.toggleFrameGuide) {
    el.toggleFrameGuide.addEventListener('change', function(e) {
      el.cropperFrameOverlay.style.display = e.target.checked ? 'block' : 'none';
    });
  }
  el.btnCropConfirm.addEventListener('click', confirmCropAndProceed);
  el.btnReupload.addEventListener('click', resetToUpload);
  el.btnRecrop.addEventListener('click', backToCropper);
  el.btnPlayPause.addEventListener('click', togglePreviewPlayback);
  el.btnReplay.addEventListener('click', restartPreviewPlayback);
  el.btnDownloadVideo.addEventListener('click', startVideoExport);
  el.btnDownloadPhoto.addEventListener('click', exportStaticPhoto);

  if (el.customVideoInput) {
    el.customVideoInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        var file = e.target.files[0];
        var url = URL.createObjectURL(file);
        state.introVideo.src = url;
        state.introVideo.load();
        state.hasCustomVideo = true;
        updateVideoStatusBadge(true, 'Video Kustom: ' + file.name);
        Swal.fire({ icon: 'success', title: 'Video Intro Diganti', text: 'Menggunakan video: ' + file.name, confirmButtonColor: '#162b3d' });
      }
    });
  }
  if (el.customFrameInput) {
    el.customFrameInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        var file = e.target.files[0];
        var url = URL.createObjectURL(file);
        state.frameImg.src = url;
        state.frameImg.onload = function() {
          state.processedFrameCanvas = applyChromaKey(state.frameImg);
          var transparentUrl = state.processedFrameCanvas.toDataURL();
          if (el.cropperFrameOverlay) el.cropperFrameOverlay.src = transparentUrl;
          Swal.fire({ icon: 'success', title: 'Frame Twibbon Diganti', text: 'Menggunakan frame: ' + file.name, confirmButtonColor: '#162b3d' });
        };
      }
    });
  }
  if (el.inputHoldDuration) {
    el.inputHoldDuration.addEventListener('input', function(e) {
      state.holdPhotoDuration = parseFloat(e.target.value) || 5;
    });
  }
}

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

function handleUserFile(file) {
  if (!file.type.startsWith('image/')) {
    Swal.fire({ icon: 'error', title: 'Format Tidak Sesuai', text: 'Harap upload file gambar (JPG, PNG, WEBP).', confirmButtonColor: '#162b3d' });
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    state.rawImageSrc = e.target.result;
    openCropper(state.rawImageSrc);
  };
  reader.readAsDataURL(file);
}

function openCropper(imageSrc) {
  setStep(2);
  el.uploadDropzone.classList.add('hidden');
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');
  el.cropperImage.src = imageSrc;
  if (state.cropper) state.cropper.destroy();
  var cropperContainer = el.cropperImage.parentElement;
  if (cropperContainer) {
    cropperContainer.style.aspectRatio = state.canvasSize.width + ' / ' + state.canvasSize.height;
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

function confirmCropAndProceed() {
  if (!state.cropper) return;
  setStep(3);
  state.croppedCanvas = state.cropper.getCroppedCanvas({
    width: state.canvasSize.width,
    height: state.canvasSize.height,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });
  if (state.previewCanvas && state.previewCanvas.parentElement) {
    state.previewCanvas.parentElement.style.aspectRatio = state.canvasSize.width + ' / ' + state.canvasSize.height;
  }
  el.cropperSection.classList.add('hidden');
  el.previewSection.classList.remove('hidden');
  startPreviewPlayer();
}

function backToCropper() {
  setStep(2);
  stopPreviewPlayer();
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');
}

function resetToUpload() {
  setStep(1);
  stopPreviewPlayer();
  if (state.cropper) state.cropper.destroy();
  el.fileInput.value = '';
  el.cropperSection.classList.add('hidden');
  el.previewSection.classList.add('hidden');
  el.uploadDropzone.classList.remove('hidden');
}

/* ============================================================
 * PREVIEW & CANVAS COMPOSITOR ENGINE
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
    ? '<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Pause'
    : '<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Play';
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

/* ============================================================
 * CANVAS COMPOSITOR: RENDER 1 FRAME (1080x1350 4:5)
 * ============================================================ */
function renderFrameToCanvas(ctx, time, introDuration) {
  var width = state.canvasSize.width;
  var height = state.canvasSize.height;
  var crossfadeDuration = 0.6;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#162b3d';
  ctx.fillRect(0, 0, width, height);

  var fadeStartTime = Math.max(0, introDuration - crossfadeDuration);

  if (time < fadeStartTime) {
    drawCoverMedia(ctx, state.introVideo, width, height);
  } else if (time >= fadeStartTime && time < introDuration) {
    drawCoverMedia(ctx, state.introVideo, width, height);
    var progress = (time - fadeStartTime) / crossfadeDuration;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, progress));
    if (state.croppedCanvas) ctx.drawImage(state.croppedCanvas, 0, 0, width, height);
    if (state.isFrameLoaded) ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
    ctx.restore();
  } else {
    if (state.croppedCanvas) ctx.drawImage(state.croppedCanvas, 0, 0, width, height);
    if (state.isFrameLoaded) ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
  }
}

/* ============================================================
 * VIDEO EXPORT ENGINE v6.0 - PATIENT OFFLINE RENDERING
 * ============================================================
 * 
 * Kenapa versi sebelumnya patah di HP:
 * v3-v4: Frame-seeking terlalu cepat (120ms timeout) → HP gak kuat decode
 * v5: Natural playback + MediaRecorder real-time → HP gak kuat render 
 *     1080x1350 + encode secara real-time
 * 
 * Solusi v6 (PATIENT):
 * - WebCodecs: Seek SABAR (500ms timeout, 50ms cooldown per frame)
 *   Output 24fps PERFECT karena timestamp di-set manual, bukan real-time
 * - Fallback: MediaRecorder 540x675 (4x lebih ringan)
 * ============================================================ */

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function patientSeek(video, targetTime) {
  return new Promise(function(resolve) {
    // Kalau udah di posisi yang benar, langsung resolve
    if (Math.abs(video.currentTime - targetTime) < 0.01 && !video.seeking && video.readyState >= 2) {
      resolve();
      return;
    }

    video.currentTime = targetTime;

    // Kalau udah ready dan gak seeking, resolve
    if (!video.seeking && video.readyState >= 2) {
      setTimeout(resolve, 20);
      return;
    }

    var resolved = false;
    function done() {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', done);
      resolve();
    }

    video.addEventListener('seeked', done, { once: true });

    // Safety timeout 500ms - SANGAT sabar
    setTimeout(done, 500);
  });
}

function startVideoExport() {
  if (state.isRendering || !state.croppedCanvas) return;
  state.isRendering = true;
  stopPreviewPlayer();

  el.processingModal.classList.remove('hidden');
  updateExportProgress(0, 'Menyiapkan mesin render...');

  // Prioritaskan Server-Side Render dengan FFmpeg
  exportServerSideFfmpeg().catch(function(err) {
    console.error('Export Error:', err);
    el.processingModal.classList.add('hidden');
    state.isRendering = false;
    startPreviewPlayer();
    Swal.fire({
      icon: 'error',
      title: 'Gagal Membuat Video',
      text: err.message || 'Terjadi kesalahan saat merender video.',
      confirmButtonColor: '#162b3d'
    });
  });
}

/* ----------------------------------------------------------
 * UTAMA: Server-Side FFmpeg Render (PHP Backend)
 * Kualitas HD 1080x1350 @ 30fps TANPA PATAH-PATAH di HP
 * ---------------------------------------------------------- */
function exportServerSideFfmpeg() {
  return new Promise(function(resolve, reject) {
    try {
      updateExportProgress(5, 'Menyiapkan gambar twibbon...');

      // Render canvas komposit 1080x1350
      var exportCanvas = document.createElement('canvas');
      exportCanvas.width = state.canvasSize.width;
      exportCanvas.height = state.canvasSize.height;
      var ctx = exportCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(state.croppedCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
      if (state.isFrameLoaded) {
        ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, exportCanvas.width, exportCanvas.height);
      }

      exportCanvas.toBlob(async function(blob) {
        if (!blob) {
          console.warn('[Server Render] Gagal membuat blob gambar, beralih ke browser render.');
          return fallbackToClientRender(resolve, reject);
        }

        updateExportProgress(15, 'Mengunggah gambar ke server...');

        var formData = new FormData();
        formData.append('image', blob, 'twibbon_composite.png');
        formData.append('holdDuration', state.holdPhotoDuration || 5);

        // Progress timer simulasi saat server merender video
        var currentPercent = 15;
        var progressTimer = setInterval(function() {
          if (currentPercent < 85) {
            currentPercent += Math.floor(Math.random() * 6) + 3;
            if (currentPercent > 85) currentPercent = 85;
            updateExportProgress(currentPercent, 'Server sedang merender video HD (30fps)...');
          }
        }, 500);

        try {
          var response = await fetch('api/render.php', {
            method: 'POST',
            body: formData
          });

          clearInterval(progressTimer);

          // Jika server mengembalikan selain 200 OK
          if (!response.ok) {
            var errDetail = 'Server HTTP error ' + response.status;
            try {
              var errJson = await response.json();
              if (errJson && errJson.message) errDetail = errJson.message;
            } catch(e) {}
            console.warn('[Server Render] Error: ' + errDetail + ' -> Fallback ke client');
            return fallbackToClientRender(resolve, reject);
          }

          // Pastikan response adalah video
          var contentType = response.headers.get('content-type') || '';
          if (contentType.indexOf('video') === -1 && contentType.indexOf('octet-stream') === -1) {
            console.warn('[Server Render] Response bukan video, fallback ke client');
            return fallbackToClientRender(resolve, reject);
          }

          updateExportProgress(92, 'Mengunduh video MP4...');

          var videoBlob = await response.blob();
          var filename = 'Twibbon_PKKMB_LPKIA_' + Date.now() + '.mp4';
          downloadBlob(videoBlob, filename);

          updateExportProgress(100, 'Selesai!');

          setTimeout(function() {
            el.processingModal.classList.add('hidden');
            state.isRendering = false;
            startPreviewPlayer();
            Swal.fire({
              icon: 'success',
              title: 'Video Berhasil Dibuat!',
              html: '<b>' + filename + '</b><br><small>1080x1350 • 30fps (Kualitas Server HD)</small>',
              confirmButtonColor: '#162b3d'
            });
            resolve();
          }, 400);

        } catch (netErr) {
          clearInterval(progressTimer);
          console.warn('[Server Render] Koneksi server gagal: ' + netErr.message + ' -> Fallback ke client');
          return fallbackToClientRender(resolve, reject);
        }
      }, 'image/png');

    } catch (e) {
      fallbackToClientRender(resolve, reject);
    }
  });
}

function fallbackToClientRender(resolve, reject) {
  updateExportProgress(25, 'Beralih ke render browser client...');
  var hasWebCodecs = (typeof VideoEncoder !== 'undefined') &&
                     (typeof VideoFrame !== 'undefined') &&
                     (typeof Mp4Muxer !== 'undefined');

  var clientPromise = hasWebCodecs ? exportPatientWebCodecs() : exportLowResMediaRecorder();
  clientPromise.then(resolve).catch(reject);
}

/* ----------------------------------------------------------
 * PATH 1: WebCodecs + Mp4Muxer — PATIENT OFFLINE RENDERING
 * Tidak real-time. Setiap frame di-seek SABAR, lalu di-encode.
 * Output PASTI smooth karena timestamp manual.
 * ---------------------------------------------------------- */
function exportPatientWebCodecs() {
  return new Promise(function(resolve, reject) {
    (async function() {
      try {
        var fps = 30;
        var width = 1080;
        var height = 1350;

        updateExportProgress(2, 'Menyiapkan encoder H.264...');

        // Setup Mp4Muxer
        var muxer = new Mp4Muxer.Muxer({
          target: new Mp4Muxer.ArrayBufferTarget(),
          video: { codec: 'avc', width: width, height: height },
          fastStart: 'in-memory'
        });

        // Setup VideoEncoder
        var encoderConfig = {
          codec: 'avc1.42001f', // Baseline Profile Level 3.1 — max kompatibilitas
          width: width,
          height: height,
          bitrate: 5000000, // 5 Mbps — cukup tajam
          framerate: fps
        };

        // Cek apakah config didukung
        try {
          var supported = await VideoEncoder.isConfigSupported(encoderConfig);
          if (!supported.supported) {
            encoderConfig.codec = 'avc1.420028';
            var supported2 = await VideoEncoder.isConfigSupported(encoderConfig);
            if (!supported2.supported) {
              console.warn('[Export] H.264 not supported, falling back to MediaRecorder');
              await exportLowResMediaRecorder();
              resolve();
              return;
            }
          }
        } catch (e) {
          console.warn('[Export] isConfigSupported error, trying anyway');
        }

        var encoder = new VideoEncoder({
          output: function(chunk, meta) { muxer.addVideoChunk(chunk, meta); },
          error: function(e) { console.error('VideoEncoder error:', e); }
        });

        encoder.configure(encoderConfig);

        // Buat video element BARU khusus export
        var video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.playsInline = true;
        video.muted = true;
        video.preload = 'auto';
        video.src = state.introVideo.src;

        updateExportProgress(5, 'Memuat video...');

        // Tunggu video siap
        await new Promise(function(res, rej) {
          video.oncanplaythrough = res;
          video.onerror = function() { rej(new Error('Gagal memuat video')); };
          video.load();
        });

        var introDuration = video.duration || 10;
        var holdDuration = state.holdPhotoDuration;
        var introFrames = Math.ceil(introDuration * fps);
        var holdFrames = Math.ceil(holdDuration * fps);
        var totalFrames = introFrames + holdFrames;

        console.log('[Export] Intro: ' + introDuration.toFixed(1) + 's (' + introFrames + ' frames), Hold: ' + holdDuration + 's (' + holdFrames + ' frames), Total: ' + totalFrames + ' frames');

        // Buat canvas khusus render export
        var exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;
        var exportCtx = exportCanvas.getContext('2d');

        // ===== PHASE 1: Render intro video (PATIENT frame-by-frame) =====
        updateExportProgress(8, 'Merender video intro...');

        for (var i = 0; i < introFrames; i++) {
          var currentTime = i / fps;

          // Seek SABAR — tunggu sampai 500ms
          var seekTarget = Math.min(currentTime, Math.max(0, video.duration - 0.02));
          await patientSeek(video, seekTarget);

          // Gambar frame ke canvas
          renderFrameForExport(exportCtx, video, currentTime, introDuration, width, height);

          // Encode frame — timestamp manual = SELALU smooth
          var timestampUs = Math.round(i * (1000000 / fps));
          var isKeyFrame = (i % (fps * 2) === 0); // Keyframe setiap 2 detik

          var vFrame = new VideoFrame(exportCanvas, { timestamp: timestampUs });
          encoder.encode(vFrame, { keyFrame: isKeyFrame });
          vFrame.close();

          // Tunggu encoder kalau queue penuh
          while (encoder.encodeQueueSize > 10) {
            await sleep(20);
          }

          // Progress update
          var pct = Math.round((i / totalFrames) * 85) + 8;
          updateExportProgress(pct, 'Frame ' + (i + 1) + '/' + totalFrames + ' (' + currentTime.toFixed(1) + 's)');

          // CRITICAL: Cooldown 30ms agar hardware decoder punya waktu istirahat
          await sleep(30);
        }

        // ===== PHASE 2: Render foto twibbon hold (TANPA seeking) =====
        updateExportProgress(93, 'Merender foto twibbon...');

        for (var j = 0; j < holdFrames; j++) {
          var frameIdx = introFrames + j;
          var holdTime = introDuration + (j / fps);

          // Gambar foto + frame (statis, sangat cepat)
          exportCtx.fillStyle = '#162b3d';
          exportCtx.fillRect(0, 0, width, height);
          if (state.croppedCanvas) exportCtx.drawImage(state.croppedCanvas, 0, 0, width, height);
          if (state.isFrameLoaded) exportCtx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);

          var tsUs = Math.round(frameIdx * (1000000 / fps));
          var vf = new VideoFrame(exportCanvas, { timestamp: tsUs });
          encoder.encode(vf, { keyFrame: j === 0 });
          vf.close();

          while (encoder.encodeQueueSize > 10) {
            await sleep(20);
          }

          if (j % 10 === 0) {
            var p2 = 93 + Math.round((j / holdFrames) * 5);
            updateExportProgress(p2, 'Foto: ' + (j + 1) + '/' + holdFrames);
            await sleep(5);
          }
        }

        // ===== PHASE 3: Finalisasi MP4 =====
        updateExportProgress(98, 'Menyelesaikan file MP4...');

        await encoder.flush();
        muxer.finalize();

        // Cleanup
        video.src = '';
        video.load();

        // Download
        var buffer = muxer.target.buffer;
        var blob = new Blob([buffer], { type: 'video/mp4' });
        var filename = 'Twibbon_PKKMB_LPKIA_' + Date.now() + '.mp4';

        updateExportProgress(100, 'Selesai! Mengunduh...');
        downloadBlob(blob, filename);

        setTimeout(function() {
          el.processingModal.classList.add('hidden');
          state.isRendering = false;
          startPreviewPlayer();
          Swal.fire({
            icon: 'success',
            title: 'Video Berhasil Dibuat!',
            html: '<b>' + filename + '</b><br><small>MP4 H.264 • 1080x1350 • ' + fps + 'fps • Patient Render</small>',
            confirmButtonColor: '#162b3d'
          });
        }, 500);

        resolve();
      } catch (err) {
        reject(err);
      }
    })();
  });
}

/* Helper: Render 1 frame untuk export (pakai video element terpisah) */
function renderFrameForExport(ctx, video, time, introDuration, width, height) {
  var crossfadeDuration = 0.6;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#162b3d';
  ctx.fillRect(0, 0, width, height);

  var fadeStartTime = Math.max(0, introDuration - crossfadeDuration);

  if (time < fadeStartTime) {
    drawCoverMedia(ctx, video, width, height);
  } else if (time >= fadeStartTime && time < introDuration) {
    drawCoverMedia(ctx, video, width, height);
    var progress = (time - fadeStartTime) / crossfadeDuration;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, progress));
    if (state.croppedCanvas) ctx.drawImage(state.croppedCanvas, 0, 0, width, height);
    if (state.isFrameLoaded) ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
    ctx.restore();
  } else {
    if (state.croppedCanvas) ctx.drawImage(state.croppedCanvas, 0, 0, width, height);
    if (state.isFrameLoaded) ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
  }
}

/* ----------------------------------------------------------
 * PATH 2: MediaRecorder FALLBACK — RESOLUSI KECIL
 * Untuk browser tanpa WebCodecs (iOS Safari, Firefox)
 * Render di 540x675 agar HP kuat handle real-time
 * ---------------------------------------------------------- */
function exportLowResMediaRecorder() {
  return new Promise(function(resolve, reject) {
    (async function() {
      try {
        var exportW = 540;
        var exportH = 675;
        var fps = 24;

        updateExportProgress(3, 'Memulai render (resolusi ringan)...');

        // Canvas kecil khusus export
        var smallCanvas = document.createElement('canvas');
        smallCanvas.width = exportW;
        smallCanvas.height = exportH;
        var smallCtx = smallCanvas.getContext('2d');

        // Setup MediaRecorder
        var stream = smallCanvas.captureStream(fps);
        var mimeType = 'video/mp4;codecs=avc1';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

        console.log('[Export Fallback] MIME: ' + mimeType + ', Resolution: ' + exportW + 'x' + exportH);

        var recorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: 3000000 // 3 Mbps — ringan
        });

        var chunks = [];
        recorder.ondataavailable = function(e) {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        var recDone = new Promise(function(res) { recorder.onstop = res; });
        recorder.start(100);

        // Buat video terpisah
        var video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.playsInline = true;
        video.muted = true;
        video.preload = 'auto';
        video.src = state.introVideo.src;

        await new Promise(function(res, rej) {
          video.oncanplaythrough = res;
          video.onerror = function() { rej(new Error('Gagal memuat video')); };
          video.load();
        });

        var introDuration = video.duration || 10;
        var holdDuration = state.holdPhotoDuration;
        var totalDuration = introDuration + holdDuration;

        updateExportProgress(8, 'Memutar video (resolusi ringan)...');

        // PUTAR video natural di resolusi kecil
        video.currentTime = 0;

        // Scale down: gambar video 1080x1350 → 540x675
        await new Promise(function(res) {
          var startTime = performance.now();
          var videoEnded = false;

          function drawFrame() {
            if (videoEnded) return;
            var elapsed = (performance.now() - startTime) / 1000;
            var pct = Math.round((elapsed / totalDuration) * 80) + 8;
            updateExportProgress(Math.min(88, pct), 'Merekam: ' + elapsed.toFixed(1) + 's / ' + introDuration.toFixed(1) + 's');

            // Render ke canvas kecil
            smallCtx.fillStyle = '#162b3d';
            smallCtx.fillRect(0, 0, exportW, exportH);
            drawCoverMedia(smallCtx, video, exportW, exportH);

            requestAnimationFrame(drawFrame);
          }

          video.onended = function() {
            videoEnded = true;
            res();
          };

          requestAnimationFrame(drawFrame);
          video.play().catch(function() { res(); });
        });

        // Hold foto di resolusi kecil
        updateExportProgress(90, 'Merekam foto twibbon...');

        // Buat scaled-down version foto
        var smallPhoto = document.createElement('canvas');
        smallPhoto.width = exportW;
        smallPhoto.height = exportH;
        var spCtx = smallPhoto.getContext('2d');
        if (state.croppedCanvas) spCtx.drawImage(state.croppedCanvas, 0, 0, exportW, exportH);
        if (state.isFrameLoaded) spCtx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, exportW, exportH);

        await new Promise(function(res) {
          var holdStart = performance.now();
          var holdMs = holdDuration * 1000;
          function holdFrame() {
            var elapsed = performance.now() - holdStart;
            if (elapsed >= holdMs) { res(); return; }
            smallCtx.drawImage(smallPhoto, 0, 0);
            var hp = 90 + Math.round((elapsed / holdMs) * 8);
            updateExportProgress(Math.min(98, hp), 'Foto: ' + (elapsed / 1000).toFixed(1) + 's');
            requestAnimationFrame(holdFrame);
          }
          requestAnimationFrame(holdFrame);
        });

        // Stop recording
        updateExportProgress(99, 'Menyelesaikan...');
        recorder.stop();
        await recDone;

        // Download
        var isMp4 = mimeType.indexOf('mp4') >= 0;
        var ext = isMp4 ? 'mp4' : 'webm';
        var blob = new Blob(chunks, { type: mimeType });
        var filename = 'Twibbon_PKKMB_LPKIA_' + Date.now() + '.' + ext;

        updateExportProgress(100, 'Selesai!');
        downloadBlob(blob, filename);

        video.src = '';
        video.load();

        setTimeout(function() {
          el.processingModal.classList.add('hidden');
          state.isRendering = false;
          startPreviewPlayer();
          Swal.fire({
            icon: 'success',
            title: 'Video Berhasil Dibuat!',
            html: '<b>' + filename + '</b><br><small>' + exportW + 'x' + exportH + ' • ' + fps + 'fps</small>',
            confirmButtonColor: '#162b3d'
          });
        }, 500);

        resolve();
      } catch (err) {
        reject(err);
      }
    })();
  });
}

function updateExportProgress(percent, text) {
  if (el.processingProgressFill) el.processingProgressFill.style.width = percent + '%';
  if (el.processingPercentText) el.processingPercentText.textContent = percent + '%';
  if (el.processingStatusText) el.processingStatusText.textContent = text;
}

/* ============================================================
 * STATIC PHOTO EXPORT (Instant PNG)
 * ============================================================ */
function exportStaticPhoto() {
  if (!state.croppedCanvas) return;
  var exportCanvas = document.createElement('canvas');
  exportCanvas.width = state.canvasSize.width;
  exportCanvas.height = state.canvasSize.height;
  var ctx = exportCanvas.getContext('2d');
  ctx.drawImage(state.croppedCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
  if (state.isFrameLoaded) {
    ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, exportCanvas.width, exportCanvas.height);
  }
  exportCanvas.toBlob(function(blob) {
    var filename = 'Twibbon_Foto_Maba_' + Date.now() + '.png';
    downloadBlob(blob, filename);
    Swal.fire({ icon: 'success', title: 'Foto Twibbon Diunduh', text: 'File ' + filename + ' berhasil disimpan.', confirmButtonColor: '#162b3d' });
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
  }, 100);
}
