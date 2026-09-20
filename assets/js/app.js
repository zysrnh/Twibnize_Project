/**
 * Twibbon Video Generator Engine - PKKMB SADAJIWA IDE LPKIA 2026
 * v9.3 - Multi-Photo with Frame-Synchronized HD Engine (No Black Screens, Rock-Solid 30fps)
 */

// Global App State
const state = {
  photos: [], // Array of { id: number, rawSrc: string, fileName: string, croppedCanvas: HTMLCanvasElement | null }
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
  canvasSize: { width: 1080, height: 1350 },
  replaceTargetIndex: -1
};

// DOM Elements Cache
const el = {
  // Step 1 Elements
  fileInput: document.getElementById('file-input'),
  slotInputExtra: document.getElementById('slot-input-extra'),
  slotReplaceInput: document.getElementById('slot-replace-input'),
  uploadDropzone: document.getElementById('upload-dropzone'),
  uploadInitialState: document.getElementById('upload-initial-state'),
  uploadSelectedState: document.getElementById('upload-selected-state'),
  btnInitialAddExtra: document.getElementById('btn-initial-add-extra'),
  btnAddMorePhotos: document.getElementById('btn-add-more-photos'),
  btnResetAllPhotos: document.getElementById('btn-reset-all-photos'),
  btnProceedCrop: document.getElementById('btn-proceed-crop'),
  photoCountBadge: document.getElementById('photo-count-badge'),
  remainingCountBadge: document.getElementById('remaining-count-badge'),
  btnCropCount: document.getElementById('btn-crop-count'),
  selectedPhotosGrid: document.getElementById('selected-photos-grid'),

  // Step 2 Cropper Elements
  cropperSection: document.getElementById('cropper-section'),
  cropperImage: document.getElementById('cropper-image'),
  cropperFrameOverlay: document.getElementById('cropper-frame-overlay'),
  toggleFrameGuide: document.getElementById('toggle-frame-guide'),
  cropperTabsContainer: document.getElementById('cropper-tabs-container'),
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

  // Step 3 Preview & Download Elements
  previewSection: document.getElementById('preview-section'),
  previewTabsContainer: document.getElementById('preview-tabs-container'),
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
  individualDownloadGrid: document.getElementById('individual-download-grid'),
  btnDlVideo1: document.getElementById('btn-dl-video-1'),
  btnDlVideo2: document.getElementById('btn-dl-video-2'),
  btnDlVideo3: document.getElementById('btn-dl-video-3'),
  btnDownloadPhoto: document.getElementById('btn-download-photo'),

  // Processing Modal Elements
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
  renderSelectedPhotosUI();
});

