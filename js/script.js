// =========================
// SARI-SARI STORE — CUSTOMER / GLOBAL SCRIPT
// Depende sa shared.js (dapat mauna itong i-load)
// =========================

// ---------- USER HELPERS ----------

function getCurrentUser() {
    return JSON.parse(localStorage.getItem("loggedInUser") || "{}");
}

function isLoggedIn() {
    const user = getCurrentUser();
    return user && user.email;
}

// ---------- CART ----------

function getCart() {
    const cart = localStorage.getItem("cart");
    return cart ? JSON.parse(cart) : [];
}

// Live Cart Sync to DB para sa Staff Real-Time Monitoring
let cartSyncDebounce = null;
function syncCartToDB(cart) {
    if (cartSyncDebounce) clearTimeout(cartSyncDebounce);
    cartSyncDebounce = setTimeout(async function() {
        try {
            const user = getCurrentUser();
            let email = user.email;
            let name = user.name || user.fullName || "Customer";

            if (!email) {
                let guestToken = localStorage.getItem("guestCartToken");
                if (!guestToken) {
                    guestToken = "guest_" + Math.random().toString(36).substring(2, 8) + "@local";
                    localStorage.setItem("guestCartToken", guestToken);
                }
                email = guestToken;
                name = "Guest Customer";
            }

            const currentCart = Array.isArray(cart) ? cart : getCart();
            const total = currentCart.reduce(function(sum, item) {
                return sum + ((parseFloat(item.price) || 0) * (parseInt(item.qty) || 0));
            }, 0);

            await fetch("api/cart.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_email: email,
                    customer_name: name,
                    items: currentCart,
                    total: total
                })
            });
        } catch (err) {
            console.error("Cart sync to DB error:", err);
        }
    }, 200);
}

function saveCart(cart) {
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartCount();
    syncCartToDB(cart);
}

function updateCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce(function(sum, item) {
        return sum + item.qty;
    }, 0);

    const cartElements = document.querySelectorAll("#cartCount");
    cartElements.forEach(function(el) {
        el.textContent = totalItems;
    });
}

// ---------- ADD TO CART ----------

function attachAddToCartListeners() {
    const buttons = document.querySelectorAll(".add-cart");

    buttons.forEach(function(button) {
        button.addEventListener("click", function() {
            const name = button.getAttribute("data-product");
            const price = parseFloat(button.getAttribute("data-price"));
            const stock = parseInt(button.getAttribute("data-stock") || "999");

            const cardBody = button.closest(".card-body");
            const qtyInput = cardBody.querySelector(".qty-input");
            const qty = parseInt(qtyInput.value) || 0;

            if (qty < 1) {
                showToast("Please enter a quantity first before adding to cart.", "warning");
                qtyInput.focus();
                return;
            }

            if (qty > stock) {
                showToast("Only " + stock + " items available in stock.", "warning");
                return;
            }

            let cart = getCart();
            const existing = cart.find(function(item) {
                return item.name === name;
            });

            if (existing) {
                if (existing.qty + qty > stock) {
                    showToast("Only " + stock + " items available. Already in cart: " + existing.qty, "warning");
                    return;
                }
                existing.qty += qty;
            } else {
                cart.push({ name: name, price: price, qty: qty });
            }

            saveCart(cart);
            showToast(qty + "x " + name + " added to cart!", "success");
            qtyInput.value = 1;
        });
    });
}

// ---------- PRODUCT SEARCH ----------

const searchInput = document.getElementById("searchInput");

if (searchInput) {
    searchInput.addEventListener("keyup", function() {
        const searchValue = this.value.toLowerCase();
        const products = document.querySelectorAll(".product-item");

        products.forEach(function(product) {
            const titleEl = product.querySelector(".card-title");
            if (!titleEl) return;
            const productName = titleEl.textContent.toLowerCase();

            if (productName.includes(searchValue)) {
                product.style.display = "";
            } else {
                product.style.display = "none";
            }
        });
    });
}

// ---------- CATEGORY FILTER ----------

function attachCategoryFilter() {
    const categoryButtons = document.querySelectorAll(".category-btn");

    categoryButtons.forEach(function(btn) {
        btn.addEventListener("click", function() {
            const category = btn.getAttribute("data-category");
            const products = document.querySelectorAll(".product-item");

            categoryButtons.forEach(function(b) {
                b.classList.remove("btn-success");
                b.classList.add("btn-outline-success");
            });
            btn.classList.remove("btn-outline-success");
            btn.classList.add("btn-success");

            products.forEach(function(product) {
                if (category === "all" || product.getAttribute("data-category") === category) {
                    product.style.display = "";
                } else {
                    product.style.display = "none";
                }
            });
        });
    });
}

