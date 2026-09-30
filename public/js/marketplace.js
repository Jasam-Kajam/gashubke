import { db, auth } from "./firebase-config.js";
import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
// GAS HUB KE - MARKETPLACE
// ============================================================

let productGrid;
let filterSize;
let filterCategory;
let filterLocation;
let filterBrand;
let clearFiltersBtn;
let searchBtn;
let searchInput;


// ============================================================
// NORMALIZATION HELPERS
// ============================================================

function normalize(value) {
    return String(value ?? "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function normalizeKey(value) {
    return normalize(value)
        .replace(/[-_]/g, "")
        .replace(/\s+/g, "");
}


// ============================================================
// BRAND DETECTION
// ============================================================

function getListingBrand(item) {
    const possibleBrand =
        item.brand ||
        item.gasBrand ||
        item.productBrand ||
        item.gas_brand ||
        item.product_brand ||
        "";

    if (possibleBrand) {
        return normalizeKey(possibleBrand);
    }

    // If no dedicated brand field exists, detect it from title
    const title = normalizeKey(item.title || "");

    if (title.includes("totalenergies") || title.includes("totalgas")) {
        return "total";
    }

    if (title.includes("progas") || title === "pro") {
        return "pro";
    }

    if (title.includes("kgas")) {
        return "kgas";
    }

    if (title.includes("olampishigas") || title.includes("olampishi")) {
        return "ola";
    }

    if (title.includes("menegas") || title.includes("menegas")) {
        return "menegas";
    }

    if (title.includes("afrigas") || title.includes("afri")) {
        return "afrigas";
    }

    if (title.includes("rubis")) {
        return "rubis";
    }

    if (title.includes("hashigas") || title.includes("hashi")) {
        return "hashi";
    }

    return "";
}


// ============================================================
// BRAND ALIASES
// ============================================================

function brandMatches(item, selectedBrand) {
    if (!selectedBrand) return true;

    const selected = normalizeKey(selectedBrand);
    const listingBrand = getListingBrand(item);

    if (!listingBrand) return false;

    const aliases = {
        pro: ["pro", "progas"],
        kgas: ["kgas"],
        ola: ["ola", "olampishi", "olampishigas"],
        total: ["total", "totalgas", "totalenergies"],
        menegas: ["menegas"],
        afrigas: ["afrigas", "afri"],
        rubis: ["rubis"],
        hashi: ["hashi", "hashigas"]
    };

    if (aliases[selected]) {
        return aliases[selected].includes(listingBrand);
    }

    return listingBrand === selected;
}


// ============================================================
// LOCATION MATCHING
// ============================================================

function locationMatches(item, selectedLocation) {
    if (!selectedLocation) return true;

    const selected = normalize(selectedLocation);

    const possibleLocations = [
        item.location,
        item.town,
        item.city,
        item.county,
        item.area,
        item.supplierLocation,
        item.supplierTown,
        item.supplierCounty,
        item.deliveryLocation,
        item.deliveryArea
    ];

    return possibleLocations.some(value => {
        if (!value) return false;

        const location = normalize(value);

        return (
            location === selected ||
            location.includes(selected) ||
            selected.includes(location)
        );
    });
}


// ============================================================
// SIZE MATCHING
// ============================================================

function sizeMatches(item, selectedSize) {
    if (!selectedSize) return true;

    const selected = normalizeKey(selectedSize);
    const itemSize = normalizeKey(item.size);

    return (
        itemSize === selected ||
        itemSize.includes(selected) ||
        selected.includes(itemSize)
    );
}


// ============================================================
// CATEGORY MATCHING
// ============================================================

function categoryMatches(item, selectedCategory) {
    if (!selectedCategory) return true;

    const selected = normalizeKey(selectedCategory);

    const itemCategory = normalizeKey(
        item.category ||
        item.productCategory ||
        item.type ||
        ""
    );

    return (
        itemCategory === selected ||
        itemCategory.includes(selected) ||
        selected.includes(itemCategory)
    );
}


// ============================================================
// VIEW SWITCHING
// ============================================================

window.switchView = function(viewId) {
    document.querySelectorAll(".view").forEach(v => {
        v.style.display = "none";
    });

    const target = document.getElementById(viewId);

    if (target) {
        target.style.display = "block";
    }
};


// ============================================================
// CART
// ============================================================

window.addToListingCart = function(id, title, price, location) {

    const currentUser = auth.currentUser;

    if (!currentUser) {
        alert("Please sign in or create an account to add items to your cart.");

        const authModal = document.getElementById("authModal");

        if (authModal) {
            authModal.style.display = "block";
        }

        return;
    }

    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];

    const existingIndex = cart.findIndex(item => item.id === id);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({
            id,
            title,
            price: Number(price) || 0,
            location,
            quantity: 1
        });
    }

    localStorage.setItem("gas_cart", JSON.stringify(cart));

    updateCartUI();

    alert(`${title} added to your cart.`);
};


