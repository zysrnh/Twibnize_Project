<?php
/**
 * Diagnostic Tool - Server Capability Check for Twibbon Video Generator
 * URL: /api/check.php
 */

header('Content-Type: text/html; charset=utf-8');

function findFfmpeg() {
    $candidates = [
        '/home/iieygoez/bin/ffmpeg',
        (getenv('HOME') ?: '') . '/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        'ffmpeg'
    ];
    foreach ($candidates as $bin) {
        if (!empty($bin)) {
            $output = @shell_exec(escapeshellcmd($bin) . ' -version 2>&1');
            if ($output && stripos($output, 'ffmpeg version') !== false) {
                return ['path' => $bin, 'version' => trim(explode("\n", $output)[0])];
            }
        }
    }
    return null;
}

$exec_enabled = function_exists('exec') && !in_array('exec', array_map('trim', explode(',', ini_get('disable_functions'))));
$shell_exec_enabled = function_exists('shell_exec') && !in_array('shell_exec', array_map('trim', explode(',', ini_get('disable_functions'))));
$ffmpeg_info = ($exec_enabled || $shell_exec_enabled) ? findFfmpeg() : null;
$gd_enabled = extension_loaded('gd');
$upload_max = ini_get('upload_max_filesize');
$post_max = ini_get('post_max_size');
$memory_limit = ini_get('memory_limit');
$max_execution_time = ini_get('max_execution_time');

$intro_video_path = realpath(__DIR__ . '/../assets/videos/Framenaur.mp4');
$video_exists = $intro_video_path && file_exists($intro_video_path);

?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnostic Twibbon Video Server</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; }
        .container { max-width: 700px; margin: 0 auto; background: #1e293b; border-radius: 8px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        h1 { margin-top: 0; font-size: 1.5rem; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 12px; }
        .item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #334155; }
        .badge { padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.85rem; }
        .badge-success { background: #15803d; color: #fff; }
        .badge-danger { background: #b91c1c; color: #fff; }
        .badge-info { background: #0369a1; color: #fff; }
        pre { background: #0b0f19; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 0.8rem; color: #a5f3fc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Diagnostic Server FFmpeg</h1>
        
        <div class="item">
            <span>PHP Exec Function</span>
            <span class="badge <?= $exec_enabled ? 'badge-success' : 'badge-danger' ?>">
                <?= $exec_enabled ? 'AKTIF' : 'NONAKTIF / DIBLOKIR' ?>
            </span>
        </div>

        <div class="item">
            <span>PHP Shell_Exec Function</span>
            <span class="badge <?= $shell_exec_enabled ? 'badge-success' : 'badge-danger' ?>">
                <?= $shell_exec_enabled ? 'AKTIF' : 'NONAKTIF / DIBLOKIR' ?>
            </span>
        </div>

        <div class="item">
            <span>FFmpeg Status</span>
            <span class="badge <?= $ffmpeg_info ? 'badge-success' : 'badge-danger' ?>">
                <?= $ffmpeg_info ? 'TERSEDIA' : 'TIDAK DITEMUKAN' ?>
            </span>
        </div>

        <?php if ($ffmpeg_info): ?>
        <div class="item">
            <span>FFmpeg Path</span>
            <code style="color:#38bdf8;"><?= htmlspecialchars($ffmpeg_info['path']) ?></code>
        </div>
        <div>
            <p style="margin-bottom:6px; font-size:0.9rem; color:#94a3b8;">Versi Binary:</p>
            <pre><?= htmlspecialchars($ffmpeg_info['version']) ?></pre>
        </div>
        <?php endif; ?>

        <div class="item">
            <span>File Video Template (Framenaur.mp4)</span>
            <span class="badge <?= $video_exists ? 'badge-success' : 'badge-danger' ?>">
                <?= $video_exists ? 'ADA (' . round(filesize($intro_video_path) / 1048576, 2) . ' MB)' : 'TIDAK DITEMUKAN' ?>
            </span>
        </div>

        <div class="item">
            <span>Upload Max Filesize / Post Max</span>
            <span class="badge badge-info"><?= $upload_max ?> / <?= $post_max ?></span>
        </div>

        <div class="item">
            <span>Memory Limit / Timeout</span>
            <span class="badge badge-info"><?= $memory_limit ?> / <?= $max_execution_time ?>s</span>
        </div>

        <p style="margin-top:20px; font-size:0.85rem; color:#94a3b8; text-align:center;">
            Twibbon Video Generator &copy; 2026 PKKMB SADAJIWA IDE LPKIA
        </p>
    </div>
</body>
</html>
