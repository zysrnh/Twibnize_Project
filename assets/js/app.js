/**
 * Twibbon Video Generator Engine
 * Stack: HTML5 Canvas, MediaRecorder, Cropper.js, Web Audio API
 */

// Global App State
const state = {
  cropper: null,
  rawImageSrc: null,
  croppedCanvas: null,
  frameImg: new Image(),
  introVideo: document.createElement('video'),
  hasCustomVideo: false,
  isVideoLoaded: false,
  isFrameLoaded: false,
  isRendering: false,
  previewCanvas: null,
  previewCtx: null,
  renderCanvas: null,
  renderCtx: null,
  animFrameId: null,
  totalVideoDuration: 5, // default
  holdPhotoDuration: 5,  // seconds to hold photo after video
  aspectRatio: 1,        // 1:1 square
  canvasSize: { width: 1080, height: 1080 }
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
  // 1. Try to load twibon.svg (or assets/frame.svg)
  state.frameImg.crossOrigin = 'anonymous';
  
  // Deteksi file twibon.svg yang sudah ada di root atau assets
  const frameCandidates = ['twibon.svg', 'assets/frame.svg', 'assets/twibon.svg', 'assets/frame.png'];
  loadFirstAvailableImage(frameCandidates, 0);

  // 2. Try to load frame.mp4 (or assets/intro.mp4)
  state.introVideo.crossOrigin = 'anonymous';
  state.introVideo.playsInline = true;
  state.introVideo.muted = false;
  state.introVideo.preload = 'auto';
  
  const videoCandidates = ['frame.mp4', 'assets/intro.mp4', 'assets/frame.mp4', 'intro.mp4'];
  loadFirstAvailableVideo(videoCandidates, 0);
}

function loadFirstAvailableImage(candidates, index) {
  if (index >= candidates.length) {
    console.warn('File frame twibbon tidak ditemukan, menggunakan fallback.');
    createFallbackFrame();
    return;
  }
  
  const testImg = new Image();
  testImg.crossOrigin = 'anonymous';
  testImg.src = candidates[index];
  testImg.onload = () => {
    state.frameImg.src = candidates[index];
    state.isFrameLoaded = true;
    
    // Auto-detect aspect ratio dari frame SVG/PNG
    const naturalW = testImg.naturalWidth || testImg.width || 1080;
    const naturalH = testImg.naturalHeight || testImg.height || 1080;
    state.aspectRatio = naturalW / naturalH;
    
    // Set resolusi render HD optimal sesuai rasio
    if (Math.abs(state.aspectRatio - 1) < 0.05) {
      // 1:1 Square
      state.canvasSize = { width: 1080, height: 1080 };
    } else if (state.aspectRatio < 0.9) {
      // Portrait / 4:5 / 9:16 (Story / Feed Vertikal)
      const targetW = 1080;
      const targetH = Math.round(targetW / state.aspectRatio);
      state.canvasSize = { width: targetW, height: targetH };
    } else {
      // Landscape
      const targetH = 1080;
      const targetW = Math.round(targetH * state.aspectRatio);
      state.canvasSize = { width: targetW, height: targetH };
    }
    
    // Update dimensi canvas preview & render
    if (state.previewCanvas) {
      state.previewCanvas.width = state.canvasSize.width;
      state.previewCanvas.height = state.canvasSize.height;
    }
    if (state.renderCanvas) {
      state.renderCanvas.width = state.canvasSize.width;
      state.renderCanvas.height = state.canvasSize.height;
    }

    // Auto Chroma Key (Hapus Green Screen Otomatis)
    state.processedFrameCanvas = applyChromaKey(testImg);
    const transparentFrameDataUrl = state.processedFrameCanvas.toDataURL();

    if (el.cropperFrameOverlay) {
      el.cropperFrameOverlay.src = transparentFrameDataUrl;
    }
    
    console.log(`Menggunakan frame twibbon: ${candidates[index]} (${state.canvasSize.width}x${state.canvasSize.height}, rasio: ${state.aspectRatio.toFixed(2)}) dengan Auto Green-Screen Removal.`);
  };
  testImg.onerror = () => {
    loadFirstAvailableImage(candidates, index + 1);
  };
}

/**
 * Auto Chroma Key Algorithm (Menghilangkan Warna Hijau Neon)
 */
