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

// CONCURRENCY LIMITER: Maksimal 2 proses FFmpeg bersamaan (Anti-Server Down)
$maxConcurrent = 2;
$lockDir = $tempDir . '/twib_locks';
if (!is_dir($lockDir)) {
    @mkdir($lockDir, 0777, true);
}

$lockAcquired = false;
$lockFp = null;
$maxWaitSeconds = 60; // Batas tunggu antrean 60 detik
$waitStart = time();

while ((time() - $waitStart) < $maxWaitSeconds) {
    for ($slot = 1; $slot <= $maxConcurrent; $slot++) {
        $lockFile = $lockDir . '/slot_' . $slot . '.lock';
        $fp = @fopen($lockFile, 'c+');
        if ($fp && @flock($fp, LOCK_EX | LOCK_NB)) {
            $lockAcquired = true;
            $lockFp = $fp;
            break 2;
        }
        if ($fp) @fclose($fp);
    }
    usleep(300000); // Istirahat 300ms lalu cek slot lagi
}

if (!$lockAcquired) {
    http_response_code(429);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Antrean server sedang sangat padat. Mohon tunggu 5 detik lalu klik unduh kembali.'
    ]);
    exit;
}

// Pastikan lock selalu dilepas saat script selesai (shutdown handler)
register_shutdown_function(function() use (&$lockFp) {
    if ($lockFp) {
        @flock($lockFp, LOCK_UN);
        @fclose($lockFp);
        $lockFp = null;
    }
});

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
$totalDuration = round($fadeOffset + $holdDuration + $crossfadeDuration, 2); // 15.0s

// 6. Jalankan FFmpeg dengan Multi-Level Fallback Engine
// Method 1: High-Definition XFade Transition + Audio Synchronization
$filterMethod1 = sprintf(
    '"[0:v]scale=1080:1350,setsar=1,format=yuv420p,settb=AVTB[v0];[1:v]scale=1080:1350,setsar=1,format=yuv420p,settb=AVTB[v1];[v0][v1]xfade=transition=fade:duration=%.2f:offset=%.2f[v];[0:a]apad[a]"',
    $crossfadeDuration,
    $fadeOffset
);

$cmdMethod1 = sprintf(
    '%s -y -i %s -loop 1 -framerate 30 -i %s -filter_complex %s -map "[v]" -map "[a]" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset ultrafast -crf 23 -r 30 -c:a aac -b:a 128k -ar 44100 -t %.2f -movflags +faststart %s 2>&1',
    escapeshellcmd($ffmpeg),
    escapeshellarg($introVideo),
    escapeshellarg($tempPhotoPath),
    $filterMethod1,
    $totalDuration,
    escapeshellarg($tempVideoPath)
);

$output1 = [];
$returnVar1 = 0;
exec($cmdMethod1, $output1, $returnVar1);

$renderSuccess = ($returnVar1 === 0 && file_exists($tempVideoPath) && filesize($tempVideoPath) > 1000);

// Method 2: XFade Transition Video-Only (jika audio stream pada input 0 bermasalah)
$output2 = [];
if (!$renderSuccess) {
    $filterMethod2 = sprintf(
        '"[0:v]scale=1080:1350,setsar=1,format=yuv420p,settb=AVTB[v0];[1:v]scale=1080:1350,setsar=1,format=yuv420p,settb=AVTB[v1];[v0][v1]xfade=transition=fade:duration=%.2f:offset=%.2f[v]"',
        $crossfadeDuration,
        $fadeOffset
    );

    $cmdMethod2 = sprintf(
        '%s -y -i %s -loop 1 -framerate 30 -i %s -filter_complex %s -map "[v]" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset ultrafast -crf 23 -r 30 -t %.2f -movflags +faststart %s 2>&1',
        escapeshellcmd($ffmpeg),
        escapeshellarg($introVideo),
        escapeshellarg($tempPhotoPath),
        $filterMethod2,
        $totalDuration,
        escapeshellarg($tempVideoPath)
    );

    $returnVar2 = 0;
    exec($cmdMethod2, $output2, $returnVar2);
    $renderSuccess = ($returnVar2 === 0 && file_exists($tempVideoPath) && filesize($tempVideoPath) > 1000);
}

// Method 3: Concat Filter Fallback (dijamin support 100% di semua versi FFmpeg lama/baru)
$output3 = [];
if (!$renderSuccess) {
    $filterMethod3 = '"[0:v]scale=1080:1350,setsar=1,format=yuv420p[v0];[1:v]scale=1080:1350,setsar=1,format=yuv420p[v1];[v0][v1]concat=n=2:v=1:a=0[v];[0:a]apad[a]"';

    $cmdMethod3 = sprintf(
        '%s -y -i %s -loop 1 -framerate 30 -i %s -filter_complex %s -map "[v]" -map "[a]" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -preset ultrafast -crf 23 -r 30 -t %.2f -movflags +faststart %s 2>&1',
        escapeshellcmd($ffmpeg),
        escapeshellarg($introVideo),
        escapeshellarg($tempPhotoPath),
        $filterMethod3,
        $introDuration + $holdDuration,
        escapeshellarg($tempVideoPath)
    );

    $returnVar3 = 0;
    exec($cmdMethod3, $output3, $returnVar3);
    $renderSuccess = ($returnVar3 === 0 && file_exists($tempVideoPath) && filesize($tempVideoPath) > 1000);
}

if (!$renderSuccess) {
    @unlink($tempPhotoPath);
    @unlink($tempVideoPath);

    $allLogs = array_filter(array_merge($output1, $output2, $output3));
    $lastErrorLines = array_slice($allLogs, -4);

    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Gagal merender video: ' . implode(' | ', $lastErrorLines),
        'debug' => $allLogs
    ]);
    exit;
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
