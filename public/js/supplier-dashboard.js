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
// Production Supplier Listing Management
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


// ============================================================
// FORMAT LOCATION
// ============================================================

function formatLocation(location) {

    if (!location) {
        return "";
    }


    // String
    if (typeof location === "string") {
        return location.trim();
    }


    // Array
    if (Array.isArray(location)) {

        return location
            .filter(Boolean)
            .map(value => formatLocation(value))
            .filter(Boolean)
            .join(", ");
    }


    // Object
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


    // --------------------------------------------------------
    // 1. supplierLocation object
    // --------------------------------------------------------

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
            formatLocation(
                data.supplierLocation
            );


        if (text) {

            return {
                text,
                town: String(town || ""),
                county: String(county || "")
            };
        }
    }


    // --------------------------------------------------------
    // 2. Separate registration fields
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // 3. Location object/string
    // --------------------------------------------------------

    const possibleLocationFields = [

        data.location,

        data.businessLocation,

        data.registeredLocation,

        data.address,

        data.supplierArea

    ];


    for (
        const location of possibleLocationFields
    ) {

        if (!location) {
            continue;
        }


        const text =
            formatLocation(location);


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


    // ========================================================
    // FIREBASE AUTH
    // ========================================================

    if (auth.currentUser) {

        uid =
            auth.currentUser.uid;


        businessName =
            auth.currentUser.displayName ||
            "Vendor";


        try {

            const userDocRef =
                doc(
                    db,
                    "users",
                    uid
                );


            const userDocSnap =
                await getDoc(
                    userDocRef
                );


            if (
                userDocSnap.exists()
            ) {

                const data =
                    userDocSnap.data();


                businessName =
                    data.businessName ||
                    data.business_name ||
                    data.name ||
                    data.fullName ||
                    businessName;


                registeredLocation =
                    extractRegisteredLocation(
                        data
                    );
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


    // ========================================================
    // LOCAL STORAGE FALLBACK
    // ========================================================

    const possibleKeys = [

        "gas_user_session",

        "user",

        "currentUser",

        "vendor_session",

        "logged_in_user",

        "firebase:authUser"
    ];


    for (
        const key of possibleKeys
    ) {

        const val =
            localStorage.getItem(
                key
            );


        if (!val) {
            continue;
        }


        try {

            const parsed =
                JSON.parse(val);


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
                extractRegisteredLocation(
                    parsed
                );


            if (
                !registeredLocation.text
            ) {

                registeredLocation =
                    extractRegisteredLocation(
                        nestedUser
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


        } catch (error) {

            console.warn(
                `Invalid session data in ${key}`
            );
        }
    }


    return null;
}


// ============================================================
// ENSURE REGISTERED LOCATION EXISTS
// ============================================================

function requireRegisteredLocation(
    session
) {

    if (
        !session ||
        !session.uid
    ) {
        return false;
    }


    if (
        !session.supplierLocation
    ) {

        alert(
            "Your supplier account does not have a registered business location. Please update your supplier registration before posting a listing."
        );

        return false;
    }


    return true;
}


// ============================================================
// LOCK LOCATION FIELD
// ============================================================

function applyRegisteredLocationToForm(
    session
) {

    const locationInput =
        document.getElementById(
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
// TAB SWITCHER
// ============================================================

window.switchSupplierTab =
async function(tabName) {

    const listingsContent =
        document.getElementById(
            "supplierListingsTabContent"
        );


    const ordersContent =
        document.getElementById(
            "supplierOrdersTabContent"
        );


    const tabListingsBtn =
        document.getElementById(
            "tabListingsBtn"
        );


    const tabOrdersBtn =
        document.getElementById(
            "tabOrdersBtn"
        );


    if (
        tabName === "listings"
    ) {

        if (listingsContent) {
            listingsContent.style.display =
                "block";
        }


        if (ordersContent) {
            ordersContent.style.display =
                "none";
        }


        if (tabListingsBtn) {

            tabListingsBtn.className =
                "btn-primary";

            tabListingsBtn.style.background =
                "";
        }


        if (tabOrdersBtn) {

            tabOrdersBtn.className =
                "btn-secondary";

            tabOrdersBtn.style.background =
                "#e2e8f0";

            tabOrdersBtn.style.color =
                "#1e293b";
        }


        const session =
            await getCurrentUserSession();


        if (
            session &&
            session.uid
        ) {

            loadSupplierDashboard(
                session.uid
            );
        }


    } else {

        if (listingsContent) {
            listingsContent.style.display =
                "none";
        }


        if (ordersContent) {
            ordersContent.style.display =
                "block";
        }


        if (tabOrdersBtn) {

            tabOrdersBtn.className =
                "btn-primary";

            tabOrdersBtn.style.background =
                "";
        }


        if (tabListingsBtn) {

            tabListingsBtn.className =
                "btn-secondary";

            tabListingsBtn.style.background =
                "#e2e8f0";

            tabListingsBtn.style.color =
                "#1e293b";
        }


        loadSupplierOrders();
    }
};


// ============================================================
// LOAD SUPPLIER DASHBOARD
// ============================================================

export async function loadSupplierDashboard(
    vendorId
) {

    const grid =
        document.getElementById(
            "supplierListingsGrid"
        );


    const statActiveListings =
        document.getElementById(
            "statActiveListings"
        );


    const statTotalOrders =
        document.getElementById(
            "statTotalOrders"
        );


    const statRevenue =
        document.getElementById(
            "statRevenue"
        );


    if (!grid) {
        return;
    }


    let userSession =
        await getCurrentUserSession();


    if (!vendorId) {

        if (
            userSession &&
            userSession.uid
        ) {

            vendorId =
                userSession.uid;

        } else {

            grid.innerHTML =
                "<p>Please sign in as a supplier to view your inventory.</p>";

            return;
        }
    }


    // If dashboard was called with a UID,
    // still use the current supplier profile.
    if (
        !userSession ||
        userSession.uid !== vendorId
    ) {

        userSession =
            await getCurrentUserSession();
    }


    // --------------------------------------------------------
    // LOCATION FIELD
    // --------------------------------------------------------

    if (userSession) {

        applyRegisteredLocationToForm(
            userSession
        );
    }


    grid.innerHTML =
        "<p>Loading your inventory...</p>";


    try {

        // ====================================================
        // STRICT SUPPLIER LISTING QUERY
        // ====================================================

        let querySnapshot;


        try {

            const q =
                query(
                    collection(
                        db,
                        "listings"
                    ),
                    where(
                        "vendorId",
                        "==",
                        vendorId
                    )
                );


            querySnapshot =
                await getDocs(q);


        } catch (queryError) {

            console.error(
                "Vendor listing query failed:",
                queryError
            );


            throw queryError;
        }


        grid.innerHTML = "";

        window._supplierListingsCache = {};


        let activeCount = 0;


        if (
            querySnapshot.empty
        ) {

            grid.innerHTML =
                "<p>You haven't posted any listings yet.</p>";
        }


        querySnapshot.forEach(
            docSnap => {

                activeCount++;


                const item =
                    docSnap.data();


                window._supplierListingsCache[
                    docSnap.id
                ] = item;


                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "product-card card p-3 mb-3";


                // ------------------------------------------------
                // IMAGES
                // ------------------------------------------------

                let imgThumbnail = "";


                let displayImages = [];


                if (
                    Array.isArray(
                        item.images
                    ) &&
                    item.images.length > 0
                ) {

                    displayImages =
                        item.images;

                } else if (
                    Array.isArray(
                        item.imageUrls
                    ) &&
                    item.imageUrls.length > 0
                ) {

                    displayImages =
                        item.imageUrls;

                } else if (
                    item.imageUrl
                ) {

                    displayImages = [
                        item.imageUrl
                    ];
                }


                if (
                    displayImages.length > 0
                ) {

                    imgThumbnail = `

                        <div
                            style="
                                width:60px;
                                height:60px;
                                background:#f8fafc;
                                border-radius:4px;
                                margin-right:1rem;
                                overflow:hidden;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                            "
                        >

                            <img
                                src="${escapeHTML(
                                    displayImages[0]
                                )}"
                                alt="Gas"
                                style="
                                    width:100%;
                                    height:100%;
                                    object-fit:contain;
                                "
                            >

                        </div>
                    `;
                }


                // ------------------------------------------------
                // LOCATION
                // ------------------------------------------------

                const listingLocation =
                    formatLocation(
                        item.supplierLocation
                    ) ||
                    formatLocation(
                        item.location
                    ) ||
                    "Location unavailable";


                // ------------------------------------------------
                // CARD
                // ------------------------------------------------

                card.innerHTML = `

                    <div
                        class="
                            d-flex
                            justify-content-between
                            align-items-start
                        "
                    >

                        <div
                            class="
                                d-flex
                                align-items-center
                            "
                        >

                            ${imgThumbnail}


                            <div>

                                <h4
                                    class="
                                        fs-6
                                        fw-bold
                                        mb-1
                                    "
                                >
                                    ${escapeHTML(
                                        item.title ||
                                        "Cooking Gas"
                                    )}
                                </h4>


                                <p
                                    class="
                                        text-primary
                                        fw-semibold
                                        mb-1
                                    "
                                >
                                    KES
                                    ${escapeHTML(
                                        item.price ??
                                        ""
                                    )}
                                </p>


                                <p
                                    class="
                                        text-muted
                                        small
                                        mb-1
                                    "
                                >
                                    Location:
                                    ${escapeHTML(
                                        listingLocation
                                    )}
                                </p>


                                <p
                                    style="
                                        font-size:0.85rem;
                                        color:#64748b;
                                    "
                                    class="mb-2"
                                >
                                    Size:
                                    ${escapeHTML(
                                        item.size ||
                                        "Not specified"
                                    )}

                                    |

                                    Category:
                                    ${escapeHTML(
                                        item.category ||
                                        "Not specified"
                                    )}
                                </p>

                            </div>

                        </div>

                    </div>


                    <div
                        class="
                            d-flex
                            gap-2
                            mt-2
                        "
                    >

                        <button
                            type="button"
                            class="
                                btn
                                btn-warning
                                btn-sm
                                text-white
                                px-3
                            "
                            onclick="
                                window.editListing(
                                    '${escapeHTML(
                                        docSnap.id
                                    )}'
                                )
                            "
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
                            onclick="
                                window.deleteListing(
                                    '${escapeHTML(
                                        docSnap.id
                                    )}'
                                )
                            "
                        >
                            Delete
                        </button>

                    </div>

                `;


                grid.appendChild(
                    card
                );
            }
        );


        if (statActiveListings) {

            statActiveListings.textContent =
                activeCount;
        }


        // ====================================================
        // SUPPLIER ORDERS
        // ====================================================

        const ordersQuery =
            query(
                collection(
                    db,
                    "orders"
                ),
                where(
                    "vendorId",
                    "==",
                    vendorId
                )
            );


        const ordersSnapshot =
            await getDocs(
                ordersQuery
            );


        let orderCount = 0;

        let totalRev = 0;


        ordersSnapshot.forEach(
            ordDoc => {

                orderCount++;


                const ordData =
                    ordDoc.data();


                totalRev +=
                    Number(
                        ordData.total || 0
                    );
            }
        );


        if (statTotalOrders) {

            statTotalOrders.textContent =
                orderCount;
        }


        if (statRevenue) {

            statRevenue.textContent =
                totalRev.toLocaleString();
        }


    } catch (err) {

        console.error(
            "Error loading supplier dashboard data:",
            err
        );


        grid.innerHTML =
            "<p>Failed to load dashboard inventory.</p>";
    }
}


// ============================================================
// EDIT LISTING
// ============================================================

window.editListing =
function(id) {

    const item =
        window._supplierListingsCache[
            id
        ];


    if (!item) {
        return;
    }


    const titleInput =
        document.getElementById(
            "supplierItemTitle"
        );


    const sizeInput =
        document.getElementById(
            "supplierItemSize"
        );


    const categoryInput =
        document.getElementById(
            "supplierItemCategory"
        );


    const priceInput =
        document.getElementById(
            "supplierItemPrice"
        );


    const descriptionInput =
        document.getElementById(
            "supplierItemDescription"
        );


    if (titleInput) {
        titleInput.value =
            item.title || "";
    }


    if (sizeInput) {
        sizeInput.value =
            item.size || "6kg";
    }


    if (categoryInput) {
        categoryInput.value =
            item.category || "refill";
    }


    if (priceInput) {
        priceInput.value =
            item.price || "";
    }


    if (descriptionInput) {
        descriptionInput.value =
            item.description || "";
    }


    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------
    //
    // Do NOT allow an old listing location to become the
    // supplier's current registered location.
    //
    // It will be replaced with the registered location when
    // the form is submitted.
    //
    // --------------------------------------------------------

    getCurrentUserSession()
        .then(session => {

            if (session) {

                applyRegisteredLocationToForm(
                    session
                );
            }
        });


    editingListingId =
        id;


    const submitBtn =
        document.querySelector(
            "#supplierListingForm button[type='submit']"
        );


    if (submitBtn) {

        submitBtn.textContent =
            "Update Listing";
    }


    const formTitle =
        document.querySelector(
            "#supplierListingForm h3"
        );


    if (formTitle) {

        formTitle.textContent =
            "Edit Gas Listing";
    }


    const form =
        document.getElementById(
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

window.deleteListing =
async function(id) {

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


        if (
            !session ||
            !session.uid
        ) {

            alert(
                "Please sign in again."
            );

            return;
        }


        // ----------------------------------------------------
        // SECURITY CHECK
        // ----------------------------------------------------

        const listingRef =
            doc(
                db,
                "listings",
                id
            );


        const listingSnap =
            await getDoc(
                listingRef
            );


        if (
            !listingSnap.exists()
        ) {

            alert(
                "This listing no longer exists."
            );

            return;
        }


        const listing =
            listingSnap.data();


        const listingOwner =
            listing.vendorId ||
            listing.supplierId;


        if (
            listingOwner !==
            session.uid
        ) {

            alert(
                "You are not authorized to delete this listing."
            );

            return;
        }


        await deleteDoc(
            listingRef
        );


        alert(
            "Listing removed successfully."
        );


        loadSupplierDashboard(
            session.uid
        );


    } catch (err) {

        console.error(
            "Error deleting listing:",
            err
        );


        alert(
            "Failed to delete listing."
        );
    }
};


// ============================================================
// SUPPLIER ORDERS
// ============================================================

async function loadSupplierOrders() {

    const ordersListEl =
        document.getElementById(
            "supplierOrdersList"
        );


    if (!ordersListEl) {
        return;
    }


    const userSession =
        await getCurrentUserSession();


    if (
        !userSession ||
        !userSession.uid
    ) {

        ordersListEl.innerHTML =
            "<p>Please sign in as a supplier to view orders.</p>";

        return;
    }


    ordersListEl.innerHTML =
        "<p>Loading customer orders...</p>";


    try {

        const q =
            query(
                collection(
                    db,
                    "orders"
                ),
                where(
                    "vendorId",
                    "==",
                    userSession.uid
                )
            );


        const querySnapshot =
            await getDocs(q);


        if (
            querySnapshot.empty
        ) {

            ordersListEl.innerHTML =
                "<p>No orders received yet.</p>";

            return;
        }


        let html = "";


        querySnapshot.forEach(
            docSnap => {

                const order =
                    docSnap.data();


                html += `

                    <div
                        style="
                            border-bottom:1px solid #e2e8f0;
                            padding:0.75rem 0;
                        "
                    >

                        <p>
                            <strong>
                                Order ID:
                            </strong>

                            ${escapeHTML(
                                docSnap.id
                            )}
                        </p>


                        <p>
                            <strong>
                                Customer:
                            </strong>

                            ${escapeHTML(
                                order.customerName ||
                                "Customer"
                            )}

                            ${
                                order.customerPhone
                                    ? `(${escapeHTML(
                                        order.customerPhone
                                      )})`
                                    : ""
                            }
                        </p>


                        <p>
                            <strong>
                                Delivery Location:
                            </strong>

                            ${escapeHTML(
                                order.deliveryAddress ||
                                "Not provided"
                            )}
                        </p>


                        <p>
                            <strong>
                                Total Amount:
                            </strong>

                            KES
                            ${escapeHTML(
                                order.total ??
                                0
                            )}
                        </p>


                        <p
                            style="
                                font-size:0.85rem;
                                color:#64748b;
                            "
                        >
                            Status:

                            ${escapeHTML(
                                order.status ||
                                "Pending M-Pesa Confirmation"
                            )}
                        </p>

                    </div>
                `;
            }
        );


        ordersListEl.innerHTML =
            html;


    } catch (err) {

        console.error(
            "Error loading orders:",
            err
        );


        ordersListEl.innerHTML =
            "<p>Error loading customer orders.</p>";
    }
}


// ============================================================
// LISTING FORM
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const listingForm =
            document.getElementById(
                "supplierListingForm"
            );


        // ====================================================
        // FIREBASE AUTH STATE
        // ====================================================

        onAuthStateChanged(
            auth,
            async user => {

                if (user) {

                    await loadSupplierDashboard(
                        user.uid
                    );

                } else {

                    const session =
                        await getCurrentUserSession();


                    if (
                        session &&
                        session.uid
                    ) {

                        await loadSupplierDashboard(
                            session.uid
                        );
                    }
                }
            }
        );


        if (!listingForm) {
            return;
        }


        // ====================================================
        // SUBMIT
        // ====================================================

        listingForm.addEventListener(
            "submit",
            async e => {

                e.preventDefault();


                const userSession =
                    await getCurrentUserSession();


                if (
                    !userSession ||
                    !userSession.uid
                ) {

                    alert(
                        "Please sign in as a supplier to post listings. No active session found."
                    );

                    return;
                }


                // ------------------------------------------------
                // LOCATION MUST BE REGISTERED
                // ------------------------------------------------

                if (
                    !requireRegisteredLocation(
                        userSession
                    )
                ) {
                    return;
                }


                const submitBtn =
                    listingForm.querySelector(
                        'button[type="submit"]'
                    );


                const isEditing =
                    Boolean(
                        editingListingId
                    );


                if (submitBtn) {

                    submitBtn.disabled =
                        true;

                    submitBtn.textContent =
                        isEditing
                            ? "Updating..."
                            : "Publishing...";
                }


                try {

                    // ==========================================
                    // FORM VALUES
                    // ==========================================

                    const titleInput =
                        document.getElementById(
                            "supplierItemTitle"
                        );


                    const sizeInput =
                        document.getElementById(
                            "supplierItemSize"
                        );


                    const categoryInput =
                        document.getElementById(
                            "supplierItemCategory"
                        );


                    const priceInput =
                        document.getElementById(
                            "supplierItemPrice"
                        );


                    const descriptionInput =
                        document.getElementById(
                            "supplierItemDescription"
                        );


                    const title =
                        titleInput?.value
                            .trim() || "";


                    const size =
                        sizeInput?.value || "";


                    const category =
                        categoryInput?.value || "";


                    const price =
                        parseFloat(
                            priceInput?.value
                        );


                    const description =
                        descriptionInput?.value
                            .trim() || "";


                    // ==========================================
                    // VALIDATION
                    // ==========================================

                    if (!title) {

                        alert(
                            "Please enter a product title."
                        );

                        return;
                    }


                    if (!size) {

                        alert(
                            "Please select the gas size."
                        );

                        return;
                    }


                    if (!category) {

                        alert(
                            "Please select the product category."
                        );

                        return;
                    }


                    if (
                        !Number.isFinite(price) ||
                        price <= 0
                    ) {

                        alert(
                            "Please enter a valid product price."
                        );

                        return;
                    }


                    // ==========================================
                    // AUTHORITATIVE LOCATION
                    // ==========================================
                    //
                    // IMPORTANT:
                    // Never read the location from the form.
                    //
                    // The supplier profile is the source of truth.
                    //
                    // ==========================================

                    const supplierLocation =
                        userSession.supplierLocation;


                    const supplierTown =
                        userSession.supplierTown ||
                        "";


                    const supplierCounty =
                        userSession.supplierCounty ||
                        "";


                    // ==========================================
                    // IMAGES
                    // ==========================================

                    const imageInput =
                        document.getElementById(
                            "supplierItemImage"
                        ) ||

                        document.getElementById(
                            "supplierItemImages"
                        ) ||

                        listingForm.querySelector(
                            'input[type="file"]'
                        );


                    let imageUrls = [];


                    if (
                        imageInput &&
                        imageInput.files &&
                        imageInput.files.length > 0
                    ) {

                        for (
                            const file of imageInput.files
                        ) {

                            const compressedBase64 =
                                await compressImage(
                                    file,
                                    800,
                                    0.7
                                );


                            if (
                                compressedBase64
                            ) {

                                imageUrls.push(
                                    compressedBase64
                                );
                            }
                        }
                    }


                    // ------------------------------------------------
                    // KEEP OLD IMAGES DURING EDIT
                    // ------------------------------------------------

                    if (
                        imageUrls.length === 0 &&
                        editingListingId &&
                        window
                            ._supplierListingsCache[
                                editingListingId
                            ]
                    ) {

                        const oldListing =
                            window
                                ._supplierListingsCache[
                                    editingListingId
                                ];


                        imageUrls =
                            Array.isArray(
                                oldListing.images
                            )
                                ? oldListing.images
                                : (
                                    Array.isArray(
                                        oldListing.imageUrls
                                    )
                                        ? oldListing.imageUrls
                                        : (
                                            oldListing.imageUrl
                                                ? [
                                                    oldListing.imageUrl
                                                  ]
                                                : []
                                        )
                                );
                    }


                    // ==========================================
                    // LOCATION SNAPSHOT
                    // ==========================================

                    const supplierLocationData = {

                        town:
                            supplierTown,

                        county:
                            supplierCounty,

                        display:
                            supplierLocation
                    };


                    // ==========================================
                    // UPDATE EXISTING LISTING
                    // ==========================================

                    if (
                        editingListingId
                    ) {

                        const listingRef =
                            doc(
                                db,
                                "listings",
                                editingListingId
                            );


                        const existingSnap =
                            await getDoc(
                                listingRef
                            );


                        if (
                            !existingSnap.exists()
                        ) {

                            alert(
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
                            existingOwner !==
                            userSession.uid
                        ) {

                            alert(
                                "You are not authorized to edit this listing."
                            );

                            return;
                        }


                        await updateDoc(
                            listingRef,
                            {

                                title,

                                size,

                                category,

                                price,

                                description,

                                // Authoritative location
                                location:
                                    supplierLocation,

                                supplierLocation:
                                    supplierLocationData,

                                // Keep both IDs for compatibility
                                vendorId:
                                    userSession.uid,

                                supplierId:
                                    userSession.uid,

                                vendorName:
                                    userSession.businessName,

                                images:
                                    imageUrls,

                                updatedAt:
                                    new Date().toISOString()
                            }
                        );


                        alert(
                            "Listing updated successfully!"
                        );


                    } else {

                        // ==========================================
                        // CREATE NEW LISTING
                        // ==========================================

                        await addDoc(
                            collection(
                                db,
                                "listings"
                            ),
                            {

                                // --------------------------------
                                // SUPPLIER IDENTITY
                                // --------------------------------

                                vendorId:
                                    userSession.uid,

                                supplierId:
                                    userSession.uid,

                                vendorName:
                                    userSession.businessName,


                                // --------------------------------
                                // REGISTERED LOCATION
                                // --------------------------------

                                location:
                                    supplierLocation,

                                supplierLocation:
                                    supplierLocationData,


                                supplierTown:
                                    supplierTown,

                                supplierCounty:
                                    supplierCounty,


                                // --------------------------------
                                // PRODUCT
                                // --------------------------------

                                title,

                                size,

                                category,

                                price,

                                description,


                                // --------------------------------
                                // IMAGES
                                // --------------------------------

                                images:
                                    imageUrls,


                                // --------------------------------
                                // TIMESTAMPS
                                // --------------------------------

                                createdAt:
                                    new Date().toISOString(),

                                updatedAt:
                                    new Date().toISOString()
                            }
                        );


                        alert(
                            "Listing published successfully!"
                        );
                    }


                    // ==================================================
                    // RESET FORM
                    // ==================================================

                    listingForm.reset();


                    editingListingId =
                        null;


                    const formTitle =
                        document.querySelector(
                            "#supplierListingForm h3"
                        );


                    if (formTitle) {

                        formTitle.textContent =
                            "Post New Gas Listing";
                    }


                    const locationInput =
                        document.getElementById(
                            "supplierItemLocation"
                        );


                    if (locationInput) {

                        locationInput.value =
                            userSession.supplierLocation;

                        locationInput.readOnly =
                            true;
                    }


                    if (submitBtn) {

                        submitBtn.textContent =
                            "Publish Listing";
                    }


                    await loadSupplierDashboard(
                        userSession.uid
                    );


                } catch (err) {

                    console.error(
                        "Error saving listing:",
                        err
                    );


                    alert(
                        "Failed to save listing. Please try again."
                    );


                } finally {

                    if (submitBtn) {

                        submitBtn.disabled =
                            false;


                        submitBtn.textContent =
                            editingListingId
                                ? "Update Listing"
                                : "Publish Listing";
                    }
                }
            }
        );
    }
);


// ============================================================
// IMAGE COMPRESSION
// ============================================================

function compressImage(
    file,
    maxWidth = 800,
    quality = 0.7
) {

    return new Promise(
        resolve => {

            const reader =
                new FileReader();


            reader.readAsDataURL(
                file
            );


            reader.onload =
                event => {

                    const img =
                        new Image();


                    img.onload =
                        () => {

                            try {

                                const canvas =
                                    document.createElement(
                                        "canvas"
                                    );


                                let width =
                                    img.width;


                                let height =
                                    img.height;


                                if (
                                    width >
                                    maxWidth
                                ) {

                                    height =
                                        Math.round(
                                            (
                                                height *
                                                maxWidth
                                            ) /
                                            width
                                        );


                                    width =
                                        maxWidth;
                                }


                                canvas.width =
                                    width;


                                canvas.height =
                                    height;


                                const ctx =
                                    canvas.getContext(
                                        "2d"
                                    );


                                ctx.drawImage(
                                    img,
                                    0,
                                    0,
                                    width,
                                    height
                                );


                                resolve(
                                    canvas.toDataURL(
                                        "image/jpeg",
                                        quality
                                    )
                                );


                            } catch (error) {

                                console.error(
                                    "Canvas compression error:",
                                    error
                                );


                                resolve(
                                    event.target.result
                                );
                            }
                        };


                    img.onerror =
                        () => {

                            console.error(
                                "Image load error."
                            );


                            resolve(
                                event.target.result
                            );
                        };


                    img.src =
                        event.target.result;
                };


            reader.onerror =
                error => {

                    console.error(
                        "FileReader error:",
                        error
                    );


                    resolve(null);
                };
        }
    );
}