
import { db, auth } from "./firebase-config.js";

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
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ============================================================
// GASHUBKE — COMPLETE SUPPLIER DASHBOARD
// Firestore-only image storage
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    MAX_IMAGES: 5,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    MAX_IMAGE_DATA: 600 * 1024,
    MAX_IMAGE_WIDTH: 800,
    MAX_IMAGE_HEIGHT: 1000,
    IMAGE_QUALITY: 0.68,
    ALLOWED_TYPES: [
        "image/jpeg",
        "image/png",
        "image/webp"
    ]
};

let editingListingId = null;
let dashboardUser = null;
let dashboardLoading = false;

window._supplierListingsCache = {};


// ============================================================
// GENERAL HELPERS
// ============================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getElement(id) {
    return document.getElementById(id);
}


function showMessage(message) {
    alert(message);
}


function setButtonState(button, disabled, text) {
    if (!button) return;

    button.disabled = disabled;

    if (text) {
        button.textContent = text;
    }
}


function formatMoney(value) {
    const amount = Number(value || 0);

    return amount.toLocaleString("en-KE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}


function formatDate(value) {
    if (!value) return "Date unavailable";

    try {
        const date = value?.toDate
            ? value.toDate()
            : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString("en-KE", {
            dateStyle: "medium",
            timeStyle: "short"
        });

    } catch {
        return "Date unavailable";
    }
}


// ============================================================
// LOCATION HELPERS
// ============================================================

function formatLocation(location) {
    if (!location) return "";

    if (typeof location === "string") {
        return location.trim();
    }

    if (Array.isArray(location)) {
        return location
            .filter(Boolean)
            .map(formatLocation)
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

        return town || county || location.name || location.display || "";
    }

    return String(location);
}


function extractRegisteredLocation(data) {
    if (!data) {
        return {
            text: "",
            town: "",
            county: ""
        };
    }

    const registered = data.supplierLocation;

    if (
        registered &&
        typeof registered === "object" &&
        !Array.isArray(registered)
    ) {
        const town =
            registered.town ||
            registered.townName ||
            registered.city ||
            registered.area ||
            "";

        const county =
            registered.county ||
            registered.countyName ||
            "";

        const text =
            formatLocation(registered);

        if (text) {
            return {
                text,
                town: String(town),
                county: String(county)
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
        return {
            text: town && county
                ? `${town}, ${county}`
                : String(town || county),
            town: String(town || ""),
            county: String(county || "")
        };
    }

    const possibleFields = [
        data.location,
        data.businessLocation,
        data.registeredLocation,
        data.address,
        data.supplierArea
    ];

    for (const location of possibleFields) {
        if (!location) continue;

        const text = formatLocation(location);

        if (!text) continue;

        if (
            typeof location === "object" &&
            !Array.isArray(location)
        ) {
            return {
                text,
                town: String(
                    location.town ||
                    location.townName ||
                    location.city ||
                    location.area ||
                    ""
                ),
                county: String(
                    location.county ||
                    location.countyName ||
                    ""
                )
            };
        }

        return {
            text,
            town: "",
            county: ""
        };
    }

    return {
        text: "",
        town: "",
        county: ""
    };
}


// ============================================================
// AUTHENTICATED SUPPLIER SESSION
// ============================================================

async function getCurrentUserSession() {
    const user = auth.currentUser;

    if (!user) return null;

    let businessName =
        user.displayName ||
        user.email ||
        "Vendor";

    let registeredLocation = {
        text: "",
        town: "",
        county: ""
    };

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();

            businessName =
                data.businessName ||
                data.business_name ||
                data.name ||
                data.fullName ||
                businessName;

            registeredLocation =
                extractRegisteredLocation(data);
        }

    } catch (error) {
        console.error(
            "Supplier profile loading error:",
            error
        );
    }

    return {
        uid: user.uid,
        email: user.email || "",
        businessName,
        supplierLocation: registeredLocation.text,
        supplierTown: registeredLocation.town,
        supplierCounty: registeredLocation.county
    };
}


async function requireAuthenticatedSupplier() {
    const session = await getCurrentUserSession();

    if (!session || !session.uid) {
        showMessage(
            "Your session has expired. Please sign in again."
        );

        return null;
    }

    return session;
}


function requireRegisteredLocation(session) {
    if (!session?.supplierLocation) {
        showMessage(
            "Your supplier account does not have a registered business location. Please update your supplier profile before publishing a listing."
        );

        return false;
    }

    return true;
}


// ============================================================
// LOCK SUPPLIER LOCATION FIELD
// ============================================================

function applyRegisteredLocationToForm(session) {
    const input = getElement("supplierItemLocation");

    if (!input) return;

    input.value =
        session?.supplierLocation ||
        "Location not registered";

    input.readOnly = true;
    input.disabled = false;

    input.setAttribute("readonly", "readonly");

    input.title =
        "This location comes from your registered supplier profile.";
}


// ============================================================
// IMAGE INPUT
// ============================================================

function getImageInput() {
    return (
        getElement("supplierItemImage") ||
        getElement("supplierItemImages") ||
        getElement("supplierProductImages") ||
        getElement("supplierImages") ||
        getElement("supplierListingImage") ||
        document.querySelector(
            "#supplierListingForm input[type='file']"
        )
    );
}


// ============================================================
// IMAGE COMPRESSION
// ============================================================

function compressImage(
    file,
    maxWidth = CONFIG.MAX_IMAGE_WIDTH,
    quality = CONFIG.IMAGE_QUALITY
) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => {
            reject(new Error("Unable to read image."));
        };

        reader.onload = event => {
            const image = new Image();

            image.onerror = () => {
                reject(new Error("Invalid image file."));
            };

            image.onload = () => {
                try {
                    const canvas =
                        document.createElement("canvas");

                    const scale = Math.min(
                        1,
                        maxWidth / image.width,
                        CONFIG.MAX_IMAGE_HEIGHT / image.height
                    );

                    const width = Math.max(
                        1,
                        Math.round(image.width * scale)
                    );

                    const height = Math.max(
                        1,
                        Math.round(image.height * scale)
                    );

                    canvas.width = width;
                    canvas.height = height;

                    const context =
                        canvas.getContext("2d");

                    if (!context) {
                        throw new Error(
                            "Image processing is unavailable."
                        );
                    }

                    context.drawImage(
                        image,
                        0,
                        0,
                        width,
                        height
                    );

                    const result = canvas.toDataURL(
                        "image/jpeg",
                        quality
                    );

                    if (
                        !result.startsWith(
                            "data:image/jpeg;base64,"
                        )
                    ) {
                        throw new Error(
                            "Image compression failed."
                        );
                    }

                    resolve(result);

                } catch (error) {
                    reject(error);
                }
            };

            image.src = event.target.result;
        };

        reader.readAsDataURL(file);
    });
}


