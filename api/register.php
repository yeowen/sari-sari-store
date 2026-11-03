<?php
// api/register.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    
    $name = $conn->real_escape_string($data['name'] ?? '');
    $email = $conn->real_escape_string($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $contact = $conn->real_escape_string($data['contact'] ?? '');
    $address = $conn->real_escape_string($data['address'] ?? '');
    
    // Check kung existing na ang email
    $checkSql = "SELECT id FROM users WHERE email = '$email'";
    $checkResult = $conn->query($checkSql);
    
    if ($checkResult->num_rows > 0) {
        jsonResponse(["success" => false, "message" => "Email is already registered"]);
    } else {
        // I-save sa database (role ay default na 'customer')
        $sql = "INSERT INTO users (name, email, password, contact, address, role) 
                VALUES ('$name', '$email', '$password', '$contact', '$address', 'customer')";
        
        if ($conn->query($sql) === TRUE) {
            jsonResponse([
                "success" => true, 
                "message" => "Registration successful",
                "user" => [
                    "id" => $conn->insert_id,
                    "name" => $name,
                    "email" => $email,
                    "role" => "customer"
                ]
            ]);
        } else {
            jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
        }
    }
} else {
    jsonResponse(["success" => false, "message" => "Method not allowed"]);
}
?>