window.updateCartQuantity = function(id, delta) {

    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];

    const index = cart.findIndex(item => item.id === id);

    if (index > -1) {

        cart[index].quantity += delta;

        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
    }

    localStorage.setItem("gas_cart", JSON.stringify(cart));

    renderCartView();
    updateCartUI();
};


window.removeFromCart = function(id) {

    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];

    cart = cart.filter(item => item.id !== id);

    localStorage.setItem("gas_cart", JSON.stringify(cart));

    renderCartView();
    updateCartUI();
};


// ============================================================
// CART UI
// ============================================================

function updateCartUI() {

    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];

    const totalCount = cart.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
    );

    const cartLink = document.getElementById("cartLink");

    if (!cartLink) return;

    cartLink.innerHTML = `
        <span style="
            position:relative;
            display:inline-flex;
            align-items:center;
            cursor:pointer;
        " title="Cart">

            <svg xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">

                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>

                <path d="
                    M1 1h4l2.68 13.39
                    a2 2 0 0 0 2 1.61h9.72
                    a2 2 0 0 0 2-1.61L23 6H6
                "></path>

            </svg>

            ${
                totalCount > 0
                    ? `<span id="cartCount"
                        class="cart-badge"
                        style="
                            position:absolute;
                            top:-8px;
                            right:-10px;
                        ">
                        ${totalCount}
                    </span>`
                    : ""
            }

        </span>
    `;
}


// ============================================================
// CART VIEW
// ============================================================

function renderCartView() {

    const cartItemsList =
        document.getElementById("cartItemsList");

    const cartSubtotal =
        document.getElementById("cartSubtotal");

    const cartTotal =
        document.getElementById("cartTotal");

    if (!cartItemsList) return;

    let cart =
        JSON.parse(localStorage.getItem("gas_cart")) || [];

    if (cart.length === 0) {

        cartItemsList.innerHTML =
            "<p>Your cart is currently empty.</p>";

        if (cartSubtotal) {
            cartSubtotal.textContent = "KES 0";
        }

        if (cartTotal) {
            cartTotal.textContent = "KES 200";
        }

        return;
    }

    let html = "";
    let subtotal = 0;

    cart.forEach(item => {

        const itemPrice = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;

        const itemTotal = itemPrice * quantity;

        subtotal += itemTotal;

        html += `
            <div class="cart-item-row">

                <div>
                    <strong>${item.title}</strong>

                    <p style="
                        font-size:0.85rem;
                        color:var(--text-muted);
                    ">
                        KES ${itemPrice} each
                    </p>
                </div>

                <div style="
                    display:flex;
                    align-items:center;
                    gap:0.5rem;
                ">

                    <button
                        type="button"
                        class="btn-secondary"
                        style="padding:2px 10px;"
                        onclick="window.updateCartQuantity('${item.id}', -1)">
                        -
                    </button>

                    <span>${quantity}</span>

                    <button
                        type="button"
                        class="btn-secondary"
                        style="padding:2px 10px;"
                        onclick="window.updateCartQuantity('${item.id}', 1)">
                        +
                    </button>

                    <button
                        type="button"
                        onclick="window.removeFromCart('${item.id}')"
                        style="
                            background:#ef4444;
                            color:#fff;
                            border:none;
                            padding:4px 8px;
                            border-radius:4px;
                            cursor:pointer;
                            margin-left:0.5rem;
                            font-size:0.85rem;
                        ">
                        Remove
                    </button>

                </div>

            </div>
        `;
    });

    cartItemsList.innerHTML = html;

    if (cartSubtotal) {
        cartSubtotal.textContent = `KES ${subtotal}`;
    }

    if (cartTotal) {
        cartTotal.textContent = `KES ${subtotal + 200}`;
    }
}


// ============================================================
// LOAD LISTINGS
// ============================================================

