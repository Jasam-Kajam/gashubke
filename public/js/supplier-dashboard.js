
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
// GAS HUB KE - SUPPLIER DASHBOARD
// Improved Supplier Listing Management
// Compatible with existing Firestore listing structure
// ============================================================

const auth = getAuth();

let editingListingId = null;
let isSavingListing = false;

window._supplierListingsCache = {};


// ============================================================
// CONFIGURATION
// ============================================================

const MAX_IMAGES = 5;

const MAX_ORIGINAL_IMAGE_SIZE = 8 * 1024 * 1024;

// Maximum compressed Base64 string length per image.
// Helps keep listing documents within Firestore limits.
const MAX_COMPRESSED_IMAGE_LENGTH = 150 * 1024;

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];


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


function formatCurrency(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "0";
    }

    return amount.toLocaleString("en-KE", {
        maximumFractionDigits: 2
    });
}


function getListingImages(item) {
    if (!item) {
        return [];
    }

    if (
        Array.isArray(item.images) &&
        item.images.length > 0
    ) {
        return item.images.filter(
            image => typeof image === "string" && image.trim()
        );
    }

    if (
        Array.isArray(item.imageUrls) &&
        item.imageUrls.length > 0
    ) {
        return item.imageUrls.filter(
            image => typeof image === "string" && image.trim()
        );
    }

    if (
        typeof item.imageUrl === "string" &&
        item.imageUrl.trim()
    ) {
        return [item.imageUrl];
    }

    return [];
}


// ============================================================
// FORMAT LOCATION
// ============================================================

function formatLocation(location) {
    if (!location) {
        return "";
    }

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

        return (
            town ||
            county ||
            location.display ||
            location.name ||
            ""
        );
    }

    return String(location);
}


// ============================================================
// EXTRACT REGISTERED SUPPLIER LOCATION
// ============================================================

function extractRegisteredLocation(data) {
    if (!data) {
        return {
            text: "",
            town: "",
            county: ""
        };
    }

    // 1. Structured supplier location

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

        const text =
            formatLocation(data.supplierLocation);

        if (text) {
            return {
                text,
                town: String(town || ""),
                county: String(county || "")
            };
        }
    }

    // 2. Separate registration fields

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
        const text =
            town && county
                ? `${town}, ${county}`
                : String(town || county);

        return {
            text,
            town: String(town || ""),
            county: String(county || "")
        };
    }

    // 3. Legacy location fields

    const possibleLocationFields = [
        data.location,
        data.businessLocation,
        data.registeredLocation,
        data.address,
        data.supplierArea
    ];

    for (const location of possibleLocationFields) {
        if (!location) {
            continue;
        }

        const text = formatLocation(location);

        if (!text) {
            continue;
        }

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
// GET CURRENT SUPPLIER SESSION
// ============================================================

async function getCurrentUserSession() {
    let uid = null;

    let businessName = "Vendor";

    let registeredLocation = {
        text: "",
        town: "",
        county: ""
    };

    // Firebase Authentication session

    if (auth.currentUser) {
        uid = auth.currentUser.uid;

        businessName =
            auth.currentUser.displayName ||
            "Vendor";

        try {
            const userDocRef = doc(
                db,
                "users",
                uid
            );

            const userDocSnap = await getDoc(
                userDocRef
            );

            if (userDocSnap.exists()) {
                const data = userDocSnap.data();

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
                "Error fetching supplier profile:",
                error
            );
        }

        return {
            uid,
            businessName,

            supplierLocation:
                registeredLocation.text,

            supplierTown:
                registeredLocation.town,

            supplierCounty:
                registeredLocation.county
        };
    }

    // Legacy local storage compatibility

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

        if (!val) {
            continue;
        }

        try {
            const parsed = JSON.parse(val);

            const nestedUser =
                parsed.user ||
                parsed.firebaseUser ||
                {};

            uid =
                parsed.uid ||
                parsed.id ||
                parsed.userId ||
                nestedUser.uid ||
                nestedUser.id ||
                nestedUser.userId ||
                null;

            if (!uid) {
                continue;
            }

            businessName =
                parsed.businessName ||
                parsed.name ||
                parsed.email ||
                nestedUser.businessName ||
                nestedUser.name ||
                nestedUser.email ||
                "Vendor";

            registeredLocation =
                extractRegisteredLocation(parsed);

            if (!registeredLocation.text) {
                registeredLocation =
                    extractRegisteredLocation(nestedUser);
            }

            return {
                uid,
                businessName,

                supplierLocation:
                    registeredLocation.text,

                supplierTown:
                    registeredLocation.town,

                supplierCounty:
                    registeredLocation.county
            };

        } catch (error) {
            console.warn(
                `Invalid session data in ${key}`,
                error
            );
        }
    }

    return null;
}


