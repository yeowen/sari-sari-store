// =========================
// SARI-SARI STORE — ADMIN & STAFF SCRIPT
// =========================

const VALID_CATEGORIES = ["beverages", "snacks", "canned", "personal", "household"];

const CATEGORY_LABELS = {
    beverages: "Beverages",
    snacks: "Snacks",
    canned: "Canned Goods",
    personal: "Personal Care",
    household: "Household"
};

const ITEMS_PER_PAGE = 5;

let paginationState = {
    products: 1,
    orders: 1,
    completed: 1
};

let salesTrendChartInstance = null;
let categoryChartInstance = null;

function renderPaginationControls(containerId, totalItems, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    container.innerHTML = "";

    if (totalPages <= 1) return;

    const createPageItem = (page, label, isActive = false, isDisabled = false) => {
        const li = document.createElement("li");
        li.className = `page-item ${isActive ? "active" : ""} ${isDisabled ? "disabled" : ""}`;
        const a = document.createElement("a");
        a.className = "page-link";
        a.href = "#";
        a.textContent = label;
        a.addEventListener("click", function(e) {
            e.preventDefault();
            if (!isActive && !isDisabled) onPageChange(page);
        });
        li.appendChild(a);
        return li;
    };

    container.appendChild(createPageItem(currentPage - 1, "«", false, currentPage === 1));

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            container.appendChild(createPageItem(i, i, i === currentPage));
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            const li = document.createElement("li");
            li.className = "page-item disabled";
            li.innerHTML = `<span class="page-link">...</span>`;
            container.appendChild(li);
        }
    }

    container.appendChild(createPageItem(currentPage + 1, "»", false, currentPage === totalPages));
}

function getPaginatedItems(items, currentPage) {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
}

const ALLOWED_TRANSITIONS = {
    "Pending": ["Received", "Cancelled"],
    "Received": ["Preparing", "Cancelled"],
    "Preparing": ["Ready for Pickup", "Cancelled"],
    "Ready for Pickup": ["Completed", "Cancelled"],
    "Completed": [],
    "Cancelled": []
};

async function updateOrderStatus(index, newStatus, cancelReason, paymentData = null) {
    const orders = getOrders();
    const oldStatus = orders[index].status;

    if (oldStatus === newStatus) return;

    const allowed = ALLOWED_TRANSITIONS[oldStatus] || [];
    if (!allowed.includes(newStatus)) {
        showToast("Cannot change status from '" + oldStatus + "' to '" + newStatus + "'.", "danger");
        return false;
    }

    // --- I-SAVE ANG BAYAD ---
    if (paymentData) {
        orders[index].payment = {
            amountPaid: paymentData.amount_paid,
            change: paymentData.change_amount,
            method: "cash"
        };
    }

    // --- STOCK DEDUCTION (COMPLETED) ---
    if (newStatus === "Completed" && oldStatus !== "Completed") {
        try {
            const products = getProducts();
            for (const item of orders[index].items) {
                const product = products.find(p => p.name === item.name);
                if (product) {
                    const newStock = Math.max(0, product.stock - item.qty);
                    await fetch('api/admin-products.php', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...product, stock: newStock })
                    });
                }
            }
            await getProductsFromDB(); 
        } catch (err) {
            console.error("Failed to deduct stock", err);
        }
        orders[index].stockDeducted = true;
    }

    // --- RESTORE STOCK (CANCELLED) ---
    if (newStatus === "Cancelled" && orders[index].stockDeducted === true) {
        restoreStock(orders[index].items);
        orders[index].stockDeducted = false;
    }

    if (newStatus === "Cancelled" && cancelReason) {
        orders[index].cancelReason = cancelReason;
        orders[index].cancelledAt = nowISO();
    }

    orders[index].status = newStatus;

    let notifMsg = "Your Order #" + orders[index].id + " is now " + newStatus + ".";
    if (newStatus === "Cancelled" && cancelReason) {
        notifMsg = "Your Order #" + orders[index].id + " was cancelled. Reason: " + cancelReason;
    }

    addNotification(orders[index].userEmail, notifMsg, "customer");

    if (newStatus === "Cancelled" && !cancelReason) {
        addNotification("", "Order #" + orders[index].id + " was cancelled by customer.", "staff");
        addNotification("", "Order #" + orders[index].id + " was cancelled by customer.", "admin");
    }

    // --- SAVE TO DATABASE ---
    try {
        const response = await fetch('api/orders.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: orders[index].id,
                status: newStatus,
                cancel_reason: cancelReason || null,
                amount_paid: orders[index].payment ? orders[index].payment.amountPaid : null,
                change_amount: orders[index].payment ? orders[index].payment.change : null,
                payment_method: orders[index].payment ? orders[index].payment.method : null
            })
        });
        
        if (!response.ok) throw new Error("Failed to update database");
        
        saveOrders(orders);
        
        if (newStatus === "Completed" || newStatus === "Cancelled") {
            renderCharts();
        }
        
        return true;
    } catch (error) {
        showToast("Error updating order in database.", "danger");
        return false;
    }
}

