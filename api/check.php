<?php
/**
 * Diagnostic Tool - Server Capability Check for Twibbon Video Generator
 * URL: /api/check.php
 */

header('Content-Type: text/html; charset=utf-8');

function findFfmpegDetails() {
    $candidates = [];

    // Deteksi user home
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

    $candidates[] = realpath(__DIR__ . '/../bin/ffmpeg');
    $candidates[] = realpath(__DIR__ . '/bin/ffmpeg');
    $candidates[] = '/usr/bin/ffmpeg';
    $candidates[] = '/usr/local/bin/ffmpeg';
    $candidates[] = '/bin/ffmpeg';
    $candidates[] = '/opt/ffmpeg/ffmpeg';
    $candidates[] = '/snap/bin/ffmpeg';
    $candidates[] = 'ffmpeg';

    $candidates = array_unique(array_filter($candidates));

    $foundPath = null;
    $version = null;
    $scannedLogs = [];

    foreach ($candidates as $bin) {
        $checkCmd = escapeshellcmd($bin) . ' -version 2>&1';
        $output = @shell_exec($checkCmd);
        if ($output && stripos($output, 'ffmpeg version') !== false) {
            $foundPath = $bin;
            $version = trim(explode("\n", $output)[0]);
            $scannedLogs[] = "[OK] " . htmlspecialchars($bin);
            break;
        } else {
            $scannedLogs[] = "[MISSING / NO ACCESS] " . htmlspecialchars($bin);
        }
    }

    return [
        'path' => $foundPath,
        'version' => $version,
        'candidates' => $scannedLogs
    ];
}

$disabled_funcs = array_map('trim', explode(',', (string)ini_get('disable_functions')));
$exec_enabled = function_exists('exec') && !in_array('exec', $disabled_funcs);
$shell_exec_enabled = function_exists('shell_exec') && !in_array('shell_exec', $disabled_funcs);
$ffmpeg_info = ($exec_enabled || $shell_exec_enabled) ? findFfmpegDetails() : null;

$cache_dir = realpath(__DIR__ . '/../assets') ? realpath(__DIR__ . '/../assets') . '/cache' : __DIR__ . '/cache';
if (!is_dir($cache_dir)) {
    @mkdir($cache_dir, 0777, true);
}
$cache_writable = is_dir($cache_dir) && is_writable($cache_dir);

$intro_video_path = realpath(__DIR__ . '/../assets/videos/Framenaur.mp4');
if (!$intro_video_path || !file_exists($intro_video_path)) {
    $intro_video_path = realpath(__DIR__ . '/../assets/videos/twibbon ppkkmb 2026 (3).mp4');
}
$video_exists = $intro_video_path && file_exists($intro_video_path);

?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnostic Twibbon Video Server</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1329; color: #f8fafc; padding: 2rem 1rem; margin: 0; }
        .container { max-width: 760px; margin: 0 auto; background: #162238; border-radius: 12px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #233554; }
        h1 { margin-top: 0; font-size: 1.4rem; color: #38bdf8; border-bottom: 1px solid #233554; padding-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
        .item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #1e2e4a; font-size: 0.95rem; }
        .badge { padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; }
        .badge-success { background: #15803d; color: #fff; }
        .badge-danger { background: #b91c1c; color: #fff; }
        .badge-info { background: #0369a1; color: #fff; }
        .badge-warning { background: #d97706; color: #fff; }
        pre { background: #070d19; padding: 14px; border-radius: 8px; overflow-x: auto; font-size: 0.8rem; color: #a5f3fc; border: 1px solid #1e293b; line-height: 1.5; }
        .note-box { background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; padding: 12px 16px; border-radius: 4px; margin-top: 20px; font-size: 0.85rem; color: #cbd5e1; }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            <span>Diagnostic Server Twibbon Video</span>
            <span style="font-size:0.8rem; font-weight:normal; color:#94a3b8;"><?= date('d M Y H:i:s') ?></span>
        </h1>
        
        <div class="item">
            <span>PHP Exec Function</span>
            <span class="badge <?= $exec_enabled ? 'badge-success' : 'badge-danger' ?>">
                <?= $exec_enabled ? 'AKTIF' : 'DIBLOKIR' ?>
            </span>
        </div>

        <div class="item">
            <span>PHP Shell_Exec Function</span>
            <span class="badge <?= $shell_exec_enabled ? 'badge-success' : 'badge-danger' ?>">
                <?= $shell_exec_enabled ? 'AKTIF' : 'DIBLOKIR' ?>
            </span>
        </div>

        <div class="item">
            <span>FFmpeg Status</span>
            <span class="badge <?= ($ffmpeg_info && $ffmpeg_info['path']) ? 'badge-success' : 'badge-danger' ?>">
                <?= ($ffmpeg_info && $ffmpeg_info['path']) ? 'TERSEDIA' : 'TIDAK DITEMUKAN' ?>
            </span>
        </div>

        <?php if ($ffmpeg_info && $ffmpeg_info['path']): ?>
        <div class="item">
            <span>FFmpeg Active Path</span>
            <code style="color:#38bdf8; font-weight:bold;"><?= htmlspecialchars($ffmpeg_info['path']) ?></code>
        </div>
        <div style="margin-top:12px;">
            <span style="font-size:0.85rem; color:#94a3b8;">Versi Binary Aktif:</span>
            <pre><?= htmlspecialchars($ffmpeg_info['version']) ?></pre>
        </div>
        <?php endif; ?>

        <div class="item">
            <span>Folder Cache (assets/cache/)</span>
            <span class="badge <?= $cache_writable ? 'badge-success' : 'badge-danger' ?>">
                <?= $cache_writable ? 'WRITABLE (BISA MENULIS)' : 'TIDAK DAPAT DITULIS' ?>
            </span>
        </div>

        <div class="item">
            <span>File Video Template Intro</span>
            <span class="badge <?= $video_exists ? 'badge-success' : 'badge-danger' ?>">
                <?= $video_exists ? 'ADA (' . round(filesize($intro_video_path) / 1048576, 2) . ' MB)' : 'TIDAK DITEMUKAN' ?>
            </span>
        </div>

        <div class="item">
            <span>Memory Limit / Timeout</span>
            <span class="badge badge-info"><?= ini_get('memory_limit') ?> / <?= ini_get('max_execution_time') ?>s</span>
        </div>

        <div style="margin-top:16px;">
            <span style="font-size:0.85rem; color:#94a3b8;">Log Lokasi FFmpeg yang Dipindai:</span>
            <pre><?php
                if ($ffmpeg_info && !empty($ffmpeg_info['candidates'])) {
                    echo implode("\n", $ffmpeg_info['candidates']);
                } else {
                    echo "Pencarian binary FFmpeg tidak dapat dijalankan karena fungsi shell_exec / exec dinonaktifkan.";
                }
            ?></pre>
        </div>

        <div class="note-box">
            💡 <b>Catatan:</b> Jika FFmpeg tidak terdeteksi di server, generator web secara otomatis menggunakan <b>Client-Side Canvas Engine (MediaRecorder 30fps)</b> di browser sehingga pengguna tetap bisa mengunduh video twibbon MP4/WebM tanpa error.
        </div>

        <p style="margin-top:24px; font-size:0.8rem; color:#64748b; text-align:center;">
            Twibbon Video Generator &copy; 2026 PKKMB SADAJIWA IDE LPKIA
        </p>
    </div>
</body>
</html>