function applyChromaKey(sourceImage) {
  const c = document.createElement('canvas');
  c.width = sourceImage.naturalWidth || sourceImage.width || 1080;
  c.height = sourceImage.naturalHeight || sourceImage.height || 1080;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceImage, 0, 0, c.width, c.height);

  try {
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Deteksi warna hijau green-screen:
      // Green dominan dibanding Red dan Blue
      const maxRB = Math.max(r, b);
      if (g > 70 && g > maxRB * 1.25) {
        const diff = g - maxRB;
        if (diff > 35) {
          data[i + 3] = 0; // Transparan 100%
        } else {
          // Semi-transparan di tepian (anti-aliasing halus)
          data[i + 3] = Math.round(255 * (1 - (diff / 35)));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Gagal membaca pixel untuk chroma key (CORS/tainted canvas):', e);
  }

  return c;
}

function loadFirstAvailableVideo(candidates, index) {
  if (index >= candidates.length) {
    console.info('Video MP4 kustom belum ada, sistem menggunakan generator animasi intro demo.');
    state.isVideoLoaded = true;
    state.hasCustomVideo = false;
    updateVideoStatusBadge(false, 'Mode Demo (Animasi Intro Bawaan)');
    return;
  }

  const vSrc = candidates[index];
  const testVid = document.createElement('video');
  testVid.crossOrigin = 'anonymous';
  testVid.src = vSrc;

  testVid.onloadedmetadata = () => {
    state.introVideo.src = vSrc;
    state.isVideoLoaded = true;
    state.hasCustomVideo = true;
    updateVideoStatusBadge(true, `Video Siap (${vSrc} - ${testVid.duration.toFixed(1)}s)`);
    console.log(`Menggunakan video: ${vSrc}`);
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
 * Fallback Frame if SVG is not yet available
 */
function createFallbackFrame() {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1080;
  const ctx = c.getContext('2d');

  // Outer frame
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1080, 1080);

  // Cutout
  ctx.clearRect(140, 160, 800, 660);

  // Border
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 14;
  ctx.strokeRect(140, 160, 800, 660);

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TWIBBON MAHASISWA BARU', 540, 930);

  state.frameImg.src = c.toDataURL();
  state.isFrameLoaded = true;
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
    el.uploadDropzone.classList.add('border-blue-600', 'bg-blue-50');
  });
  el.uploadDropzone.addEventListener('dragleave', () => {
    el.uploadDropzone.classList.remove('border-blue-600', 'bg-blue-50');
  });
  el.uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.uploadDropzone.classList.remove('border-blue-600', 'bg-blue-50');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUserFile(e.dataTransfer.files[0]);
    }
  });

  // Cropper Controls - Zoom Slider & Gestures
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
          confirmButtonColor: '#1e40af'
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
            text: `Menggunakan frame: ${file.name} (Auto Green-Screen Hilang)`,
            confirmButtonColor: '#1e40af'
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

/**
 * Handle Loaded User Image
 */
