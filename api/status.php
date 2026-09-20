<?php
/**
 * Ticket Status Endpoint - Twibbon PKKMB LPKIA 2026
 * GET /api/status.php?ticket=TICKET_ID
 * 
 * Lightweight polling endpoint. Maba cek status tiket mereka
 * setiap 2 detik. Respon sangat ringan (< 1KB JSON, 0ms CPU).
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$ticketId = isset($_GET['ticket']) ? preg_replace('/[^A-Za-z0-9]/', '', $_GET['ticket']) : '';

if (empty($ticketId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Parameter ticket wajib diisi.']);
    exit;
}

$queueDir  = __DIR__ . '/../storage/queue';
$outputDir = __DIR__ . '/../storage/output';
$ticketPath = $queueDir . '/' . $ticketId . '.json';

// ============================================================
// 1. Cek apakah tiket ada
// ============================================================
if (!file_exists($ticketPath)) {
    // Mungkin tiket sudah expired (>2 jam) dan ter-cleanup
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'status'  => 'expired',
        'message' => 'Tiket tidak ditemukan atau sudah kedaluwarsa (maks 2 jam).'
    ]);
    exit;
}

$ticket = @json_decode(file_get_contents($ticketPath), true);
if (!$ticket) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Data tiket rusak.']);
    exit;
}

// ============================================================
// 2. Kalau sudah done, cek apakah file MP4 masih ada
// ============================================================
if ($ticket['status'] === 'done') {
    $outputPath = $outputDir . '/' . $ticketId . '.mp4';
    if (file_exists($outputPath) && filesize($outputPath) > 1000) {
        echo json_encode([
            'success'      => true,
            'status'       => 'done',
            'ticket_id'    => $ticketId,
            'download_url' => 'api/download.php?ticket=' . $ticketId,
            'file_size'    => filesize($outputPath),
            'message'      => 'Video kamu sudah selesai! Siap diunduh.'
        ]);
    } else {
        // File sudah ter-cleanup
        echo json_encode([
            'success' => false,
            'status'  => 'expired',
            'message' => 'File video sudah kedaluwarsa. Silakan buat ulang.'
        ]);
    }
    exit;
}

// ============================================================
// 3. Kalau error
// ============================================================
if ($ticket['status'] === 'error') {
    echo json_encode([
        'success' => false,
        'status'  => 'error',
        'message' => $ticket['error_message'] ?: 'Terjadi kesalahan saat merender video.',
        'ticket_id' => $ticketId
    ]);
    exit;
}

// ============================================================
// 4. Kalau masih queued/processing, hitung posisi antrean
// ============================================================
$allTickets = glob($queueDir . '/*.json');
$myPosition  = 0;
$totalActive = 0;
$processingCount = 0;

if ($allTickets) {
    usort($allTickets, function($a, $b) {
        return filemtime($a) - filemtime($b);
    });

    $pos = 0;
    foreach ($allTickets as $tf) {
        $td = @json_decode(file_get_contents($tf), true);
        if (!$td) continue;
        if ($td['status'] === 'queued' || $td['status'] === 'processing') {
            $pos++;
            $totalActive++;
            if ($td['status'] === 'processing') $processingCount++;
            if ($td['ticket_id'] === $ticketId) {
                $myPosition = $pos;
            }
        }
    }
}

// Estimasi waktu (rata-rata 5-6 detik per video, 2 slot paralel)
$aheadOfMe = max(0, $myPosition - 1);
$estimatedSeconds = max(0, ceil($aheadOfMe / 2) * 6);

$statusLabel = $ticket['status'] === 'processing' ? 'processing' : 'queued';

$messageText = '';
if ($statusLabel === 'processing') {
    $messageText = 'Video kamu sedang dirender oleh server...';
} elseif ($myPosition <= 2) {
    $messageText = 'Hampir giliran kamu! Mohon tunggu sebentar...';
} else {
    $messageText = 'Kamu di antrean ke-' . $myPosition . ' dari ' . $totalActive . '. Estimasi ~' . $estimatedSeconds . ' detik.';
}

echo json_encode([
    'success'           => true,
    'status'            => $statusLabel,
    'ticket_id'         => $ticketId,
    'position'          => $myPosition,
    'total_queue'       => $totalActive,
    'processing_count'  => $processingCount,
    'estimated_seconds' => $estimatedSeconds,
    'progress'          => $ticket['progress'] ?? 0,
    'message'           => $messageText
]);
exit;