function requireRole(allowedRoles) {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
    if (!user.role || !allowedRoles.includes(user.role)) {
        showToast("Access denied. " + allowedRoles.join("/") + " only.", "danger");
        setTimeout(function() {
            window.location.href = "login.html";
        }, 1500);
        return false;
    }
    return true;
}

function attachLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function() {
            showConfirm("Are you sure you want to logout?", function() {
                localStorage.removeItem("loggedInUser");
                showToast("Logged out successfully.", "success");
                setTimeout(function() {
                    window.location.href = "login.html";
                }, 800);
            }, { title: "Logout", confirmText: "Yes, Logout", type: "warning" });
        });
    }
}

function getImageSrc(product) {
    if (product.image && product.image.trim() !== "") {
        return product.image;
    }
    return "https://placehold.co/300x200/198754/ffffff?text=" + encodeURIComponent(product.name);
}

function attachImageUploadListeners() {
    const fileInput = document.getElementById("productImageFile");
    const preview = document.getElementById("imagePreview");
    const hiddenData = document.getElementById("productImageData");
    const removeBtn = document.getElementById("removeImageBtn");

    if (!fileInput) return;

    fileInput.addEventListener("change", function() {
        const file = fileInput.files[0];
        if (!file) return;

        if (file.size > 500 * 1024) {
            showConfirm(
                "Image is too large (" + Math.round(file.size / 1024) + "KB). Storage might get full. Do you want to continue?",
                function() {
                    processImageFile(file, hiddenData, preview, removeBtn);
                },
                { title: "Large Image", confirmText: "Continue", type: "warning" }
            );
            fileInput.value = "";
            return;
        }

        if (!file.type.startsWith("image/")) {
            showToast("Please select a valid image file (JPG, PNG, WEBP).", "danger");
            fileInput.value = "";
            return;
        }

        processImageFile(file, hiddenData, preview, removeBtn);
    });

    removeBtn.addEventListener("click", function() {
        fileInput.value = "";
        hiddenData.value = "";
        preview.src = "";
        preview.style.display = "none";
        removeBtn.style.display = "none";
    });
}

function processImageFile(file, hiddenData, preview, removeBtn) {
    if (!file.type.startsWith("image/")) {
        showToast("Please select a valid image file (JPG, PNG, WEBP).", "danger");
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        hiddenData.value = e.target.result;
        preview.src = e.target.result;
        preview.style.display = "block";
        removeBtn.style.display = "inline-block";
    };
    reader.readAsDataURL(file);
}

