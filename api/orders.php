<?php
// api/orders.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Kukunin ang mga orders mula sa pinakauna para sa malinis at sequential na Order # (#1, #2, #3, ...)
    $sql = "SELECT * FROM orders ORDER BY id ASC";
    $result = $conn->query($sql);
    $orders = [];
    $orderNumber = 1;

    while($row = $result->fetch_assoc()) {
        $order_id = (int)$row['id'];
        
        $itemSql = "SELECT product_name as name, price, qty FROM order_items WHERE order_id = $order_id";
        $itemResult = $conn->query($itemSql);
        $items = [];
        while($item = $itemResult->fetch_assoc()) {
            $item['price'] = (float)$item['price'];
            $item['qty'] = (int)$item['qty'];
            $items[] = $item;
        }
        
        $row['db_id'] = $order_id;
        $row['order_number'] = $orderNumber++; // Malinis na numero: 1, 2, 3, 4, 5...
        $row['display_id'] = $row['order_number'];
        $row['id'] = $order_id; // Database primary key para sa update/delete
        $row['total'] = (float)$row['total'];
        $row['items'] = $items;
        $row['date'] = $row['created_at'];
        
        if ($row['amount_paid'] !== null) {
            $row['payment'] = [
                "amountPaid" => (float)$row['amount_paid'],
                "change" => (float)$row['change_amount'],
                "method" => $row['payment_method'] ?: 'cash'
            ];
        } else {
            $row['payment'] = null;
        }

        $orders[] = $row;
    }

    // Pinakabagong order ang unang makikita sa listahan
    $orders = array_reverse($orders);
    jsonResponse($orders);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = (int)($data['id'] ?? 0);
    $status = $conn->real_escape_string($data['status'] ?? 'Pending');
    $cancel_reason = isset($data['cancel_reason']) && $data['cancel_reason'] !== null ? "'" . $conn->real_escape_string($data['cancel_reason']) . "'" : "NULL";

    $setParts = ["status='$status'", "cancel_reason=$cancel_reason"];

    if (isset($data['amount_paid']) && $data['amount_paid'] !== null && $data['amount_paid'] !== '') {
        $amount_paid = (float)$data['amount_paid'];
        $setParts[] = "amount_paid=$amount_paid";
    }
    if (isset($data['change_amount']) && $data['change_amount'] !== null && $data['change_amount'] !== '') {
        $change_amount = (float)$data['change_amount'];
        $setParts[] = "change_amount=$change_amount";
    }
    if (isset($data['payment_method']) && $data['payment_method'] !== null && $data['payment_method'] !== '') {
        $payment_method = $conn->real_escape_string($data['payment_method']);
        $setParts[] = "payment_method='$payment_method'";
    }

    $setClause = implode(", ", $setParts);
    $sql = "UPDATE orders SET $setClause WHERE id=$id";
    
    if ($conn->query($sql) === TRUE) {
        // I-restore ang stock kung kinansela ang order
        if ($status === 'Cancelled') {
            $itemSql = "SELECT product_name, qty FROM order_items WHERE order_id = $id";
            $itemRes = $conn->query($itemSql);
            if ($itemRes) {
                while ($it = $itemRes->fetch_assoc()) {
                    $pName = $conn->real_escape_string($it['product_name']);
                    $pQty = (int)$it['qty'];
                    $conn->query("UPDATE products SET stock = stock + $pQty WHERE name = '$pName'");
                }
            }
        }

        jsonResponse(["success" => true, "message" => "Order updated successfully"]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }
}
?>