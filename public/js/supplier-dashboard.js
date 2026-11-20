import { db } from "./firebase-config.js";

import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    deleteDoc,
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ============================================================
// GAS HUB KE - SUPPLIER DASHBOARD / LISTINGS
// Production Supplier Listing Management & Delivery Offers
// ============================================================

const auth = getAuth();

let editingListingId = null;

window._supplierListingsCache = {};


// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function parseDeliveryFeeInput(rawValue) {
    if (rawValue === undefined || rawValue === null) return 0;
    const trimmed = String(rawValue).trim();
    if (!trimmed) return 0;
    const cleaned = trimmed.replace(/[^\d.]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatKES(amount) {
    return `KES ${(Number(amount) || 0).toLocaleString()}`;
}


// ============================================================
// FORMAT LOCATION
// ============================================================

function formatLocation(location) {
    if (!location) return "";

    if (typeof location === "string") {
        return location.trim();
    }

    if (Array.isArray(location)) {
        return location
            .filter(Boolean)
            .map(value => formatLocation(value))
            .filter(Boolean)
            .join(", ");
    }

    if (typeof location === "object") {
        const town =
            location.town ||
            location.townName ||
            location.city ||
            location.area ||
            location.location ||
            "";

        const county =
            location.county ||
            location.countyName ||
            "";

        if (town && county) {
            return `${town}, ${county}`;
        }

        return town || county || location.name || "";
    }

    return String(location);
}


// ============================================================
// EXTRACT REGISTERED SUPPLIER LOCATION
// ============================================================

function extractRegisteredLocation(data) {
    if (!data) {
        return { text: "", town: "", county: "" };
    }

    if (
        data.supplierLocation &&
        typeof data.supplierLocation === "object" &&
        !Array.isArray(data.supplierLocation)
    ) {
        const town =
            data.supplierLocation.town ||
            data.supplierLocation.townName ||
            data.supplierLocation.city ||
            data.supplierLocation.area ||
            "";

        const county =
            data.supplierLocation.county ||
            data.supplierLocation.countyName ||
            "";

        const text = formatLocation(data.supplierLocation);
        if (text) {
            return {
                text,
                town: String(town || ""),
                county: String(county || "")
            };
        }
    }

    const town =
        data.town ||
        data.townName ||
        data.city ||
        data.businessTown ||
        data.registeredTown ||
        data.supplierTown ||
        "";

    const county =
        data.county ||
        data.countyName ||
        data.businessCounty ||
        data.registeredCounty ||
        data.supplierCounty ||
        "";

    if (town || county) {
        const text = town && county ? `${town}, ${county}` : String(town || county);
        return {
            text,
            town: String(town || ""),
            county: String(county || "")
        };
    }

    const possibleLocationFields = [
        data.location,
        data.businessLocation,
        data.registeredLocation,
        data.address,
        data.supplierArea
    ];

    for (const location of possibleLocationFields) {
        if (!location) continue;
        const text = formatLocation(location);
        if (!text) continue;

        if (typeof location === "object" && !Array.isArray(location)) {
            return {
                text,
                town: String(location.town || location.townName || location.city || location.area || ""),
                county: String(location.county || location.countyName || "")
            };
        }

        return { text, town: "", county: "" };
    }

    return { text: "", town: "", county: "" };
}


// ============================================================
// GET CURRENT SUPPLIER SESSION
// ============================================================

async function getCurrentUserSession() {
    let uid = null;
    let businessName = "Vendor";
    let registeredLocation = { text: "", town: "", county: "" };

    if (auth.currentUser) {
        uid = auth.currentUser.uid;
        businessName = auth.currentUser.displayName || "Vendor";

        try {
            const supplierDocSnap = await getDoc(doc(db, "suppliers", uid));
            if (supplierDocSnap.exists()) {
                const sData = supplierDocSnap.data();
                businessName =
                    sData.businessName ||
                    sData.supplierName ||
                    sData.name ||
                    businessName;
                registeredLocation = extractRegisteredLocation(sData);
            }

            const userDocSnap = await getDoc(doc(db, "users", uid));
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                businessName =
                    data.businessName ||
                    data.business_name ||
                    data.name ||
                    data.fullName ||
                    businessName;

                if (!registeredLocation.text) {
                    registeredLocation = extractRegisteredLocation(data);
                }
            }
        } catch (error) {
            console.error("Error fetching supplier profile:", error);
        }

        return {
            uid,
            businessName,
            supplierLocation: registeredLocation.text,
            supplierTown: registeredLocation.town,
            supplierCounty: registeredLocation.county
        };
    }

    const possibleKeys = [
        "gas_user_session",
        "user",
        "currentUser",
        "vendor_session",
        "logged_in_user",
        "firebase:authUser"
    ];

    for (const key of possibleKeys) {
        const val = localStorage.getItem(key);
        if (!val) continue;

        try {
            const parsed = JSON.parse(val);
            const nestedUser = parsed.user || parsed.firebaseUser || {};

            uid =
                parsed.uid ||
                parsed.id ||
                parsed.userId ||
                nestedUser.uid ||
                nestedUser.id ||
                nestedUser.userId ||
                null;

            if (!uid) continue;

            businessName =
                parsed.businessName ||
                parsed.name ||
                parsed.email ||
                nestedUser.businessName ||
                nestedUser.name ||
                nestedUser.email ||
                "Vendor";

            registeredLocation = extractRegisteredLocation(parsed);
            if (!registeredLocation.text) {
                registeredLocation = extractRegisteredLocation(nestedUser);
            }

            return {
                uid,
                businessName,
                supplierLocation: registeredLocation.text,
                supplierTown: registeredLocation.town,
                supplierCounty: registeredLocation.county
            };
        } catch (error) {
            console.warn(`Invalid session data in ${key}`);
        }
    }

    return null;
}