// ---------- DYNAMIC PRODUCT RENDERING ----------

function renderProducts() {
    const container = document.getElementById("productList");
    if (!container) return;

    const products = getProducts();
    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-5">No products available.</p>';
        return;
    }

    products.forEach(function(p) {
        const imgSrc = (p.image && p.image.trim() !== "")
            ? p.image
            : "https://placehold.co/300x200/198754/ffffff?text=" + encodeURIComponent(p.name);

        const outOfStock = p.stock === 0;

        const col = document.createElement("div");
        col.className = "col-md-6 col-lg-3 product-item";
        col.setAttribute("data-category", p.category);

        col.innerHTML = `
            <div class="card product-card shadow-sm h-100">
                <img src="${imgSrc}" class="card-img-top product-image" alt="${p.name}">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${p.name}</h5>
                    <p class="price">₱${p.price.toFixed(2)}</p>
                    <p class="stock ${outOfStock ? 'text-danger' : 'text-success'}">
                        ${outOfStock ? '❌ Out of Stock' : 'Stock: ' + p.stock}
                    </p>
                    <label class="form-label small mb-1">Quantity:</label>
                    <input type="number" class="form-control mb-2 qty-input"
                           value="1" min="1" max="${p.stock}"
                           ${outOfStock ? 'disabled' : ''}>
                    <button class="btn btn-success w-100 add-cart mt-auto"
                            data-product="${p.name}"
                            data-price="${p.price}"
                            data-stock="${p.stock}"
                            ${outOfStock ? 'disabled' : ''}>
                        ${outOfStock ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>
            </div>
        `;
        container.appendChild(col);
    });

    attachAddToCartListeners();
}

// ---------- RENDER CART PAGE ----------

const cartItemsContainer = document.getElementById("cartItems");
const cartTotalElement = document.getElementById("cartTotal");
const cartSubtotalElement = document.getElementById("cartSubtotal");

function renderCart() {
    if (!cartItemsContainer) return;

    const cart = getCart();
    cartItemsContainer.innerHTML = "";

    if (cart.length === 0) {
        cartItemsContainer.innerHTML =
            '<p class="text-muted text-center py-4">Your cart is empty.</p>';
        if (cartSubtotalElement) cartSubtotalElement.textContent = "₱0.00";
        if (cartTotalElement) cartTotalElement.textContent = "₱0.00";
        return;
    }

    let subtotal = 0;

    cart.forEach(function(item, index) {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;

        const row = document.createElement("div");
        row.className = "row align-items-center border-bottom py-3";

        row.innerHTML = `
            <div class="col-md-4">
                <strong>${item.name}</strong>
            </div>
            <div class="col-md-2">
                ₱${item.price.toFixed(2)}
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control qty-input"
                       value="${item.qty}" min="1" data-index="${index}">
            </div>
            <div class="col-md-2">
                <strong>₱${itemTotal.toFixed(2)}</strong>
            </div>
            <div class="col-md-1">
                <button class="btn btn-danger btn-sm remove-btn" data-index="${index}">X</button>
            </div>
        `;

        cartItemsContainer.appendChild(row);
    });

    if (cartSubtotalElement) {
        cartSubtotalElement.textContent = "₱" + subtotal.toFixed(2);
    }
    if (cartTotalElement) {
        cartTotalElement.textContent = "₱" + subtotal.toFixed(2);
    }

    document.querySelectorAll(".remove-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const index = parseInt(btn.getAttribute("data-index"));
            const cart = getCart();
            const itemName = cart[index] ? cart[index].name : "item";

            showConfirm(
                "Remove '" + itemName + "' from your cart?",
                function() {
                    const c = getCart();
                    c.splice(index, 1);
                    saveCart(c);
                    renderCart();
                    showToast("Item removed from cart.", "success");
                },
                { title: "Remove Item", confirmText: "Remove", type: "danger" }
            );
        });
    });

    document.querySelectorAll(".qty-input").forEach(function(input) {
        input.addEventListener("change", function() {
            const index = parseInt(input.getAttribute("data-index"));
            let qty = parseInt(input.value);
            if (isNaN(qty) || qty < 1) qty = 1;
            let cart = getCart();
            cart[index].qty = qty;
            saveCart(cart);
            renderCart();
        });
    });
}

renderCart();

// ---------- RENDER CHECKOUT PAGE ----------

const checkoutItemsContainer = document.getElementById("checkoutItems");
const checkoutTotalElement = document.getElementById("checkoutTotal");

