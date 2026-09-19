/**
 * Twibbon Video Generator Engine - PKKMB SADAJIWA IDE LPKIA 2026
 * v5.0 - Natural Playback Recording (Zero Frame-Seeking)
 * 
 * Strategi: Video diputar NATURAL (bukan seek per-frame), lalu canvas 
 * direkam pakai MediaRecorder. HP handle smooth karena hardware decoder
 * cuma putar video biasa — TANPA seeking sama sekali.
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

  // Processing & Modal
  processingModal: document.getElementById('processing-modal'),
  processingProgressFill: document.getElementById('processing-progress-fill'),
  processingStatusText: document.getElementById('processing-status-text'),
  processingPercentText: document.getElementById('processing-percent-text'),

  // Settings & Custom Asset Loaders
  customVideoInput: document.getElementById('custom-video-input'),
  customFrameInput: document.getElementById('custom-frame-input'),
  inputHoldDuration: document.getElementById('input-hold-duration'),
  videoStatusBadge: document.getElementById('video-status-badge')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initCanvases();
  loadDefaultAssets();
  bindEvents();
});

/**
 * Setup Canvases (Preview Canvas & High-Res Render Canvas)
 */
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

/**
 * Load Initial Assets (SVG Frame and Intro Video)
 */
function loadDefaultAssets() {
  // 1. Load twibon.svg from assets/images/
  state.frameImg.crossOrigin = 'anonymous';
  
  const frameCandidates = [
    'assets/images/twibon.svg',
    'assets/twibon.svg',
    'twibon.svg',
    'assets/images/frame.png',
    'assets/frame.png'
  ];
  loadFirstAvailableImage(frameCandidates, 0);

  // 2. Load Framenaur.mp4 from assets/videos/
  state.introVideo.crossOrigin = 'anonymous';
  state.introVideo.playsInline = true;
  state.introVideo.muted = true; // Muted for seamless autoplay on mobile
  state.introVideo.preload = 'auto';
  
  const videoCandidates = [
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
  
  const testImg = new Image();
  testImg.crossOrigin = 'anonymous';
  testImg.src = candidates[index];
  testImg.onload = () => {
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

    // Auto Chroma Key (Hapus Green Screen Otomatis)
    state.processedFrameCanvas = applyChromaKey(testImg);
    const transparentFrameDataUrl = state.processedFrameCanvas.toDataURL();

    if (el.cropperFrameOverlay) {
      el.cropperFrameOverlay.src = transparentFrameDataUrl;
    }
    
    console.log(`Menggunakan frame twibbon: ${candidates[index]} (1080x1350 - 4:5)`);
  };
  testImg.onerror = () => {
    loadFirstAvailableImage(candidates, index + 1);
  };
}

/**
 * Auto Chroma Key Algorithm (Menghilangkan Warna Hijau Neon pada 1080x1350)
 */
function applyChromaKey(sourceImage) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceImage, 0, 0, 1080, 1350);

  try {
    const imgData = ctx.getImageData(0, 0, 1080, 1350);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Deteksi warna hijau green-screen
      const maxRB = Math.max(r, b);
      if (g > 70 && g > maxRB * 1.25) {
        const diff = g - maxRB;
        if (diff > 35) {
          data[i + 3] = 0; // Transparan 100%
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

  const vSrc = candidates[index];
  const testVid = document.createElement('video');
  testVid.crossOrigin = 'anonymous';
  testVid.playsInline = true;
  testVid.muted = true;
  testVid.src = vSrc;

  testVid.onloadedmetadata = () => {
    state.introVideo.src = vSrc;
    state.isVideoLoaded = true;
    state.hasCustomVideo = true;
    state.totalVideoDuration = testVid.duration || 10;
    updateVideoStatusBadge(true, `Video Siap (${vSrc} - ${testVid.duration.toFixed(1)}s)`);
    console.log(`Menggunakan video: ${vSrc} (${testVid.duration.toFixed(1)}s)`);
  };

  testVid.onerror = () => {
    loadFirstAvailableVideo(candidates, index + 1);
  };
}

/**
 * Update video badge indicator
 */
function updateVideoStatusBadge(isCustom, text) {
  if (!el.videoStatusBadge) return;
  if (isCustom) {
    el.videoStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
    el.videoStatusBadge.innerHTML = `<span class="w-2 h-2 mr-1.5 bg-emerald-500 rounded-full"></span> ${text}`;
  } else {
    el.videoStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300';
    el.videoStatusBadge.innerHTML = `<span class="w-2 h-2 mr-1.5 bg-amber-500 rounded-full"></span> ${text}`;
  }
}

/**
 * Bind All Event Handlers
 */
function bindEvents() {
  // File Upload Handlers
  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUserFile(e.target.files[0]);
    }
  });

  // Drag & Drop
  el.uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.uploadDropzone.classList.add('border-[#b69861]', 'bg-amber-50/20');
  });
  el.uploadDropzone.addEventListener('dragleave', () => {
    el.uploadDropzone.classList.remove('border-[#b69861]', 'bg-amber-50/20');
  });
  el.uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.uploadDropzone.classList.remove('border-[#b69861]', 'bg-amber-50/20');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUserFile(e.dataTransfer.files[0]);
    }
  });

  // Cropper Controls
  if (el.zoomSlider) {
    el.zoomSlider.addEventListener('input', (e) => {
      if (state.cropper) {
        const val = parseFloat(e.target.value);
        state.cropper.zoomTo(val);
        if (el.zoomLevelText) el.zoomLevelText.textContent = `${Math.round(val * 100)}%`;
      }
    });
  }

  el.btnRotateLeft.addEventListener('click', () => state.cropper && state.cropper.rotate(-90));
  el.btnRotateRight.addEventListener('click', () => state.cropper && state.cropper.rotate(90));
  el.btnResetCrop.addEventListener('click', () => {
    if (state.cropper) {
      state.cropper.reset();
      if (el.zoomSlider) el.zoomSlider.value = 1;
      if (el.zoomLevelText) el.zoomLevelText.textContent = '100%';
    }
  });

  if (el.toggleFrameGuide) {
    el.toggleFrameGuide.addEventListener('change', (e) => {
      el.cropperFrameOverlay.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  el.btnCropConfirm.addEventListener('click', confirmCropAndProceed);
  el.btnReupload.addEventListener('click', resetToUpload);
  el.btnRecrop.addEventListener('click', backToCropper);

  // Preview & Download Controls
  el.btnPlayPause.addEventListener('click', togglePreviewPlayback);
  el.btnReplay.addEventListener('click', restartPreviewPlayback);
  el.btnDownloadVideo.addEventListener('click', startVideoExport);
  el.btnDownloadPhoto.addEventListener('click', exportStaticPhoto);

  // Settings: Custom Video / SVG file pickers
  if (el.customVideoInput) {
    el.customVideoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        state.introVideo.src = url;
        state.introVideo.load();
        state.hasCustomVideo = true;
        updateVideoStatusBadge(true, `Video Kustom: ${file.name}`);
        Swal.fire({
          icon: 'success',
          title: 'Video Intro Diganti',
          text: `Menggunakan video: ${file.name}`,
          confirmButtonColor: '#162b3d'
        });
      }
    });
  }

  if (el.customFrameInput) {
    el.customFrameInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        state.frameImg.src = url;
        state.frameImg.onload = () => {
          state.processedFrameCanvas = applyChromaKey(state.frameImg);
          const transparentUrl = state.processedFrameCanvas.toDataURL();
          if (el.cropperFrameOverlay) el.cropperFrameOverlay.src = transparentUrl;
          Swal.fire({
            icon: 'success',
            title: 'Frame Twibbon Diganti',
            text: `Menggunakan frame: ${file.name}`,
            confirmButtonColor: '#162b3d'
          });
        };
      }
    });
  }

  if (el.inputHoldDuration) {
    el.inputHoldDuration.addEventListener('input', (e) => {
      state.holdPhotoDuration = parseFloat(e.target.value) || 5;
    });
  }
}