// ============================================================
// REQUIRE REGISTERED LOCATION
// ============================================================

function requireRegisteredLocation(session) {
    if (!session || !session.uid) {
        return false;
    }

    if (!session.supplierLocation) {
        showMessage(
            "Your supplier account does not have a registered business location. Please update your supplier registration before posting a listing."
        );

        return false;
    }

    return true;
}


// ============================================================
// APPLY REGISTERED LOCATION TO FORM
// ============================================================

function applyRegisteredLocationToForm(session) {
    const locationInput = getElement(
        "supplierItemLocation"
    );

    if (!locationInput) {
        return;
    }

    locationInput.value =
        session?.supplierLocation ||
        "Location not registered";

    locationInput.readOnly = true;
    locationInput.disabled = false;

    locationInput.setAttribute(
        "readonly",
        "readonly"
    );

    locationInput.setAttribute(
        "title",
        "This location is taken from your registered supplier location."
    );
}


// ============================================================
// RESET LISTING FORM
// ============================================================

function resetListingForm(session = null) {
    const form = getElement(
        "supplierListingForm"
    );

    if (form) {
        form.reset();
    }

    editingListingId = null;

    const formTitle = document.querySelector(
        "#supplierListingForm h3"
    );

    if (formTitle) {
        formTitle.textContent =
            "Post New Gas Listing";
    }

    const submitBtn = document.querySelector(
        "#supplierListingForm button[type='submit']"
    );

    if (submitBtn) {
        submitBtn.textContent =
            "Publish Listing";

        submitBtn.disabled = false;
    }

    if (session) {
        applyRegisteredLocationToForm(session);
    }
}


// ============================================================
// TAB SWITCHER
// ============================================================

window.switchSupplierTab = async function(tabName) {
    const listingsContent = getElement(
        "supplierListingsTabContent"
    );

    const ordersContent = getElement(
        "supplierOrdersTabContent"
    );

    const tabListingsBtn = getElement(
        "tabListingsBtn"
    );

    const tabOrdersBtn = getElement(
        "tabOrdersBtn"
    );

    if (tabName === "listings") {
        if (listingsContent) {
            listingsContent.style.display = "block";
        }

        if (ordersContent) {
            ordersContent.style.display = "none";
        }

        if (tabListingsBtn) {
            tabListingsBtn.className = "btn-primary";
            tabListingsBtn.style.background = "";
        }

        if (tabOrdersBtn) {
            tabOrdersBtn.className = "btn-secondary";
            tabOrdersBtn.style.background = "#e2e8f0";
            tabOrdersBtn.style.color = "#1e293b";
        }

        const session = await getCurrentUserSession();

        if (session?.uid) {
            await loadSupplierDashboard(session.uid);
        }

    } else {
        if (listingsContent) {
            listingsContent.style.display = "none";
        }

        if (ordersContent) {
            ordersContent.style.display = "block";
        }

        if (tabOrdersBtn) {
            tabOrdersBtn.className = "btn-primary";
            tabOrdersBtn.style.background = "";
        }

        if (tabListingsBtn) {
            tabListingsBtn.className = "btn-secondary";
            tabListingsBtn.style.background = "#e2e8f0";
            tabListingsBtn.style.color = "#1e293b";
        }

        await loadSupplierOrders();
    }
};


// ============================================================
// LOAD SUPPLIER DASHBOARD
// ============================================================