// ============================================================
// VALIDATE AND PREPARE IMAGES
// ============================================================

async function prepareListingImages(files) {
    const selectedFiles = Array.from(files || []);

    if (selectedFiles.length > CONFIG.MAX_IMAGES) {
        throw new Error(
            `You can upload a maximum of ${CONFIG.MAX_IMAGES} images per listing.`
        );
    }

    const images = [];

    let totalCharacters = 0;

    for (const file of selectedFiles) {
        if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
            throw new Error(
                `${file.name} is not supported. Use JPEG, PNG or WebP.`
            );
        }

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            throw new Error(
                `${file.name} exceeds the 5 MB file limit.`
            );
        }

        const compressed = await compressImage(file);

        totalCharacters += compressed.length;

        if (
            totalCharacters >
            CONFIG.MAX_IMAGE_DATA
        ) {
            throw new Error(
                "Your images are too large for one Firestore listing. Please select fewer or smaller images."
            );
        }

        images.push(compressed);
    }

    return images;
}


// ============================================================
// IMAGE PREVIEW
// ============================================================

function renderImagePreview(images) {
    const preview =
        getElement("supplierImagePreview") ||
        getElement("supplierItemImagePreview");

    if (!preview) return;

    preview.innerHTML = "";

    if (!images.length) return;

    images.forEach((src, index) => {
        const wrapper = document.createElement("div");

        wrapper.style.cssText = `
            display:inline-flex;
            flex-direction:column;
            margin:5px;
            width:85px;
        `;

        const image = document.createElement("img");

        image.src = src;
        image.alt = `Product image ${index + 1}`;

        image.style.cssText = `
            width:80px;
            height:80px;
            object-fit:cover;
            border-radius:8px;
            border:1px solid #e2e8f0;
        `;

        const label = document.createElement("small");

        label.textContent = `Image ${index + 1}`;
        label.style.cssText = `
            text-align:center;
            color:#64748b;
            margin-top:4px;
        `;

        wrapper.append(image, label);
        preview.appendChild(wrapper);
    });
}