function setStep(step) {
  const p1 = document.getElementById('step-1-pill');
  const p2 = document.getElementById('step-2-pill');
  const p3 = document.getElementById('step-3-pill');

  if (p1 && p2 && p3) {
    p1.className = step === 1 ? 'step-item active' : 'step-item completed';
    p2.className = step === 2 ? 'step-item active' : (step > 2 ? 'step-item completed' : 'step-item');
    p3.className = step === 3 ? 'step-item active' : 'step-item';
  }
}

/**
 * Handle Loaded User Image
 */
function handleUserFile(file) {
  if (!file.type.startsWith('image/')) {
    Swal.fire({
      icon: 'error',
      title: 'Format Tidak Sesuai',
      text: 'Harap upload file gambar (JPG, PNG, WEBP).',
      confirmButtonColor: '#162b3d'
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.rawImageSrc = e.target.result;
    openCropper(state.rawImageSrc);
  };
  reader.readAsDataURL(file);
}

/**
 * Initialize Cropper
 */
function openCropper(imageSrc) {
  setStep(2);
  el.uploadDropzone.classList.add('hidden');
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');

  el.cropperImage.src = imageSrc;

  if (state.cropper) {
    state.cropper.destroy();
  }

  const cropperContainer = el.cropperImage.parentElement;
  if (cropperContainer) {
    cropperContainer.style.aspectRatio = `${state.canvasSize.width} / ${state.canvasSize.height}`;
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
    ready() {
      if (el.zoomSlider) el.zoomSlider.value = 1;
      if (el.zoomLevelText) el.zoomLevelText.textContent = '100%';
    },
    zoom(e) {
      if (el.zoomSlider && e.detail && e.detail.ratio) {
        const ratio = Math.min(3, Math.max(0.2, e.detail.ratio));
        el.zoomSlider.value = ratio;
        if (el.zoomLevelText) el.zoomLevelText.textContent = `${Math.round(ratio * 100)}%`;
      }
    }
  });
}

/**
 * Confirm Crop and Switch to Preview
 */
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
    state.previewCanvas.parentElement.style.aspectRatio = `${state.canvasSize.width} / ${state.canvasSize.height}`;
  }

  el.cropperSection.classList.add('hidden');
  el.previewSection.classList.remove('hidden');

  startPreviewPlayer();
}

