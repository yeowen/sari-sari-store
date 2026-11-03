<?php
// api/products.php

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT * FROM products ORDER BY id ASC";
    $result = $conn->query($sql);

    $products = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $row['id'] = (int)$row['id'];
            $row['price'] = (float)$row['price'];
            $row['stock'] = (int)$row['stock'];
            $products[] = $row;
        }
    }
    
    jsonResponse($products);
} else {
    jsonResponse(["success" => false, "message" => "Method not allowed"]);
}
?>