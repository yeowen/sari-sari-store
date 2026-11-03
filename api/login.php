<?php
// api/login.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    // Kunin ang data na ipinadala ng JavaScript
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);
    
    // Fallback kung sakaling hindi naka-JSON format
    if (!$data) {
        $data = $_POST;
    }

    $email = $conn->real_escape_string($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $role = $conn->real_escape_string($data['role'] ?? 'customer');

    // Hanapin ang user sa database
    $sql = "SELECT * FROM users WHERE email = '$email' AND role = '$role'";
    $result = $conn->query($sql);

    if ($result && $result->num_rows > 0) {
        $user = $result->fetch_assoc();
        
        // Check password (plain text muna gaya ng nasa DB)
        if ($password === $user['password']) {
            // Tanggalin ang password sa response
            unset($user['password']);
            
            jsonResponse([
                "success" => true,
                "message" => "Login successful",
                "user" => $user
            ]);
        } else {
            jsonResponse(["success" => false, "message" => "Invalid password"]);
        }
    } else {
        jsonResponse(["success" => false, "message" => "Account not found or role mismatch"]);
    }
} else {
    jsonResponse(["success" => false, "message" => "Method not allowed"]);
}
?>