// ============================================================
// LOCATION HELPERS
// ============================================================

function requireRegisteredLocation(session) {
    if (!session || !session.uid) return false;

    if (!session.supplierLocation) {
        alert("Your supplier account does not have a registered business location. Please update your supplier profile before posting a listing.");
        return false;
    }

    return true;
}

function applyRegisteredLocationToForm(session) {
    const locationInput = document.getElementById("supplierItemLocation");
    if (!locationInput) return;

    locationInput.value = session?.supplierLocation || "Location not registered";
    locationInput.readOnly = true;
    locationInput.disabled = false;
    locationInput.setAttribute("readonly", "readonly");
    locationInput.setAttribute("title", "This location is taken from your registered supplier location.");
}


// ============================================================
// TAB SWITCHER
// ============================================================

window.switchSupplierTab = async function (tabName) {
    const listingsContent = document.getElementById("supplierListingsTabContent");
    const ordersContent = document.getElementById("supplierOrdersTabContent");
    const tabListingsBtn = document.getElementById("tabListingsBtn");
    const tabOrdersBtn = document.getElementById("tabOrdersBtn");

    if (tabName === "listings") {
        if (listingsContent) listingsContent.style.display = "block";
        if (ordersContent) ordersContent.style.display = "none";

        if (tabListingsBtn) {
            tabListingsBtn.className = "btn-primary";
            tabListingsBtn.style.background = "";
            tabListingsBtn.style.color = "";
        }

        if (tabOrdersBtn) {
            tabOrdersBtn.className = "btn-secondary";
            tabOrdersBtn.style.background = "#e2e8f0";
            tabOrdersBtn.style.color = "#1e293b";
        }

        const session = await getCurrentUserSession();
        if (session && session.uid) {
            loadSupplierDashboard(session.uid);
        }
    } else {
        if (listingsContent) listingsContent.style.display = "none";
        if (ordersContent) ordersContent.style.display = "block";

        if (tabOrdersBtn) {
            tabOrdersBtn.className = "btn-primary";
            tabOrdersBtn.style.background = "";
            tabOrdersBtn.style.color = "";
        }

        if (tabListingsBtn) {
            tabListingsBtn.className = "btn-secondary";
            tabListingsBtn.style.background = "#e2e8f0";
            tabListingsBtn.style.color = "#1e293b";
        }

        loadSupplierOrders();
    }
};


// ============================================================
// LOAD SUPPLIER DASHBOARD
// ============================================================

