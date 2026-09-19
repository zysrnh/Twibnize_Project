<?php
/**
 * Server-Side Video Rendering Engine with FFmpeg
 * Twibbon Video Maker - PKKMB SADAJIWA IDE LPKIA 2026
 * 
 * Endpoint: /api/render.php (POST)
 */

// Tingkatkan batas resource untuk proses video encoding
@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '180');
@set_time_limit(180);

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Hanya menerima request POST']);
    exit;
}

// 1. Cari binary FFmpeg
function getFfmpegBinary() {
    $candidates = [
        '/home/iieygoez/bin/ffmpeg',
        (getenv('HOME') ?: '') . '/bin/ffmpeg',
        (isset($_SERVER['HOME']) ? $_SERVER['HOME'] : '') . '/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        'ffmpeg'
    ];
    foreach ($candidates as $bin) {
        if (!empty($bin)) {
            $output = @shell_exec(escapeshellcmd($bin) . ' -version 2>&1');
            if ($output && stripos($output, 'ffmpeg version') !== false) {
                return $bin;
            }
        }
    }
    return null;
}

$ffmpeg = getFfmpegBinary();
if (!$ffmpeg) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'FFmpeg binary tidak ditemukan di server (/home/iieygoez/bin/ffmpeg).'
    ]);
    exit;
}

// 2. Cari file video intro (Framenaur.mp4)
$introCandidates = [
    realpath(__DIR__ . '/../assets/videos/Framenaur.mp4'),
    realpath(__DIR__ . '/../assets/Framenaur.mp4'),
    realpath(__DIR__ . '/../Framenaur.mp4')
];
$introVideo = null;
foreach ($introCandidates as $candidate) {
    if ($candidate && file_exists($candidate) && filesize($candidate) > 1000) {
        $introVideo = $candidate;
        break;
    }
}

if (!$introVideo) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'File intro video (Framenaur.mp4) tidak ditemukan di server.'
    ]);
    exit;
}

// 3. Siapkan folder temporary
$tempDir = sys_get_temp_dir();
if (!is_writable($tempDir)) {
    $tempDir = __DIR__ . '/../assets/cache';
    if (!is_dir($tempDir)) {
        @mkdir($tempDir, 0777, true);
    }
}

$uniqueId = bin2hex(random_bytes(8));
$tempPhotoPath = $tempDir . '/twib_in_' . $uniqueId . '.jpg';
$tempVideoPath = $tempDir . '/twib_out_' . $uniqueId . '.mp4';

// 4. Ambil gambar yang di-upload (bisa multipart file, base64, atau raw binary)
$imageSaved = false;

if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $imageSaved = move_uploaded_file($_FILES['image']['tmp_name'], $tempPhotoPath);
} elseif (!empty($_POST['image'])) {
    $raw = $_POST['image'];
    if (strpos($raw, 'base64,') !== false) {
        $raw = explode('base64,', $raw)[1];
    }
    $decoded = base64_decode($raw);
    if ($decoded !== false) {
        $imageSaved = file_put_contents($tempPhotoPath, $decoded) !== false;
    }
} else {
    // Coba baca dari raw php://input
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        if (strpos($rawInput, 'base64,') !== false) {
            $rawInput = explode('base64,', $rawInput)[1];
            $decoded = base64_decode($rawInput);
            if ($decoded !== false) {
                $imageSaved = file_put_contents($tempPhotoPath, $decoded) !== false;
            }
        } else {
            // Raw binary JPG/PNG
            $imageSaved = file_put_contents($tempPhotoPath, $rawInput) !== false;
        }
    }
}

if (!$imageSaved || !file_exists($tempPhotoPath) || filesize($tempPhotoPath) < 100) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Gagal menerima gambar twibbon yang valid.']);
    exit;
}

// 5. Parameter video
$holdDuration = isset($_POST['holdDuration']) ? floatval($_POST['holdDuration']) : 5.0;
if ($holdDuration <= 0 || $holdDuration > 30) $holdDuration = 5.0;

$introDuration = 10.0;
$crossfadeDuration = 0.6;
$fadeOffset = round($introDuration - $crossfadeDuration, 2); // 9.4s
$photoDuration = round($holdDuration + $crossfadeDuration, 2); // 5.6s
$totalDuration = round($fadeOffset + $photoDuration, 2); // 15.0s

// 6. Jalankan FFmpeg dengan timebase synchronization (settb=AVTB)
// Percobaan 1: Dengan Audio
$filterWithAudio = sprintf(
    '"[0:v]settb=AVTB[v0];[1:v]settb=AVTB[v1];[v0][v1]xfade=transition=fade:duration=%.2f:offset=%.2f[v];[0:a]apad=whole_dur=%.2f[a]"',
    $crossfadeDuration,
    $fadeOffset,
    $totalDuration
);

$cmd = sprintf(
    '%s -y -i %s -loop 1 -t %.2f -framerate 30 -i %s -filter_complex %s -map "[v]" -map "[a]" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -c:a aac -b:a 128k -ar 44100 -movflags +faststart %s 2>&1',
    escapeshellcmd($ffmpeg),
    escapeshellarg($introVideo),
    $photoDuration,
    escapeshellarg($tempPhotoPath),
    $filterWithAudio,
    escapeshellarg($tempVideoPath)
);

$output = [];
$returnVar = 0;
exec($cmd, $output, $returnVar);

// Jika gagal, coba render video-only dengan sinkronisasi timebase
if ($returnVar !== 0 || !file_exists($tempVideoPath) || filesize($tempVideoPath) < 1000) {
    $filterVideoOnly = sprintf(
        '"[0:v]settb=AVTB[v0];[1:v]settb=AVTB[v1];[v0][v1]xfade=transition=fade:duration=%.2f:offset=%.2f[v]"',
        $crossfadeDuration,
        $fadeOffset
    );

    $cmdFallback = sprintf(
        '%s -y -i %s -loop 1 -t %.2f -framerate 30 -i %s -filter_complex %s -map "[v]" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -movflags +faststart %s 2>&1',
        escapeshellcmd($ffmpeg),
        escapeshellarg($introVideo),
        $photoDuration,
        escapeshellarg($tempPhotoPath),
        $filterVideoOnly,
        escapeshellarg($tempVideoPath)
    );

    $outputFallback = [];
    $returnVarFallback = 0;
    exec($cmdFallback, $outputFallback, $returnVarFallback);

    if ($returnVarFallback !== 0 || !file_exists($tempVideoPath) || filesize($tempVideoPath) < 1000) {
        // Hapus file temporary photo
        @unlink($tempPhotoPath);
        @unlink($tempVideoPath);

        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Gagal merender video dengan FFmpeg.',
            'debug' => array_merge($output, $outputFallback)
        ]);
        exit;
    }
}

// 7. Berhasil! Kirim video MP4 ke browser pengguna
@unlink($tempPhotoPath); // Hapus foto sementara

$filename = 'Twibbon_PKKMB_LPKIA_' . date('Ymd_His') . '.mp4';
$fileSize = filesize($tempVideoPath);

header('Content-Type: video/mp4');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . $fileSize);
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Stream file ke output buffer
$fp = fopen($tempVideoPath, 'rb');
if ($fp) {
    while (!feof($fp)) {
        echo fread($fp, 65536); // buffer 64KB
        flush();
    }
    fclose($fp);
} else {
    readfile($tempVideoPath);
}

// Hapus file video sementara setelah selesai dikirim
@unlink($tempVideoPath);
exit;