async function loadListings() {

    if (!productGrid) return;

    productGrid.innerHTML =
        "<p>Loading gas suppliers & inventory...</p>";

    try {

        const listingsRef = collection(db, "listings");

        const querySnapshot =
            await getDocs(listingsRef);

        productGrid.innerHTML = "";

        if (querySnapshot.empty) {

            productGrid.innerHTML =
                "<p>No active cooking gas listings found.</p>";

            return;
        }


        // ====================================================
        // CURRENT FILTER VALUES
        // ====================================================

        const selectedSize =
            filterSize ? normalize(filterSize.value) : "";

        const selectedCategory =
            filterCategory ? normalize(filterCategory.value) : "";

        const selectedLocation =
            filterLocation ? normalize(filterLocation.value) : "";

        const selectedBrand =
            filterBrand ? normalize(filterBrand.value) : "";

        const searchQuery =
            searchInput
                ? normalize(searchInput.value)
                : "";


        let matchCount = 0;


        // ====================================================
        // PROCESS EACH LISTING
        // ====================================================

        querySnapshot.forEach(docSnap => {

            const item = docSnap.data();

            const itemId = docSnap.id;


            // ------------------------------------------------
            // SIZE
            // ------------------------------------------------

            if (!sizeMatches(item, selectedSize)) {
                return;
            }


            // ------------------------------------------------
            // CATEGORY
            // ------------------------------------------------

            if (!categoryMatches(item, selectedCategory)) {
                return;
            }


            // ------------------------------------------------
            // LOCATION
            // ------------------------------------------------

            if (!locationMatches(item, selectedLocation)) {
                return;
            }


            // ------------------------------------------------
            // BRAND
            // ------------------------------------------------

            if (!brandMatches(item, selectedBrand)) {
                return;
            }


            // ------------------------------------------------
            // SEARCH
            // ------------------------------------------------

            if (searchQuery) {

                const searchableText = [

                    item.title,
                    item.description,
                    item.location,
                    item.town,
                    item.city,
                    item.county,
                    item.area,
                    item.brand,
                    item.gasBrand,
                    item.category,
                    item.size

                ]
                    .filter(Boolean)
                    .map(normalize)
                    .join(" ");

                if (!searchableText.includes(searchQuery)) {
                    return;
                }
            }


            matchCount++;


            // =================================================
            // PRODUCT CARD
            // =================================================

            const card =
                document.createElement("div");

            card.className = "product-card";


            const mapPinSvg = `
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    style="
                        vertical-align:middle;
                        margin-right:4px;
                        color:var(--primary);
                    ">

                    <path d="
                        M21 10
                        c0 7-9 13-9 13
                        S3 17 3 10
                        a9 9 0 0 1 18 0z
                    "></path>

                    <circle
                        cx="12"
                        cy="10"
                        r="3">
                    </circle>

                </svg>
            `;


            // =================================================
            // IMAGES
            // =================================================

            const displayImages =
                item.images &&
                item.images.length > 0

                    ? item.images

                    : item.imageUrls &&
                      item.imageUrls.length > 0

                        ? item.imageUrls

                        : item.imageUrl

                            ? [item.imageUrl]

                            : [];


            const primaryImage =
                displayImages.length > 0
                    ? displayImages[0]
                    : "";


            // =================================================
            // SAFE DISPLAY VALUES
            // =================================================

            const title =
                item.title || "Cooking Gas";

            const price =
                item.price !== undefined &&
                item.price !== null &&
                item.price !== ""
                    ? item.price
                    : "Price on request";

            const size =
                item.size || "Size not specified";

            const location =
                item.location ||
                item.town ||
                item.city ||
                "Local Delivery";

            const description =
                item.description || "";


            // =================================================
            // ESCAPE VALUES FOR HTML
            // =================================================

            const safeTitle =
                String(title)
                    .replace(/'/g, "\\'")
                    .replace(/"/g, "&quot;");


            const safeLocation =
                String(location)
                    .replace(/'/g, "\\'")
                    .replace(/"/g, "&quot;");


            // =================================================
            // CARD HTML
            // =================================================

            card.innerHTML = `

                <div>

                    ${
                        primaryImage
                            ? `
                                <div
                                    class="card-img-container"
                                    style="
                                        background:#f8fafc;
                                        border-radius:6px;
                                        margin-bottom:10px;
                                        overflow:hidden;
                                        display:flex;
                                        align-items:center;
                                        justify-content:center;
                                        height:180px;
                                    ">

                                    <img
                                        src="${primaryImage}"
                                        alt="${safeTitle}"
                                        style="
                                            width:100%;
                                            height:100%;
                                            object-fit:contain;
                                        "
                                        loading="lazy"
                                        onerror="
                                            this.parentElement.style.display='none';
                                        "
                                    >

                                </div>
                            `
                            : ""
                    }


                    <div class="card-body">

                        <h4>${title}</h4>

                        <p class="price">
                            KES ${price}

                            <span style="
                                font-size:0.8rem;
                                font-weight:normal;
                                color:var(--text-muted);
                            ">
                                (${size})
                            </span>
                        </p>

                        <p class="location">
                            ${mapPinSvg}
                            ${location}
                        </p>

                        <p style="
                            font-size:0.85rem;
                            color:var(--text-muted);
                            line-height:1.4;
                        ">
                            ${description}
                        </p>

                    </div>

                </div>


                <div style="
                    padding:0 1rem 1rem 1rem;
                ">

                    <button
                        class="btn-primary"
                        onclick="
                            window.addToListingCart(
                                '${itemId}',
                                '${safeTitle}',
                                ${Number(item.price) || 0},
                                '${safeLocation}'
                            )
                        ">

                        Order Now

                    </button>

                </div>
            `;


            productGrid.appendChild(card);

        });


        // ====================================================
        // NO RESULTS
        // ====================================================

        if (matchCount === 0) {

            productGrid.innerHTML = `
                <div style="
                    grid-column:1/-1;
                    text-align:center;
                    padding:40px 20px;
                    color:var(--text-muted);
                ">

                    <h4>No listings found</h4>

                    <p>
                        Try changing your location, brand,
                        size or category filter.
                    </p>

                </div>
            `;
        }


    } catch (err) {

        console.error(
            "GasHubKE listings error:",
            err
        );

        productGrid.innerHTML = `
            <div style="
                grid-column:1/-1;
                text-align:center;
                padding:30px;
            ">

                <p>
                    Error loading platform inventory.
                </p>

                <small>
                    ${err.message || "Please try again."}
                </small>

            </div>
        `;
    }
}


// ============================================================
// CLEAR FILTERS
// ============================================================

function clearFilters() {

    if (filterLocation) {
        filterLocation.value = "";
    }

    if (filterBrand) {
        filterBrand.value = "";
    }

    if (filterSize) {
        filterSize.value = "";
    }

    if (filterCategory) {
        filterCategory.value = "";
    }

    if (searchInput) {
        searchInput.value = "";
    }

    loadListings();
}


// ============================================================
// NAVIGATION + INITIALIZATION
// ============================================================

function initializeMarketplace() {

    // Get elements after DOM is ready
    productGrid =
        document.getElementById("productGrid");

    filterSize =
        document.getElementById("filterSize");

    filterCategory =
        document.getElementById("filterCategory");

    filterLocation =
        document.getElementById("filterLocation");

    filterBrand =
        document.getElementById("filterBrand");

    clearFiltersBtn =
        document.getElementById("clearFiltersBtn");

    searchBtn =
        document.getElementById("searchBtn");

    searchInput =
        document.getElementById("searchInput");


    // ========================================================
    // CART
    // ========================================================

    updateCartUI();


    // ========================================================
    // NAVIGATION
    // ========================================================

    const homeLink =
        document.getElementById("homeLink");

    const cartLink =
        document.getElementById("cartLink");

    const hamburger =
        document.querySelector(".hamburger");

    const navLinks =
        document.querySelector(".nav-links");


    if (homeLink) {

        homeLink.addEventListener("click", e => {

            e.preventDefault();

            switchView("marketplaceView");

            if (navLinks) {
                navLinks.classList.remove("active");
            }

        });
    }


    if (cartLink) {

        cartLink.addEventListener("click", e => {

            e.preventDefault();

            renderCartView();

            switchView("cartView");

            if (navLinks) {
                navLinks.classList.remove("active");
            }

        });
    }


    // ========================================================
    // HAMBURGER
    // ========================================================

    if (hamburger && navLinks) {

        hamburger.addEventListener("click", e => {

            e.preventDefault();

            navLinks.classList.toggle("active");

        });
    }


    // ========================================================
    // FILTER EVENTS
    // ========================================================

    if (filterSize) {
        filterSize.addEventListener(
            "change",
            loadListings
        );
    }


    if (filterCategory) {
        filterCategory.addEventListener(
            "change",
            loadListings
        );
    }


    if (filterLocation) {
        filterLocation.addEventListener(
            "change",
            loadListings
        );
    }


    if (filterBrand) {
        filterBrand.addEventListener(
            "change",
            loadListings
        );
    }


    // ========================================================
    // CLEAR
    // ========================================================

    if (clearFiltersBtn) {

        clearFiltersBtn.addEventListener(
            "click",
            clearFilters
        );
    }


    // ========================================================
    // SEARCH
    // ========================================================

    if (searchBtn) {

        searchBtn.addEventListener(
            "click",
            loadListings
        );
    }


    if (searchInput) {

        searchInput.addEventListener(
            "keypress",
            e => {

                if (e.key === "Enter") {
                    e.preventDefault();
                    loadListings();
                }

            }
        );
    }


    // ========================================================
    // INITIAL LOAD
    // ========================================================

    loadListings();
}


// ============================================================
// START
// ============================================================

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMarketplace
    );

} else {

    initializeMarketplace();
}