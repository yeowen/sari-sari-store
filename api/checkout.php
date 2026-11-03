<?php
// api/checkout.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    
    $user_email = $conn->real_escape_string($data['user_email']);
    $customer_name = $conn->real_escape_string($data['customer_name']);
    $contact_number = $conn->real_escape_string($data['contact_number']);
    $pickup_date = $conn->real_escape_string($data['pickup_date']);
    $pickup_time = $conn->real_escape_string($data['pickup_time']);
    $total = (float)$data['total'];
    $items = $data['items']; 

    // 1. I-save ang Order sa `orders` table
    $sql = "INSERT INTO orders (user_email, customer_name, contact_number, pickup_date, pickup_time, total, status) 
            VALUES ('$user_email', '$customer_name', '$contact_number', '$pickup_date', '$pickup_time', $total, 'Pending')";
    
    if ($conn->query($sql) === TRUE) {
        $order_id = $conn->insert_id; 

        // 2. I-save ang bawat item sa `order_items` table
        foreach ($items as $item) {
            $name = $conn->real_escape_string($item['name']);
            $price = (float)$item['price'];
            $qty = (int)$item['qty'];

            $itemSql = "INSERT INTO order_items (order_id, product_name, price, qty) 
                        VALUES ($order_id, '$name', $price, $qty)";
            $conn->query($itemSql);
        }

        jsonResponse(["success" => true, "message" => "Order placed successfully!", "order_id" => $order_id]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }
} else {
    jsonResponse(["success" => false, "message" => "Method not allowed"]);
}
?>