export async function loadSupplierDashboard(vendorId) {
    const grid = getElement(
        "supplierListingsGrid"
    );

    const statActiveListings = getElement(
        "statActiveListings"
    );

    const statTotalOrders = getElement(
        "statTotalOrders"
    );

    const statRevenue = getElement(
        "statRevenue"
    );

    if (!grid) {
        return;
    }

    let userSession =
        await getCurrentUserSession();

    if (!vendorId) {
        if (userSession?.uid) {
            vendorId = userSession.uid;
        } else {
            grid.innerHTML =
                "<p>Please sign in as a supplier to view your inventory.</p>";

            return;
        }
    }

    if (
        !userSession ||
        userSession.uid !== vendorId
    ) {
        userSession =
            await getCurrentUserSession();
    }

    if (userSession) {
        applyRegisteredLocationToForm(userSession);
    }

    grid.innerHTML =
        "<p>Loading your inventory...</p>";

    try {
        // Supplier listings

        const listingsQuery = query(
            collection(db, "listings"),
            where("vendorId", "==", vendorId)
        );

        const querySnapshot = await getDocs(
            listingsQuery
        );

        grid.innerHTML = "";

        window._supplierListingsCache = {};

        let activeCount = 0;

        if (querySnapshot.empty) {
            grid.innerHTML =
                "<p>You haven't posted any listings yet.</p>";
        }

        querySnapshot.forEach(docSnap => {
            activeCount++;

            const item = docSnap.data();

            window._supplierListingsCache[
                docSnap.id
            ] = item;

            const card = document.createElement("div");

            card.className =
                "product-card card p-3 mb-3";

            // Existing image compatibility

            const displayImages =
                getListingImages(item);

            let imgThumbnail = "";

            if (displayImages.length > 0) {
                imgThumbnail = `
                    <div style="
                        width:60px;
                        height:60px;
                        background:#f8fafc;
                        border-radius:6px;
                        margin-right:1rem;
                        overflow:hidden;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        flex-shrink:0;
                    ">
                        <img
                            src="${escapeHTML(displayImages[0])}"
                            alt="${escapeHTML(item.title || "Gas product")}"
                            loading="lazy"
                            style="
                                width:100%;
                                height:100%;
                                object-fit:contain;
                            "
                        >
                    </div>
                `;
            } else {
                imgThumbnail = `
                    <div style="
                        width:60px;
                        height:60px;
                        background:#f1f5f9;
                        border-radius:6px;
                        margin-right:1rem;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        flex-shrink:0;
                        color:#94a3b8;
                        font-size:12px;
                    ">
                        No image
                    </div>
                `;
            }

            const listingLocation =
                formatLocation(item.supplierLocation) ||
                formatLocation(item.location) ||
                "Location unavailable";

            card.innerHTML = `
                <div class="
                    d-flex
                    justify-content-between
                    align-items-start
                ">
                    <div class="
                        d-flex
                        align-items-center
                        min-w-0
                    ">
                        ${imgThumbnail}

                        <div class="min-w-0">
                            <h4 class="
                                fs-6
                                fw-bold
                                mb-1
                            ">
                                ${escapeHTML(
                                    item.title || "Cooking Gas"
                                )}
                            </h4>

                            <p class="
                                text-primary
                                fw-semibold
                                mb-1
                            ">
                                KES ${escapeHTML(
                                    formatCurrency(item.price)
                                )}
                            </p>

                            <p class="
                                text-muted
                                small
                                mb-1
                            ">
                                Location:
                                ${escapeHTML(listingLocation)}
                            </p>

                            <p style="
                                font-size:0.85rem;
                                color:#64748b;
                            " class="mb-2">
                                Size:
                                ${escapeHTML(
                                    item.size || "Not specified"
                                )}

                                |

                                Category:
                                ${escapeHTML(
                                    item.category || "Not specified"
                                )}
                            </p>

                            <p class="
                                small
                                text-muted
                                mb-0
                            ">
                                ${displayImages.length}
                                image(s)
                            </p>
                        </div>
                    </div>
                </div>

                <div class="
                    d-flex
                    gap-2
                    mt-2
                ">
                    <button
                        type="button"
                        class="
                            btn
                            btn-warning
                            btn-sm
                            text-white
                            px-3
                        "
                        data-action="edit"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="
                            btn
                            btn-danger
                            btn-sm
                            px-3
                        "
                        data-action="delete"
                    >
                        Delete
                    </button>
                </div>
            `;

            // Bind buttons without inserting IDs into inline JS.

            const editBtn = card.querySelector(
                '[data-action="edit"]'
            );

            const deleteBtn = card.querySelector(
                '[data-action="delete"]'
            );

            editBtn.addEventListener("click", () => {
                window.editListing(docSnap.id);
            });

            deleteBtn.addEventListener("click", () => {
                window.deleteListing(docSnap.id);
            });

            grid.appendChild(card);
        });

        if (statActiveListings) {
            statActiveListings.textContent = activeCount;
        }

        // Supplier orders and statistics

        const ordersQuery = query(
            collection(db, "orders"),
            where("vendorId", "==", vendorId)
        );

        const ordersSnapshot = await getDocs(
            ordersQuery
        );

        let orderCount = 0;
        let totalRev = 0;

        ordersSnapshot.forEach(ordDoc => {
            orderCount++;

            const ordData = ordDoc.data();

            totalRev += Number(ordData.total || 0);
        });

        if (statTotalOrders) {
            statTotalOrders.textContent = orderCount;
        }

        if (statRevenue) {
            statRevenue.textContent =
                formatCurrency(totalRev);
        }

    } catch (err) {
        console.error(
            "Error loading supplier dashboard:",
            err
        );

        grid.innerHTML =
            "<p>Failed to load dashboard inventory. Please refresh and try again.</p>";
    }
}


