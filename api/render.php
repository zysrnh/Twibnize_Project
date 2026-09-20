<?php
/**
 * Server-Side Video Rendering Engine with FFmpeg
 * Twibbon Video Maker - PKKMB SADAJIWA IDE LPKIA 2026
 * 
 * Endpoint: /api/render.php (POST)
 */

// Tingkatkan batas resource untuk proses video encoding
@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '300');
@set_time_limit(300);

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

// 1. Fungsi Pencarian Binary FFmpeg Secara Dinamis
function getFfmpegBinary() {
    $candidates = [];

    // Deteksi user home dari path file saat ini & Document Root (cPanel / DirectAdmin / VPS)
    $pathsToInspect = [__DIR__, isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : ''];
    foreach ($pathsToInspect as $p) {
        if (!empty($p) && preg_match('#^(/home[0-9]*/[^/]+)#', $p, $matches)) {
            $userHome = rtrim($matches[1], '/');
            $candidates[] = $userHome . '/bin/ffmpeg';
            $candidates[] = $userHome . '/ffmpeg';
            $candidates[] = $userHome . '/.local/bin/ffmpeg';
        }
    }

    if (!empty($_SERVER['HOME'])) {
        $home = rtrim($_SERVER['HOME'], '/');
        $candidates[] = $home . '/bin/ffmpeg';
        $candidates[] = $home . '/ffmpeg';
    }
    if (getenv('HOME')) {
        $home = rtrim(getenv('HOME'), '/');
        $candidates[] = $home . '/bin/ffmpeg';
        $candidates[] = $home . '/ffmpeg';
    }

    // Path folder relatif dari project
    $candidates[] = realpath(__DIR__ . '/../bin/ffmpeg');
    $candidates[] = realpath(__DIR__ . '/bin/ffmpeg');

    // Path sistem Linux / Server standar
    $candidates[] = '/usr/bin/ffmpeg';
    $candidates[] = '/usr/local/bin/ffmpeg';
    $candidates[] = '/bin/ffmpeg';
    $candidates[] = '/opt/ffmpeg/ffmpeg';
    $candidates[] = '/snap/bin/ffmpeg';
    $candidates[] = 'ffmpeg';

    // Cek masing-masing path
    foreach ($candidates as $bin) {
        if (!empty($bin)) {
            $checkCmd = escapeshellcmd($bin) . ' -version 2>&1';
            $output = @shell_exec($checkCmd);
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
        'message' => 'FFmpeg binary tidak ditemukan di server. Pastikan ffmpeg terpasang di ~/bin/ffmpeg atau /usr/bin/ffmpeg.'
    ]);
    exit;
}

// 2. Cari File Template Video Intro (Framenaur.mp4)
$introCandidates = [
    realpath(__DIR__ . '/../assets/videos/Framenaur.mp4'),
    realpath(__DIR__ . '/../assets/Framenaur.mp4'),
    realpath(__DIR__ . '/../Framenaur.mp4'),
    realpath(__DIR__ . '/../assets/videos/twibbon ppkkmb 2026 (3).mp4'),
    realpath(__DIR__ . '/../twibbon ppkkmb 2026 (3).mp4')
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
        'message' => 'File video template intro (Framenaur.mp4) tidak ditemukan di folder assets/videos/.'
    ]);
    exit;
}

// 3. Siapkan Folder Temporary & Cache Lokal
$cacheDir = realpath(__DIR__ . '/../assets') ? realpath(__DIR__ . '/../assets') . '/cache' : __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0777, true);
}

$tempDir = is_writable($cacheDir) ? $cacheDir : sys_get_temp_dir();

// Concurrency Limiter: Maksimal 2 proses FFmpeg aktif bersamaan
$maxConcurrent = 2;
$lockDir = $tempDir . '/twib_locks';
if (!is_dir($lockDir)) {
    @mkdir($lockDir, 0777, true);
}

$lockAcquired = false;
$lockFp = null;
$maxWaitSeconds = 45;
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
    usleep(300000); // Tunggu 300ms
}

if (!$lockAcquired) {
    http_response_code(429);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Antrean render server sedang padat. Silakan coba kembali dalam beberapa detik.'
    ]);
    exit;
}

// Pastikan lock file selalu dilepas saat script selesai
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

