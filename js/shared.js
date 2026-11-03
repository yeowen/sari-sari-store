// =========================
// SHARED DATA LAYER
// =========================

const API_URL = "api"; // Folder kung nasaan ang mga PHP files

// ---------- PRODUCTS ----------

async function getProductsFromDB() {
    try {
        const response = await fetch(`${API_URL}/products.php`);
        const data = await response.json();
        localStorage.setItem("products", JSON.stringify(data));
        return data;
    } catch (error) {
        console.error("Error fetching products:", error);
        return getProducts();
    }
}

function getProducts() {
    let products = JSON.parse(localStorage.getItem("products") || "null");
    if (!products || products.length === 0) {
        products = [
            { id: 1, name: "Coca-Cola 1.5L", category: "beverages", price: 75, stock: 20, image: "" },
            { id: 2, name: "Lucky Me Pancit Canton", category: "snacks", price: 18, stock: 35, image: "" },
            { id: 3, name: "Safeguard Soap", category: "personal", price: 25, stock: 15, image: "" },
            { id: 4, name: "Bear Brand Milk", category: "beverages", price: 15, stock: 25, image: "" }
        ];
        localStorage.setItem("products", JSON.stringify(products));
    }
    return products;
}

function saveProducts(products) {
    try {
        localStorage.setItem("products", JSON.stringify(products));
    } catch (e) {
        showToast("❌ Storage full! Cannot save the new product/image.", "danger");
        throw e;
    }
}

// ---------- ORDERS ----------

async function getOrdersFromDB() {
    try {
        const response = await fetch(`${API_URL}/orders.php`);
        const data = await response.json();
        localStorage.setItem("orders", JSON.stringify(data));
        return data;
    } catch (error) {
        console.error("Error fetching orders:", error);
        return getOrders();
    }
}

function getOrders() {
    return JSON.parse(localStorage.getItem("orders") || "[]");
}

function saveOrders(orders) {
    localStorage.setItem("orders", JSON.stringify(orders));
}

// ---------- USERS (Para sa Admin Settings) ----------

async function getUsersFromDB() {
    try {
        const response = await fetch(`${API_URL}/users.php`);
        const data = await response.json();
        localStorage.setItem("users", JSON.stringify(data));
        return data;
    } catch (error) {
        console.error("Error fetching users:", error);
        return JSON.parse(localStorage.getItem("users") || "[]");
    }
}

// ---------- NOTIFICATIONS ----------

function addNotification(recipientEmail, message, recipientRole) {
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    notifications.push({
        userEmail: recipientEmail || "",
        recipientRole: recipientRole || "customer",
        message: message,
        date: new Date().toISOString(),
        read: false
    });
    localStorage.setItem("notifications", JSON.stringify(notifications));
}

// ---------- CATEGORIES ----------

function getCategories() {
    let categories = JSON.parse(localStorage.getItem("categories") || "null");
    if (!categories || categories.length === 0) {
        categories = [
            { id: 1, name: "Beverages", slug: "beverages" },
            { id: 2, name: "Snacks", slug: "snacks" },
            { id: 3, name: "Canned Goods", slug: "canned" },
            { id: 4, name: "Personal Care", slug: "personal" },
            { id: 5, name: "Household", slug: "household" }
        ];
        localStorage.setItem("categories", JSON.stringify(categories));
    }
    return categories;
}

function saveCategories(categories) {
    localStorage.setItem("categories", JSON.stringify(categories));
}

// ---------- STOCK ----------

function deductStock(items) {
    const products = getProducts();
    items.forEach(function(item) {
        const product = products.find(function(p) {
            return p.name === item.name;
        });
        if (product) {
            product.stock = Math.max(0, product.stock - item.qty);
        }
    });
    saveProducts(products);
}

function restoreStock(items) {
    const products = getProducts();
    items.forEach(function(item) {
        const product = products.find(function(p) {
            return p.name === item.name;
        });
        if (product) {
            product.stock = product.stock + item.qty;
        }
    });
    saveProducts(products);
}

// ---------- DATE HELPERS ----------

function nowISO() {
    return new Date().toISOString();
}

function formatDisplayDate(isoOrString) {
    const d = new Date(isoOrString);
    if (isNaN(d.getTime())) return isoOrString;
    return d.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
    });
}

// =========================
// UI HELPERS — TOAST / CONFIRM / PROMPT
// =========================