/**
 * Back to Cropper from Preview
 */
function backToCropper() {
  setStep(2);
  stopPreviewPlayer();
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');
}

/**
 * Reset all to upload screen
 */
function resetToUpload() {
  setStep(1);
  stopPreviewPlayer();
  if (state.cropper) state.cropper.destroy();
  el.fileInput.value = '';
  el.cropperSection.classList.add('hidden');
  el.previewSection.classList.add('hidden');
  el.uploadDropzone.classList.remove('hidden');
}

/**
 * ----------------------------------------------------
 * PREVIEW & CANVAS COMPOSITOR ENGINE
 * ----------------------------------------------------
 */

let previewState = {
  isPlaying: false,
  currentTime: 0,
  introDuration: 10,
  totalDuration: 15,
  startTime: 0
};

function startPreviewPlayer() {
  stopPreviewPlayer();

  const introDuration = state.introVideo.duration && !isNaN(state.introVideo.duration)
    ? state.introVideo.duration
    : 10.0;

  previewState.introDuration = introDuration;
  previewState.totalDuration = introDuration + state.holdPhotoDuration;
  previewState.currentTime = 0;
  previewState.isPlaying = true;
  previewState.startTime = performance.now();

  state.introVideo.currentTime = 0;
  state.introVideo.play().catch(e => console.log('Autoplay muted preview'));

  updatePlayButtonIcon(true);
  runPreviewLoop();
}

function runPreviewLoop() {
  if (!previewState.isPlaying) return;

  const now = performance.now();
  const elapsed = (now - previewState.startTime) / 1000;
  previewState.currentTime = elapsed;

  if (previewState.currentTime >= previewState.totalDuration) {
    // Selesai -> Loop kembali
    previewState.currentTime = 0;
    previewState.startTime = performance.now();
    state.introVideo.currentTime = 0;
    state.introVideo.play().catch(() => {});
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
      state.introVideo.play().catch(() => {});
    }
    updatePlayButtonIcon(true);
    runPreviewLoop();
  }
}

function restartPreviewPlayback() {
  startPreviewPlayer();
}

function stopPreviewPlayer() {
  previewState.isPlaying = false;
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  state.introVideo.pause();
}