function handleUserFile(file) {
  if (!file.type.startsWith('image/')) {
    Swal.fire({
      icon: 'error',
      title: 'Format Tidak Sesuai',
      text: 'Harap upload file gambar (JPG, PNG, WEBP).',
      confirmButtonColor: '#1e40af'
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
  el.uploadDropzone.classList.add('hidden');
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');

  el.cropperImage.src = imageSrc;

  if (state.cropper) {
    state.cropper.destroy();
  }

  // Update cropper container aspect-ratio
  const cropperContainer = el.cropperImage.parentElement;
  if (cropperContainer) {
    cropperContainer.style.aspectRatio = `${state.canvasSize.width} / ${state.canvasSize.height}`;
  }

  state.cropper = new Cropper(el.cropperImage, {
    aspectRatio: state.aspectRatio || 1,
    viewMode: 0, // Bebas digeser tanpa batas kaku
    dragMode: 'move', // Menggeser foto langsung
    autoCropArea: 1, // Pas 100% frame
    restore: false,
    guides: false, // Hilangkan garis putus-putus
    center: false, // Hilangkan tanda plus di tengah
    highlight: false,
    cropBoxMovable: false, // Frame terkunci
    cropBoxResizable: false, // Ukuran frame terkunci
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

  // Dapatkan hasil crop dengan resolusi tajam
  state.croppedCanvas = state.cropper.getCroppedCanvas({
    width: state.canvasSize.width,
    height: state.canvasSize.height,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  // Update preview canvas aspect ratio
  if (state.previewCanvas && state.previewCanvas.parentElement) {
    state.previewCanvas.parentElement.style.aspectRatio = `${state.canvasSize.width} / ${state.canvasSize.height}`;
  }

  el.cropperSection.classList.add('hidden');
  el.previewSection.classList.remove('hidden');

  // Mulai preview
  startPreviewPlayer();
}

/**
 * Back to Cropper from Preview
 */
function backToCropper() {
  stopPreviewPlayer();
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');
}

/**
 * Reset all to upload screen
 */
function resetToUpload() {
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
  introDuration: 3, // fallback intro duration in seconds
  totalDuration: 8,
  startTime: 0
};

function startPreviewPlayer() {
  stopPreviewPlayer();

  const introDuration = state.hasCustomVideo && state.introVideo.duration && !isNaN(state.introVideo.duration)
    ? state.introVideo.duration
    : 3.5; // fallback animated intro duration

  previewState.introDuration = introDuration;
  previewState.totalDuration = introDuration + state.holdPhotoDuration;
  previewState.currentTime = 0;
  previewState.isPlaying = true;
  previewState.startTime = performance.now();

  if (state.hasCustomVideo) {
    state.introVideo.currentTime = 0;
    state.introVideo.play().catch(e => console.log('Autoplay audio blocked, silent play'));
  }

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
    if (state.hasCustomVideo) {
      state.introVideo.currentTime = 0;
      state.introVideo.play().catch(() => {});
    }
  }

  // Draw current frame to Preview Canvas
  renderFrameToCanvas(state.previewCtx, previewState.currentTime, previewState.introDuration);

  // Update UI Progress
  updatePreviewUI();

  state.animFrameId = requestAnimationFrame(runPreviewLoop);
}

function togglePreviewPlayback() {
  if (previewState.isPlaying) {
    previewState.isPlaying = false;
    if (state.hasCustomVideo) state.introVideo.pause();
    updatePlayButtonIcon(false);
  } else {
    previewState.isPlaying = true;
    previewState.startTime = performance.now() - (previewState.currentTime * 1000);
    if (state.hasCustomVideo) {
      state.introVideo.currentTime = Math.min(previewState.currentTime, state.introVideo.duration || 0);
      if (previewState.currentTime < previewState.introDuration) {
        state.introVideo.play().catch(() => {});
      }
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
  if (state.hasCustomVideo) state.introVideo.pause();
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
 * ----------------------------------------------------
 * CANVAS COMPOSITOR: RENDER 1 FRAME
 * ----------------------------------------------------
 */
function renderFrameToCanvas(ctx, time, introDuration) {
  const width = state.canvasSize.width;
  const height = state.canvasSize.height;
  const crossfadeDuration = 0.55; // 0.55 detik transisi crossfade halus

  // Clear canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const fadeStartTime = Math.max(0, introDuration - crossfadeDuration);

  if (time < fadeStartTime) {
    // PHASE 1: FULL INTRO VIDEO
    if (state.hasCustomVideo && state.introVideo.readyState >= 2) {
      ctx.drawImage(state.introVideo, 0, 0, width, height);
    } else {
      drawProceduralIntro(ctx, time, introDuration, width, height);
    }
  } else if (time >= fadeStartTime && time < introDuration) {
    // PHASE 1.5: MAGICAL STARBURST CROSSFADE (Transisi Bintang Emas)
    // 1. Gambar Video Frame (Ledakan Sihir Bintang Emas)
    if (state.hasCustomVideo && state.introVideo.readyState >= 2) {
      ctx.drawImage(state.introVideo, 0, 0, width, height);
    } else {
      drawProceduralIntro(ctx, time, introDuration, width, height);
    }

    // 2. Blend Twibbon + Foto Maba muncul dari balik kilau bintang
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
    // 1. Draw Cropped Photo
    if (state.croppedCanvas) {
      ctx.drawImage(state.croppedCanvas, 0, 0, width, height);
    }

    // 2. Draw Twibbon Frame Overlay (dengan green screen yang sudah dihilangkan)
    if (state.isFrameLoaded) {
      ctx.drawImage(state.processedFrameCanvas || state.frameImg, 0, 0, width, height);
    }
  }
}

/**
 * Built-in Procedural Flat Intro Animation (for testing without external mp4)
 */
function drawProceduralIntro(ctx, time, duration, w, h) {
  const progress = time / duration; // 0 to 1

  // Solid background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Geometric expanding boxes
  const boxScale = Math.min(1, progress * 1.5);
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(w/2 - (400 * boxScale), h/2 - (240 * boxScale), 800 * boxScale, 480 * boxScale);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 12;
  ctx.strokeRect(w/2 - (420 * boxScale), h/2 - (260 * boxScale), 840 * boxScale, 520 * boxScale);

  // Animated Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (progress < 0.5) {
    ctx.fillText('WELCOME TO', w/2, h/2 - 40);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('KAMPUS KEBANGGAAN', w/2, h/2 + 40);
  } else {
    ctx.fillText('OFFICIAL TWIBBON', w/2, h/2 - 40);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('MAHASISWA BARU 2026', w/2, h/2 + 50);
  }

  // Progress line at bottom
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, h - 24, w * progress, 24);
}

/**
 * ----------------------------------------------------
 * VIDEO EXPORT ENGINE (MediaRecorder + Canvas Stream)
 * ----------------------------------------------------
 */
async function startVideoExport() {
  if (state.isRendering || !state.croppedCanvas) return;
  state.isRendering = true;
  stopPreviewPlayer();

  // Show processing modal
  el.processingModal.classList.remove('hidden');
  updateExportProgress(0, 'Menyiapkan encoder video...');

  try {
    const fps = 30;
    const introDuration = state.hasCustomVideo && state.introVideo.duration && !isNaN(state.introVideo.duration)
      ? state.introVideo.duration
      : 3.5;
    const totalDuration = introDuration + state.holdPhotoDuration;
    const totalFrames = Math.ceil(totalDuration * fps);

    // Setup Canvas Stream
    const stream = state.renderCanvas.captureStream(fps);

    // Setup Audio Capture if custom video is present
    let audioContext = null;
    let audioDestination = null;
    let audioStream = null;

    if (state.hasCustomVideo) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
        audioDestination = audioContext.createMediaStreamDestination();
        const source = audioContext.createMediaElementSource(state.introVideo);
        source.connect(audioDestination);
        source.connect(audioContext.destination);

        const audioTracks = audioDestination.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          stream.addTrack(audioTracks[0]);
        }
      } catch (e) {
        console.warn('Audio capture bypassed:', e);
      }
    }

    // Determine Best Supported MimeType
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 8000000 // 8 Mbps High Quality
    });

    const recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      updateExportProgress(100, 'Selesai! Mengunduh video...');
      const blob = new Blob(recordedChunks, { type: mimeType });
      const extension = mimeType.includes('mp4') ? 'mp4' : 'mp4'; // Modern player accepts standard extension
      const filename = `Twibbon_Maba_${Date.now()}.${extension}`;

      downloadBlob(blob, filename);

      setTimeout(() => {
        el.processingModal.classList.add('hidden');
        state.isRendering = false;
        startPreviewPlayer(); // Resume preview
        Swal.fire({
          icon: 'success',
          title: 'Video Berhasil Dibuat!',
          text: `File ${filename} sudah otomatis di-download.`,
          confirmButtonColor: '#1e40af'
        });
      }, 800);
    };

    mediaRecorder.start();

    // Mulai render frame demi frame
    if (state.hasCustomVideo) {
      state.introVideo.currentTime = 0;
      state.introVideo.play().catch(() => {});
    }

    const frameInterval = 1000 / fps;
    let currentFrame = 0;

    const renderTimer = setInterval(() => {
      const currentTime = currentFrame / fps;

      if (currentTime >= totalDuration) {
        clearInterval(renderTimer);
        if (state.hasCustomVideo) state.introVideo.pause();
        mediaRecorder.stop();
        return;
      }

      // Draw to High-Res Render Canvas
      renderFrameToCanvas(state.renderCtx, currentTime, introDuration);

      currentFrame++;
      const percent = Math.min(99, Math.round((currentFrame / totalFrames) * 100));
      updateExportProgress(percent, `Merender video: detik ke-${currentTime.toFixed(1)} dari ${totalDuration.toFixed(1)}s`);
    }, frameInterval);

  } catch (err) {
    console.error('Export Error:', err);
    el.processingModal.classList.add('hidden');
    state.isRendering = false;
    Swal.fire({
      icon: 'error',
      title: 'Gagal Membuat Video',
      text: err.message || 'Terjadi kesalahan pada browser saat merender.',
      confirmButtonColor: '#1e40af'
    });
  }
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
      text: `File ${filename} berhasil disimpan.`,
      confirmButtonColor: '#1e40af'
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
