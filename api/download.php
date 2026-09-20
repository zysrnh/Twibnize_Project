<?php
/**
 * Video Download Endpoint - Twibbon PKKMB LPKIA 2026
 * GET /api/download.php?ticket=TICKET_ID
 * 
 * Serve file MP4 yang sudah selesai dirender ke browser maba.
 * File di-stream dengan proper headers untuk kompatibilitas HP.
 */

header('Access-Control-Allow-Origin: *');

$ticketId = isset($_GET['ticket']) ? preg_replace('/[^A-Za-z0-9]/', '', $_GET['ticket']) : '';

if (empty($ticketId)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Parameter ticket wajib diisi.']);
    exit;
}

$queueDir  = __DIR__ . '/../storage/queue';
$outputDir = __DIR__ . '/../storage/output';
$ticketPath = $queueDir . '/' . $ticketId . '.json';
$videoPath  = $outputDir . '/' . $ticketId . '.mp4';

// Cek tiket ada dan status done
if (!file_exists($ticketPath)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Tiket tidak ditemukan.']);
    exit;
}

$ticket = @json_decode(file_get_contents($ticketPath), true);
if (!$ticket || $ticket['status'] !== 'done') {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Video belum selesai diproses.']);
    exit;
}

// Cek file video ada
if (!file_exists($videoPath) || filesize($videoPath) < 1000) {
    http_response_code(410);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'File video sudah kedaluwarsa atau terhapus.']);
    exit;
}

// Stream video ke browser
$filename = 'Twibbon_PKKMB_LPKIA_' . $ticketId . '.mp4';
$fileSize = filesize($videoPath);

header('Content-Type: video/mp4');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . $fileSize);
header('Accept-Ranges: bytes');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Stream dalam chunks 64KB
$fp = fopen($videoPath, 'rb');
if ($fp) {
    while (!feof($fp)) {
        echo fread($fp, 65536);
        flush();
    }
    fclose($fp);
} else {
    readfile($videoPath);
}

exit;
