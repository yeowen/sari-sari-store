<?php
// api/cart.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT user_email, customer_name, items, total, updated_at FROM active_carts ORDER BY updated_at DESC";
    $result = $conn->query($sql);
    $carts = [];

    if ($result) {
        while($row = $result->fetch_assoc()) {
            $items = json_decode($row['items'], true);
            if (!is_array($items) || count($items) === 0) continue;

            $carts[] = [
                "user_email" => $row['user_email'],
                "customer_name" => $row['customer_name'],
                "items" => $items,
                "total" => (float)$row['total'],
                "updated_at" => $row['updated_at']
            ];
        }
    }
    jsonResponse($carts);

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $user_email = $conn->real_escape_string($data['user_email'] ?? '');
    $customer_name = $conn->real_escape_string($data['customer_name'] ?? 'Guest');
    $items = $data['items'] ?? [];
    $total = (float)($data['total'] ?? 0.0);

    if (empty($user_email)) {
        jsonResponse(["success" => false, "message" => "user_email is required"]);
    }

    if (empty($items) || count($items) === 0) {
        $conn->query("DELETE FROM active_carts WHERE user_email = '$user_email'");
        jsonResponse(["success" => true, "message" => "Cart cleared"]);
    }

    $itemsJson = $conn->real_escape_string(json_encode($items));
    $sql = "INSERT INTO active_carts (user_email, customer_name, items, total) 
            VALUES ('$user_email', '$customer_name', '$itemsJson', $total)
            ON DUPLICATE KEY UPDATE 
                customer_name = VALUES(customer_name),
                items = VALUES(items),
                total = VALUES(total),
                updated_at = CURRENT_TIMESTAMP";

    if ($conn->query($sql) === TRUE) {
        jsonResponse(["success" => true, "message" => "Cart synced successfully"]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }

} elseif ($method === 'DELETE') {
    $data = json_decode(file_get_contents("php://input"), true);
    $user_email = $conn->real_escape_string($data['user_email'] ?? '');
    if (!empty($user_email)) {
        $conn->query("DELETE FROM active_carts WHERE user_email = '$user_email'");
    }
    jsonResponse(["success" => true, "message" => "Cart deleted"]);
} else {
    jsonResponse(["success" => false, "message" => "Method not allowed"]);
}
?>