// ============================================================
// REGISTERED LOCATION SNAPSHOT
// ============================================================

function createLocationSnapshot(session) {
    return {
        town: session.supplierTown || "",
        county: session.supplierCounty || "",
        display: session.supplierLocation || ""
    };
}


// ============================================================
// TAB SWITCHER
// ============================================================

window.switchSupplierTab = async function(tabName) {
    const listingsContent =
        getElement("supplierListingsTabContent");

    const ordersContent =
        getElement("supplierOrdersTabContent");

    const listingsButton =
        getElement("tabListingsBtn");

    const ordersButton =
        getElement("tabOrdersBtn");

    const showListings = tabName === "listings";

    if (listingsContent) {
        listingsContent.style.display =
            showListings ? "block" : "none";
    }

    if (ordersContent) {
        ordersContent.style.display =
            showListings ? "none" : "block";
    }

    if (listingsButton) {
        listingsButton.className = showListings
            ? "btn-primary"
            : "btn-secondary";

        listingsButton.style.background =
            showListings ? "" : "#e2e8f0";

        listingsButton.style.color =
            showListings ? "" : "#1e293b";
    }

    if (ordersButton) {
        ordersButton.className = showListings
            ? "btn-secondary"
            : "btn-primary";

        ordersButton.style.background =
            showListings ? "#e2e8f0" : "";

        ordersButton.style.color =
            showListings ? "#1e293b" : "";
    }

    if (showListings) {
        const session =
            await getCurrentUserSession();

        if (session) {
            await loadSupplierDashboard(session.uid);
        }
    } else {
        await loadSupplierOrders();
    }
};


// ============================================================
// LISTING IMAGE RESOLUTION
// ============================================================

function getListingImages(item) {
    if (
        Array.isArray(item.images) &&
        item.images.length
    ) {
        return item.images;
    }

    if (
        Array.isArray(item.imageUrls) &&
        item.imageUrls.length
    ) {
        return item.imageUrls;
    }

    if (item.imageUrl) {
        return [item.imageUrl];
    }

    return [];
}


// ============================================================
// CREATE LISTING CARD
// ============================================================

