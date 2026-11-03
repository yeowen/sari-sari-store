<?php
// api/admin-products.php
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT * FROM products ORDER BY id ASC";
    $result = $conn->query($sql);
    $products = [];
    while($row = $result->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['price'] = (float)$row['price'];
        $row['stock'] = (int)$row['stock'];
        $products[] = $row;
    }
    jsonResponse($products);

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $name = $conn->real_escape_string($data['name']);
    $category = $conn->real_escape_string($data['category']);
    $price = (float)$data['price'];
    $stock = (int)$data['stock'];
    $image = $conn->real_escape_string($data['image']);

    $sql = "INSERT INTO products (name, category, price, stock, image) 
            VALUES ('$name', '$category', $price, $stock, '$image')";
    
    if ($conn->query($sql) === TRUE) {
        jsonResponse(["success" => true, "message" => "Product added successfully"]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = (int)$data['id'];
    $name = $conn->real_escape_string($data['name']);
    $category = $conn->real_escape_string($data['category']);
    $price = (float)$data['price'];
    $stock = (int)$data['stock'];
    $image = $conn->real_escape_string($data['image']);

    $sql = "UPDATE products SET 
            name='$name', category='$category', price=$price, stock=$stock, image='$image' 
            WHERE id=$id";
    
    if ($conn->query($sql) === TRUE) {
        jsonResponse(["success" => true, "message" => "Product updated successfully"]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }

} elseif ($method === 'DELETE') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = (int)$data['id'];
    $sql = "DELETE FROM products WHERE id=$id";
    
    if ($conn->query($sql) === TRUE) {
        jsonResponse(["success" => true, "message" => "Product deleted successfully"]);
    } else {
        jsonResponse(["success" => false, "message" => "Error: " . $conn->error]);
    }
}
?>