function renderAdminProducts() {
    const products = getProducts();
    const tbody = document.getElementById("productsTable");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No products found. Click "+ Add Product".</td></tr>';
        renderPaginationControls("productsPagination", 0, 1, function(){});
        return;
    }

    const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
    if (paginationState.products > totalPages) paginationState.products = Math.max(1, totalPages);

    const paginatedProducts = getPaginatedItems(products, paginationState.products);

    paginatedProducts.forEach(function(p) {
        const realIndex = products.findIndex(x => x.id === p.id);
        const categoryLabel = CATEGORY_LABELS[p.category] || p.category;
        const imgSrc = getImageSrc(p);
        const lowStockBadge = p.stock === 0
            ? '<span class="badge bg-danger ms-1">Out</span>'
            : (p.stock < 5 ? '<span class="badge bg-warning text-dark ms-1">Low</span>' : '');

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong class="text-success">#${realIndex + 1}</strong></td>
            <td><img src="${imgSrc}" style="width: 60px; height: 45px; object-fit: cover;" class="rounded border"></td>
            <td>${p.name}</td>
            <td><span class="badge bg-secondary">${categoryLabel}</span></td>
            <td>₱${p.price.toFixed(2)}</td>
            <td>${p.stock} ${lowStockBadge}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-product" data-index="${realIndex}">Edit</button>
                <button class="btn btn-sm btn-danger delete-product" data-index="${realIndex}">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll(".edit-product").forEach(function(btn) {
        btn.addEventListener("click", function() {
            openEditProductModal(parseInt(btn.getAttribute("data-index")));
        });
    });

    document.querySelectorAll(".delete-product").forEach(function(btn) {
        btn.addEventListener("click", function() {
            deleteProduct(parseInt(btn.getAttribute("data-index")));
        });
    });

    renderPaginationControls("productsPagination", products.length, paginationState.products, function(newPage) {
        paginationState.products = newPage;
        renderAdminProducts();
    });
}

let productModalInstance = null;

function openAddProductModal() {
    document.getElementById("productModalTitle").textContent = "Add Product";
    document.getElementById("productIndex").value = "-1";
    document.getElementById("productForm").reset();
    document.getElementById("productForm").classList.remove("was-validated");

    const preview = document.getElementById("imagePreview");
    const hiddenData = document.getElementById("productImageData");
    const removeBtn = document.getElementById("removeImageBtn");

    hiddenData.value = "";
    preview.src = "";
    preview.style.display = "none";
    removeBtn.style.display = "none";

    populateCategoryDropdown();
    productModalInstance.show();
}

function openEditProductModal(index) {
    const products = getProducts();
    const p = products[index];

    populateCategoryDropdown();

    document.getElementById("productModalTitle").textContent = "Edit Product";
    document.getElementById("productIndex").value = index;
    document.getElementById("productName").value = p.name;
    document.getElementById("productCategory").value = p.category;
    document.getElementById("productPrice").value = p.price;
    document.getElementById("productStock").value = p.stock;

    const preview = document.getElementById("imagePreview");
    const hiddenData = document.getElementById("productImageData");
    const removeBtn = document.getElementById("removeImageBtn");
    const fileInput = document.getElementById("productImageFile");

    fileInput.value = "";

    if (p.image && p.image.trim() !== "") {
        hiddenData.value = p.image;
        preview.src = p.image;
        preview.style.display = "block";
        removeBtn.style.display = "inline-block";
    } else {
        hiddenData.value = "";
        preview.src = "";
        preview.style.display = "none";
        removeBtn.style.display = "none";
    }

    document.getElementById("productForm").classList.remove("was-validated");
    productModalInstance.show();
}

function populateCategoryDropdown() {
    const select = document.getElementById("productCategory");
    if (!select) return;
    const categories = getCategories();
    select.innerHTML = '<option value="">-- Select a category --</option>' +
        categories.map(function(c) {
            return '<option value="' + c.slug + '">' + c.name + '</option>';
        }).join("");
}

async function saveProductFromModal() {
    const form = document.getElementById("productForm");
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }

    const index = parseInt(document.getElementById("productIndex").value);
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value;
    const price = parseFloat(document.getElementById("productPrice").value);
    const stock = parseInt(document.getElementById("productStock").value);
    const imageData = document.getElementById("productImageData").value;

    if (!category) return showToast("Please select a category.", "warning");
    if (name.length < 2) return showToast("Product name must be at least 2 characters.", "warning");
    if (isNaN(price) || price < 0) return showToast("Invalid price.", "danger");
    if (isNaN(stock) || stock < 0) return showToast("Invalid stock.", "danger");

    const products = getProducts();
    const isEdit = index !== -1;
    const productId = isEdit ? products[index].id : null;

    const payload = { id: productId, name: name, category: category, price: price, stock: stock, image: imageData || "" };

    try {
        const response = await fetch('api/admin-products.php', {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            showToast(isEdit ? "Product updated successfully!" : "Product added successfully!", "success");
            await getProductsFromDB(); 
            renderAdminProducts();
            productModalInstance.hide();
        } else {
            showToast(data.message, "danger");
        }
    } catch (error) {
        showToast("Server error. Try again.", "danger");
    }
}

function deleteProduct(index) {
    const products = getProducts();
    const productName = products[index].name;
    const productId = products[index].id;

    showConfirm(
        "Are you sure you want to delete product '" + productName + "'? This cannot be undone.",
        async function() {
            try {
                const response = await fetch('api/admin-products.php', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: productId })
                });
                const data = await response.json();

                if (data.success) {
                    showToast("Product deleted.", "success");
                    await getProductsFromDB(); 
                    renderAdminProducts();
                } else {
                    showToast(data.message, "danger");
                }
            } catch (error) {
                showToast("Server error. Try again.", "danger");
            }
        },
        { title: "Delete Product", confirmText: "Delete", type: "danger" }
    );
}