function createListingCard(id, item) {
    const card = document.createElement("div");

    card.className = "product-card card p-3 mb-3";

    const images = getListingImages(item);

    const thumbnail = images[0] || "";

    const location =
        formatLocation(item.supplierLocation) ||
        formatLocation(item.location) ||
        "Location unavailable";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">

            <div class="d-flex align-items-center">

                ${
                    thumbnail
                        ? `
                            <div style="
                                width:65px;
                                height:65px;
                                min-width:65px;
                                background:#f8fafc;
                                border-radius:7px;
                                margin-right:12px;
                                overflow:hidden;
                            ">
                                <img
                                    src="${escapeHTML(thumbnail)}"
                                    alt="Product"
                                    loading="lazy"
                                    style="
                                        width:100%;
                                        height:100%;
                                        object-fit:contain;
                                    "
                                >
                            </div>
                        `
                        : `
                            <div style="
                                width:65px;
                                height:65px;
                                min-width:65px;
                                background:#f1f5f9;
                                border-radius:7px;
                                margin-right:12px;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                color:#94a3b8;
                                font-size:12px;
                            ">
                                No image
                            </div>
                        `
                }

                <div>
                    <h4 class="fs-6 fw-bold mb-1">
                        ${escapeHTML(item.title || "Cooking Gas")}
                    </h4>

                    <p class="text-primary fw-semibold mb-1">
                        KES ${escapeHTML(formatMoney(item.price))}
                    </p>

                    <p class="text-muted small mb-1">
                        Location: ${escapeHTML(location)}
                    </p>

                    <p class="small mb-1" style="color:#64748b;">
                        Size: ${escapeHTML(item.size || "Not specified")}
                        |
                        Category: ${escapeHTML(item.category || "Not specified")}
                    </p>

                    <p class="small text-muted mb-0">
                        ${images.length} image(s)
                    </p>
                </div>

            </div>

        </div>

        <div class="d-flex gap-2 mt-3">

            <button
                type="button"
                class="btn btn-warning btn-sm text-white px-3"
                data-action="edit"
            >
                Edit
            </button>

            <button
                type="button"
                class="btn btn-danger btn-sm px-3"
                data-action="delete"
            >
                Delete
            </button>

        </div>
    `;

    card.querySelector('[data-action="edit"]')
        .addEventListener("click", () => {
            window.editListing(id);
        });

    card.querySelector('[data-action="delete"]')
        .addEventListener("click", () => {
            window.deleteListing(id);
        });

    return card;
}


// ============================================================
// LOAD SUPPLIER DASHBOARD
// ============================================================

export async function loadSupplierDashboard(vendorId) {
    const grid = getElement("supplierListingsGrid");

    if (!grid) return;

    const session = await getCurrentUserSession();

    if (!session) {
        grid.textContent =
            "Please sign in as a supplier to view your inventory.";

        return;
    }

    // Never load another supplier's dashboard.
    if (vendorId && vendorId !== session.uid) {
        console.warn(
            "Supplier dashboard access rejected."
        );

        grid.textContent =
            "You are not authorized to view this inventory.";

        return;
    }

    vendorId = session.uid;
    dashboardUser = session;

    applyRegisteredLocationToForm(session);

    grid.innerHTML =
        "<p>Loading your inventory...</p>";

    const statActiveListings =
        getElement("statActiveListings");

    const statTotalOrders =
        getElement("statTotalOrders");

    const statRevenue =
        getElement("statRevenue");

    try {
        const listingsQuery = query(
            collection(db, "listings"),
            where("vendorId", "==", vendorId)
        );

        const listingsSnapshot =
            await getDocs(listingsQuery);

        grid.innerHTML = "";

        window._supplierListingsCache = {};

        let activeCount = 0;

        if (listingsSnapshot.empty) {
            grid.innerHTML =
                "<p>You haven't posted any listings yet.</p>";
        }

        listingsSnapshot.forEach(docSnap => {
            const item = docSnap.data();

            window._supplierListingsCache[docSnap.id] =
                item;

            activeCount++;

            grid.appendChild(
                createListingCard(docSnap.id, item)
            );
        });

        if (statActiveListings) {
            statActiveListings.textContent =
                activeCount;
        }

        // --------------------------------------------
        // ORDERS AND REVENUE
        // --------------------------------------------

        const ordersQuery = query(
            collection(db, "orders"),
            where("vendorId", "==", vendorId)
        );

        const ordersSnapshot =
            await getDocs(ordersQuery);

        let orderCount = 0;
        let totalRevenue = 0;

        ordersSnapshot.forEach(orderDoc => {
            const order = orderDoc.data();

            orderCount++;

            totalRevenue += Number(
                order.total || 0
            );
        });

        if (statTotalOrders) {
            statTotalOrders.textContent =
                orderCount;
        }

        if (statRevenue) {
            statRevenue.textContent =
                formatMoney(totalRevenue);
        }

    } catch (error) {
        console.error(
            "Supplier dashboard loading error:",
            error
        );

        grid.innerHTML = `
            <p class="text-danger">
                Unable to load your inventory. Please refresh and try again.
            </p>
        `;
    }
}


// ============================================================
// RESET LISTING FORM
// ============================================================

function resetListingForm() {
    const form = getElement("supplierListingForm");

    if (form) {
        form.reset();
    }

    editingListingId = null;

    const title = document.querySelector(
        "#supplierListingForm h3"
    );

    if (title) {
        title.textContent = "Post New Gas Listing";
    }

    const submitButton = document.querySelector(
        "#supplierListingForm button[type='submit']"
    );

    if (submitButton) {
        submitButton.textContent = "Publish Listing";
        submitButton.disabled = false;
    }

    const preview =
        getElement("supplierImagePreview") ||
        getElement("supplierItemImagePreview");

    if (preview) {
        preview.innerHTML = "";
    }

    const imageInput = getImageInput();

    if (imageInput) {
        imageInput.value = "";
    }

    if (dashboardUser) {
        applyRegisteredLocationToForm(dashboardUser);
    }
}


// ============================================================
// EDIT LISTING
// ============================================================

window.editListing = async function(id) {
    const session =
        await requireAuthenticatedSupplier();

    if (!session) return;

    const item =
        window._supplierListingsCache[id];

    if (!item) {
        showMessage(
            "Listing information could not be found. Refresh your dashboard."
        );

        return;
    }

    try {
        const listingRef = doc(db, "listings", id);

        const listingSnap =
            await getDoc(listingRef);

        if (!listingSnap.exists()) {
            showMessage("This listing no longer exists.");
            return;
        }

        const latest = listingSnap.data();

        const owner =
            latest.vendorId || latest.supplierId;

        if (owner !== session.uid) {
            showMessage(
                "You are not authorized to edit this listing."
            );

            return;
        }

        const fields = {
            supplierItemTitle: latest.title || "",
            supplierItemSize: latest.size || "6kg",
            supplierItemCategory: latest.category || "refill",
            supplierItemPrice: latest.price ?? "",
            supplierItemDescription: latest.description || ""
        };

        Object.entries(fields).forEach(([id, value]) => {
            const input = getElement(id);

            if (input) {
                input.value = value;
            }
        });

        applyRegisteredLocationToForm(session);

        editingListingId = id;

        const submitButton = document.querySelector(
            "#supplierListingForm button[type='submit']"
        );

        if (submitButton) {
            submitButton.textContent = "Update Listing";
        }

        const formTitle = document.querySelector(
            "#supplierListingForm h3"
        );

        if (formTitle) {
            formTitle.textContent = "Edit Gas Listing";
        }

        renderImagePreview(getListingImages(latest));

        const form = getElement("supplierListingForm");

        if (form) {
            form.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

    } catch (error) {
        console.error("Edit listing error:", error);

        showMessage(
            "Unable to open this listing for editing."
        );
    }
};


// ============================================================
// DELETE LISTING
// ============================================================

window.deleteListing = async function(id) {
    const session =
        await requireAuthenticatedSupplier();

    if (!session) return;

    if (
        !confirm(
            "Are you sure you want to delete this listing?"
        )
    ) {
        return;
    }

    try {
        const listingRef = doc(db, "listings", id);

        const listingSnap =
            await getDoc(listingRef);

        if (!listingSnap.exists()) {
            showMessage("This listing no longer exists.");
            return;
        }

        const listing = listingSnap.data();

        const owner =
            listing.vendorId || listing.supplierId;

        if (owner !== session.uid) {
            showMessage(
                "You are not authorized to delete this listing."
            );

            return;
        }

        await deleteDoc(listingRef);

        delete window._supplierListingsCache[id];

        if (editingListingId === id) {
            resetListingForm();
        }

        showMessage("Listing deleted successfully.");

        await loadSupplierDashboard(session.uid);

    } catch (error) {
        console.error("Delete listing error:", error);

        showMessage(
            "Failed to delete listing. Please try again."
        );
    }
};


// ============================================================
// LOAD SUPPLIER ORDERS
// ============================================================

async function loadSupplierOrders() {
    const list = getElement("supplierOrdersList");

    if (!list) return;

    const session =
        await getCurrentUserSession();

    if (!session) {
        list.textContent =
            "Please sign in as a supplier to view orders.";

        return;
    }

    list.innerHTML =
        "<p>Loading customer orders...</p>";

    try {
        const ordersQuery = query(
            collection(db, "orders"),
            where("vendorId", "==", session.uid)
        );

        const snapshot =
            await getDocs(ordersQuery);

        if (snapshot.empty) {
            list.innerHTML =
                "<p>No orders received yet.</p>";

            return;
        }

        list.innerHTML = "";

        snapshot.forEach(docSnap => {
            const order = docSnap.data();

            const card = document.createElement("div");

            card.style.cssText = `
                border-bottom:1px solid #e2e8f0;
                padding:15px 5px;
            `;

            card.innerHTML = `
                <p>
                    <strong>Order ID:</strong>
                    ${escapeHTML(docSnap.id)}
                </p>

                <p>
                    <strong>Customer:</strong>
                    ${escapeHTML(order.customerName || "Customer")}
                    ${
                        order.customerPhone
                            ? `(${escapeHTML(order.customerPhone)})`
                            : ""
                    }
                </p>

                <p>
                    <strong>Delivery Location:</strong>
                    ${escapeHTML(order.deliveryAddress || "Not provided")}
                </p>

                <p>
                    <strong>Total Amount:</strong>
                    KES ${escapeHTML(formatMoney(order.total))}
                </p>

                <p>
                    <strong>Status:</strong>
                    ${escapeHTML(order.status || "Pending")}
                </p>

                <p class="small text-muted mb-0">
                    ${escapeHTML(formatDate(order.createdAt || order.timestamp))}
                </p>
            `;

            list.appendChild(card);
        });

    } catch (error) {
        console.error(
            "Supplier orders loading error:",
            error
        );

        list.innerHTML =
            "<p class='text-danger'>Unable to load customer orders.</p>";
    }
}


// ============================================================
// SAVE LISTING
// ============================================================

async function saveListing(event) {
    event.preventDefault();

    const session =
        await requireAuthenticatedSupplier();

    if (!session) return;

    if (!requireRegisteredLocation(session)) {
        return;
    }

    const form = event.currentTarget;

    const submitButton = form.querySelector(
        'button[type="submit"]'
    );

    const isEditing = Boolean(editingListingId);

    setButtonState(
        submitButton,
        true,
        isEditing ? "Updating..." : "Publishing..."
    );

    try {
        // --------------------------------------------
        // FORM VALUES
        // --------------------------------------------

        const title =
            getElement("supplierItemTitle")?.value.trim() || "";

        const size =
            getElement("supplierItemSize")?.value || "";

        const category =
            getElement("supplierItemCategory")?.value || "";

        const price =
            Number(getElement("supplierItemPrice")?.value);

        const description =
            getElement("supplierItemDescription")?.value.trim() || "";

        if (!title) {
            throw new Error("Please enter a product title.");
        }

        if (!size) {
            throw new Error("Please select the gas size.");
        }

        if (!category) {
            throw new Error("Please select a product category.");
        }

        if (!Number.isFinite(price) || price <= 0) {
            throw new Error("Please enter a valid product price.");
        }

        // --------------------------------------------
        // IMAGE PROCESSING
        // --------------------------------------------

        const imageInput = getImageInput();

        const selectedFiles =
            imageInput?.files || [];

        let images = [];

        if (selectedFiles.length > 0) {
            images = await prepareListingImages(
                selectedFiles
            );
        } else if (editingListingId) {
            const oldListing =
                window._supplierListingsCache[editingListingId];

            images = oldListing
                ? getListingImages(oldListing)
                : [];
        }

        // --------------------------------------------
        // LOCATION FROM VERIFIED PROFILE
        // --------------------------------------------

        const supplierLocation =
            session.supplierLocation;

        const supplierLocationData =
            createLocationSnapshot(session);

        // --------------------------------------------
        // LISTING DATA
        // --------------------------------------------

        const listingData = {
            title,
            size,
            category,
            price,
            description,

            location: supplierLocation,

            supplierLocation: supplierLocationData,

            supplierTown: session.supplierTown || "",
            supplierCounty: session.supplierCounty || "",

            vendorId: session.uid,
            supplierId: session.uid,

            vendorName: session.businessName,

            images,

            updatedAt: new Date().toISOString()
        };

        // --------------------------------------------
        // UPDATE EXISTING LISTING
        // --------------------------------------------

        if (editingListingId) {
            const listingRef =
                doc(db, "listings", editingListingId);

            const existingSnap =
                await getDoc(listingRef);

            if (!existingSnap.exists()) {
                throw new Error(
                    "This listing no longer exists."
                );
            }

            const existing = existingSnap.data();

            const owner =
                existing.vendorId || existing.supplierId;

            if (owner !== session.uid) {
                throw new Error(
                    "You are not authorized to edit this listing."
                );
            }

            await updateDoc(
                listingRef,
                listingData
            );

            showMessage(
                "Listing updated successfully!"
            );

        } else {
            // ----------------------------------------
            // CREATE NEW LISTING
            // ----------------------------------------

            await addDoc(
                collection(db, "listings"),
                {
                    ...listingData,
                    createdAt: new Date().toISOString()
                }
            );

            showMessage(
                "Listing published successfully!"
            );
        }

        // --------------------------------------------
        // RESET AND REFRESH
        // --------------------------------------------

        resetListingForm();

        await loadSupplierDashboard(session.uid);

    } catch (error) {
        console.error(
            "Saving supplier listing failed:",
            error
        );

        showMessage(
            error.message ||
            "Failed to save listing. Please try again."
        );

    } finally {
        if (submitButton) {
            submitButton.disabled = false;

            submitButton.textContent =
                editingListingId
                    ? "Update Listing"
                    : "Publish Listing";
        }
    }
}


// ============================================================
// AUTHENTICATION AND DASHBOARD INITIALIZATION
// ============================================================

function initializeSupplierDashboard() {
    const form = getElement("supplierListingForm");

    if (form) {
        form.addEventListener("submit", saveListing);
    }

    const imageInput = getImageInput();

    if (imageInput) {
        imageInput.addEventListener("change", async () => {
            try {
                const files = imageInput.files;

                if (!files?.length) {
                    renderImagePreview([]);
                    return;
                }

                if (files.length > CONFIG.MAX_IMAGES) {
                    imageInput.value = "";

                    renderImagePreview([]);

                    showMessage(
                        `Select no more than ${CONFIG.MAX_IMAGES} images.`
                    );

                    return;
                }

                const previewImages =
                    await prepareListingImages(files);

                renderImagePreview(previewImages);

            } catch (error) {
                imageInput.value = "";

                renderImagePreview([]);

                showMessage(error.message);
            }
        });
    }

    onAuthStateChanged(auth, async user => {
        if (!user) {
            dashboardUser = null;

            window._supplierListingsCache = {};

            const grid =
                getElement("supplierListingsGrid");

            const orders =
                getElement("supplierOrdersList");

            if (grid) {
                grid.textContent =
                    "Please sign in to access your supplier dashboard.";
            }

            if (orders) {
                orders.textContent =
                    "Please sign in to view supplier orders.";
            }

            return;
        }

        if (dashboardLoading) return;

        dashboardLoading = true;

        try {
            const session =
                await getCurrentUserSession();

            if (!session) return;

            dashboardUser = session;

            applyRegisteredLocationToForm(session);

            await loadSupplierDashboard(session.uid);

        } finally {
            dashboardLoading = false;
        }
    });
}


// ============================================================
// START DASHBOARD
// ============================================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeSupplierDashboard,
        { once: true }
    );
} else {
    initializeSupplierDashboard();
}