// 4. Tangani File Gambar dari Client
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
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        if (strpos($rawInput, 'base64,') !== false) {
            $rawInput = explode('base64,', $rawInput)[1];
            $decoded = base64_decode($rawInput);
            if ($decoded !== false) {
                $imageSaved = file_put_contents($tempPhotoPath, $decoded) !== false;
            }
        } else {
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

// 5. Cek Durasi dan Audio Stream dari Video Template
function inspectMedia($ffmpegBin, $mediaPath) {
    $info = ['duration' => 10.0, 'hasAudio' => false];
    $cmd = escapeshellcmd($ffmpegBin) . ' -i ' . escapeshellarg($mediaPath) . ' 2>&1';
    $output = @shell_exec($cmd);
    if ($output) {
        // Cek durasi (contoh: Duration: 00:00:10.20)
        if (preg_match('/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/', $output, $m)) {
            $info['duration'] = ($m[1] * 3600) + ($m[2] * 60) + floatval($m[3]);
        }
        // Cek stream audio
        if (stripos($output, 'Audio:') !== false || stripos($output, 'Stream #0:1') !== false || stripos($output, 'Stream #0:0(und): Audio') !== false) {
            $info['hasAudio'] = true;
        }
    }
    return $info;
}

$mediaInfo = inspectMedia($ffmpeg, $introVideo);
$introDuration = max(2.0, floatval($mediaInfo['duration']));
$hasAudio = $mediaInfo['hasAudio'];

// Parameter durasi
$holdDuration = isset($_POST['holdDuration']) ? floatval($_POST['holdDuration']) : 5.0;
if ($holdDuration <= 0 || $holdDuration > 30) $holdDuration = 5.0;

$crossfadeDuration = 0.6;
if ($introDuration <= $crossfadeDuration) {
    $crossfadeDuration = max(0.2, $introDuration * 0.2);
}

$fadeOffset = max(0.0, round($introDuration - $crossfadeDuration, 2));
$photoDuration = round($holdDuration + $crossfadeDuration, 2);
$totalDuration = round($fadeOffset + $photoDuration, 2);

// 6. Eksekusi FFmpeg Encoding
// Normalisasi resolusi ke 1080x1350 dan framerate 30fps sebelum xfade
$filterVideo = sprintf(
    '[0:v]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,setsar=1,fps=30,settb=AVTB,format=yuv420p[v0];' .
    '[1:v]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,setsar=1,fps=30,settb=AVTB,format=yuv420p[v1];' .
    '[v0][v1]xfade=transition=fade:duration=%.2f:offset=%.2f[v]',
    $crossfadeDuration,
    $fadeOffset
);

if ($hasAudio) {
    $filterComplex = sprintf('%s;[0:a]apad=whole_dur=%.2f[a]', $filterVideo, $totalDuration);
    $cmd = sprintf(
        '%s -y -i %s -loop 1 -t %.2f -framerate 30 -i %s -filter_complex %s -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -c:a aac -b:a 128k -ar 44100 -movflags +faststart %s 2>&1',
        escapeshellcmd($ffmpeg),
        escapeshellarg($introVideo),
        $photoDuration,
        escapeshellarg($tempPhotoPath),
        escapeshellarg($filterComplex),
        escapeshellarg($tempVideoPath)
    );
} else {
    $cmd = sprintf(
        '%s -y -i %s -loop 1 -t %.2f -framerate 30 -i %s -filter_complex %s -map "[v]" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -movflags +faststart %s 2>&1',
        escapeshellcmd($ffmpeg),
        escapeshellarg($introVideo),
        $photoDuration,
        escapeshellarg($tempPhotoPath),
        escapeshellarg($filterVideo),
        escapeshellarg($tempVideoPath)
    );
}

$output = [];
$returnVar = 0;
exec($cmd, $output, $returnVar);

// Fallback jika mode audio gagal
if ($returnVar !== 0 || !file_exists($tempVideoPath) || filesize($tempVideoPath) < 1000) {
    $cmdFallback = sprintf(
        '%s -y -i %s -loop 1 -t %.2f -framerate 30 -i %s -filter_complex %s -map "[v]" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 -r 30 -movflags +faststart %s 2>&1',
        escapeshellcmd($ffmpeg),
        escapeshellarg($introVideo),
        $photoDuration,
        escapeshellarg($tempPhotoPath),
        escapeshellarg($filterVideo),
        escapeshellarg($tempVideoPath)
    );

    $outputFallback = [];
    $returnVarFallback = 0;
    exec($cmdFallback, $outputFallback, $returnVarFallback);

    if ($returnVarFallback !== 0 || !file_exists($tempVideoPath) || filesize($tempVideoPath) < 1000) {
        @unlink($tempPhotoPath);
        @unlink($tempVideoPath);

        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Gagal merender video dengan FFmpeg di server.',
            'debug' => array_merge($output, $outputFallback)
        ]);
        exit;
    }
}

// 7. Berhasil! Kirim Video MP4 ke Browser
@unlink($tempPhotoPath);

$filename = 'Twibbon_PKKMB_LPKIA_' . date('Ymd_His') . '.mp4';
$fileSize = filesize($tempVideoPath);

header('Content-Type: video/mp4');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . $fileSize);
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$fp = @fopen($tempVideoPath, 'rb');
if ($fp) {
    while (!feof($fp)) {
        echo fread($fp, 65536);
        flush();
    }
    @fclose($fp);
} else {
    readfile($tempVideoPath);
}

@unlink($tempVideoPath);
exit;