function updatePlayButtonIcon(isPlaying) {
  if (!el.btnPlayPause) return;
  if (isPlaying) {
    el.btnPlayPause.innerHTML = `
      <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Pause
    `;
  } else {
    el.btnPlayPause.innerHTML = `
      <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Play
    `;
  }
}

function updatePreviewUI() {
  const current = previewState.currentTime.toFixed(1);
  const total = previewState.totalDuration.toFixed(1);
  if (el.previewTimeDisplay) {
    el.previewTimeDisplay.textContent = `${current}s / ${total}s`;
  }
  if (el.previewProgressBar) {
    const percent = Math.min(100, (previewState.currentTime / previewState.totalDuration) * 100);
    el.previewProgressBar.style.width = `${percent}%`;
  }
}

/**
 * Helper: Draw video / image with object-fit: cover on target canvas
 */
function drawCoverMedia(ctx, media, targetW, targetH) {
  const srcW = media.videoWidth || media.naturalWidth || media.width || targetW;
  const srcH = media.videoHeight || media.naturalHeight || media.height || targetH;
  const srcRatio = srcW / srcH;
  const targetRatio = targetW / targetH;

  let renderW, renderH, offsetX, offsetY;

  if (srcRatio > targetRatio) {
    renderH = targetH;
    renderW = targetH * srcRatio;
    offsetX = (targetW - renderW) / 2;
    offsetY = 0;
  } else {
    renderW = targetW;
    renderH = targetW / srcRatio;
    offsetX = 0;
    offsetY = (targetH - renderH) / 2;
  }

  ctx.drawImage(media, offsetX, offsetY, renderW, renderH);
}

/**
 * ----------------------------------------------------
 * CANVAS COMPOSITOR: RENDER 1 FRAME (1080x1350 4:5)
 * ----------------------------------------------------
 */
function renderFrameToCanvas(ctx, time, introDuration) {
  const width = state.canvasSize.width;   // 1080
  const height = state.canvasSize.height; // 1350
  const crossfadeDuration = 0.6; // 0.6 detik transisi ledakan bintang emas

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Base background dark navy
  ctx.fillStyle = '#162b3d';
  ctx.fillRect(0, 0, width, height);

  const fadeStartTime = Math.max(0, introDuration - crossfadeDuration);

  if (time < fadeStartTime) {
    // PHASE 1: FULL INTRO VIDEO (Animasi Burung Hantu Sihir)
    drawCoverMedia(ctx, state.introVideo, width, height);
  } else if (time >= fadeStartTime && time < introDuration) {
    // PHASE 1.5: CROSSFADE PADA KILAU BINTANG EMAS
    drawCoverMedia(ctx, state.introVideo, width, height);

    const progress = (time - fadeStartTime) / crossfadeDuration;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, progress));

    if (state.croppedCanvas) {
      ctx.drawImage(state.croppedCanvas, 0, 0, width, height);
    }
    if (state.isFrameLoaded) {
      ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
    }

    ctx.restore();
  } else {
    // PHASE 2: FULL TWIBBON + FOTO MABA
    if (state.croppedCanvas) {
      ctx.drawImage(state.croppedCanvas, 0, 0, width, height);
    }
    if (state.isFrameLoaded) {
      ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
    }
  }
}

/**
 * ------------------------------------------------------------------
 * VIDEO EXPORT ENGINE v5.0 - NATURAL PLAYBACK RECORDING
 * ------------------------------------------------------------------
 * 
 * STRATEGI BARU (anti-patah di HP):
 * 1. Buat video element BARU khusus export (biar gak ganggu state preview)
 * 2. PUTAR video secara NATURAL (play biasa, bukan seek per frame)
 * 3. Setiap frame baru muncul → gambar ke renderCanvas
 * 4. Canvas direkam pakai MediaRecorder via captureStream
 * 5. Setelah video selesai → hold foto twibbon beberapa detik
 * 6. Stop recording → download
 * 
 * Kenapa ini smooth di HP:
 * - Hardware video decoder HP hanya perlu PUTAR video biasa (yang emang smooth)
 * - TIDAK ada seeking ratusan kali (yang bikin patah)
 * - MediaRecorder merekam apa yang ada di canvas secara real-time
 */