// ============================================================
// EDIT LISTING
// ============================================================

window.editListing = async function(id) {
    const item =
        window._supplierListingsCache[id];

    if (!item) {
        showMessage(
            "Listing information could not be found. Please refresh your dashboard."
        );

        return;
    }

    const session =
        await getCurrentUserSession();

    if (!session?.uid) {
        showMessage("Please sign in again.");
        return;
    }

    const owner =
        item.vendorId ||
        item.supplierId;

    if (owner !== session.uid) {
        showMessage(
            "You are not authorized to edit this listing."
        );

        return;
    }

    const titleInput = getElement(
        "supplierItemTitle"
    );

    const sizeInput = getElement(
        "supplierItemSize"
    );

    const categoryInput = getElement(
        "supplierItemCategory"
    );

    const priceInput = getElement(
        "supplierItemPrice"
    );

    const descriptionInput = getElement(
        "supplierItemDescription"
    );

    if (titleInput) {
        titleInput.value = item.title || "";
    }

    if (sizeInput) {
        sizeInput.value = item.size || "6kg";
    }

    if (categoryInput) {
        categoryInput.value = item.category || "refill";
    }

    if (priceInput) {
        priceInput.value = item.price ?? "";
    }

    if (descriptionInput) {
        descriptionInput.value =
            item.description || "";
    }

    applyRegisteredLocationToForm(session);

    editingListingId = id;

    const submitBtn = document.querySelector(
        "#supplierListingForm button[type='submit']"
    );

    if (submitBtn) {
        submitBtn.textContent = "Update Listing";
    }

    const formTitle = document.querySelector(
        "#supplierListingForm h3"
    );

    if (formTitle) {
        formTitle.textContent = "Edit Gas Listing";
    }

    const form = getElement(
        "supplierListingForm"
    );

    if (form) {
        form.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
};


// ============================================================
// DELETE LISTING
// ============================================================

window.deleteListing = async function(id) {
    if (
        !confirm(
            "Are you sure you want to delete this listing?"
        )
    ) {
        return;
    }

    try {
        const session =
            await getCurrentUserSession();

        if (!session?.uid) {
            showMessage("Please sign in again.");
            return;
        }

        const listingRef = doc(
            db,
            "listings",
            id
        );

        const listingSnap = await getDoc(
            listingRef
        );

        if (!listingSnap.exists()) {
            showMessage(
                "This listing no longer exists."
            );

            await loadSupplierDashboard(session.uid);
            return;
        }

        const listing = listingSnap.data();

        const listingOwner =
            listing.vendorId ||
            listing.supplierId;

        if (listingOwner !== session.uid) {
            showMessage(
                "You are not authorized to delete this listing."
            );

            return;
        }

        await deleteDoc(listingRef);

        delete window._supplierListingsCache[id];

        showMessage(
            "Listing removed successfully."
        );

        await loadSupplierDashboard(session.uid);

    } catch (err) {
        console.error(
            "Error deleting listing:",
            err
        );

        showMessage(
            "Failed to delete listing. Please try again."
        );
    }
};


// ============================================================
// SUPPLIER ORDERS
// ============================================================

async function loadSupplierOrders() {
    const ordersListEl = getElement(
        "supplierOrdersList"
    );

    if (!ordersListEl) {
        return;
    }

    const userSession =
        await getCurrentUserSession();

    if (!userSession?.uid) {
        ordersListEl.innerHTML =
            "<p>Please sign in as a supplier to view orders.</p>";

        return;
    }

    ordersListEl.innerHTML =
        "<p>Loading customer orders...</p>";

    try {
        const q = query(
            collection(db, "orders"),
            where("vendorId", "==", userSession.uid)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            ordersListEl.innerHTML =
                "<p>No orders received yet.</p>";

            return;
        }

        let html = "";

        querySnapshot.forEach(docSnap => {
            const order = docSnap.data();

            html += `
                <div style="
                    border-bottom:1px solid #e2e8f0;
                    padding:0.75rem 0;
                ">
                    <p>
                        <strong>Order ID:</strong>
                        ${escapeHTML(docSnap.id)}
                    </p>

                    <p>
                        <strong>Customer:</strong>
                        ${escapeHTML(
                            order.customerName || "Customer"
                        )}

                        ${
                            order.customerPhone
                                ? `(${escapeHTML(order.customerPhone)})`
                                : ""
                        }
                    </p>

                    <p>
                        <strong>Delivery Location:</strong>
                        ${escapeHTML(
                            order.deliveryAddress || "Not provided"
                        )}
                    </p>

                    <p>
                        <strong>Total Amount:</strong>
                        KES ${escapeHTML(
                            formatCurrency(order.total ?? 0)
                        )}
                    </p>

                    <p style="
                        font-size:0.85rem;
                        color:#64748b;
                    ">
                        <strong>Status:</strong>
                        ${escapeHTML(
                            order.status ||
                            "Pending M-Pesa Confirmation"
                        )}
                    </p>
                </div>
            `;
        });

        ordersListEl.innerHTML = html;

    } catch (err) {
        console.error(
            "Error loading supplier orders:",
            err
        );

        ordersListEl.innerHTML =
            "<p>Error loading customer orders. Please try again.</p>";
    }
}


// ============================================================
// IMAGE VALIDATION
// ============================================================

function validateImageFiles(files) {
    if (!files || files.length === 0) {
        return true;
    }

    if (files.length > MAX_IMAGES) {
        showMessage(
            `You can upload a maximum of ${MAX_IMAGES} images per listing.`
        );

        return false;
    }

    for (const file of files) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            showMessage(
                "Only JPG, PNG and WebP images are supported."
            );

            return false;
        }

        if (file.size > MAX_ORIGINAL_IMAGE_SIZE) {
            showMessage(
                `${file.name} is too large. Each image must be 8 MB or smaller.`
            );

            return false;
        }
    }

    return true;
}


