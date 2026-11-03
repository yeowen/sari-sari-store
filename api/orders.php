<?php
// api/orders.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT * FROM orders ORDER BY id DESC";
    $result = $conn->query($sql);
    $orders = [];

    while($row = $result->fetch_assoc()) {
        $order_id = $row['id'];
        
        $itemSql = "SELECT product_name as name, price, qty FROM order_items WHERE order_id = $order_id";
        $itemResult = $conn->query($itemSql);
        $items = [];
        while($item = $itemResult->fetch_assoc()) {
            $item['price'] = (float)$item['price'];
            $item['qty'] = (int)$item['qty'];
            $items[] = $item;
        }
        
        $row['id'] = (int)$row['id'];
        $row['total'] = (float)$row['total'];
        $row['items'] = $items;
        $row['date'] = $row['created_at'];
        
        if ($row['amount_paid'] !== null) {
            $row['payment'] = [
                "amountPaid" => (float)$row['amount_paid'],
                "change" => (float)$row['change_amount'],
                "method" => $row['payment_method']
            ];
        } else {
            $row['payment'] = null;
        }

        $orders[] = $row;
    }
    jsonResponse($orders);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = (int)$data['id'];
    $status = $conn->real_escape_string($data['status']);
    $cancel_reason = isset($data['cancel_reason']) ? "'" . $conn->real_escape_string($data['cancel_reason']) . "'" : "NULL";

    $sql = "UPDATE orders SET status='$status', cancel_reason=$cancel_reason WHERE id=$id";
    
    if ($conn->query($sql) === TRUE) {
        jsonResponse(["success" => true, "message" => "Order status updated"]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }
}
?>