function renderSalesSummary() {
    const orders = getOrders();
    let totalSales = 0;
    let completedCount = 0;
    let pendingCount = 0;

    orders.forEach(function(o) {
        if (o.status === "Completed") { totalSales += o.total; completedCount++; }
        if (o.status === "Pending") pendingCount++;
    });

    const el = function(id, val) {
        const e = document.getElementById(id);
        if (e) e.textContent = val;
    };

    el("totalOrders", orders.length);
    el("totalSales", "₱" + totalSales.toFixed(2));
    el("pendingCount", pendingCount);
    el("completedCount", completedCount);
}

function renderCharts() {
    const orders = getOrders().filter(o => o.status === "Completed");
    renderSalesTrendChart(orders);
    renderCategoryChart(orders);
}

function renderSalesTrendChart(orders) {
    const canvas = document.getElementById("salesTrendChart");
    if (!canvas) return;

    const salesByDate = {};
    orders.forEach(function(o) {
        const dateStr = new Date(o.date).toISOString().split("T")[0];
        salesByDate[dateStr] = (salesByDate[dateStr] || 0) + o.total;
    });

    const sortedDates = Object.keys(salesByDate).sort();
    const labels = sortedDates.map(d => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    const data = sortedDates.map(d => salesByDate[d]);

    if (salesTrendChartInstance) salesTrendChartInstance.destroy();

    const ctx = canvas.getContext("2d");
    salesTrendChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels.length > 0 ? labels : ["No Data"],
            datasets: [{
                label: "Sales (₱)",
                data: data.length > 0 ? data : [0],
                borderColor: "#198754",
                backgroundColor: "rgba(25, 135, 84, 0.1)",
                borderWidth: 2, tension: 0.3, fill: true, pointBackgroundColor: "#198754", pointRadius: 4, pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { return "₱" + context.parsed.y.toFixed(2); } } } },
            scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return "₱" + value; } } } }
        }
    });
}

function renderCategoryChart(orders) {
    const canvas = document.getElementById("categoryChart");
    if (!canvas) return;

    const products = getProducts();
    const categories = getCategories();
    const productCategoryMap = {};
    products.forEach(function(p) { productCategoryMap[p.name] = p.category; });

    const salesByCategory = {};
    orders.forEach(function(o) {
        o.items.forEach(function(item) {
            const categorySlug = productCategoryMap[item.name] || "unknown";
            salesByCategory[categorySlug] = (salesByCategory[categorySlug] || 0) + (item.price * item.qty);
        });
    });

    const categoryLabels = [];
    const categoryData = [];
    const colors = ["#198754", "#0d6efd", "#dc3545", "#ffc107", "#6f42c1", "#fd7e14", "#20c997", "#e83e8c", "#6610f2", "#0dcaf0"];

    Object.keys(salesByCategory).forEach(function(slug) {
        const cat = categories.find(c => c.slug === slug);
        categoryLabels.push(cat ? cat.name : slug);
        categoryData.push(salesByCategory[slug]);
    });

    if (categoryChartInstance) categoryChartInstance.destroy();

    const ctx = canvas.getContext("2d");
    if (categoryLabels.length === 0) { categoryLabels.push("No Data"); categoryData.push(1); }

    categoryChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: categoryLabels,
            datasets: [{ data: categoryData, backgroundColor: colors.slice(0, categoryLabels.length), borderWidth: 2, borderColor: "#fff" }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { padding: 15, font: { size: 12 } } },
                tooltip: { callbacks: { label: function(context) {
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percent = ((context.parsed / total) * 100).toFixed(1);
                    return context.label + ": ₱" + context.parsed.toFixed(2) + " (" + percent + "%)";
                }}}
            }
        }
    });
}