async function startVideoExport() {
  if (state.isRendering || !state.croppedCanvas) return;
  state.isRendering = true;
  stopPreviewPlayer();

  // Show processing modal
  el.processingModal.classList.remove('hidden');
  updateExportProgress(0, 'Menyiapkan mesin render...');

  try {
    await exportNaturalPlayback();
  } catch (err) {
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
  }
}

/**
 * CORE EXPORT: Natural Playback Recording
 * Video diputar biasa → canvas direkam → zero seeking → smooth di HP
 */
async function exportNaturalPlayback() {
  const width = state.canvasSize.width;   // 1080
  const height = state.canvasSize.height; // 1350
  const renderCanvas = state.renderCanvas;
  const renderCtx = state.renderCtx;

  // ========== PHASE 0: Setup MediaRecorder ==========
  updateExportProgress(2, 'Memulai perekaman canvas...');
  
  const fps = 30;
  const stream = renderCanvas.captureStream(fps);
  
  // Pilih MIME type terbaik yang tersedia
  let mimeType = 'video/mp4;codecs=avc1';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

  console.log(`[Export] Menggunakan MIME: ${mimeType}`);

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: mimeType,
    videoBitsPerSecond: 8_000_000 // 8 Mbps — cukup crisp, gak terlalu berat
  });

  const recordedChunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  // Promise yang resolve ketika recording selesai
  const recordingDone = new Promise((resolve) => {
    mediaRecorder.onstop = () => resolve();
  });

  // Mulai recording
  mediaRecorder.start(100); // Collect chunks setiap 100ms

  // ========== PHASE 1: Putar Video Intro Secara Natural ==========
  updateExportProgress(5, 'Memutar video intro (natural playback)...');

  // Buat video element baru khusus export
  const exportVideo = document.createElement('video');
  exportVideo.crossOrigin = 'anonymous';
  exportVideo.playsInline = true;
  exportVideo.muted = true;
  exportVideo.preload = 'auto';
  exportVideo.src = state.introVideo.src;

  // Tunggu video siap
  await new Promise((resolve, reject) => {
    exportVideo.oncanplaythrough = resolve;
    exportVideo.onerror = () => reject(new Error('Gagal memuat video untuk export'));
    exportVideo.load();
  });

  const introDuration = exportVideo.duration || 10;
  const holdDuration = state.holdPhotoDuration;
  const totalDuration = introDuration + holdDuration;

  console.log(`[Export] Durasi intro: ${introDuration.toFixed(1)}s, hold: ${holdDuration}s, total: ${totalDuration.toFixed(1)}s`);

  // Putar video dari awal
  exportVideo.currentTime = 0;
  
  // Render loop selama video intro
  // Pakai requestVideoFrameCallback kalau tersedia (lebih presisi), 
  // fallback ke requestAnimationFrame
  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  
  await new Promise((resolve) => {
    let videoEnded = false;
    const playStartTime = performance.now();

    function drawVideoFrame() {
      if (videoEnded) return;

      const elapsed = (performance.now() - playStartTime) / 1000;
      const progress = Math.min(85, Math.round((elapsed / totalDuration) * 85) + 5);
      updateExportProgress(progress, `Merekam video: ${elapsed.toFixed(1)}s / ${introDuration.toFixed(1)}s`);

      // Gambar frame video ke canvas
      renderCtx.fillStyle = '#162b3d';
      renderCtx.fillRect(0, 0, width, height);
      drawCoverMedia(renderCtx, exportVideo, width, height);

      if (hasRVFC && !exportVideo.ended) {
        exportVideo.requestVideoFrameCallback(drawVideoFrame);
      } else if (!exportVideo.ended) {
        requestAnimationFrame(drawVideoFrame);
      }
    }

    // Ketika video selesai
    exportVideo.onended = () => {
      videoEnded = true;
      console.log('[Export] Video intro selesai diputar');
      resolve();
    };

    // Mulai putar & render
    if (hasRVFC) {
      exportVideo.requestVideoFrameCallback(drawVideoFrame);
    } else {
      requestAnimationFrame(drawVideoFrame);
    }
    
    exportVideo.play().catch((e) => {
      console.error('[Export] Gagal putar video:', e);
      // Fallback: skip video, langsung ke foto
      resolve();
    });
  });

  // ========== PHASE 2: Hold Foto Twibbon ==========
  updateExportProgress(88, 'Merekam foto twibbon...');

  // Gambar foto twibbon + frame ke canvas
  renderCtx.fillStyle = '#162b3d';
  renderCtx.fillRect(0, 0, width, height);
  
  if (state.croppedCanvas) {
    renderCtx.drawImage(state.croppedCanvas, 0, 0, width, height);
  }
  if (state.isFrameLoaded) {
    renderCtx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
  }

  // Hold foto selama holdDuration detik
  // Kita perlu terus "redraw" canvas agar MediaRecorder tetap punya frame baru
  await new Promise((resolve) => {
    const holdStart = performance.now();
    const holdMs = holdDuration * 1000;

    function holdFrame() {
      const elapsed = performance.now() - holdStart;
      
      if (elapsed >= holdMs) {
        resolve();
        return;
      }

      // Redraw foto (agar captureStream tetap generate frame baru)
      renderCtx.fillStyle = '#162b3d';
      renderCtx.fillRect(0, 0, width, height);
      if (state.croppedCanvas) {
        renderCtx.drawImage(state.croppedCanvas, 0, 0, width, height);
      }
      if (state.isFrameLoaded) {
        renderCtx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
      }

      const holdProgress = Math.round((elapsed / holdMs) * 10) + 88;
      updateExportProgress(Math.min(98, holdProgress), `Merekam foto: ${(elapsed/1000).toFixed(1)}s / ${holdDuration}s`);

      requestAnimationFrame(holdFrame);
    }

    requestAnimationFrame(holdFrame);
  });

  // ========== PHASE 3: Finalisasi ==========
  updateExportProgress(99, 'Menyelesaikan video...');

  mediaRecorder.stop();
  await recordingDone;

  // Cleanup export video
  exportVideo.src = '';
  exportVideo.load();

  // Download file
  const isMp4 = mimeType.includes('mp4');
  const ext = isMp4 ? 'mp4' : 'webm';
  const blob = new Blob(recordedChunks, { type: mimeType });
  const filename = `Twibbon_PKKMB_LPKIA_${Date.now()}.${ext}`;

  updateExportProgress(100, 'Selesai! Mengunduh video...');
  downloadBlob(blob, filename);

  // Done!
  setTimeout(() => {
    el.processingModal.classList.add('hidden');
    state.isRendering = false;
    startPreviewPlayer();
    Swal.fire({
      icon: 'success',
      title: 'Video Berhasil Dibuat!',
      html: `File <b>${filename}</b> berhasil diunduh.<br><small class="text-slate-500">Format: ${mimeType} • Resolusi: ${width}x${height}</small>`,
      confirmButtonColor: '#162b3d'
    });
  }, 600);
}

