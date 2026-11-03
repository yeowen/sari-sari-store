<?php
// api/users.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT id, name, email, role, contact, address FROM users ORDER BY id ASC";
    $result = $conn->query($sql);
    $users = [];
    while($row = $result->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $users[] = $row;
    }
    jsonResponse($users);

} elseif ($method === 'PUT') {
    // Update Role
    $data = json_decode(file_get_contents("php://input"), true);
    $id = (int)$data['id'];
    $role = $conn->real_escape_string($data['role']);

    $sql = "UPDATE users SET role='$role' WHERE id=$id";
    if ($conn->query($sql) === TRUE) {
        jsonResponse(["success" => true, "message" => "Role updated"]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }

} elseif ($method === 'DELETE') {
    // Delete User
    $data = json_decode(file_get_contents("php://input"), true);
    $id = (int)$data['id'];

    $sql = "DELETE FROM users WHERE id=$id";
    if ($conn->query($sql) === TRUE) {
        jsonResponse(["success" => true, "message" => "User deleted"]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }
}
?>