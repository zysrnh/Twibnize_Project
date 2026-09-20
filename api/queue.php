<?php
/**
 * Queue Submit Endpoint - Twibbon PKKMB LPKIA 2026
 * POST /api/queue.php
 * 
 * Menerima gambar composite twibbon, menyimpan ke antrean,
 * dan langsung return tiket antrean (instant response < 100ms).
 * Video dirender di background oleh worker.php
 */

@ini_set('memory_limit', '256M');
@ini_set('max_execution_time', '30');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Hanya menerima request POST']);
    exit;
}

// ============================================================
// 1. Setup Storage Directories
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

// Protect storage from web access
$htaccessPath = $baseStorage . '/.htaccess';
if (!file_exists($htaccessPath)) {
    file_put_contents($htaccessPath, "Order Deny,Allow\nDeny from all\n");
}

// ============================================================
// 2. Auto-Cleanup: Hapus file antrean & output > 2 jam
// ============================================================
$cleanupAge = 7200; // 2 jam
foreach ([$queueDir, $outputDir] as $cleanDir) {
    $files = @glob($cleanDir . '/*');
    if ($files) {
        foreach ($files as $f) {
            if (is_file($f) && (time() - filemtime($f)) > $cleanupAge) {
                @unlink($f);
            }
        }
    }
}

// ============================================================
// 3. Generate Ticket ID & Simpan Gambar
// ============================================================
$ticketId = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)); // contoh: "A3F2B1C9"

// Ambil gambar dari upload
$imageSaved = false;
$imagePath  = $queueDir . '/' . $ticketId . '.jpg';

if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $imageSaved = move_uploaded_file($_FILES['image']['tmp_name'], $imagePath);
} elseif (!empty($_POST['image'])) {
    $raw = $_POST['image'];
    if (strpos($raw, 'base64,') !== false) {
        $raw = explode('base64,', $raw)[1];
    }
    $decoded = base64_decode($raw);
    if ($decoded !== false) {
        $imageSaved = file_put_contents($imagePath, $decoded) !== false;
    }
}

if (!$imageSaved || !file_exists($imagePath) || filesize($imagePath) < 100) {
    @unlink($imagePath);
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Gagal menerima gambar twibbon.']);
    exit;
}

// ============================================================
// 4. Buat Ticket Metadata (JSON)
// ============================================================
$holdDuration = isset($_POST['holdDuration']) ? floatval($_POST['holdDuration']) : 5.0;
if ($holdDuration <= 0 || $holdDuration > 30) $holdDuration = 5.0;

$ticketData = [
    'ticket_id'     => $ticketId,
    'status'        => 'queued',   // queued -> processing -> done / error
    'created_at'    => time(),
    'hold_duration' => $holdDuration,
    'image_path'    => $imagePath,
    'output_path'   => $outputDir . '/' . $ticketId . '.mp4',
    'error_message' => null,
    'progress'      => 0
];

$ticketPath = $queueDir . '/' . $ticketId . '.json';
file_put_contents($ticketPath, json_encode($ticketData, JSON_PRETTY_PRINT));

// ============================================================
// 5. Hitung Posisi Antrean
// ============================================================
$allTickets = glob($queueDir . '/*.json');
$queuedCount = 0;
$myPosition  = 0;

if ($allTickets) {
    // Sort by creation time (filemtime)
    usort($allTickets, function($a, $b) {
        return filemtime($a) - filemtime($b);
    });

    $pos = 0;
    foreach ($allTickets as $tf) {
        $td = @json_decode(file_get_contents($tf), true);
        if ($td && ($td['status'] === 'queued' || $td['status'] === 'processing')) {
            $pos++;
            if ($td['ticket_id'] === $ticketId) {
                $myPosition = $pos;
            }
            $queuedCount++;
        }
    }
}

// Estimasi waktu (rata-rata 5 detik per video, 2 slot paralel)
$estimatedSeconds = max(0, ceil(($myPosition - 1) / 2) * 6);

// ============================================================
// 6. Trigger Background Worker (fire-and-forget)
// ============================================================
$workerScript = __DIR__ . '/worker.php';

if (file_exists($workerScript)) {
    // Cari PHP binary
    $phpBin = PHP_BINARY ?: '/usr/bin/php';
    if (!file_exists($phpBin)) {
        $phpBin = '/usr/local/bin/php';
    }
    if (!file_exists($phpBin)) {
        $phpBin = 'php';
    }

    // Fire-and-forget: jalankan worker di background tanpa nunggu hasilnya
    $workerCmd = sprintf(
        '%s %s > /dev/null 2>&1 &',
        escapeshellcmd($phpBin),
        escapeshellarg($workerScript)
    );
    @exec($workerCmd);
}

// ============================================================
// 7. Return Response (Instan!)
// ============================================================
echo json_encode([
    'success'           => true,
    'ticket_id'         => $ticketId,
    'position'          => $myPosition,
    'total_queue'       => $queuedCount,
    'estimated_seconds' => $estimatedSeconds,
    'message'           => $myPosition <= 2 
        ? 'Video kamu sedang diproses...' 
        : 'Kamu di antrean ke-' . $myPosition . '. Estimasi ' . $estimatedSeconds . ' detik.'
]);
exit;