function renderCheckout() {
    if (!checkoutItemsContainer) return;

    const cart = getCart();
    checkoutItemsContainer.innerHTML = "";

    if (cart.length === 0) {
        checkoutItemsContainer.innerHTML =
            '<p class="text-muted">Your cart is empty.</p>';
        if (checkoutTotalElement) checkoutTotalElement.textContent = "₱0.00";
        return;
    }

    let total = 0;

    cart.forEach(function(item) {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        const row = document.createElement("div");
        row.className = "d-flex justify-content-between mb-2";
        row.innerHTML = `
            <span>${item.name} x ${item.qty}</span>
            <strong>₱${itemTotal.toFixed(2)}</strong>
        `;
        checkoutItemsContainer.appendChild(row);
    });

    if (checkoutTotalElement) {
        checkoutTotalElement.textContent = "₱" + total.toFixed(2);
    }
}

renderCheckout();

// ---------- CHECKOUT FORM (PLACE ORDER - CONNECTED TO DB) ----------

const orderForm = document.getElementById("orderForm");

if (orderForm) {
    orderForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const cart = getCart();

        if (cart.length === 0) {
            showToast("Your cart is empty. Please add products first.", "warning");
            setTimeout(function() { window.location.href = "products.html"; }, 1200);
            return;
        }

        const user = getCurrentUser();
        if (!user.email) {
            showToast("You must be logged in to place an order.", "warning");
            setTimeout(function() { window.location.href = "login.html"; }, 1200);
            return;
        }

        // STOCK VALIDATION
        const products = getProducts();
        for (let i = 0; i < cart.length; i++) {
            const item = cart[i];
            const product = products.find(p => p.name === item.name);
            if (!product) return showToast("Product '" + item.name + "' no longer exists.", "danger");
            if (product.stock < item.qty) return showToast("Insufficient stock for '" + item.name + "'.", "danger");
        }

        const inputs = orderForm.querySelectorAll("input, select");
        const customerName = inputs[0].value.trim();
        const contactNumber = inputs[1].value.trim();
        const pickupDate = inputs[2].value;
        const pickupTime = inputs[3].value;

        if (!customerName || !contactNumber || !pickupDate || !pickupTime) {
            showToast("Please fill out all pickup information.", "warning");
            return;
        }

        let total = 0;
        cart.forEach(function(item) { total += item.price * item.qty; });

        const orderData = {
            user_email: user.email,
            customer_name: customerName,
            contact_number: contactNumber,
            pickup_date: pickupDate,
            pickup_time: pickupTime,
            total: total,
            items: cart
        };

        try {
            const response = await fetch('api/checkout.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            const data = await response.json();

            if (data.success) {
                localStorage.removeItem("cart");
                updateCartCount();
                syncCartToDB([]);
                showToast("Order placed successfully!", "success");
                setTimeout(function() { window.location.href = "orders.html"; }, 1200);
            } else {
                showToast(data.message, "danger");
            }
        } catch (error) {
            showToast("Server error. Please try again.", "danger");
        }
    });
}

// ---------- NOTIFICATIONS (ROLE-BASED) ----------

function getNotifications() {
    const user = getCurrentUser();
    const all = JSON.parse(localStorage.getItem("notifications") || "[]");
    return all.filter(function(n) {
        if (n.userEmail && n.userEmail === user.email) return true;
        if (n.recipientRole && n.recipientRole === user.role && !n.userEmail) return true;
        return false;
    });
}

function updateNotifCount() {
    const notifs = getNotifications();
    const unread = notifs.filter(function(n) { return !n.read; }).length;
    const el = document.getElementById("notifCount");
    if (el) {
        el.textContent = unread;
        el.style.display = unread > 0 ? "inline" : "none";
    }
}

function renderNotifications() {
    const notifs = getNotifications();
    const list = document.getElementById("notifList");
    if (!list) return;

    if (notifs.length === 0) {
        list.innerHTML = '<li><span class="dropdown-item text-muted">No notifications.</span></li>';
        return;
    }

    list.innerHTML = "";
    notifs.slice().reverse().forEach(function(n) {
        const li = document.createElement("li");
        li.innerHTML = `
            <span class="dropdown-item ${n.read ? "" : "fw-bold"}">
                <small class="text-muted d-block">${formatDisplayDate(n.date)} ${new Date(n.date).toLocaleTimeString ? new Date(n.date).toLocaleTimeString() : ""}</small>
                ${n.message}
            </span>
        `;
        list.appendChild(li);
    });
}

// ---------- DYNAMIC NAVBAR ----------