function ensureUIContainers() {
    if (!document.getElementById("toastContainer")) {
        const toastContainer = document.createElement("div");
        toastContainer.id = "toastContainer";
        toastContainer.className = "toast-container position-fixed top-0 end-0 p-3";
        toastContainer.style.zIndex = "9999";
        document.body.appendChild(toastContainer);
    }

    if (!document.getElementById("globalConfirmModal")) {
        const modal = document.createElement("div");
        modal.className = "modal fade";
        modal.id = "globalConfirmModal";
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header" id="globalConfirmHeader">
                        <h5 class="modal-title" id="globalConfirmTitle">Confirm</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p id="globalConfirmMessage" class="mb-0"></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="globalConfirmCancelBtn">Cancel</button>
                        <button type="button" class="btn btn-danger" id="globalConfirmOkBtn">Confirm</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    if (!document.getElementById("globalPromptModal")) {
        const modal = document.createElement("div");
        modal.className = "modal fade";
        modal.id = "globalPromptModal";
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title" id="globalPromptTitle">Input</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <label class="form-label" id="globalPromptLabel"></label>
                        <input type="text" class="form-control" id="globalPromptInput">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-success" id="globalPromptOkBtn">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureUIContainers);
} else {
    ensureUIContainers();
}

function showToast(message, type) {
    ensureUIContainers();
    type = type || "success";

    const iconMap = { success: "✅", danger: "❌", warning: "⚠️", info: "ℹ️", secondary: "🔔" };
    const bgMap = { success: "text-bg-success", danger: "text-bg-danger", warning: "text-bg-warning", info: "text-bg-info", secondary: "text-bg-secondary" };

    const container = document.getElementById("toastContainer");
    const toastEl = document.createElement("div");
    toastEl.className = "toast align-items-center border-0 " + (bgMap[type] || bgMap.success);
    toastEl.setAttribute("role", "alert");
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <span class="me-1">${iconMap[type] || ""}</span>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    container.appendChild(toastEl);

    if (window.bootstrap && bootstrap.Toast) {
        const bsToast = new bootstrap.Toast(toastEl, { delay: 3500 });
        bsToast.show();
        toastEl.addEventListener("hidden.bs.toast", function() { toastEl.remove(); });
    } else {
        toastEl.style.display = "block";
        setTimeout(function() { toastEl.remove(); }, 3500);
    }
}

function showConfirm(message, onConfirm, options) {
    ensureUIContainers();
    options = options || {};
    const title = options.title || "Confirm";
    const confirmText = options.confirmText || "Confirm";
    const type = options.type || "danger";

    const headerMap = { danger: "bg-danger text-white", success: "bg-success text-white", warning: "bg-warning text-dark", primary: "bg-primary text-white" };
    const btnMap = { danger: "btn-danger", success: "btn-success", warning: "btn-warning", primary: "btn-primary" };

    const modalEl = document.getElementById("globalConfirmModal");
    const header = document.getElementById("globalConfirmHeader");
    const titleEl = document.getElementById("globalConfirmTitle");
    const msgEl = document.getElementById("globalConfirmMessage");
    const okBtn = document.getElementById("globalConfirmOkBtn");

    header.className = "modal-header " + (headerMap[type] || headerMap.danger);
    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = confirmText;
    okBtn.className = "btn " + (btnMap[type] || btnMap.danger);

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    const modal = new bootstrap.Modal(modalEl);
    newOkBtn.addEventListener("click", function() {
        modal.hide();
        if (typeof onConfirm === "function") onConfirm();
    });
    modal.show();
}

function showPrompt(label, defaultValue, onConfirm, options) {
    ensureUIContainers();
    options = options || {};
    const title = options.title || "Input";
    const confirmText = options.confirmText || "Save";

    const modalEl = document.getElementById("globalPromptModal");
    const titleEl = document.getElementById("globalPromptTitle");
    const labelEl = document.getElementById("globalPromptLabel");
    const inputEl = document.getElementById("globalPromptInput");
    const okBtn = document.getElementById("globalPromptOkBtn");

    titleEl.textContent = title;
    labelEl.textContent = label;
    inputEl.value = defaultValue || "";
    inputEl.placeholder = options.placeholder || "";
    okBtn.textContent = confirmText;

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    const modal = new bootstrap.Modal(modalEl);
    newOkBtn.addEventListener("click", function() {
        const val = inputEl.value;
        modal.hide();
        if (typeof onConfirm === "function") onConfirm(val);
    });
    inputEl.onkeydown = function(e) {
        if (e.key === "Enter") { e.preventDefault(); newOkBtn.click(); }
    };
    modal.show();
    setTimeout(function() { inputEl.focus(); }, 400);
}