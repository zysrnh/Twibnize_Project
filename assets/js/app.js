/**
 * Twibbon Video Generator Engine - PKKMB SADAJIWA IDE LPKIA 2026
 * Stack: HTML5 Canvas, WebCodecs, mp4-muxer, MediaRecorder, Cropper.js
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
  totalVideoDuration: 10, // default intro duration
  holdPhotoDuration: 5,   // seconds to hold photo after video
  aspectRatio: 1080 / 1350, // 4:5 Portrait Full HD
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
 * VIDEO EXPORT ENGINE (WebCodecs + Mp4Muxer / Ultra HD H.264 MP4)
 * ------------------------------------------------------------------
 */
async function startVideoExport() {
  if (state.isRendering || !state.croppedCanvas) return;
  state.isRendering = true;
  stopPreviewPlayer();

  // Show processing modal
  el.processingModal.classList.remove('hidden');
  updateExportProgress(0, 'Menyiapkan mesin render Ultra HD...');

  try {
    const fps = 30;
    const introDuration = state.introVideo.duration && !isNaN(state.introVideo.duration)
      ? state.introVideo.duration
      : 10.0;
    const totalDuration = introDuration + state.holdPhotoDuration;
    const totalFrames = Math.ceil(totalDuration * fps);

    const width = state.canvasSize.width;   // 1080
    const height = state.canvasSize.height; // 1350

    const supportsWebCodecs = typeof window.VideoEncoder !== 'undefined' && 
                              typeof window.VideoFrame !== 'undefined' && 
                              typeof window.Mp4Muxer !== 'undefined';

    if (supportsWebCodecs) {
      await exportVideoWithWebCodecs({ fps, introDuration, totalDuration, totalFrames, width, height });
    } else {
      console.warn('WebCodecs not supported, using MediaRecorder fallback.');
      await exportVideoWithMediaRecorder({ fps, introDuration, totalDuration, totalFrames, width, height });
    }
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
 * Primary Exporter: True ISO MP4 with WebCodecs & Mp4Muxer (10 Mbps Crisp Ultra HD)
 */
async function exportVideoWithWebCodecs({ fps, introDuration, totalDuration, totalFrames, width, height }) {
  updateExportProgress(5, 'Menginisialisasi encoder H.264 MP4 (10 Mbps)...');

  const muxerOptions = {
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: width,
      height: height
    },
    fastStart: 'in-memory'
  };

  const muxer = new Mp4Muxer.Muxer(muxerOptions);

  let encoderConfig = {
    codec: 'avc1.420028', // H.264 Main Profile
    width: width,
    height: height,
    bitrate: 10_000_000,  // 10 Mbps Ultra Crisp High Definition
    framerate: fps
  };

  try {
    const isVideoSupported = await VideoEncoder.isConfigSupported(encoderConfig);
    if (!isVideoSupported.supported) {
      encoderConfig.codec = 'avc1.42001f';
    }
  } catch (e) {
    encoderConfig.codec = 'avc1.42001f';
  }

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e)
  });

  videoEncoder.configure(encoderConfig);

  state.introVideo.pause();

  const renderCanvas = state.renderCanvas;
  const renderCtx = state.renderCtx;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const currentTime = frameIndex / fps;

    if (currentTime <= introDuration) {
      state.introVideo.currentTime = Math.min(currentTime, Math.max(0, (state.introVideo.duration || 0.1) - 0.05));
      await waitForSeek(state.introVideo);
    }

    renderFrameToCanvas(renderCtx, currentTime, introDuration);

    const timestampUs = Math.round(frameIndex * (1000000 / fps));
    const isKeyFrame = frameIndex % 30 === 0;

    const vFrame = new VideoFrame(renderCanvas, {
      timestamp: timestampUs
    });

    videoEncoder.encode(vFrame, { keyFrame: isKeyFrame });
    vFrame.close();

    const percent = Math.min(98, Math.round((frameIndex / totalFrames) * 100));
    updateExportProgress(percent, `Merender video Ultra HD: frame ${frameIndex + 1}/${totalFrames} (${currentTime.toFixed(1)}s)`);

    if (frameIndex % 2 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  updateExportProgress(99, 'Menyelesaikan file MP4...');

  await videoEncoder.flush();
  muxer.finalize();

  const buffer = muxer.target.buffer;
  const blob = new Blob([buffer], { type: 'video/mp4' });
  const filename = `Twibbon_PKKMB_LPKIA_${Date.now()}.mp4`;

  updateExportProgress(100, 'Selesai! Mengunduh video...');
  downloadBlob(blob, filename);

  finishExport(filename);
}

/**
 * Fallback Exporter: MediaRecorder with Best Available Format (12 Mbps)
 */
async function exportVideoWithMediaRecorder({ fps, introDuration, totalDuration, totalFrames, width, height }) {
  const stream = state.renderCanvas.captureStream(fps);

  let mimeType = 'video/mp4;codecs=avc1';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: mimeType,
    videoBitsPerSecond: 12000000
  });

  const recordedChunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  const recordingPromise = new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const isMp4 = mimeType.includes('mp4');
      const ext = isMp4 ? 'mp4' : 'webm';
      const blob = new Blob(recordedChunks, { type: mimeType });
      const filename = `Twibbon_PKKMB_LPKIA_${Date.now()}.${ext}`;
      downloadBlob(blob, filename);
      resolve(filename);
    };
  });

  mediaRecorder.start();
  state.introVideo.pause();

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const currentTime = frameIndex / fps;

    if (currentTime <= introDuration) {
      state.introVideo.currentTime = Math.min(currentTime, Math.max(0, (state.introVideo.duration || 0.1) - 0.05));
      await waitForSeek(state.introVideo);
    }

    renderFrameToCanvas(state.renderCtx, currentTime, introDuration);

    const percent = Math.min(99, Math.round((frameIndex / totalFrames) * 100));
    updateExportProgress(percent, `Merender video Ultra HD: frame ${frameIndex + 1}/${totalFrames}`);

    await new Promise(r => setTimeout(r, 1000 / fps));
  }

  mediaRecorder.stop();
  const filename = await recordingPromise;
  finishExport(filename);
}

function waitForSeek(video) {
  return new Promise((resolve) => {
    if (video.seeking === false && video.readyState >= 2) {
      setTimeout(resolve, 8);
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 120);
  });
}

function finishExport(filename) {
  setTimeout(() => {
    el.processingModal.classList.add('hidden');
    state.isRendering = false;
    startPreviewPlayer();
    Swal.fire({
      icon: 'success',
      title: 'Video Berhasil Dibuat!',
      text: `File ${filename} berhasil diunduh dengan format MP4 Ultra HD (4:5) jernih dan mulus.`,
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