function renderNavbar() {
    const navLinks = document.getElementById("navLinks");
    if (!navLinks) return;

    const user = getCurrentUser();
    const isLogged = isLoggedIn();
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const activeClass = (page) => currentPage === page ? "active text-success fw-bold" : "";

    let html = `
        <li class="nav-item"><a class="nav-link ${activeClass('index.html')}" href="index.html">Home</a></li>
        <li class="nav-item"><a class="nav-link ${activeClass('products.html')}" href="products.html">Products</a></li>
        <li class="nav-item"><a class="nav-link ${activeClass('orders.html')}" href="orders.html">My Orders</a></li>
    `;

    html += `
        <li class="nav-item">
            <a class="nav-link ${activeClass('cart.html')}" href="cart.html">
                🛒 Cart <span id="cartCount" class="badge bg-success">0</span>
            </a>
        </li>
    `;

    html += `
        <li class="nav-item dropdown">
            <a class="nav-link position-relative" href="#" id="notifDropdown" data-bs-toggle="dropdown">
                🔔 <span id="notifCount" class="badge bg-danger position-absolute top-0 start-100 translate-middle" style="display:none;">0</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end" id="notifList" style="min-width: 300px;">
                <li><span class="dropdown-item text-muted">No notifications.</span></li>
            </ul>
        </li>
    `;

    if (isLogged) {
        html += `<li class="nav-item"><a class="nav-link ${activeClass('profile.html')}" href="profile.html">👤 ${user.name || 'Profile'}</a></li>`;
        html += `<li class="nav-item"><button id="navLogoutBtn" class="btn btn-outline-danger btn-sm ms-lg-2">Logout</button></li>`;

        if (user.role === 'admin') {
            html += `<li class="nav-item"><a class="btn btn-success btn-sm ms-lg-2" href="admin-dashboard.html">👑 Admin</a></li>`;
        } else if (user.role === 'staff') {
            html += `<li class="nav-item"><a class="btn btn-primary btn-sm ms-lg-2" href="staff-dashboard.html">👷 Staff</a></li>`;
        }
    } else {
        html += `<li class="nav-item"><a class="btn btn-success ms-lg-2" href="login.html">Login</a></li>`;
    }

    navLinks.innerHTML = html;

    let welcomeBanner = document.getElementById("welcomeBanner");

    if (!welcomeBanner) {
        welcomeBanner = document.createElement("div");
        welcomeBanner.id = "welcomeBanner";
        const navbar = document.querySelector(".navbar");
        if (navbar) {
            navbar.insertAdjacentElement("afterend", welcomeBanner);
        }
    }

    if (isLogged && welcomeBanner) {
        let bgColor = "alert-success";
        let icon = "👤";
        if (user.role === "admin") { bgColor = "alert-dark"; icon = "👑"; }
        if (user.role === "staff") { bgColor = "alert-primary"; icon = "👷"; }

        welcomeBanner.innerHTML = `
            <div class="alert ${bgColor} text-center mb-0 rounded-0 border-0 py-2 shadow-sm" role="alert">
                <span class="fw-bold">${icon} Welcome, ${user.name}!</span> 
                <span class="ms-2 badge bg-light text-dark text-uppercase">${user.role}</span>
            </div>
        `;
    } else if (welcomeBanner) {
        welcomeBanner.innerHTML = "";
    }

    updateCartCount();
    updateNotifCount();
    renderNotifications();

    const logoutBtn = document.getElementById("navLogoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function() {
            showConfirm(
                "Are you sure you want to logout?",
                function() {
                    localStorage.removeItem("loggedInUser");
                    showToast("Logged out successfully.", "success");
                    setTimeout(function() {
                        window.location.href = "login.html";
                    }, 800);
                },
                { title: "Logout", confirmText: "Yes, Logout", type: "warning" }
            );
        });
    }

    const notifDropdown = document.getElementById("notifDropdown");
    if (notifDropdown) {
        notifDropdown.addEventListener("click", function() {
            const user = getCurrentUser();
            const all = JSON.parse(localStorage.getItem("notifications") || "[]");
            all.forEach(function(n) {
                if (n.userEmail && n.userEmail === user.email) n.read = true;
                if (n.recipientRole && n.recipientRole === user.role && !n.userEmail) n.read = true;
            });
            localStorage.setItem("notifications", JSON.stringify(all));
            setTimeout(function() {
                updateNotifCount();
                renderNotifications();
            }, 500);
        });
    }
}

// ---------- INITIALIZE ----------

document.addEventListener("DOMContentLoaded", async function() {
    renderNavbar();
    try {
        await getProductsFromDB();
    } catch (e) {
        console.error("Products DB fetch error:", e);
    }
    renderProducts();
    attachCategoryFilter();
    updateCartCount();
    if (getCart().length > 0) {
        syncCartToDB(getCart());
    }
    updateNotifCount();
    renderNotifications();

    // Auto-sync products from database every 15s para laging updated ang Customer sa paninda
    if (document.getElementById("productList")) {
        setInterval(async function() {
            try {
                await getProductsFromDB();
                renderProducts();
            } catch (e) {}
        }, 15000);
    }
});