function initCanvases() {
  state.previewCanvas = el.previewCanvas;
  if (state.previewCanvas) {
    state.previewCtx = state.previewCanvas.getContext('2d');
    state.previewCanvas.width = state.canvasSize.width;
    state.previewCanvas.height = state.canvasSize.height;
  }

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
    'assets/videos/twibbon ppkkmb 2026 (3).mp4',
    'twibbon ppkkmb 2026 (3).mp4'
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
  if (el.fileInput) {
    el.fileInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files.length > 0) {
        handleIncomingFiles(Array.from(e.target.files));
      }
      e.target.value = '';
    });
  }

  if (el.slotInputExtra) {
    el.slotInputExtra.addEventListener('change', function(e) {
      if (e.target.files && e.target.files.length > 0) {
        handleIncomingFiles(Array.from(e.target.files));
      }
      e.target.value = '';
    });
  }

  if (el.slotReplaceInput) {
    el.slotReplaceInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0] && state.replaceTargetIndex >= 0) {
        replaceSinglePhoto(state.replaceTargetIndex, e.target.files[0]);
      }
      e.target.value = '';
    });
  }

  if (el.btnInitialAddExtra) {
    el.btnInitialAddExtra.addEventListener('click', function(e) {
      e.stopPropagation();
      if (el.fileInput) el.fileInput.click();
    });
  }

  if (el.btnAddMorePhotos) {
    el.btnAddMorePhotos.addEventListener('click', function() {
      if (state.photos.length >= 3) {
        Swal.fire({
          icon: 'info',
          title: 'Maksimal 3 Foto',
          text: 'Kamu sudah memilih batas maksimal 3 foto.',
          confirmButtonColor: '#162b3d'
        });
        return;
      }
      if (el.slotInputExtra) el.slotInputExtra.click();
    });
  }

  if (el.btnResetAllPhotos) {
    el.btnResetAllPhotos.addEventListener('click', function() {
      state.photos = [];
      state.activeCropIndex = 0;
      state.activePreviewIndex = 0;
      renderSelectedPhotosUI();
    });
  }

  if (el.btnProceedCrop) {
    el.btnProceedCrop.addEventListener('click', function() {
      if (state.photos.length === 0) return;
      openCropper(0);
    });
  }

  if (el.uploadDropzone) {
    ['dragenter', 'dragover'].forEach(function(eventName) {
      el.uploadDropzone.addEventListener(eventName, function(e) {
        e.preventDefault();
        e.stopPropagation();
        el.uploadDropzone.classList.add('border-[#b69861]', 'bg-slate-50');
      });
    });
    ['dragleave', 'drop'].forEach(function(eventName) {
      el.uploadDropzone.addEventListener(eventName, function(e) {
        e.preventDefault();
        e.stopPropagation();
        el.uploadDropzone.classList.remove('border-[#b69861]', 'bg-slate-50');
      });
    });
    el.uploadDropzone.addEventListener('drop', function(e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleIncomingFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  // Step 2: Cropper Tabs
  el.cropTabs.forEach(function(tab, idx) {
    if (tab) {
      tab.addEventListener('click', function() {
        if (idx < state.photos.length) {
          saveCurrentCropperState();
          openCropper(idx);
        }
      });
    }
  });

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

  if (el.btnCropConfirm) el.btnCropConfirm.addEventListener('click', confirmCropAndProceed);
  if (el.btnReupload) el.btnReupload.addEventListener('click', backToUpload);
  if (el.btnRecrop) el.btnRecrop.addEventListener('click', backToCropper);

  // Step 3: Preview Tabs
  el.previewTabs.forEach(function(tab, idx) {
    if (tab) {
      tab.addEventListener('click', function() {
        if (idx < state.photos.length && state.photos[idx].croppedCanvas) {
          switchPreviewTab(idx);
        }
      });
    }
  });

  if (el.btnPlayPause) el.btnPlayPause.addEventListener('click', togglePreviewPlayback);
  if (el.btnReplay) el.btnReplay.addEventListener('click', restartPreviewPlayback);

  // Download Handlers
  if (el.btnDownloadAllVideos) {
    el.btnDownloadAllVideos.addEventListener('click', function() {
      startBatchVideoExport(null);
    });
  }
  if (el.btnDlVideo1) {
    el.btnDlVideo1.addEventListener('click', function() {
      startBatchVideoExport(0);
    });
  }
  if (el.btnDlVideo2) {
    el.btnDlVideo2.addEventListener('click', function() {
      startBatchVideoExport(1);
    });
  }
  if (el.btnDlVideo3) {
    el.btnDlVideo3.addEventListener('click', function() {
      startBatchVideoExport(2);
    });
  }
  if (el.btnDownloadPhoto) {
    el.btnDownloadPhoto.addEventListener('click', exportStaticPhoto);
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

/* ============================================================
 * PHOTO SELECTION & STEP 1 UI MANAGEMENT
 * ============================================================ */
function handleIncomingFiles(fileList) {
  var validImageFiles = fileList.filter(function(f) {
    return f.type.startsWith('image/');
  });

  if (validImageFiles.length === 0) {
    Swal.fire({
      icon: 'error',
      title: 'Format Salah',
      text: 'Harap pilih file gambar yang valid (JPG, PNG, WEBP).',
      confirmButtonColor: '#162b3d'
    });
    return;
  }

  var availableSlots = 3 - state.photos.length;
  if (availableSlots <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Slot Penuh',
      text: 'Maksimal 3 foto. Hapus salah satu foto jika ingin mengganti.',
      confirmButtonColor: '#162b3d'
    });
    return;
  }

  var filesToAdd = validImageFiles.slice(0, availableSlots);
  var loaded = 0;

  filesToAdd.forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      state.photos.push({
        id: state.photos.length + 1,
        rawSrc: e.target.result,
        fileName: file.name,
        croppedCanvas: null
      });
      loaded++;
      if (loaded === filesToAdd.length) {
        reindexPhotos();
        renderSelectedPhotosUI();
      }
    };
    reader.readAsDataURL(file);
  });
}

