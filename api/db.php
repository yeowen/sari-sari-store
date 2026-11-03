<?php
// api/db.php

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = (int)(getenv('DB_PORT') ?: 3307);
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
$dbname = getenv('DB_NAME') ?: 'sari_sari_db';
$useTls = filter_var(getenv('DB_TLS') ?: 'false', FILTER_VALIDATE_BOOLEAN);

mysqli_report(MYSQLI_REPORT_OFF);
$conn = mysqli_init();
if ($useTls) {
    // TiDB Cloud Starter/Essential requires TLS. It uses publicly trusted certs.
    $conn->ssl_set(null, null, getenv('DB_SSL_CA') ?: null, null, null);
}

$flags = $useTls ? MYSQLI_CLIENT_SSL : 0;
if (!$conn->real_connect($host, $user, $pass, $dbname, $port, null, $flags)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed. Check the database environment variables and network access."
    ]);
    exit;
}
$conn->set_charset('utf8mb4');

date_default_timezone_set('Asia/Manila');

function jsonResponse($data) {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *'); 
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        exit(0);
    }
    
    echo json_encode($data);
    exit;
}
?>
