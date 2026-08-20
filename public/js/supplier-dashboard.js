import { db } from "./firebase-config.js";
import { collection, addostics, getDocs, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Tab switcher logic
window.switchSupplierTab = function(tabName) {
    const listingsContent = document.getElementById("supplierListingsTabContent");
    const ordersContent = document.getElementById("supplierOrdersTabContent");
    const tabListingsBtn = document.getElementById("tabListingsBtn");
    const tabOrdersBtn = document.getElementById("tabOrdersBtn");

    if (tabName === 'listings') {
        listingsContent.style.display = 'block';
        ordersContent.style.display = 'none';
        tabListingsBtn.className = 'btn-primary';
        tabListingsBtn.style.background = '';
        tabOrdersBtn.className = 'btn-secondary';
        tabOrdersBtn.style.background = '#e2e8f0';
        tabOrdersBtn.style.color = '#1e293b';
    } else {
        listingsContent.style.display = 'none';
        ordersContent.style.display = 'block';
        tabOrdersBtn.className = 'btn-primary';
        tabOrdersBtn.style.background = '';
        tabListingsBtn.className = 'btn-secondary';
        tabListingsBtn.style.background = '#e2e8f0';
        tabListingsBtn.style.color = '#1e293b';
        loadSupplierOrders();
    }
};

// Load supplier listings and update dashboard metrics
export async function loadSupplierDashboard(vendorId) {
    const grid = document.getElementById("vendorListingsGrid");
    const statActiveListings = document.getElementById("statActiveListings");
    const statTotalOrders = document.getElementById("statTotalOrders");
    const statRevenue = document.getElementById("statRevenue");

    if (!grid) return;

    grid.innerHTML = "<p>Loading your inventory...</p>";

    try {
        const q = query(collection(db, "listings"), where("vendorId", "==", vendorId));
        const querySnapshot = await getDocs(q);

        grid.innerHTML = "";
        let activeCount = 0;

        if (querySnapshot.empty) {
            grid.innerHTML = "<p>You haven't posted any listings yet.</p>";
        }

        querySnapshot.forEach((docSnap) => {
            activeCount++;
            const item = docSnap.data();
            const card = document.createElement("div");
            card.className = "product-card";
            card.style.marginBotom = "1rem";
            card.innerHTML = `
                <div>
                    <h4>${item.title}</h4>
                    <p class="price">KES ${item.price}</p>
                    <p class="location">Zone: ${item.location}</p>
                    <p style="font-size:0.85rem; color:#64748b;">Size: ${item.size} | Category: ${item.category}</p>
                </div>
                <button type="button" class="btn-danger" onclick="window.deleteListing('${docSnap.id}')" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-top:0.5rem;">Delete Listing</button>
            `;
            grid.appendChild(card);
        });

        if (statActiveListings) statActiveListings.textContent = activeCount;

        // Fetch supplier orders stats
        const ordersQuery = query(collection(db, "orders"), where("vendorId", "==", vendorId));
        const ordersSnapshot = await getDocs(ordersQuery);
        let orderCount = 0;
        let totalRev = 0;

        ordersSnapshot.forEach((ordDoc) => {
            orderCount++;
            const ordData = ordDoc.data();
            totalRev += (ordData.total || 0);
        });

        if (statTotalOrders) statTotalOrders.textContent = orderCount;
        if (statRevenue) statRevenue.textContent = totalRev.toLocaleString();

    } catch (err) {
        console.error("Error loading supplier dashboard data:", err);
        grid.innerHTML = "<p>Failed to load dashboard inventory.</p>";
    }
}

// Delete item action handler
window.deleteListing = async function(id) {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    try {
        await deleteDoc(doc(db, "listings", id));
        alert("Listing removed successfully.");
        location.reload();
    } catch (err) {
        console.error("Error deleting listing:", err);
        alert("Failed to delete listing.");
    }
};

async function loadSupplierOrders() {
    const ordersListEl = document.getElementById("supplierOrdersList");
    const userSession = JSON.parse(localStorage.getItem("gas_user_session"));
    
    if (!userSession || !userSession.uid) return;

    ordersListEl.innerHTML = "<p>Loading customer orders...</p>";

    try {
        const q = query(collection(db, "orders"), where("vendorId", "==", userSession.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            ordersListEl.innerHTML = "<p>No orders received yet.</p>";
            return;
        }

        let html = "";
        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            html += `
                <div style="border-bottom: 1px solid var(--border-color); padding: 0.75rem 0;">
                    <p><strong>Order ID:</strong> ${docSnap.id}</p>
                    <p><strong>Customer:</strong> ${order.customerName} (${order.customerPhone})</p>
                    <p><strong>Delivery Location:</strong> ${order.deliveryAddress}</p>
                    <p><strong>Total Amount:</strong> KES ${order.total}</p>
                    <p style="font-size:0.85rem; color:#64748b;">Status: ${order.status || 'Pending M-Pesa Confirmation'}</p>
                </div>
            `;
        });
        ordersListEl.innerHTML = html;
    } catch (err) {
        console.error("Error loading orders:", err);
        ordersListEl.innerHTML = "<p>Error loading customer orders.</p>";
    }
}