function replaceSinglePhoto(index, file) {
  if (!file.type.startsWith('image/')) {
    Swal.fire({
      icon: 'error',
      title: 'Format Salah',
      text: 'Harap pilih file gambar (JPG, PNG, WEBP).',
      confirmButtonColor: '#162b3d'
    });
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    if (state.photos[index]) {
      state.photos[index].rawSrc = e.target.result;
      state.photos[index].fileName = file.name;
      state.photos[index].croppedCanvas = null;
      renderSelectedPhotosUI();
    }
  };
  reader.readAsDataURL(file);
}

function removeSinglePhoto(index) {
  state.photos.splice(index, 1);
  reindexPhotos();
  renderSelectedPhotosUI();
}

function reindexPhotos() {
  state.photos.forEach(function(photo, i) {
    photo.id = i + 1;
  });
}

function triggerReplaceDialog(index) {
  state.replaceTargetIndex = index;
  if (el.slotReplaceInput) el.slotReplaceInput.click();
}

function renderSelectedPhotosUI() {
  var count = state.photos.length;

  if (count === 0) {
    if (el.uploadInitialState) el.uploadInitialState.classList.remove('hidden');
    if (el.uploadSelectedState) el.uploadSelectedState.classList.add('hidden');
    return;
  }

  if (el.uploadInitialState) el.uploadInitialState.classList.add('hidden');
  if (el.uploadSelectedState) el.uploadSelectedState.classList.remove('hidden');

  if (el.photoCountBadge) el.photoCountBadge.textContent = count;
  if (el.btnCropCount) el.btnCropCount.textContent = count;
  if (el.remainingCountBadge) el.remainingCountBadge.textContent = 3 - count;

  if (el.btnAddMorePhotos) {
    if (count < 3) {
      el.btnAddMorePhotos.classList.remove('hidden');
    } else {
      el.btnAddMorePhotos.classList.add('hidden');
    }
  }

  if (el.selectedPhotosGrid) {
    el.selectedPhotosGrid.innerHTML = '';

    state.photos.forEach(function(photo, idx) {
      var isPrimary = idx === 0;
      var card = document.createElement('div');
      card.className = 'border border-slate-200 rounded p-3 bg-slate-50 flex items-center sm:flex-col sm:items-center text-left sm:text-center relative transition-all shadow-sm';

      var badgeText = isPrimary ? 'Foto 1 (Utama)' : ('Foto ' + (idx + 1));
      var badgeColor = isPrimary ? 'bg-[#162b3d] text-[#b69861]' : 'bg-slate-700 text-white';

      card.innerHTML = `
        <div class="relative w-16 h-20 sm:w-24 sm:h-28 flex-shrink-0 border border-slate-300 rounded overflow-hidden bg-black shadow-sm mr-3 sm:mr-0 sm:mb-2">
          <img src="${photo.rawSrc}" class="w-full h-full object-cover">
          <span class="absolute top-1 left-1 text-[9px] font-black px-1.5 py-0.5 rounded ${badgeColor} shadow">
            #${idx + 1}
          </span>
        </div>
        <div class="flex-1 min-w-0 sm:w-full">
          <span class="block text-xs font-black text-[#162b3d] truncate mb-0.5">${badgeText}</span>
          <span class="block text-[11px] text-slate-500 truncate mb-2 max-w-[140px] sm:max-w-none">${photo.fileName || ('foto_' + (idx + 1))}</span>
          <div class="flex items-center space-x-1.5 sm:justify-center">
            <button type="button" class="btn-card-replace text-[11px] font-bold text-[#162b3d] bg-white border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-100 transition-all">
              Ganti
            </button>
            ${!isPrimary ? `
              <button type="button" class="btn-card-remove text-[11px] font-bold text-[#830106] bg-white border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition-all">
                Hapus
              </button>
            ` : `
              <button type="button" class="btn-card-remove text-[11px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-100 transition-all" title="Hapus Foto">
                &times;
              </button>
            `}
          </div>
        </div>
      `;

      var btnReplace = card.querySelector('.btn-card-replace');
      if (btnReplace) {
        btnReplace.addEventListener('click', function(e) {
          e.stopPropagation();
          triggerReplaceDialog(idx);
        });
      }

      var btnRemove = card.querySelector('.btn-card-remove');
      if (btnRemove) {
        btnRemove.addEventListener('click', function(e) {
          e.stopPropagation();
          removeSinglePhoto(idx);
        });
      }

      el.selectedPhotosGrid.appendChild(card);
    });

    if (count < 3) {
      var nextSlotNum = count + 1;
      var addSlot = document.createElement('div');
      addSlot.className = 'border-2 border-dashed border-slate-300 hover:border-[#b69861] p-3 text-center rounded bg-white flex flex-col items-center justify-center min-h-[120px] sm:min-h-[170px] cursor-pointer transition-all';
      addSlot.innerHTML = `
        <div class="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs mb-1.5 border border-slate-200">
          +
        </div>
        <span class="text-xs font-bold text-[#162b3d]">Tambah Foto ${nextSlotNum}</span>
        <span class="text-[10px] text-slate-400 mt-0.5">Bisa sampai 3 foto</span>
        <span class="mt-2 text-[11px] font-bold text-[#b69861] bg-white border border-[#b69861] px-2.5 py-0.5 rounded shadow-sm hover:bg-[#b69861] hover:text-white transition-all">+ Pilih</span>
      `;
      addSlot.addEventListener('click', function() {
        if (el.slotInputExtra) el.slotInputExtra.click();
      });
      el.selectedPhotosGrid.appendChild(addSlot);
    }
  }
}

