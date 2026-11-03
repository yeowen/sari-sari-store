<?php
// api/login.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);
    
    if (!$data) {
        $data = $_POST;
    }

    $email = strtolower(trim($conn->real_escape_string($data['email'] ?? '')));
    $password = $data['password'] ?? '';
    $role = strtolower(trim($conn->real_escape_string($data['role'] ?? 'customer')));

    // Siguraduhing laging existing ang default credentials
    $demoAccounts = [
        'customer@demo.com' => ['name' => 'Demo Customer', 'role' => 'customer', 'contact' => '09123456789', 'address' => 'Brgy. Sample, Metro Manila'],
        'staff@demo.com'    => ['name' => 'Demo Staff',    'role' => 'staff',    'contact' => '09223344556', 'address' => 'Store Counter'],
        'admin@demo.com'    => ['name' => 'Demo Admin',    'role' => 'admin',    'contact' => '09334455667', 'address' => 'Main Office']
    ];

    if (isset($demoAccounts[$email])) {
        $check = $conn->query("SELECT id FROM users WHERE LOWER(email) = '$email'");
        if (!$check || $check->num_rows === 0) {
            $d = $demoAccounts[$email];
            $conn->query("INSERT INTO users (name, email, password, role, contact, address) VALUES 
                ('{$d['name']}', '$email', '123456', '{$d['role']}', '{$d['contact']}', '{$d['address']}')");
        }
    }

    $sql = "SELECT * FROM users WHERE LOWER(email) = '$email' AND LOWER(role) = '$role'";
    $result = $conn->query($sql);

    if ($result && $result->num_rows > 0) {
        $user = $result->fetch_assoc();
        
        if ($password === $user['password']) {
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