// ============================================================
// IMAGE COMPRESSION
// ============================================================

function compressImage(
    file,
    maxWidth = 800,
    quality = 0.7
) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            reject(
                new Error("Invalid image file.")
            );

            return;
        }

        const reader = new FileReader();

        reader.onerror = () => {
            reject(
                new Error("Could not read image file.")
            );
        };

        reader.onload = event => {
            const img = new Image();

            img.onerror = () => {
                reject(
                    new Error("Could not load selected image.")
                );
            };

            img.onload = () => {
                try {
                    const attempts = [
                        {
                            width: maxWidth,
                            quality
                        },
                        {
                            width: 700,
                            quality: 0.6
                        },
                        {
                            width: 600,
                            quality: 0.5
                        },
                        {
                            width: 500,
                            quality: 0.4
                        }
                    ];

                    let compressedImage = null;

                    for (const attempt of attempts) {
                        const scale = Math.min(
                            1,
                            attempt.width / img.width,
                            800 / img.height
                        );

                        const width = Math.max(
                            1,
                            Math.round(img.width * scale)
                        );

                        const height = Math.max(
                            1,
                            Math.round(img.height * scale)
                        );

                        const canvas =
                            document.createElement("canvas");

                        canvas.width = width;
                        canvas.height = height;

                        const ctx = canvas.getContext("2d");

                        if (!ctx) {
                            throw new Error(
                                "Image compression is not supported by this browser."
                            );
                        }

                        // White background preserves a clean
                        // appearance for transparent PNG images.

                        ctx.fillStyle = "#ffffff";

                        ctx.fillRect(
                            0,
                            0,
                            width,
                            height
                        );

                        ctx.drawImage(
                            img,
                            0,
                            0,
                            width,
                            height
                        );

                        const result = canvas.toDataURL(
                            "image/jpeg",
                            attempt.quality
                        );

                        if (
                            result.length <=
                            MAX_COMPRESSED_IMAGE_LENGTH
                        ) {
                            compressedImage = result;
                            break;
                        }

                        compressedImage = result;
                    }

                    if (
                        !compressedImage ||
                        compressedImage.length >
                        MAX_COMPRESSED_IMAGE_LENGTH
                    ) {
                        throw new Error(
                            `${file.name} could not be compressed sufficiently. Please choose a smaller image.`
                        );
                    }

                    resolve(compressedImage);

                } catch (error) {
                    reject(error);
                }
            };

            img.src = event.target.result;
        };

        reader.readAsDataURL(file);
    });
}