function renderAdminOrders() {
    const orders = getOrders();
    const tbody = document.getElementById("adminOrdersTable");
    if (!tbody) return;

    const search = (document.getElementById("orderSearch")?.value || "").toLowerCase();
    const statusFilter = document.getElementById("orderStatusFilter")?.value || "all";

    let filtered = orders;
    if (statusFilter !== "all") filtered = filtered.filter(o => o.status === statusFilter);
    if (search) filtered = filtered.filter(o => String(o.id).includes(search) || (o.customer_name || "").toLowerCase().includes(search));

    tbody.innerHTML = "";

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No orders found.</td></tr>';
        renderPaginationControls("ordersPagination", 0, 1, function(){});
        return;
    }

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (paginationState.orders > totalPages) paginationState.orders = Math.max(1, totalPages);

    const paginatedOrders = getPaginatedItems(filtered, paginationState.orders);

    paginatedOrders.forEach(function(order) {
        const realIndex = orders.findIndex(o => o.id === order.id);
        let statusColor = "bg-warning text-dark";
        if (order.status === "Received") statusColor = "bg-info text-dark";
        if (order.status === "Preparing") statusColor = "bg-primary";
        if (order.status === "Ready for Pickup") statusColor = "bg-success";
        if (order.status === "Completed") statusColor = "bg-secondary";
        if (order.status === "Cancelled") statusColor = "bg-danger";

        const paymentBadge = order.payment
            ? '<span class="badge bg-success">✅ Paid</span>'
            : '<span class="badge bg-light text-dark">⏳ Unpaid</span>';

        const canCancel = order.status !== "Completed" && order.status !== "Cancelled";
        const cancelBtn = canCancel
            ? `<button class="btn btn-sm btn-outline-danger ms-1 cancel-order-btn" data-index="${realIndex}" title="Cancel Order">✕ Cancel</button>`
            : '';

        const cancelReason = (order.status === "Cancelled" && order.cancel_reason)
            ? `<br><small class="text-danger">Reason: ${order.cancel_reason}</small>`
            : '';

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${order.id}</td>
            <td>${formatDisplayDate(order.date)}</td>
            <td>${order.customer_name || "Guest"}</td>
            <td>₱${order.total.toFixed(2)}</td>
            <td><span class="badge ${statusColor}">${order.status}</span>${cancelReason}</td>
            <td>${paymentBadge}</td>
            <td>
                <div class="d-flex align-items-center flex-wrap gap-1">
                    <select class="form-select form-select-sm status-select" data-index="${realIndex}" style="max-width: 160px;">
                        ${["Pending","Received","Preparing","Ready for Pickup","Completed","Cancelled"].map(s =>
                            `<option ${order.status === s ? "selected" : ""}>${s}</option>`
                        ).join("")}
                    </select>
                    ${cancelBtn}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    tbody.querySelectorAll(".status-select").forEach(function(select) {
        select.addEventListener("change", async function() {
            const index = parseInt(select.getAttribute("data-index"));
            const newStatus = select.value;

            if (newStatus === "Cancelled") {
                openCancelOrderModal(index);
                return;
            }

            const success = await updateOrderStatus(index, newStatus);
            if (success !== false) {
                showToast("Order status updated to " + newStatus + ".", "success");
                renderAdminOrders();
                renderSalesSummary();
                renderCompletedTransactions();
            } else {
                renderAdminOrders();
            }
        });
    });

    tbody.querySelectorAll(".cancel-order-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
            openCancelOrderModal(parseInt(btn.getAttribute("data-index")));
        });
    });

    renderPaginationControls("ordersPagination", filtered.length, paginationState.orders, function(newPage) {
        paginationState.orders = newPage;
        renderAdminOrders();
    });
}

let cancelOrderModalInstance = null;

function openCancelOrderModal(index) {
    const orders = getOrders();
    const o = orders[index];
    if (!o) return;

    if (o.status === "Completed" || o.status === "Cancelled") {
        showToast("Cannot cancel an order that is already " + o.status + ".", "warning");
        return;
    }

    document.getElementById("cancelOrderIndex").value = index;
    document.getElementById("cancelOrderId").textContent = o.id;
    document.getElementById("cancelOrderCustomer").textContent = o.customer_name || "Guest";
    document.getElementById("cancelOrderTotal").textContent = o.total.toFixed(2);
    document.getElementById("cancelReasonSelect").value = "";
    document.getElementById("cancelReasonNotes").value = "";

    cancelOrderModalInstance.show();
}

async function confirmCancelOrder() {
    const index = parseInt(document.getElementById("cancelOrderIndex").value);
    const reason = document.getElementById("cancelReasonSelect").value;
    const notes = document.getElementById("cancelReasonNotes").value.trim();

    if (!reason) {
        showToast("Please select a reason for cancellation.", "warning");
        return;
    }

    let finalReason = reason;
    if (notes) finalReason += " — " + notes;

    const success = await updateOrderStatus(index, "Cancelled", finalReason);

    if (success !== false) {
        cancelOrderModalInstance.hide();
        renderAdminOrders();
        renderSalesSummary();
        renderCompletedTransactions();
        showToast("Order cancelled. Reason: " + finalReason, "success");
    }
}

