CREATE DATABASE IF NOT EXISTS sari_sari_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sari_sari_db;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'customer',
  contact VARCHAR(50) NOT NULL DEFAULT '',
  address VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  image LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY products_category_index (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_email VARCHAR(254) NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  contact_number VARCHAR(50) NOT NULL,
  pickup_date DATE NOT NULL,
  pickup_time VARCHAR(30) NOT NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  cancel_reason TEXT NULL,
  amount_paid DECIMAL(12,2) NULL,
  change_amount DECIMAL(12,2) NULL,
  payment_method VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY orders_user_email_index (user_email),
  KEY orders_created_at_index (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  qty INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY order_items_order_id_index (order_id),
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