export async function loadSupplierDashboard(vendorId) {
    const grid = document.getElementById("supplierListingsGrid");
    const statActiveListings = document.getElementById("statActiveListings");
    const statTotalOrders = document.getElementById("statTotalOrders");
    const statRevenue = document.getElementById("statRevenue");

    if (!grid) return;

    let userSession = await getCurrentUserSession();

    if (!vendorId) {
        if (userSession && userSession.uid) {
            vendorId = userSession.uid;
        } else {
            grid.innerHTML = "<p>Please sign in as a supplier to view your inventory.</p>";
            return;
        }
    }

    if (!userSession || userSession.uid !== vendorId) {
        userSession = await getCurrentUserSession();
    }

    if (userSession) {
        applyRegisteredLocationToForm(userSession);
    }

    grid.innerHTML = "<p>Loading your inventory...</p>";

    try {
        const q = query(
            collection(db, "listings"),
            where("vendorId", "==", vendorId)
        );

        const querySnapshot = await getDocs(q);

        grid.innerHTML = "";
        window._supplierListingsCache = {};

        let activeCount = 0;

        if (querySnapshot.empty) {
            grid.innerHTML = "<p>You haven't posted any listings yet.</p>";
        }

        querySnapshot.forEach(docSnap => {
            activeCount++;
            const item = docSnap.data();
            window._supplierListingsCache[docSnap.id] = item;

            const card = document.createElement("div");
            card.className = "product-card card p-3 mb-3";

            let imgThumbnail = "";
            let displayImages = [];

            if (Array.isArray(item.images) && item.images.length > 0) {
                displayImages = item.images;
            } else if (Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
                displayImages = item.imageUrls;
            } else if (item.imageUrl) {
                displayImages = [item.imageUrl];
            }

            if (displayImages.length > 0) {
                imgThumbnail = `
                    <div style="width:60px;height:60px;background:#f8fafc;border-radius:4px;margin-right:1rem;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                        <img src="${escapeHTML(displayImages[0])}" alt="Gas" style="width:100%;height:100%;object-fit:contain;">
                    </div>
                `;
            }

            const listingLocation =
                formatLocation(item.supplierLocation) ||
                formatLocation(item.location) ||
                "Location unavailable";

            const fee = parseDeliveryFeeInput(item.deliveryFee);
            const offerText = item.deliveryOffer
                ? escapeHTML(item.deliveryOffer)
                : (fee === 0 ? "Free Delivery" : `Delivery: ${formatKES(fee)}`);

            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div style="display:flex;align-items:center;">
                        ${imgThumbnail}
                        <div>
                            <h4 style="margin:0 0 0.25rem;font-weight:700;">${escapeHTML(item.title || "Cooking Gas")}</h4>
                            <p style="margin:0 0 0.25rem;color:#f97316;font-weight:600;">KES ${escapeHTML(item.price ?? "")}</p>
                            <p style="margin:0 0 0.25rem;color:#64748b;font-size:0.85rem;">Location: ${escapeHTML(listingLocation)}</p>
                            <p style="margin:0 0 0.25rem;color:#16a34a;font-size:0.82rem;font-weight:600;">${offerText}</p>
                            <p style="font-size:0.85rem;color:#64748b;margin:0;">
                                Size: ${escapeHTML(item.size || "Not specified")} | Category: ${escapeHTML(item.category || "Not specified")}
                            </p>
                        </div>
                    </div>
                </div>

                <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
                    <button
                        type="button"
                        class="btn-secondary"
                        style="padding:6px 12px;background:#f59e0b;color:#fff;border:none;border-radius:6px;cursor:pointer;"
                        onclick="window.editListing('${escapeHTML(docSnap.id)}')"
                    >
                        Edit
                    </button>
                    <button
                        type="button"
                        class="btn-secondary"
                        style="padding:6px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;"
                        onclick="window.deleteListing('${escapeHTML(docSnap.id)}')"
                    >
                        Delete
                    </button>
                </div>
            `;

            grid.appendChild(card);
        });

        if (statActiveListings) {
            statActiveListings.textContent = activeCount;
        }

        const ordersQuery = query(
            collection(db, "orders"),
            where("vendorId", "==", vendorId)
        );
        const ordersSnapshot = await getDocs(ordersQuery);

        let orderCount = 0;
        let totalRev = 0;

        ordersSnapshot.forEach(ordDoc => {
            orderCount++;
            const ordData = ordDoc.data();
            totalRev += Number(ordData.total || 0);
        });

        if (statTotalOrders) statTotalOrders.textContent = orderCount;
        if (statRevenue) statRevenue.textContent = totalRev.toLocaleString();

    } catch (err) {
        console.error("Error loading supplier dashboard data:", err);
        grid.innerHTML = "<p>Failed to load dashboard inventory.</p>";
    }
}

window.refreshSupplierDashboard = function () {
    loadSupplierDashboard();
};


// ============================================================
// EDIT LISTING
// ============================================================

window.editListing = function (id) {
    const item = window._supplierListingsCache[id];
    if (!item) return;

    const titleInput = document.getElementById("supplierItemTitle");
    const sizeInput = document.getElementById("supplierItemSize");
    const categoryInput = document.getElementById("supplierItemCategory");
    const priceInput = document.getElementById("supplierItemPrice");
    const deliveryFeeInput = document.getElementById("supplierItemDeliveryFee");
    const deliveryOfferInput = document.getElementById("supplierItemDeliveryOffer");
    const descriptionInput = document.getElementById("supplierItemDescription");

    if (titleInput) titleInput.value = item.title || "";
    if (sizeInput) sizeInput.value = item.size || "6kg";
    if (categoryInput) categoryInput.value = item.category || "refill";
    if (priceInput) priceInput.value = item.price || "";
    if (deliveryFeeInput) deliveryFeeInput.value = item.deliveryFee ?? 0;
    if (deliveryOfferInput) deliveryOfferInput.value = item.deliveryOffer || "";
    if (descriptionInput) descriptionInput.value = item.description || "";

    getCurrentUserSession().then(session => {
        if (session) applyRegisteredLocationToForm(session);
    });

    editingListingId = id;

    const submitBtn = document.querySelector("#supplierListingForm button[type='submit']");
    if (submitBtn) submitBtn.textContent = "Update Listing";

    const formTitle = document.querySelector("#supplierListingForm h3");
    if (formTitle) formTitle.textContent = "Edit Gas Listing";

    const form = document.getElementById("supplierListingForm");
    if (form) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
};


// ============================================================
// DELETE LISTING
// ============================================================

window.deleteListing = async function (id) {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
        const session = await getCurrentUserSession();
        if (!session || !session.uid) {
            alert("Please sign in again.");
            return;
        }

        const listingRef = doc(db, "listings", id);
        const listingSnap = await getDoc(listingRef);

        if (!listingSnap.exists()) {
            alert("This listing no longer exists.");
            return;
        }

        const listing = listingSnap.data();
        const listingOwner = listing.vendorId || listing.supplierId;

        if (listingOwner !== session.uid) {
            alert("You are not authorized to delete this listing.");
            return;
        }

        await deleteDoc(listingRef);
        alert("Listing removed successfully.");
        loadSupplierDashboard(session.uid);
    } catch (err) {
        console.error("Error deleting listing:", err);
        alert("Failed to delete listing.");
    }
};


// ============================================================
// SUPPLIER ORDERS
// ============================================================

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
        const q = query(
            collection(db, "orders"),
            where("vendorId", "==", userSession.uid)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            ordersListEl.innerHTML = "<p>No orders received yet.</p>";
            return;
        }

        let html = "";
        querySnapshot.forEach(docSnap => {
            const order = docSnap.data();
            html += `
                <div style="border-bottom:1px solid #e2e8f0;padding:0.75rem 0;">
                    <p><strong>Order ID:</strong> ${escapeHTML(docSnap.id)}</p>
                    <p>
                        <strong>Customer:</strong> ${escapeHTML(order.customerName || "Customer")}
                        ${order.customerPhone ? `(${escapeHTML(order.customerPhone)})` : ""}
                    </p>
                    <p><strong>Delivery Location:</strong> ${escapeHTML(order.deliveryAddress || "Not provided")}</p>
                    <p><strong>Total Amount:</strong> KES ${escapeHTML(order.total ?? 0)}</p>
                    <p style="font-size:0.85rem;color:#64748b;">
                        Status: ${escapeHTML(order.status || "Pending M-Pesa Confirmation")}
                    </p>
                </div>
            `;
        });

        ordersListEl.innerHTML = html;
    } catch (err) {
        console.error("Error loading orders:", err);
        ordersListEl.innerHTML = "<p>Error loading customer orders.</p>";
    }
}


// ============================================================
// LISTING FORM SUBMISSION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const listingForm = document.getElementById("supplierListingForm");

    onAuthStateChanged(auth, async user => {
        if (user) {
            await loadSupplierDashboard(user.uid);
        } else {
            const session = await getCurrentUserSession();
            if (session && session.uid) {
                await loadSupplierDashboard(session.uid);
            }
        }
    });

    if (!listingForm) return;

    listingForm.addEventListener("submit", async e => {
        e.preventDefault();

        const userSession = await getCurrentUserSession();
        if (!userSession || !userSession.uid) {
            alert("Please sign in as a supplier to post listings. No active session found.");
            return;
        }

        if (!requireRegisteredLocation(userSession)) {
            return;
        }

        const title = document.getElementById("supplierItemTitle")?.value.trim() || "";
        const size = document.getElementById("supplierItemSize")?.value || "";
        const category = document.getElementById("supplierItemCategory")?.value || "";
        const price = parseFloat(document.getElementById("supplierItemPrice")?.value);
        const deliveryFee = parseDeliveryFeeInput(document.getElementById("supplierItemDeliveryFee")?.value);
        const deliveryOfferRaw = document.getElementById("supplierItemDeliveryOffer")?.value.trim() || "";
        const deliveryOffer = deliveryOfferRaw || (deliveryFee === 0 ? "Free Delivery" : `Delivery: ${formatKES(deliveryFee)}`);
        const description = document.getElementById("supplierItemDescription")?.value.trim() || "";

        if (!title) {
            alert("Please enter a product title.");
            return;
        }
        if (!size) {
            alert("Please select the gas size.");
            return;
        }
        if (!category) {
            alert("Please select the product category.");
            return;
        }
        if (!Number.isFinite(price) || price <= 0) {
            alert("Please enter a valid product price.");
            return;
        }

        const imageInput =
            document.getElementById("supplierItemImage") ||
            document.getElementById("supplierItemImages") ||
            listingForm.querySelector('input[type="file"]');

        if (!editingListingId && (!imageInput || !imageInput.files || imageInput.files.length === 0)) {
            alert("Please select at least one product image.");
            return;
        }

        if (imageInput && imageInput.files && imageInput.files.length > 5) {
            alert("You can upload a maximum of 5 images per listing.");
            return;
        }

        const submitBtn = listingForm.querySelector('button[type="submit"]');
        const isEditing = Boolean(editingListingId);

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = isEditing ? "Updating..." : "Publishing...";
        }

        try {
            const supplierLocation = userSession.supplierLocation;
            const supplierTown = userSession.supplierTown || "";
            const supplierCounty = userSession.supplierCounty || "";

            let imageUrls = [];
            if (imageInput && imageInput.files && imageInput.files.length > 0) {
                for (const file of imageInput.files) {
                    const compressedBase64 = await compressImage(file, 600, 0.55);
                    if (compressedBase64) {
                        imageUrls.push(compressedBase64);
                    }
                }
            }

            if (
                imageUrls.length === 0 &&
                editingListingId &&
                window._supplierListingsCache[editingListingId]
            ) {
                const oldListing = window._supplierListingsCache[editingListingId];
                imageUrls = Array.isArray(oldListing.images)
                    ? oldListing.images
                    : Array.isArray(oldListing.imageUrls)
                        ? oldListing.imageUrls
                        : oldListing.imageUrl
                            ? [oldListing.imageUrl]
                            : [];
            }

            const supplierLocationData = {
                town: supplierTown,
                county: supplierCounty,
                display: supplierLocation
            };

            const listingPayload = {
                title,
                size,
                category,
                price,
                deliveryFee,
                deliveryOffer,
                description,
                location: supplierLocation,
                supplierLocation: supplierLocationData,
                supplierTown,
                supplierCounty,
                vendorId: userSession.uid,
                supplierId: userSession.uid,
                vendorName: userSession.businessName,
                supplierName: userSession.businessName,
                images: imageUrls,
                updatedAt: new Date().toISOString()
            };

            if (editingListingId) {
                const listingRef = doc(db, "listings", editingListingId);
                const existingSnap = await getDoc(listingRef);

                if (!existingSnap.exists()) {
                    alert("This listing no longer exists.");
                    return;
                }

                const existingListing = existingSnap.data();
                const existingOwner = existingListing.vendorId || existingListing.supplierId;

                if (existingOwner !== userSession.uid) {
                    alert("You are not authorized to edit this listing.");
                    return;
                }

                await updateDoc(listingRef, listingPayload);
                alert("Listing updated successfully!");
            } else {
                await addDoc(collection(db, "listings"), {
                    ...listingPayload,
                    createdAt: new Date().toISOString()
                });
                alert("Listing published successfully!");
            }

            listingForm.reset();
            editingListingId = null;

            const formTitle = document.querySelector("#supplierListingForm h3");
            if (formTitle) formTitle.textContent = "Post New Listing";

            applyRegisteredLocationToForm(userSession);

            await loadSupplierDashboard(userSession.uid);

        } catch (err) {
            console.error("Error saving listing:", err);
            alert("Failed to save listing. If uploading multiple photos, try fewer or smaller images.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = editingListingId ? "Update Listing" : "Publish Listing";
            }
        }
    });
});


// ============================================================
// IMAGE COMPRESSION
// ============================================================

function compressImage(file, maxWidth = 600, quality = 0.55) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = event => {
            const img = new Image();

            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL("image/jpeg", quality));
                } catch (error) {
                    console.error("Canvas compression error:", error);
                    resolve(event.target.result);
                }
            };

            img.onerror = () => {
                console.error("Image load error.");
                resolve(event.target.result);
            };

            img.src = event.target.result;
        };

        reader.onerror = error => {
            console.error("FileReader error:", error);
            resolve(null);
        };
    });
}