function renderCompletedTransactions() {
    const tbody = document.getElementById("completedTransactionsTable");
    const totalEl = document.getElementById("reportTotal");
    if (!tbody) return;

    const fromDate = document.getElementById("salesFromDate")?.value;
    const toDate = document.getElementById("salesToDate")?.value;

    let orders = getOrders().filter(o => o.status === "Completed");
    if (fromDate) orders = orders.filter(o => new Date(o.date).getTime() >= new Date(fromDate).getTime());
    if (toDate) orders = orders.filter(o => new Date(o.date).getTime() <= new Date(toDate).getTime() + 86400000);

    tbody.innerHTML = "";
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No completed transactions.</td></tr>';
        if (totalEl) totalEl.textContent = "₱0.00";
        renderPaginationControls("completedPagination", 0, 1, function(){});
        return;
    }

    let total = 0;
    const productCount = {};
    orders.forEach(function(o) {
        total += o.total;
        o.items.forEach(function(i) { productCount[i.name] = (productCount[i.name] || 0) + i.qty; });
    });
    if (totalEl) totalEl.textContent = "₱" + total.toFixed(2);

    const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
    if (paginationState.completed > totalPages) paginationState.completed = Math.max(1, totalPages);

    const paginatedOrders = getPaginatedItems(orders, paginationState.completed);

    paginatedOrders.forEach(function(o) {
        const items = o.items.map(i => i.name + " x" + i.qty).join(", ");
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${o.id}</td>
            <td>${formatDisplayDate(o.date)}</td>
            <td>${o.customer_name || "Guest"}</td>
            <td><small>${items}</small></td>
            <td>₱${o.total.toFixed(2)}</td>
            <td>${o.payment ? '<span class="badge bg-success">✅ Paid</span>' : '<span class="badge bg-warning text-dark">⚠️ Missing</span>'}</td>
        `;
        tbody.appendChild(row);
    });

    const topList = document.getElementById("topProductsList");
    if (topList) {
        const top = Object.entries(productCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
        topList.innerHTML = top.length === 0 ? '<li class="text-muted">No data available.</li>' : top.map(([name, qty]) => `<li>${name} — <strong>${qty}</strong> sold</li>`).join("");
    }

    renderPaginationControls("completedPagination", orders.length, paginationState.completed, function(newPage) {
        paginationState.completed = newPage;
        renderCompletedTransactions();
    });
}

let categoryModalInstance = null;

function renderCategories() {
    const categories = getCategories();
    const tbody = document.getElementById("categoriesTable");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No categories found.</td></tr>';
        return;
    }

    categories.forEach(function(c, index) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${c.id}</td>
            <td>${c.name}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-category" data-index="${index}">Edit</button>
                <button class="btn btn-sm btn-danger delete-category" data-index="${index}">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll(".edit-category").forEach(function(btn) {
        btn.addEventListener("click", function() { openEditCategoryModal(parseInt(btn.getAttribute("data-index"))); });
    });

    document.querySelectorAll(".delete-category").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const index = parseInt(btn.getAttribute("data-index"));
            const categories = getCategories();
            const catName = categories[index].name;

            showConfirm("Are you sure you want to delete category '" + catName + "'?", function() {
                const cats = getCategories();
                cats.splice(index, 1);
                saveCategories(cats);
                renderCategories();
                showToast("Category deleted.", "success");
            }, { title: "Delete Category", confirmText: "Delete", type: "danger" });
        });
    });
}

function openAddCategoryModal() {
    document.getElementById("categoryModalTitle").textContent = "Add Category";
    document.getElementById("categoryIndex").value = "-1";
    document.getElementById("categoryForm").reset();
    document.getElementById("categoryForm").classList.remove("was-validated");
    categoryModalInstance.show();
}

function openEditCategoryModal(index) {
    const categories = getCategories();
    const c = categories[index];
    if (!c) return;

    document.getElementById("categoryModalTitle").textContent = "Edit Category";
    document.getElementById("categoryIndex").value = index;
    document.getElementById("categoryNameInput").value = c.name;
    document.getElementById("categoryForm").classList.remove("was-validated");
    categoryModalInstance.show();
}

function saveCategoryFromModal() {
    const form = document.getElementById("categoryForm");
    const nameInput = document.getElementById("categoryNameInput");
    const name = nameInput.value.trim();

    if (name.length < 2) { form.classList.add("was-validated"); return; }

    const index = parseInt(document.getElementById("categoryIndex").value);
    const categories = getCategories();

    const duplicate = categories.find(function(c, i) { return c.name.toLowerCase() === name.toLowerCase() && i !== index; });
    if (duplicate) { showToast("A category with this name already exists.", "warning"); return; }

    if (index === -1) {
        const newId = categories.length > 0 ? Math.max.apply(null, categories.map(function(c) { return c.id; })) + 1 : 1;
        categories.push({ id: newId, name: name, slug: name.toLowerCase().replace(/\s+/g, "-") });
        saveCategories(categories);
        renderCategories();
        categoryModalInstance.hide();
        showToast("Category added successfully!", "success");
    } else {
        categories[index].name = name;
        categories[index].slug = name.toLowerCase().replace(/\s+/g, "-");
        saveCategories(categories);
        renderCategories();
        categoryModalInstance.hide();
        showToast("Category updated successfully!", "success");
    }
}

function addCategory() { openAddCategoryModal(); }

// =========================
// STAFF: ORDERS TABLE
// =========================

function renderStaffOrders() {
    const orders = getOrders();
    const tbody = document.getElementById("staffOrdersTable");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No orders found.</td></tr>';
        return;
    }

    let pending = 0, preparing = 0, ready = 0, completed = 0;

    orders.forEach(function(order, index) {
        if (order.status === "Pending") pending++;
        if (order.status === "Preparing") preparing++;
        if (order.status === "Ready for Pickup") ready++;
        if (order.status === "Completed") completed++;
        let statusColor = "bg-warning text-dark";
        if (order.status === "Received") statusColor = "bg-info text-dark";
        if (order.status === "Preparing") statusColor = "bg-primary";
        if (order.status === "Ready for Pickup") statusColor = "bg-success";
        if (order.status === "Completed") statusColor = "bg-secondary";
        if (order.status === "Cancelled") statusColor = "bg-danger";

        const itemsList = order.items.map(function(i) { return i.name + " x" + i.qty; }).join(", ");

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customer_name || "Guest"}</td>
            <td><small>${itemsList}</small></td>
            <td><small>${order.pickup_date || "-"}<br>${order.pickup_time || "-"}</small></td>
            <td>₱${order.total.toFixed(2)}</td>
            <td><span class="badge ${statusColor}">${order.status}</span></td>
            <td>
                <select class="form-select form-select-sm status-select" data-index="${index}">
                    <option ${order.status === "Pending" ? "selected" : ""}>Pending</option>
                    <option ${order.status === "Received" ? "selected" : ""}>Received</option>
                    <option ${order.status === "Preparing" ? "selected" : ""}>Preparing</option>
                    <option ${order.status === "Ready for Pickup" ? "selected" : ""}>Ready for Pickup</option>
                    <option ${order.status === "Completed" ? "selected" : ""}>Completed</option>
                    <option ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                </select>
            </td>
        `;
        tbody.appendChild(row);
    });

    const pendingEl = document.getElementById("pendingCount");
    const preparingEl = document.getElementById("preparingCount");
    const readyEl = document.getElementById("readyCount");
    const completedEl = document.getElementById("completedCount");

    if (pendingEl) pendingEl.textContent = pending;
    if (preparingEl) preparingEl.textContent = preparing;
    if (readyEl) readyEl.textContent = ready;
    if (completedEl) completedEl.textContent = completed;

    tbody.querySelectorAll(".status-select").forEach(function(select) {
        select.addEventListener("change", async function() {
            const index = parseInt(select.getAttribute("data-index"));
            const success = await updateOrderStatus(index, select.value);
            if (success !== false) showToast("Order status updated to " + select.value + ".", "success");
            renderStaffOrders();
            renderStaffStock();
            if (typeof renderReadyOrders === "function") renderReadyOrders();
        });
    });
}

