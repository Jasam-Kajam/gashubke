import { db, auth } from "./firebase-config.js";

import {
    collection,
    addDoc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    showSupplierProfileForm
} from "./auth.js";


// ============================================================
// GAS HUB KE - ORDERS.JS
// Vendor-Aware Checkout, M-Pesa Order Creation & Customer History
// ============================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatKES(amount) {
    return `KSh ${(Number(amount) || 0).toLocaleString()}`;
}

function normalizeKenyanPhone(rawPhone) {
    const digits = String(rawPhone || "").replace(/\D/g, "");
    if (digits.startsWith("254") && digits.length === 12) return digits;
    if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
    if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) return "254" + digits;
    return "";
}

function showOrderToast(message, isError = false) {
    if (!message) return;

    let toast = document.getElementById("gasHubOrderToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "gasHubOrderToast";
        toast.style.cssText = [
            "position:fixed",
            "bottom:20px",
            "right:20px",
            "z-index:99999",
            "color:#ffffff",
            "padding:12px 18px",
            "border-radius:10px",
            "font-size:14px",
            "font-weight:500",
            "box-shadow:0 12px 28px rgba(15,23,42,0.28)",
            "transition:opacity 0.2s ease",
            "opacity:0",
            "pointer-events:none"
        ].join(";");
        document.body.appendChild(toast);
    }

    toast.style.background = isError ? "#b91c1c" : "#0f172a";
    toast.textContent = message;
    toast.style.opacity = "1";

    clearTimeout(showOrderToast._timer);
    showOrderToast._timer = setTimeout(() => {
        toast.style.opacity = "0";
    }, 3000);
}


// ============================================================
// LOAD CUSTOMER ORDER HISTORY ("MY ORDERS")
// ============================================================

export async function loadCustomerOrders() {
    const ordersListEl = document.getElementById("customerOrdersList");
    if (!ordersListEl) return;

    const user = auth.currentUser;
    if (!user) {
        ordersListEl.innerHTML = `<p style="color:#64748b;">Please sign in to view your orders.</p>`;
        return;
    }

    ordersListEl.innerHTML = `<p style="color:#64748b;">Loading your order history...</p>`;

    try {
        const q = query(
            collection(db, "orders"),
            where("customerId", "==", user.uid)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            ordersListEl.innerHTML = `
                <div style="text-align:center;padding:2rem 1rem;color:#64748b;">
                    <p style="font-weight:600;color:#0f172a;margin-bottom:0.4rem;">No orders placed yet</p>
                    <p style="font-size:0.9rem;">Browse verified suppliers in the Marketplace to place your first gas order.</p>
                </div>
            `;
            return;
        }

        const orders = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

        ordersListEl.innerHTML = orders
            .map(order => {
                const items = Array.isArray(order.items) ? order.items : [];
                const itemsSummary = items
                    .map(i => `${escapeHTML(i.title)} × ${Number(i.quantity) || 1}`)
                    .join(", ");

                const dateLabel = order.createdAt
                    ? new Date(order.createdAt).toLocaleString("en-KE", {
                          dateStyle: "medium",
                          timeStyle: "short"
                      })
                    : "Recent";

                const status = order.status || "Pending M-Pesa Confirmation";
                const isCompleted = /delivered|completed|paid/i.test(status);
                const badgeBg = isCompleted ? "#dcfce7" : "#fff7ed";
                const badgeColor = isCompleted ? "#15803d" : "#c2410c";

                return `
                    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem;background:#ffffff;">
                        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.6rem;">
                            <div>
                                <strong style="color:#0f172a;">Order #${escapeHTML(order.id.slice(0, 8).toUpperCase())}</strong>
                                <span style="font-size:0.8rem;color:#64748b;margin-left:0.5rem;">${escapeHTML(dateLabel)}</span>
                            </div>
                            <span style="padding:4px 10px;border-radius:999px;font-size:0.78rem;font-weight:700;background:${badgeBg};color:${badgeColor};">
                                ${escapeHTML(status)}
                            </span>
                        </div>

                        <p style="margin:0 0 0.35rem;font-size:0.92rem;color:#1e293b;">
                            <strong>Items:</strong> ${itemsSummary || "Cooking Gas Order"}
                        </p>
                        <p style="margin:0 0 0.35rem;font-size:0.86rem;color:#64748b;">
                            <strong>Supplier:</strong> ${escapeHTML(order.supplierName || "Verified Supplier")} ·
                            <strong>Delivery:</strong> ${escapeHTML(order.deliveryAddress || "Not specified")}
                        </p>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.65rem;padding-top:0.65rem;border-top:1px solid #f1f5f9;">
                            <span style="font-size:0.82rem;color:#64748b;">
                                Delivery Fee: ${Number(order.deliveryFee) > 0 ? formatKES(order.deliveryFee) : "Free (Seller Handles Delivery)"}
                            </span>
                            <strong style="color:#ea580c;font-size:1rem;">Total: ${formatKES(order.total)}</strong>
                        </div>
                    </div>
                `;
            })
            .join("");
    } catch (error) {
        console.error("Error loading customer orders:", error);
        ordersListEl.innerHTML = `<p style="color:#b91c1c;">Unable to load your order history right now.</p>`;
    }
}