/* ============================================================
 * STEP 2: CROPPER SECTION
 * ============================================================ */
function openCropper(photoIndex) {
  if (!state.photos[photoIndex]) return;
  state.activeCropIndex = photoIndex;
  setStep(2);

  el.uploadDropzone.classList.add('hidden');
  el.previewSection.classList.add('hidden');
  el.cropperSection.classList.remove('hidden');

  var totalActive = state.photos.length;

  if (totalActive <= 1) {
    if (el.cropperTabsContainer) el.cropperTabsContainer.classList.add('hidden');
  } else {
    if (el.cropperTabsContainer) el.cropperTabsContainer.classList.remove('hidden');
    state.photos.forEach(function(photo, i) {
      var tab = el.cropTabs[i];
      if (tab) {
        tab.classList.remove('hidden');
        if (i === photoIndex) {
          tab.className = 'px-3 py-1.5 text-xs font-bold rounded flex items-center bg-[#162b3d] text-white shadow-sm';
        } else {
          tab.className = 'px-3 py-1.5 text-xs font-bold rounded flex items-center bg-slate-100 text-slate-700 hover:bg-slate-200';
        }
      }
    });
    for (var j = totalActive; j < 3; j++) {
      if (el.cropTabs[j]) el.cropTabs[j].classList.add('hidden');
    }
    if (el.cropIndicatorText) {
      el.cropIndicatorText.textContent = 'Mengatur Foto ' + (photoIndex + 1) + ' dari ' + totalActive;
    }
  }

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
  if (state.cropper && state.photos[state.activeCropIndex]) {
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

  state.photos.forEach(function(photo) {
    if (photo.rawSrc && !photo.croppedCanvas) {
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
  renderSelectedPhotosUI();
}

/* ============================================================
 * STEP 3: PREVIEW & DOWNLOAD SECTION
 * ============================================================ */
function setupPreviewAndDownloadUI() {
  var count = state.photos.length;

  if (count <= 1) {
    if (el.previewTabsContainer) el.previewTabsContainer.classList.add('hidden');
    if (el.individualDownloadGrid) el.individualDownloadGrid.classList.add('hidden');
    if (el.btnDownloadAllText) el.btnDownloadAllText.textContent = 'Download Video Twibbon (MP4)';
  } else {
    if (el.previewTabsContainer) el.previewTabsContainer.classList.remove('hidden');
    if (el.individualDownloadGrid) el.individualDownloadGrid.classList.remove('hidden');
    if (el.btnDownloadAllText) {
      el.btnDownloadAllText.textContent = 'Download Semua Video Sekaligus (' + count + ' Video MP4)';
    }

    state.photos.forEach(function(photo, i) {
      var tab = el.previewTabs[i];
      if (tab) tab.classList.remove('hidden');
    });
    for (var j = count; j < 3; j++) {
      if (el.previewTabs[j]) el.previewTabs[j].classList.add('hidden');
    }

    if (el.btnDlVideo1) el.btnDlVideo1.style.display = count >= 1 ? 'block' : 'none';
    if (el.btnDlVideo2) el.btnDlVideo2.style.display = count >= 2 ? 'block' : 'none';
    if (el.btnDlVideo3) el.btnDlVideo3.style.display = count >= 3 ? 'block' : 'none';
  }
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
 * VIDEO EXPORT ENGINE
 * ============================================================ */
async function startBatchVideoExport(specificIndex) {
  if (state.isRendering) return;

  var targets = [];
  if (specificIndex !== null && specificIndex !== undefined) {
    var p = state.photos[specificIndex];
    if (p && p.croppedCanvas) targets.push(p);
  } else {
    targets = state.photos.filter(function(p) { return p.rawSrc && p.croppedCanvas; });
  }

  if (targets.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Belum Ada Foto',
      text: 'Silakan upload dan atur posisi foto terlebih dahulu.',
      confirmButtonColor: '#162b3d'
    });
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
      if (i < total - 1) {
        await new Promise(function(r) { setTimeout(r, 400); });
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
      html: 'Total <b>' + successCount + ' video MP4</b> telah berhasil dibuat dengan kualitas <b>HD 30fps</b>.',
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
      text: 'Terjadi kendala saat memproses video. Silakan coba kembali.',
      confirmButtonColor: '#162b3d'
    });
  }
}

function renderSinglePhotoVideo(photo, currentIdx, totalCount) {
  return new Promise(function(resolve, reject) {
    updateExportProgress(5, 'Menyiapkan gambar komposisi (Foto ' + photo.id + ')...');

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

    exportCanvas.toBlob(async function(blob) {
      if (!blob) {
        return reject(new Error('Gagal membuat blob gambar'));
      }

      updateExportProgress(15, 'Menghubungkan ke server render (Foto ' + photo.id + ')...');

      var formData = new FormData();
      formData.append('image', blob, 'twibbon_composite_' + photo.id + '.jpg');
      formData.append('holdDuration', state.holdPhotoDuration || 5);

      var curPercent = 15;
      var timer = setInterval(function() {
        if (curPercent < 85) {
          curPercent += Math.floor(Math.random() * 4) + 2;
          if (curPercent > 85) curPercent = 85;
          updateExportProgress(curPercent, 'Memproses Video ' + currentIdx + ' dari ' + totalCount + ' (30fps HD)...');
        }
      }, 350);

      try {
        var response = await fetch('api/render.php', {
          method: 'POST',
          body: formData
        });

        clearInterval(timer);

        if (response.ok && response.headers.get('Content-Type') && response.headers.get('Content-Type').includes('video')) {
          updateExportProgress(95, 'Mengunduh file MP4 Video ' + photo.id + '...');
          var videoBlob = await response.blob();
          var filename = 'Twibbon_PKKMB_LPKIA_Foto_' + photo.id + '_' + Date.now() + '.mp4';
          downloadBlob(videoBlob, filename);
          updateExportProgress(100, 'Selesai Video ' + photo.id + '!');
          return setTimeout(resolve, 300);
        }

        var errMsg = 'Server render fallback';
        try {
          var errJson = await response.json();
          errMsg = errJson.message || errMsg;
        } catch(e) {}
        console.warn('Server render (' + errMsg + '). Beralih ke High-Quality Browser Engine...');

        // Fallback langsung ke Synchronized Browser Engine
        await renderSynchronizedBrowserVideo(photo, exportCanvas, currentIdx, totalCount);
        resolve();

      } catch (err) {
        clearInterval(timer);
        console.warn('Server error (' + err.message + '). Menggunakan Synchronized Browser Engine...');
        try {
          await renderSynchronizedBrowserVideo(photo, exportCanvas, currentIdx, totalCount);
          resolve();
        } catch (clientErr) {
          reject(clientErr);
        }
      }
    }, 'image/jpeg', 0.95);
  });
}

/**
 * Helper to ensure a video element reliably seeks and renders a specific frame
 */
function seekVideoFrame(video, time) {
  return new Promise(function(resolve) {
    var timeout = setTimeout(resolve, 120);
    function onSeeked() {
      clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

/**
 * High-Quality Synchronized Browser Video Engine (Guaranteed Visible Intro Animation + 30fps)
 */
async function renderSynchronizedBrowserVideo(photo, compositeCanvas, currentIdx, totalCount) {
  var width = 1080;
  var height = 1350;
  var fps = 30;
  var introDuration = state.introVideo.duration && !isNaN(state.introVideo.duration) ? state.introVideo.duration : 10.0;
  var holdDuration = state.holdPhotoDuration || 5.0;
  var totalDuration = introDuration + holdDuration;
  var crossfadeDuration = 0.6;
  var fadeStartTime = Math.max(0, introDuration - crossfadeDuration);
  var totalFrames = Math.ceil(totalDuration * fps);

  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Setup synchronous video instance
  var tempVideo = document.createElement('video');
  tempVideo.src = state.introVideo.src;
  tempVideo.crossOrigin = 'anonymous';
  tempVideo.muted = true;
  tempVideo.playsInline = true;
  tempVideo.preload = 'auto';

  await new Promise(function(res) {
    if (tempVideo.readyState >= 2) return res();
    tempVideo.onloadeddata = res;
    tempVideo.oncanplay = res;
    tempVideo.onerror = res;
    setTimeout(res, 2500);
  });

  // Pastikan frame 0 ter-load
  await seekVideoFrame(tempVideo, 0.05);

  // METODE 1: WebCodecs + Mp4Muxer (Deterministic Seeked Frame-by-Frame, Exact 30fps HD MP4)
  if (window.VideoEncoder && window.Mp4Muxer && window.VideoFrame) {
    try {
      updateExportProgress(20, 'Menyiapkan Hardware H.264 30fps (Video ' + currentIdx + ')...');

      var muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: width,
          height: height
        },
        fastStart: 'in-memory'
      });

      var encoder = new VideoEncoder({
        output: function(chunk, meta) {
          muxer.addVideoChunk(chunk, meta);
        },
        error: function(e) {
          console.error('WebCodecs Error:', e);
        }
      });

      encoder.configure({
        codec: 'avc1.420028',
        width: width,
        height: height,
        bitrate: 6000000,
        framerate: fps
      });

      for (var f = 0; f < totalFrames; f++) {
        var time = f / fps;

        if (time < introDuration) {
          var seekTarget = Math.min(time, Math.max(0, introDuration - 0.04));
          await seekVideoFrame(tempVideo, seekTarget);
        }

        ctx.fillStyle = '#162b3d';
        ctx.fillRect(0, 0, width, height);

        if (time < fadeStartTime) {
          drawCoverMedia(ctx, tempVideo, width, height);
        } else if (time >= fadeStartTime && time < introDuration) {
          drawCoverMedia(ctx, tempVideo, width, height);
          var progress = (time - fadeStartTime) / crossfadeDuration;
          ctx.save();
          ctx.globalAlpha = Math.min(1, Math.max(0, progress));
          ctx.drawImage(compositeCanvas, 0, 0, width, height);
          ctx.restore();
        } else {
          ctx.drawImage(compositeCanvas, 0, 0, width, height);
        }

        var frameDurationMicro = Math.round((1 / fps) * 1000000);
        var timestampMicro = Math.round(time * 1000000);

        var videoFrame = new VideoFrame(canvas, {
          timestamp: timestampMicro,
          duration: frameDurationMicro
        });

        var isKeyFrame = f % 60 === 0;
        encoder.encode(videoFrame, { keyFrame: isKeyFrame });
        videoFrame.close();

        if (f % 5 === 0) {
          var pct = Math.min(95, Math.floor(20 + (f / totalFrames) * 75));
          updateExportProgress(pct, 'Merender frame ' + (f + 1) + ' / ' + totalFrames + ' (30fps HD)...');
          await new Promise(function(r) { setTimeout(r, 0); });
        }
      }

      updateExportProgress(96, 'Menyelesaikan file MP4...');
      await encoder.flush();
      muxer.finalize();

      var buffer = muxer.target.buffer;
      var finalBlob = new Blob([buffer], { type: 'video/mp4' });
      var filename = 'Twibbon_PKKMB_LPKIA_Foto_' + photo.id + '_' + Date.now() + '.mp4';
      downloadBlob(finalBlob, filename);
      updateExportProgress(100, 'Selesai Video ' + photo.id + '!');
      return;

    } catch (webCodecsErr) {
      console.warn('WebCodecs execution fallback to Synchronized MediaRecorder:', webCodecsErr);
    }
  }

  // METODE 2: Synchronized Real-Time Playback Capture (Guaranteed Smooth Playback & Accurate Video Frames)
  return new Promise(async function(resolve, reject) {
    updateExportProgress(20, 'Merender video twibbon di browser (Foto ' + photo.id + ')...');

    var stream = canvas.captureStream(30);
    var options = { mimeType: 'video/mp4' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 6000000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };

    var recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch(e) {
      return reject(new Error('Browser tidak mendukung MediaRecorder'));
    }

    var chunks = [];
    recorder.ondataavailable = function(e) {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = function() {
      var blob = new Blob(chunks, { type: options.mimeType });
      var filename = 'Twibbon_PKKMB_LPKIA_Foto_' + photo.id + '_' + Date.now() + '.mp4';
      downloadBlob(blob, filename);
      updateExportProgress(100, 'Selesai Video ' + photo.id + '!');
      setTimeout(resolve, 300);
    };

    // Reset video ke awal
    tempVideo.currentTime = 0;
    await seekVideoFrame(tempVideo, 0.02);

    recorder.start(100);
    tempVideo.play().catch(function() {});

    var startTime = performance.now();

    function renderLoop() {
      var now = performance.now();
      var time = (now - startTime) / 1000;

      if (time >= totalDuration) {
        tempVideo.pause();
        recorder.stop();
        return;
      }

      ctx.fillStyle = '#162b3d';
      ctx.fillRect(0, 0, width, height);

      if (time < fadeStartTime) {
        drawCoverMedia(ctx, tempVideo, width, height);
      } else if (time >= fadeStartTime && time < introDuration) {
        drawCoverMedia(ctx, tempVideo, width, height);
        var progress = (time - fadeStartTime) / crossfadeDuration;
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0, progress));
        ctx.drawImage(compositeCanvas, 0, 0, width, height);
        ctx.restore();
      } else {
        ctx.drawImage(compositeCanvas, 0, 0, width, height);
      }

      var pct = Math.min(95, Math.floor(20 + (time / totalDuration) * 75));
      updateExportProgress(pct, 'Memproses video ' + time.toFixed(1) + 's / ' + totalDuration.toFixed(1) + 's...');

      requestAnimationFrame(renderLoop);
    }

    requestAnimationFrame(renderLoop);
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