// =========================
// STAFF: STOCK MONITORING
// =========================

function renderStaffStock() {
    const products = getProducts();
    const tbody = document.getElementById("staffStockTable");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No products found.</td></tr>';
        return;
    }

    products.forEach(function(p) {
        let status = '<span class="badge bg-success">OK</span>';
        if (p.stock === 0) status = '<span class="badge bg-danger">Out of Stock</span>';
        else if (p.stock < 5) status = '<span class="badge bg-warning text-dark">Low Stock</span>';

        const categoryLabel = CATEGORY_LABELS[p.category] || p.category;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${p.name}</td>
            <td><span class="badge bg-secondary">${categoryLabel}</span></td>
            <td>
                <input type="number" class="form-control form-control-sm stock-update-input"
                       value="${p.stock}" min="0" data-id="${p.id}">
            </td>
            <td>${status}</td>
        `;
        tbody.appendChild(row);
    });

    tbody.querySelectorAll(".stock-update-input").forEach(function(input) {
        input.addEventListener("change", function() {
            const id = parseInt(input.getAttribute("data-id"));
            const newStock = parseInt(input.value);
            if (isNaN(newStock) || newStock < 0) { showToast("Invalid stock value.", "danger"); return; }
            const products = getProducts();
            const product = products.find(function(p) { return p.id === id; });
            if (product) {
                product.stock = newStock;
                saveProducts(products);
                renderStaffStock();
                showToast("Stock updated: " + product.name + " = " + newStock, "success");
            }
        });
    });
}

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", async function() {
    // ADMIN PAGE
    if (document.getElementById("productsTable")) {
        if (!requireRole(["admin"])) return;

        await getProductsFromDB();
        await getOrdersFromDB();

        const modalEl = document.getElementById("productModal");
        if (modalEl) productModalInstance = new bootstrap.Modal(modalEl);
        const catModalEl = document.getElementById("categoryModal");
        if (catModalEl) categoryModalInstance = new bootstrap.Modal(catModalEl);
        const cancelModalEl = document.getElementById("cancelOrderModal");
        if (cancelModalEl) cancelOrderModalInstance = new bootstrap.Modal(cancelModalEl);

        renderAdminProducts();
        renderSalesSummary();
        renderAdminOrders();
        renderCompletedTransactions();
        renderCategories();
        renderCharts();
        attachLogout();
        attachImageUploadListeners();

        const addBtn = document.getElementById("addProductBtn");
        if (addBtn) addBtn.addEventListener("click", openAddProductModal);
        const saveBtn = document.getElementById("saveProductBtn");
        if (saveBtn) saveBtn.addEventListener("click", saveProductFromModal);
        const addCatBtn = document.getElementById("addCategoryBtn");
        if (addCatBtn) addCatBtn.addEventListener("click", openAddCategoryModal);
        const saveCatBtn = document.getElementById("saveCategoryBtn");
        if (saveCatBtn) saveCatBtn.addEventListener("click", saveCategoryFromModal);
        const confirmCancelBtn = document.getElementById("confirmCancelOrderBtn");
        if (confirmCancelBtn) confirmCancelBtn.addEventListener("click", confirmCancelOrder);

        const salesFrom = document.getElementById("salesFromDate");
        const salesTo = document.getElementById("salesToDate");
        const clearSales = document.getElementById("clearSalesFilter");
        if (salesFrom) salesFrom.addEventListener("change", renderCompletedTransactions);
        if (salesTo) salesTo.addEventListener("change", renderCompletedTransactions);
        if (clearSales) clearSales.addEventListener("click", function() {
            if (salesFrom) salesFrom.value = "";
            if (salesTo) salesTo.value = "";
            renderCompletedTransactions();
        });

        const orderSearch = document.getElementById("orderSearch");
        const orderStatusFilter = document.getElementById("orderStatusFilter");
        if (orderSearch) orderSearch.addEventListener("input", function() { paginationState.orders = 1; renderAdminOrders(); });
                if (orderStatusFilter) orderStatusFilter.addEventListener("change", function() { paginationState.orders = 1; renderAdminOrders(); });

        // Auto-sync every 15s para laging updated ang Admin dashboard sa mga bagong order ng Customer at Staff
        setInterval(async function() {
            try {
                await getProductsFromDB();
                await getOrdersFromDB();
                renderAdminProducts();
                renderSalesSummary();
                renderAdminOrders();
                renderCompletedTransactions();
                renderCharts();
            } catch (err) {}
        }, 15000);
    }

    // STAFF PAGE
    if (document.getElementById("staffOrdersTable")) {
        if (!requireRole(["staff", "admin"])) return;
        attachLogout();
    }
});