window.loadCustomerOrders = loadCustomerOrders;


// ============================================================
// GROUP CART BY VENDOR FOR CLEAN ORDER CREATION
// ============================================================

function groupCartItemsByVendor(items) {
    const groups = new Map();

    items.forEach(item => {
        const vendorKey = item.vendorId ? String(item.vendorId) : `direct_${item.id}`;
        if (!groups.has(vendorKey)) {
            groups.set(vendorKey, {
                vendorId: item.vendorId || "",
                supplierName: item.supplierName || "Verified Supplier",
                items: [],
                subtotal: 0,
                deliveryFee: 0,
                deliveryOffer: item.deliveryOffer || ""
            });
        }

        const group = groups.get(vendorKey);
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        const fee = Math.max(0, Number(item.deliveryFee) || 0);

        group.items.push({
            id: item.id,
            title: item.title,
            price,
            quantity,
            location: item.location || ""
        });
        group.subtotal += price * quantity;
        group.deliveryFee = Math.max(group.deliveryFee, fee);
        if (!group.deliveryOffer && item.deliveryOffer) {
            group.deliveryOffer = item.deliveryOffer;
        }
    });

    return [...groups.values()];
}


// ============================================================
// CHECKOUT FORM SUBMISSION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const checkoutForm = document.getElementById("checkoutForm");
    const settingsNavLink = document.getElementById("settingsNavLink");

    if (settingsNavLink) {
        settingsNavLink.addEventListener("click", async event => {
            event.preventDefault();
            const user = auth.currentUser;
            if (!user) {
                const authModal = document.getElementById("authModal");
                if (authModal) authModal.style.display = "flex";
                return;
            }
            await showSupplierProfileForm(user);
        });
    }

    onAuthStateChanged(auth, user => {
        if (user) {
            loadCustomerOrders();
        }
    });

    if (!checkoutForm) return;

    checkoutForm.addEventListener("submit", async event => {
        event.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            showOrderToast("Please sign in before placing an order.", true);
            const authModal = document.getElementById("authModal");
            if (authModal) authModal.style.display = "flex";
            return;
        }

        const summary = typeof window.getGasCartSummary === "function"
            ? window.getGasCartSummary()
            : { items: [], subtotal: 0, deliveryFee: 0, total: 0 };

        if (!summary.items || summary.items.length === 0) {
            showOrderToast("Your cart is empty. Add gas cylinders or refills first.", true);
            return;
        }

        const customerName = document.getElementById("deliveryName")?.value.trim() || "";
        const rawPhone = document.getElementById("deliveryPhone")?.value.trim() || "";
        const deliveryAddress = document.getElementById("deliveryAddress")?.value.trim() || "";
        const formattedPhone = normalizeKenyanPhone(rawPhone);

        if (!customerName || !deliveryAddress) {
            showOrderToast("Please enter your full name and delivery location.", true);
            return;
        }

        if (!formattedPhone) {
            showOrderToast("Enter a valid Kenyan M-Pesa phone number (e.g. 0712345678).", true);
            document.getElementById("deliveryPhone")?.focus();
            return;
        }

        const submitBtn = checkoutForm.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.textContent : "";

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing Order...";
        }

        try {
            const vendorGroups = groupCartItemsByVendor(summary.items);
            const nowIso = new Date().toISOString();

            for (const group of vendorGroups) {
                const orderTotal = group.subtotal + group.deliveryFee;

                await addDoc(collection(db, "orders"), {
                    customerId: user.uid,
                    customerEmail: user.email || "",
                    customerName,
                    customerPhone: formattedPhone,
                    deliveryAddress,
                    vendorId: group.vendorId,
                    supplierId: group.vendorId,
                    supplierName: group.supplierName,
                    items: group.items,
                    subtotal: group.subtotal,
                    deliveryFee: group.deliveryFee,
                    deliveryOffer: group.deliveryOffer || (group.deliveryFee === 0 ? "Free Delivery" : ""),
                    total: orderTotal,
                    paymentMethod: "M-PESA",
                    status: "Pending M-Pesa Confirmation",
                    createdAt: nowIso,
                    updatedAt: nowIso
                });
            }

            if (typeof window.clearListingCart === "function") {
                window.clearListingCart();
            }

            checkoutForm.reset();
            showOrderToast("Order placed! Check My Orders for live delivery status.");

            await loadCustomerOrders();
            if (typeof window.switchView === "function") {
                window.switchView("customerOrdersView");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            showOrderToast("Could not place order. Please check your connection and try again.", true);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText || "Place Order & Pay via M-Pesa";
            }
        }
    });
});