import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();
let editingListingId = null;
window._supplierListingsCache = {};

// Robust helper function to retrieve active supplier session and their registered default location
async function getCurrentUserSession() {
    let uid = null;
    let businessName = "Vendor";
    let supplierArea = "Ruiru"; // Default fallback

    // 1. Check Firebase Auth currentUser & fetch profile from Firestore
    if (auth.currentUser) {
        uid = auth.currentUser.uid;
        businessName = auth.currentUser.displayName || "Vendor";
        
        try {
            const userDocRef = doc(db, "users", uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                businessName = data.businessName || data.name || data.fullName || businessName;
                supplierArea = data.supplierArea || data.location || data.county || data.zone || data.businessLocation || data.area || supplierArea;
            }
        } catch (e) {
            console.error("Error fetching user profile from Firestore:", e);
        }
        
        return { uid, businessName, supplierArea };
    }

    // 2. Check all possible localStorage session keys
    const possibleKeys = ["gas_user_session", "user", "currentUser", "vendor_session", "logged_in_user", "firebase:authUser"];
    
    for (const key of possibleKeys) {
        const val = localStorage.getItem(key);
        if (val) {
            try {
                const parsed = JSON.parse(val);
                uid = parsed.uid || parsed.id || parsed.userId || 
                      (parsed.user && (parsed.user.uid || parsed.user.id || parsed.user.userId)) ||
                      (parsed.firebaseUser && parsed.firebaseUser.uid);
                
                if (uid) {
                    businessName = parsed.businessName || parsed.name || parsed.email || 
                                   (parsed.user && (parsed.user.businessName || parsed.user.name || parsed.user.email)) || businessName;
                    
                    supplierArea = parsed.supplierArea || parsed.location || parsed.county || parsed.zone || parsed.businessLocation || parsed.area ||
                                   (parsed.user && (parsed.user.supplierArea || parsed.user.location || parsed.user.county || parsed.user.zone)) || supplierArea;
                    
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

    let userSession = null;
    if (!vendorId) {
        userSession = await getCurrentUserSession();
        if (userSession) {
            vendorId = userSession.uid;
        } else {
            grid.innerHTML = "<p>Please sign in as a supplier to view your inventory.</p>";
            return;
        }
    } else {
        userSession = await getCurrentUserSession();
    }

    // Auto-populate location field in form if present
    const locationInput = document.getElementById("supplierItemLocation");
    if (locationInput && userSession) {
        locationInput.value = userSession.supplierArea;
        locationInput.readOnly = true;
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
            
            // Render thumbnail preview if images exist
            let imgThumbnail = "";
            if (item.images && item.images.length > 0) {
                imgThumbnail = `<img src="${item.images[0]}" alt="Gas" style="width:60px; height:60px; object-fit:cover; border-radius:4px; margin-right:1rem;" />`;
            }

            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex align-items-center">
                        ${imgThumbnail}
                        <div>
                            <h4 class="fs-6 fw-bold mb-1">${item.title}</h4>
                            <p class="text-primary fw-semibold mb-1">KES ${item.price}</p>
                            <p class="text-muted small mb-1">Zone: ${item.location}</p>
                            <p style="font-size:0.85rem; color:#64748b;" class="mb-2">Size: ${item.size} | Category: ${item.category}</p>
                        </div>
                    </div>
                </div>
                <div class="d-flex gap-2 mt-2">
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
    
    const locationInput = document.getElementById("supplierItemLocation");
    if (locationInput) {
        locationInput.value = item.location || "";
    }
    
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
            const location = userSession.supplierArea;
            
            // Flexible file input selector (checks supplierItemImage, supplierItemImages, or any file input in form)
            const imageInput = document.getElementById("supplierItemImage") || 
                               document.getElementById("supplierItemImages") || 
                               listingForm.querySelector('input[type="file"]');

            let imageUrls = [];
            if (imageInput && imageInput.files && imageInput.files.length > 0) {
                for (let file of imageInput.files) {
                    const compressedBase64 = await compressImage(file, 800, 0.7);
                    if (compressedBase64) {
                        imageUrls.push(compressedBase64);
                    }
                }
            } 
            
            // If no new images were selected during an edit, retain the existing images
            if (imageUrls.length === 0 && editingListingId && window._supplierListingsCache[editingListingId]) {
                imageUrls = window._supplierListingsCache[editingListingId].images || [];
            }

            if (editingListingId) {
                await updateDoc(doc(db, "listings", editingListingId), {
                    title,
                    size,
                    category,
                    price,
                    description,
                    location,
                    images: imageUrls,
                    updatedAt: new Date().toISOString()
                });
                alert("Listing updated successfully!");
            } else {
                await addDoc(collection(db, "listings"), {
                    vendorId: userSession.uid,
                    vendorName: userSession.businessName,
                    location: location,
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
            
            const locationInput = document.getElementById("supplierItemLocation");
            if (locationInput) locationInput.value = userSession.supplierArea;

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

// Helper function to compress images reliably with fallback safeguards
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                try {
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
                } catch (e) {
                    console.error("Canvas compression error, using raw base64:", e);
                    resolve(event.target.result); // Fallback to raw base64 if canvas fails
                }
            };
            img.onerror = (error) => {
                console.error("Image load error, using raw base64:", error);
                resolve(event.target.result); // Fallback to raw base64
            };
            img.src = event.target.result;
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            resolve(null);
        };
    });
}