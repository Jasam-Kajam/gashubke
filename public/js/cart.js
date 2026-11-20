const CART_STORAGE_KEY = "gas_cart";
const DEFAULT_DELIVERY_FEE = 200;

export let cart = loadCartFromStorage();

function loadCartFromStorage() {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("Unable to read cart from localStorage:", error);
        return [];
    }
}

function saveCart(showToastMessage = "") {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
        console.warn("Unable to save cart to localStorage:", error);
    }

    updateCartBadge();
    renderCartView();

    if (showToastMessage) {
        showCartToast(showToastMessage);
    }
}

export function getCartItems() {
    return cart;
}

export function addToCart(product) {
    if (!product || !product.id) return;

    const unitPrice = Number(product.price) || 0;
    const existing = cart.find(item => String(item.id) === String(product.id));

    if (existing) {
        existing.quantity = (Number(existing.quantity) || 1) + 1;
    } else {
        cart.push({
            id: product.id,
            title: product.title || product.name || "Gas Item",
            price: unitPrice,
            quantity: 1,
            location: product.location || product.county || "",
            vendorId: product.vendorId || product.supplierId || "",
            supplierName: product.supplierName || product.businessName || "",
            image: product.image || ""
        });
    }

    saveCart(`${product.title || "Item"} added to cart.`);
}

export function updateCartQuantity(itemId, delta) {
    const index = cart.findIndex(item => String(item.id) === String(itemId));
    if (index === -1) return;

    const nextQty = (Number(cart[index].quantity) || 1) + Number(delta || 0);
    if (nextQty <= 0) {
        cart.splice(index, 1);
    } else {
        cart[index].quantity = nextQty;
    }

    saveCart();
}

export function removeFromCart(itemId) {
    const nextCart = cart.filter(item => String(item.id) !== String(itemId));
    cart.length = 0;
    cart.push(...nextCart);
    saveCart("Item removed from cart.");
}

export function clearCart() {
    cart.length = 0;
    saveCart();
}

export function getCartSubtotal() {
    return cart.reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + price * qty;
    }, 0);
}

export function getEstimatedDeliveryFee(subtotal = getCartSubtotal()) {
    if (!cart.length || subtotal <= 0) return 0;
    return DEFAULT_DELIVERY_FEE;
}

export function getCartTotal() {
    const subtotal = getCartSubtotal();
    return subtotal + getEstimatedDeliveryFee(subtotal);
}

export function updateCartBadge() {
    const badge = document.getElementById("cartCount");
    if (!badge) return;

    const totalQty = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    badge.textContent = String(totalQty);
}

export function renderCartView() {
    const itemsContainer = document.getElementById("cartItemsList");
    const subtotalEl = document.getElementById("cartSubtotal");
    const deliveryEl = document.getElementById("cartDelivery");
    const totalEl = document.getElementById("cartTotal");

    const subtotal = getCartSubtotal();
    const deliveryFee = getEstimatedDeliveryFee(subtotal);
    const total = subtotal + deliveryFee;

    if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toLocaleString()}`;
    if (deliveryEl) deliveryEl.textContent = `KES ${deliveryFee.toLocaleString()}`;
    if (totalEl) totalEl.textContent = `KES ${total.toLocaleString()}`;

    if (!itemsContainer) return;

    if (!cart.length) {
        itemsContainer.innerHTML = `<p style="color:#64748b;padding:1rem 0;">Your cart is currently empty.</p>`;
        return;
    }

    itemsContainer.innerHTML = cart
        .map(item => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.price) || 0;
            const lineTotal = price * qty;

            return `
                <div class="cart-item-row" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:0.85rem 0;border-bottom:1px solid #e2e8f0;">
                    <div>
                        <div style="font-weight:700;color:#0f172a;">${escapeHtml(item.title)}</div>
                        <div style="font-size:0.9rem;color:#64748b;">KES ${price.toLocaleString()} each${item.location ? ` · ${escapeHtml(item.location)}` : ""}</div>
                        <div style="font-size:0.85rem;font-weight:600;color:#334155;margin-top:0.2rem;">Line total: KES ${lineTotal.toLocaleString()}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.45rem;">
                        <button type="button" data-cart-action="dec" data-item-id="${escapeAttr(item.id)}" style="padding:0.35rem 0.65rem;cursor:pointer;">-</button>
                        <span style="min-width:1.5rem;text-align:center;font-weight:600;">${qty}</span>
                        <button type="button" data-cart-action="inc" data-item-id="${escapeAttr(item.id)}" style="padding:0.35rem 0.65rem;cursor:pointer;">+</button>
                        <button type="button" data-cart-action="remove" data-item-id="${escapeAttr(item.id)}" style="padding:0.35rem 0.7rem;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;">Remove</button>
                    </div>
                </div>
            `;
        })
        .join("");
}

function showCartToast(message) {
    let toast = document.getElementById("gasHubCartToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "gasHubCartToast";
        toast.style.cssText = [
            "position:fixed",
            "bottom:20px",
            "right:20px",
            "z-index:99999",
            "background:#0f172a",
            "color:#ffffff",
            "padding:10px 16px",
            "border-radius:10px",
            "font-size:14px",
            "box-shadow:0 10px 25px rgba(0,0,0,0.2)",
            "transition:opacity 0.2s ease",
            "opacity:0",
            "pointer-events:none"
        ].join(";");
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = "1";

    clearTimeout(showCartToast._timer);
    showCartToast._timer = setTimeout(() => {
        toast.style.opacity = "0";
    }, 2200);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
    return String(value ?? "").replace(/"/g, "&quot;");
}

document.addEventListener("click", event => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;

    const action = button.getAttribute("data-cart-action");
    const itemId = button.getAttribute("data-item-id");
    if (!itemId) return;

    if (action === "inc") updateCartQuantity(itemId, 1);
    else if (action === "dec") updateCartQuantity(itemId, -1);
    else if (action === "remove") removeFromCart(itemId);
});

document.addEventListener("DOMContentLoaded", () => {
    updateCartBadge();
    renderCartView();
});

// Expose helpers for non-module callers if needed
window.gasHubCart = {
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    getCartSubtotal,
    getEstimatedDeliveryFee,
    getCartTotal,
    renderCartView,
    updateCartBadge
};