// ============================================================
// PROCESS SELECTED IMAGES
// ============================================================

async function processSelectedImages(imageInput) {
    if (
        !imageInput ||
        !imageInput.files ||
        imageInput.files.length === 0
    ) {
        return [];
    }

    const files = Array.from(imageInput.files);

    if (!validateImageFiles(files)) {
        throw new Error("Please correct the selected images.");
    }

    const compressedImages = [];

    for (const file of files) {
        const compressed = await compressImage(
            file,
            800,
            0.7
        );

        if (compressed) {
            compressedImages.push(compressed);
        }
    }

    return compressedImages;
}


// ============================================================
// LISTING FORM INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const listingForm = getElement(
        "supplierListingForm"
    );

    // Firebase authentication state

    onAuthStateChanged(auth, async user => {
        if (user) {
            await loadSupplierDashboard(user.uid);
        } else {
            const session =
                await getCurrentUserSession();

            if (session?.uid) {
                await loadSupplierDashboard(session.uid);
            }
        }
    });

    if (!listingForm) {
        return;
    }

    // ========================================================
    // FORM SUBMISSION
    // ========================================================

    listingForm.addEventListener("submit", async e => {
        e.preventDefault();

        if (isSavingListing) {
            return;
        }

        const userSession =
            await getCurrentUserSession();

        if (!userSession?.uid) {
            showMessage(
                "Please sign in as a supplier to post listings. No active session found."
            );

            return;
        }

        if (
            !requireRegisteredLocation(userSession)
        ) {
            return;
        }

        const submitBtn = listingForm.querySelector(
            'button[type="submit"]'
        );

        const isEditing = Boolean(editingListingId);

        isSavingListing = true;

        if (submitBtn) {
            submitBtn.disabled = true;

            submitBtn.textContent = isEditing
                ? "Updating..."
                : "Publishing...";
        }

        try {
            // ------------------------------------------------
            // FORM VALUES
            // ------------------------------------------------

            const titleInput = getElement(
                "supplierItemTitle"
            );

            const sizeInput = getElement(
                "supplierItemSize"
            );

            const categoryInput = getElement(
                "supplierItemCategory"
            );

            const priceInput = getElement(
                "supplierItemPrice"
            );

            const descriptionInput = getElement(
                "supplierItemDescription"
            );

            const title =
                titleInput?.value.trim() || "";

            const size =
                sizeInput?.value || "";

            const category =
                categoryInput?.value || "";

            const price =
                Number(priceInput?.value);

            const description =
                descriptionInput?.value.trim() || "";

            // ------------------------------------------------
            // VALIDATION
            // ------------------------------------------------

            if (!title) {
                showMessage(
                    "Please enter a product title."
                );

                return;
            }

            if (!size) {
                showMessage(
                    "Please select the gas size."
                );

                return;
            }

            if (!category) {
                showMessage(
                    "Please select the product category."
                );

                return;
            }

            if (
                !Number.isFinite(price) ||
                price <= 0
            ) {
                showMessage(
                    "Please enter a valid product price."
                );

                return;
            }

            // ------------------------------------------------
            // REGISTERED SUPPLIER LOCATION
            // ------------------------------------------------

            const supplierLocation =
                userSession.supplierLocation;

            const supplierTown =
                userSession.supplierTown || "";

            const supplierCounty =
                userSession.supplierCounty || "";

            const supplierLocationData = {
                town: supplierTown,
                county: supplierCounty,
                display: supplierLocation
            };

            // ------------------------------------------------
            // IMAGE INPUT
            // ------------------------------------------------

            const imageInput =
                getElement("supplierItemImage") ||
                getElement("supplierItemImages") ||
                listingForm.querySelector(
                    'input[type="file"]'
                );

            // ------------------------------------------------
            // PROCESS NEW IMAGES
            // ------------------------------------------------

            let imageUrls = [];

            if (
                imageInput &&
                imageInput.files &&
                imageInput.files.length > 0
            ) {
                imageUrls =
                    await processSelectedImages(imageInput);
            }

            // ------------------------------------------------
            // KEEP EXISTING IMAGES WHEN NO NEW IMAGE SELECTED
            // ------------------------------------------------

            if (
                imageUrls.length === 0 &&
                editingListingId
            ) {
                const oldListing =
                    window._supplierListingsCache[
                        editingListingId
                    ];

                imageUrls =
                    getListingImages(oldListing);
            }

            // ------------------------------------------------
            // UPDATE EXISTING LISTING
            // ------------------------------------------------

            if (editingListingId) {
                const listingRef = doc(
                    db,
                    "listings",
                    editingListingId
                );

                const existingSnap = await getDoc(
                    listingRef
                );

                if (!existingSnap.exists()) {
                    showMessage(
                        "This listing no longer exists."
                    );

                    return;
                }

                const existingListing =
                    existingSnap.data();

                const existingOwner =
                    existingListing.vendorId ||
                    existingListing.supplierId;

                if (
                    existingOwner !== userSession.uid
                ) {
                    showMessage(
                        "You are not authorized to edit this listing."
                    );

                    return;
                }

                await updateDoc(listingRef, {
                    title,
                    size,
                    category,
                    price,
                    description,

                    // Registered location remains authoritative.

                    location: supplierLocation,

                    supplierLocation:
                        supplierLocationData,

                    vendorId:
                        userSession.uid,

                    supplierId:
                        userSession.uid,

                    vendorName:
                        userSession.businessName,

                    // Keep the existing marketplace image format.

                    images: imageUrls,

                    updatedAt:
                        new Date().toISOString()
                });

                showMessage(
                    "Listing updated successfully!"
                );

            } else {
                // --------------------------------------------
                // CREATE NEW LISTING
                // --------------------------------------------

                await addDoc(
                    collection(db, "listings"),
                    {
                        vendorId:
                            userSession.uid,

                        supplierId:
                            userSession.uid,

                        vendorName:
                            userSession.businessName,

                        location:
                            supplierLocation,

                        supplierLocation:
                            supplierLocationData,

                        supplierTown:
                            supplierTown,

                        supplierCounty:
                            supplierCounty,

                        title,
                        size,
                        category,
                        price,
                        description,

                        // Existing marketplace image format.

                        images: imageUrls,

                        createdAt:
                            new Date().toISOString(),

                        updatedAt:
                            new Date().toISOString()
                    }
                );

                showMessage(
                    "Listing published successfully!"
                );
            }

            // ------------------------------------------------
            // RESET FORM
            // ------------------------------------------------

            resetListingForm(userSession);

            // Clear selected files explicitly.

            if (imageInput) {
                imageInput.value = "";
            }

            await loadSupplierDashboard(
                userSession.uid
            );

        } catch (err) {
            console.error(
                "Error saving supplier listing:",
                err
            );

            showMessage(
                err.message ||
                "Failed to save listing. Please try again."
            );

        } finally {
            isSavingListing = false;

            if (submitBtn) {
                submitBtn.disabled = false;

                submitBtn.textContent =
                    editingListingId
                        ? "Update Listing"
                        : "Publish Listing";
            }
        }
    });
});


// ============================================================
// END OF SUPPLIER DASHBOARD
// ============================================================
