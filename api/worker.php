<?php
/**
 * Background Queue Worker - Twibbon PKKMB LPKIA 2026
 * 
 * Dijalankan di background oleh queue.php. Mengambil tiket
 * dari antrean, render video dengan FFmpeg, dan update status.
 * Maks 2 proses FFmpeg paralel (file-lock based).
 * 
 * TIDAK boleh diakses langsung dari browser (gak ada output HTML).
 */

// Hanya boleh dijalankan dari CLI atau background exec
if (php_sapi_name() !== 'cli' && !isset($_SERVER['REDIRECT_STATUS'])) {
    // Tetap izinkan jika dipanggil via exec() dari queue.php
}

@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '300');
@set_time_limit(300);

// ============================================================
// 1. Setup Paths
// ============================================================
$baseStorage = __DIR__ . '/../storage';
$queueDir    = $baseStorage . '/queue';
$outputDir   = $baseStorage . '/output';
$lockDir     = $baseStorage . '/locks';

foreach ([$baseStorage, $queueDir, $outputDir, $lockDir] as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
}

// ============================================================
// 2. Acquire Worker Slot (Maks 2 paralel)
// ============================================================
$maxConcurrent = 2;
$lockAcquired  = false;
$lockFp        = null;
$lockFilePath  = '';

for ($slot = 1; $slot <= $maxConcurrent; $slot++) {
    $lockFilePath = $lockDir . '/worker_slot_' . $slot . '.lock';
    $fp = @fopen($lockFilePath, 'c+');
    if ($fp && @flock($fp, LOCK_EX | LOCK_NB)) {
        $lockAcquired = true;
        $lockFp = $fp;
        // Tulis PID ke lock file untuk monitoring
        ftruncate($fp, 0);
        fwrite($fp, getmypid() . "\n" . date('Y-m-d H:i:s'));
        break;
    }
    if ($fp) @fclose($fp);
}

if (!$lockAcquired) {
    // Sudah ada 2 worker aktif, exit silently
    exit(0);
}

// Pastikan lock dilepas saat script selesai
register_shutdown_function(function() use (&$lockFp) {
    if ($lockFp) {
        @flock($lockFp, LOCK_UN);
        @fclose($lockFp);
        $lockFp = null;
    }
});

// ============================================================
// 3. Cari FFmpeg Binary
// ============================================================
function findFfmpeg() {
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

$ffmpeg = findFfmpeg();
if (!$ffmpeg) {
    exit(1);
}

// ============================================================
// 4. Cari Intro Video
// ============================================================
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
    exit(1);
}

// ============================================================
// 5. Process Queue Loop (Proses semua tiket yang pending)
// ============================================================
$maxJobsPerRun = 20; // Safety limit per worker run
$jobsProcessed = 0;

while ($jobsProcessed < $maxJobsPerRun) {
    // Cari tiket queued terlama
    $ticketToProcess = findNextQueuedTicket($queueDir);
    
    if (!$ticketToProcess) {
        break; // Gak ada lagi yang perlu diproses
    }
    
    $ticketPath = $queueDir . '/' . $ticketToProcess['ticket_id'] . '.json';
    
    // Update status ke "processing"
    $ticketToProcess['status'] = 'processing';
    $ticketToProcess['progress'] = 10;
    file_put_contents($ticketPath, json_encode($ticketToProcess, JSON_PRETTY_PRINT));
    
    // Render video
    $success = renderVideoForTicket($ticketToProcess, $ffmpeg, $introVideo, $outputDir);
    
    if ($success) {
        $ticketToProcess['status'] = 'done';
        $ticketToProcess['progress'] = 100;
        $ticketToProcess['completed_at'] = time();
    } else {
        $ticketToProcess['status'] = 'error';
        $ticketToProcess['progress'] = 0;
        if (empty($ticketToProcess['error_message'])) {
            $ticketToProcess['error_message'] = 'Gagal merender video. Silakan coba lagi.';
        }
    }
    
    file_put_contents($ticketPath, json_encode($ticketToProcess, JSON_PRETTY_PRINT));
    
    // Hapus file gambar source setelah selesai
    if (!empty($ticketToProcess['image_path']) && file_exists($ticketToProcess['image_path'])) {
        @unlink($ticketToProcess['image_path']);
    }
    
    $jobsProcessed++;
    
    // Sedikit delay antar job supaya CPU gak overheat
    usleep(200000); // 200ms
}