function updateExportProgress(percent, text) {
  if (el.processingProgressFill) el.processingProgressFill.style.width = `${percent}%`;
  if (el.processingPercentText) el.processingPercentText.textContent = `${percent}%`;
  if (el.processingStatusText) el.processingStatusText.textContent = text;
}

/**
 * ----------------------------------------------------
 * STATIC PHOTO EXPORT (Instant PNG)
 * ----------------------------------------------------
 */
function exportStaticPhoto() {
  if (!state.croppedCanvas) return;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = state.canvasSize.width;
  exportCanvas.height = state.canvasSize.height;
  const ctx = exportCanvas.getContext('2d');

  // 1. Draw Cropped Photo
  ctx.drawImage(state.croppedCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

  // 2. Draw Frame
  if (state.isFrameLoaded) {
    ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, exportCanvas.width, exportCanvas.height);
  }

  // Export to Blob
  exportCanvas.toBlob((blob) => {
    const filename = `Twibbon_Foto_Maba_${Date.now()}.png`;
    downloadBlob(blob, filename);

    Swal.fire({
      icon: 'success',
      title: 'Foto Twibbon Diunduh',
      text: `File ${filename} berhasil disimpan dalam resolusi tinggi.`,
      confirmButtonColor: '#162b3d'
    });
  }, 'image/png');
}

/**
 * Helper: Download Blob File
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}
