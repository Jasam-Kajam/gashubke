import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();
let editingListingId = null;
window._supplierListingsCache = {};

// Robust helper function to retrieve active supplier session from Firebase Auth or localStorage
async function getCurrentUserSession() {
    if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        let businessName = auth.currentUser.displayName || "Vendor";
        let supplierArea = "Ruiru";
        
        try {
            const userDocRef = doc(db, "users", uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                businessName = data.businessName || data.name || businessName;
                supplierArea = data.supplierArea || data.location || data.county || supplierArea;
            }
        } catch (e) {
            console.error("Error fetching user profile from Firestore:", e);
        }
        
        return { uid, businessName, supplierArea };
    }

    const possibleKeys = ["gas_user_session", "user", "currentUser", "vendor_session", "logged_in_user", "firebase:authUser"];
    
    for (const key of possibleKeys) {
        const val = localStorage.getItem(key);
        if (val) {
            try {
                const parsed = JSON.parse(val);
                const uid = parsed.uid || parsed.id || parsed.userId || 
                            (parsed.user && (parsed.user.uid || parsed.user.id || parsed.user.userId)) ||
                            (parsed.firebaseUser && parsed.firebaseUser.uid);
                
                if (uid) {
                    const businessName = parsed.businessName || parsed.name || parsed.email || 
                                         (parsed.user && (parsed.user.businessName || parsed.user.name || parsed.user.email)) || "Vendor";
                    const supplierArea = parsed.supplierArea || parsed.location || parsed.county || 
                                         (parsed.user && (parsed.user.supplierArea || parsed.user.location || parsed.user.county)) || "Ruiru";
                    return { uid, businessName, supplierArea };
                }
            } catch (err) {}
        }
    }

    return null;
}

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
    const grid = document.getElementById("supplierListingsGrid");
    const statActiveListings = document.getElementById("statActiveListings");
    const statTotalOrders = document.getElementById("statTotalOrders");
    const statRevenue = document.getElementById("statRevenue");

    if (!grid) return;

    if (!vendorId) {
        const session = await getCurrentUserSession();
        if (session) {
            vendorId = session.uid;
        } else {
            grid.innerHTML = "<p>Please sign in as a supplier to view your inventory.</p>";
            return;
        }
    }

    grid.innerHTML = "<p>Loading your inventory...</p>";

    try {
        const q = query(collection(db, "listings"), where("vendorId", "==", vendorId));
        const querySnapshot = await getDocs(q);

        grid.innerHTML = "";
        window._supplierListingsCache = {};
        let activeCount = 0;

        if (querySnapshot.empty) {
            grid.innerHTML = "<p>You haven't posted any listings yet.</p>";
        }

        querySnapshot.forEach((docSnap) => {
            activeCount++;
            const item = docSnap.data();
            window._supplierListingsCache[docSnap.id] = item;

            const card = document.createElement("div");
            card.className = "product-card card p-3 mb-3";
            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h4 class="fs-6 fw-bold mb-1">${item.title}</h4>
                        <p class="text-primary fw-semibold mb-1">KES ${item.price}</p>
                        <p class="text-muted small mb-1">Zone: ${item.location}</p>
                        <p style="font-size:0.85rem; color:#64748b;" class="mb-2">Size: ${item.size} | Category: ${item.category}</p>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-warning btn-sm text-white px-3" onclick="window.editListing('${docSnap.id}')">Edit</button>
                    <button type="button" class="btn btn-danger btn-sm px-3" onclick="window.deleteListing('${docSnap.id}')">Delete</button>
                </div>
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
};

// Edit item action handler
window.editListing = function(id) {
    const item = window._supplierListingsCache[id];
    if (!item) return;

    document.getElementById("supplierItemTitle").value = item.title || "";
    document.getElementById("supplierItemSize").value = item.size || "6kg";
    document.getElementById("supplierItemCategory").value = item.category || "refill";
    document.getElementById("supplierItemPrice").value = item.price || "";
    document.getElementById("supplierItemDescription").value = item.description || "";
    
    editingListingId = id;
    
    const submitBtn = document.querySelector("#supplierListingForm button[type='submit']");
    if (submitBtn) submitBtn.textContent = "Update Listing";

    const formTitle = document.querySelector("#supplierListingForm h3");
    if (formTitle) formTitle.textContent = "Edit Gas Listing";

    document.getElementById("supplierListingForm").scrollIntoView({ behavior: 'smooth' });
};

// Delete item action handler
window.deleteListing = async function(id) {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    try {
        await deleteDoc(doc(db, "listings", id));
        alert("Listing removed successfully.");
        const session = await getCurrentUserSession();
        if (session) loadSupplierDashboard(session.uid);
    } catch (err) {
        console.error("Error deleting listing:", err);
        alert("Failed to delete listing.");
    }
};

async function loadSupplierOrders() {
    const ordersListEl = document.getElementById("supplierOrdersList");
    if (!ordersListEl) return;
    
    const userSession = await getCurrentUserSession();
    if (!userSession || !userSession.uid) {
        ordersListEl.innerHTML = "<p>Please sign in as a supplier to view orders.</p>";
        return;
    }

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
                <div style="border-bottom: 1px solid #e2e8f0; padding: 0.75rem 0;">
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

// Handle new listing form submission (Create or Update)
document.addEventListener("DOMContentLoaded", () => {
    const listingForm = document.getElementById("supplierListingForm");
    if (!listingForm) return;

    getCurrentUserSession().then(session => {
        if (session && session.uid) {
            loadSupplierDashboard(session.uid);
        }
    });

    listingForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const userSession = await getCurrentUserSession();
        if (!userSession || !userSession.uid) {
            alert("Please sign in as a supplier to post listings. No active session found.");
            return;
        }

        const submitBtn = listingForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = editingListingId ? "Updating..." : "Publishing...";

        try {
            const title = document.getElementById("supplierItemTitle").value.trim();
            const size = document.getElementById("supplierItemSize").value;
            const category = document.getElementById("supplierItemCategory").value;
            const price = parseFloat(document.getElementById("supplierItemPrice").value);
            const description = document.getElementById("supplierItemDescription").value.trim();
            const imageInput = document.getElementById("supplierItemImage");

            let imageUrls = [];
            if (imageInput.files && imageInput.files.length > 0) {
                for (let file of imageInput.files) {
                    const compressedBase64 = await compressImage(file, 800, 0.7);
                    imageUrls.push(compressedBase64);
                }
            } else if (editingListingId && window._supplierListingsCache[editingListingId]) {
                // Keep existing images if none selected during edit
                imageUrls = window._supplierListingsCache[editingListingId].images || [];
            }

            if (editingListingId) {
                // Update existing listing document
                await updateDoc(doc(db, "listings", editingListingId), {
                    title,
                    size,
                    category,
                    price,
                    description,
                    images: imageUrls,
                    updatedAt: new Date().toISOString()
                });
                alert("Listing updated successfully!");
            } else {
                // Create new listing document
                await addDoc(collection(db, "listings"), {
                    vendorId: userSession.uid,
                    vendorName: userSession.businessName,
                    location: userSession.supplierArea,
                    title,
                    size,
                    category,
                    price,
                    description,
                    images: imageUrls,
                    createdAt: new Date().toISOString()
                });
                alert("Listing published successfully!");
            }

            // Reset form and state
            listingForm.reset();
            editingListingId = null;
            const formTitle = document.querySelector("#supplierListingForm h3");
            if (formTitle) formTitle.textContent = "Post New Gas Listing";
            
            loadSupplierDashboard(userSession.uid);
        } catch (err) {
            console.error("Error saving listing:", err);
            alert("Failed to save listing. Please try again.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editingListingId ? "Update Listing" : "Publish Listing";
        }
    });
});

// Helper function to compress images and avoid Firestore 1MB document size limits
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}