exit(0);

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function findNextQueuedTicket($queueDir) {
    $ticketFiles = glob($queueDir . '/*.json');
    if (!$ticketFiles) return null;
    
    // Sort by creation time (oldest first = FIFO)
    usort($ticketFiles, function($a, $b) {
        return filemtime($a) - filemtime($b);
    });
    
    foreach ($ticketFiles as $tf) {
        $td = @json_decode(file_get_contents($tf), true);
        if ($td && $td['status'] === 'queued') {
            // Pastikan gambar masih ada
            if (!empty($td['image_path']) && file_exists($td['image_path'])) {
                return $td;
            } else {
                // Gambar hilang, tandai error
                $td['status'] = 'error';
                $td['error_message'] = 'File gambar hilang dari server.';
                file_put_contents($tf, json_encode($td, JSON_PRETTY_PRINT));
            }
        }
    }
    
    return null;
}

function renderVideoForTicket(&$ticket, $ffmpeg, $introVideo, $outputDir) {
    $tempPhotoPath = $ticket['image_path'];
    $outputPath    = $outputDir . '/' . $ticket['ticket_id'] . '.mp4';
    
    $holdDuration      = $ticket['hold_duration'] ?: 5.0;
    $introDuration     = 10.0;
    $crossfadeDuration = 0.6;
    $fadeOffset        = round($introDuration - $crossfadeDuration, 2); // 9.4s
    $photoDuration     = round($holdDuration + $crossfadeDuration, 2); // 5.6s
    $totalDuration     = round($fadeOffset + $photoDuration, 2);       // 15.0s
    
    // Update progress
    $ticket['progress'] = 30;
    $ticketPath = dirname($tempPhotoPath) . '/' . $ticket['ticket_id'] . '.json';
    file_put_contents($ticketPath, json_encode($ticket, JSON_PRETTY_PRINT));
    
    // Attempt 1: With Audio
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
        escapeshellarg($outputPath)
    );
    
    $ticket['progress'] = 50;
    file_put_contents($ticketPath, json_encode($ticket, JSON_PRETTY_PRINT));
    
    $output = [];
    $returnVar = 0;
    exec($cmd, $output, $returnVar);
    
    // Check success
    if ($returnVar === 0 && file_exists($outputPath) && filesize($outputPath) > 1000) {
        $ticket['progress'] = 95;
        file_put_contents($ticketPath, json_encode($ticket, JSON_PRETTY_PRINT));
        return true;
    }
    
    // Attempt 2: Video-only fallback (tanpa audio)
    $ticket['progress'] = 60;
    file_put_contents($ticketPath, json_encode($ticket, JSON_PRETTY_PRINT));
    
    @unlink($outputPath);
    
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
        escapeshellarg($outputPath)
    );
    
    $outputFallback = [];
    $returnVarFallback = 0;
    exec($cmdFallback, $outputFallback, $returnVarFallback);
    
    if ($returnVarFallback === 0 && file_exists($outputPath) && filesize($outputPath) > 1000) {
        $ticket['progress'] = 95;
        file_put_contents($ticketPath, json_encode($ticket, JSON_PRETTY_PRINT));
        return true;
    }
    
    // Kedua percobaan gagal
    $ticket['error_message'] = 'FFmpeg gagal merender video. Code: ' . $returnVarFallback;
    @unlink($outputPath);
    return false;
}
