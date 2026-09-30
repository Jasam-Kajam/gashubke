import { db, auth } from "./firebase-config.js";

import {
    collection,
    getDocs,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// GAS HUB KE - MARKETPLACE.JS
// Production Marketplace
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
// SUPPLIER LOCATION CACHE
// ============================================================

const supplierLocationCache = new Map();


// ============================================================
// HELPERS
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
// ESCAPE HTML
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
// ESCAPE JAVASCRIPT
// ============================================================

function escapeJS(value) {

    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "")
        .replace(/\n/g, "\\n");
}


// ============================================================
// LOCATION TEXT
// ============================================================

function formatLocation(location) {

    if (!location) {
        return "";
    }


    // String location
    if (typeof location === "string") {
        return location.trim();
    }


    // Array location
    if (Array.isArray(location)) {

        return location
            .filter(Boolean)
            .map(value => formatLocation(value))
            .filter(Boolean)
            .join(", ");
    }


    // Object location
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
// GET SUPPLIER LOCATION FROM PROFILE
// ============================================================

function extractSupplierLocation(profile) {

    if (!profile) {
        return "";
    }


    // Preferred registered location object
    if (profile.supplierLocation) {

        const location =
            formatLocation(
                profile.supplierLocation
            );

        if (location) {
            return location;
        }
    }


    // Other possible registered location objects
    const nestedLocations = [
        profile.location,
        profile.address,
        profile.businessLocation,
        profile.registeredLocation
    ];


    for (const location of nestedLocations) {

        const formatted =
            formatLocation(location);

        if (formatted) {
            return formatted;
        }
    }


    // Separate registration fields
    const town =
        profile.town ||
        profile.townName ||
        profile.city ||
        profile.businessTown ||
        profile.registeredTown ||
        "";

    const county =
        profile.county ||
        profile.countyName ||
        profile.businessCounty ||
        profile.registeredCounty ||
        "";


    if (town && county) {

        return `${town}, ${county}`;
    }


    if (town) {
        return String(town);
    }


    if (county) {
        return String(county);
    }


    return "";
}


// ============================================================
// LOAD SUPPLIER PROFILE LOCATION
// ============================================================
//
// The listing should ideally contain supplierLocation.
// This function provides compatibility with existing listings
// that only contain supplierId.
//
// ============================================================

async function getSupplierLocation(supplierId) {

    if (!supplierId) {
        return "";
    }


    const cacheKey =
        String(supplierId);


    if (
        supplierLocationCache.has(
            cacheKey
        )
    ) {

        return supplierLocationCache.get(
            cacheKey
        );
    }


    try {

        // ----------------------------------------------------
        // FIRST: suppliers collection
        // ----------------------------------------------------

        const supplierRef =
            doc(
                db,
                "suppliers",
                cacheKey
            );


        const supplierSnap =
            await getDoc(supplierRef);


        if (supplierSnap.exists()) {

            const location =
                extractSupplierLocation(
                    supplierSnap.data()
                );


            if (location) {

                supplierLocationCache.set(
                    cacheKey,
                    location
                );

                return location;
            }
        }


        // ----------------------------------------------------
        // SECOND: users collection
        // ----------------------------------------------------

        const userRef =
            doc(
                db,
                "users",
                cacheKey
            );


        const userSnap =
            await getDoc(userRef);


        if (userSnap.exists()) {

            const location =
                extractSupplierLocation(
                    userSnap.data()
                );


            if (location) {

                supplierLocationCache.set(
                    cacheKey,
                    location
                );

                return location;
            }
        }


    } catch (error) {

        console.warn(
            "Unable to load supplier location:",
            supplierId,
            error
        );
    }


    supplierLocationCache.set(
        cacheKey,
        ""
    );


    return "";
}


// ============================================================
// RESOLVE AUTHORITATIVE PRODUCT LOCATION
// ============================================================

async function resolveListingLocation(
    item
) {

    // --------------------------------------------------------
    // 1. LOCATION SAVED DIRECTLY FROM SUPPLIER REGISTRATION
    // --------------------------------------------------------

    if (item.supplierLocation) {

        const location =
            formatLocation(
                item.supplierLocation
            );

        if (location) {
            return location;
        }
    }


    // --------------------------------------------------------
    // 2. REGISTERED SUPPLIER PROFILE
    // --------------------------------------------------------

    const supplierId =
        item.supplierId ||
        item.supplierID ||
        item.sellerId ||
        item.sellerID ||
        item.ownerId ||
        "";


    if (supplierId) {

        const supplierLocation =
            await getSupplierLocation(
                supplierId
            );


        if (supplierLocation) {

            return supplierLocation;
        }
    }


    // --------------------------------------------------------
    // 3. LEGACY FALLBACK
    // --------------------------------------------------------

    const legacyLocations = [

        item.location,

        item.town,

        item.city,

        item.county,

        item.area,

        item.deliveryLocation,

        item.deliveryArea

    ];


    for (
        const location of legacyLocations
    ) {

        const formatted =
            formatLocation(location);


        if (formatted) {
            return formatted;
        }
    }


    return "Location unavailable";
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

        return normalizeKey(
            possibleBrand
        );
    }


    const title =
        normalizeKey(
            item.title || ""
        );


    if (
        title.includes("totalenergies") ||
        title.includes("totalgas")
    ) {
        return "total";
    }


    if (
        title.includes("progas") ||
        title === "pro"
    ) {
        return "pro";
    }


    if (
        title.includes("kgas")
    ) {
        return "kgas";
    }


    if (
        title.includes("olampishigas") ||
        title.includes("olampishi")
    ) {
        return "ola";
    }


    if (
        title.includes("menegas")
    ) {
        return "menegas";
    }


    if (
        title.includes("afrigas") ||
        title.includes("afri")
    ) {
        return "afrigas";
    }


    if (
        title.includes("rubis")
    ) {
        return "rubis";
    }


    if (
        title.includes("hashigas") ||
        title.includes("hashi")
    ) {
        return "hashi";
    }


    return "";
}


// ============================================================
// BRAND FILTER
// ============================================================

function brandMatches(
    item,
    selectedBrand
) {

    if (!selectedBrand) {
        return true;
    }


    const selected =
        normalizeKey(
            selectedBrand
        );


    const listingBrand =
        getListingBrand(item);


    if (!listingBrand) {
        return false;
    }


    const aliases = {

        pro: [
            "pro",
            "progas"
        ],

        kgas: [
            "kgas"
        ],

        ola: [
            "ola",
            "olampishi",
            "olampishigas"
        ],

        total: [
            "total",
            "totalgas",
            "totalenergies"
        ],

        menegas: [
            "menegas"
        ],

        afrigas: [
            "afrigas",
            "afri"
        ],

        rubis: [
            "rubis"
        ],

        hashi: [
            "hashi",
            "hashigas"
        ]
    };


    if (aliases[selected]) {

        return aliases[selected]
            .includes(
                listingBrand
            );
    }


    return (
        listingBrand === selected
    );
}


// ============================================================
// LOCATION FILTER
// ============================================================

function locationMatches(
    location,
    selectedLocation
) {

    if (!selectedLocation) {
        return true;
    }


    const selected =
        normalize(
            selectedLocation
        );


    const actualLocation =
        normalize(
            location
        );


    if (!actualLocation) {
        return false;
    }


    return (
        actualLocation === selected ||
        actualLocation.includes(selected) ||
        selected.includes(actualLocation)
    );
}


// ============================================================
// SIZE FILTER
// ============================================================

function sizeMatches(
    item,
    selectedSize
) {

    if (!selectedSize) {
        return true;
    }


    const selected =
        normalizeKey(
            selectedSize
        );


    const itemSize =
        normalizeKey(
            item.size ||
            item.weight ||
            ""
        );


    return (
        itemSize === selected ||
        itemSize.includes(selected) ||
        selected.includes(itemSize)
    );
}


// ============================================================
// CATEGORY FILTER
// ============================================================

function categoryMatches(
    item,
    selectedCategory
) {

    if (!selectedCategory) {
        return true;
    }


    const selected =
        normalizeKey(
            selectedCategory
        );


    const itemCategory =
        normalizeKey(
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

window.switchView =
function(viewId) {

    document
        .querySelectorAll(".view")
        .forEach(view => {

            view.style.display =
                "none";
        });


    const target =
        document.getElementById(
            viewId
        );


    if (target) {

        target.style.display =
            "block";
    }
};


// ============================================================
// IMAGE TICKER
// ============================================================

function createImageTicker(
    images,
    title
) {

    if (!Array.isArray(images)) {
        return "";
    }


    const validImages =
        [
            ...new Set(
                images
                    .filter(Boolean)
                    .map(
                        image =>
                            String(image).trim()
                    )
                    .filter(Boolean)
            )
        ];


    if (
        validImages.length === 0
    ) {
        return "";
    }


    const tickerId =
        "ticker-" +
        Math.random()
            .toString(36)
            .substring(2, 12);


    // --------------------------------------------------------
    // SINGLE IMAGE
    // --------------------------------------------------------

    if (
        validImages.length === 1
    ) {

        return `
            <div
                id="${tickerId}"
                class="listing-image-ticker"
            >

                <div
                    class="listing-image-track"
                >

                    <div
                        class="listing-image-slide active"
                    >

                        <img
                            src="${escapeHTML(validImages[0])}"
                            alt="${escapeHTML(title)}"
                            loading="lazy"
                            onerror="
                                this.style.display='none';
                            "
                        >

                    </div>

                </div>

            </div>
        `;
    }


    // --------------------------------------------------------
    // MULTIPLE IMAGES
    // --------------------------------------------------------

    const slides =
        validImages
            .map(
                (image, index) => {

                    return `
                        <div
                            class="
                                listing-image-slide
                                ${
                                    index === 0
                                        ? "active"
                                        : ""
                                }
                            "
                            data-slide="${index}"
                        >

                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(title)} - Photo ${index + 1}"
                                loading="${
                                    index === 0
                                        ? "eager"
                                        : "lazy"
                                }"
                                onerror="
                                    this.style.visibility='hidden';
                                "
                            >

                        </div>
                    `;
                }
            )
            .join("");


    const indicators =
        validImages
            .map(
                (_, index) => {

                    return `
                        <span
                            class="
                                listing-image-dot
                                ${
                                    index === 0
                                        ? "active"
                                        : ""
                                }
                            "
                            data-slide="${index}"
                        ></span>
                    `;
                }
            )
            .join("");


    const html = `
        <div
            id="${tickerId}"
            class="listing-image-ticker"
        >

            <div
                class="listing-image-track"
            >

                ${slides}

            </div>


            <div
                class="listing-image-indicators"
            >

                ${indicators}

            </div>


            <div
                class="listing-image-counter"
            >
                1 / ${validImages.length}
            </div>

        </div>
    `;


    // --------------------------------------------------------
    // START TICKER
    // --------------------------------------------------------

    setTimeout(
        () => {

            const ticker =
                document.getElementById(
                    tickerId
                );


            if (!ticker) {
                return;
            }


            const tickerSlides =
                ticker.querySelectorAll(
                    ".listing-image-slide"
                );


            const tickerDots =
                ticker.querySelectorAll(
                    ".listing-image-dot"
                );


            const counter =
                ticker.querySelector(
                    ".listing-image-counter"
                );


            let currentIndex = 0;


            const timer =
                setInterval(
                    () => {

                        if (
                            !document.body.contains(
                                ticker
                            )
                        ) {

                            clearInterval(
                                timer
                            );

                            return;
                        }


                        tickerSlides[
                            currentIndex
                        ]?.classList.remove(
                            "active"
                        );


                        tickerDots[
                            currentIndex
                        ]?.classList.remove(
                            "active"
                        );


                        currentIndex++;


                        if (
                            currentIndex >=
                            tickerSlides.length
                        ) {

                            currentIndex = 0;
                        }


                        tickerSlides[
                            currentIndex
                        ]?.classList.add(
                            "active"
                        );


                        tickerDots[
                            currentIndex
                        ]?.classList.add(
                            "active"
                        );


                        if (counter) {

                            counter.textContent =
                                `${currentIndex + 1} / ${tickerSlides.length}`;
                        }

                    },
                    3000
                );

        },
        100
    );


    return html;
}


// ============================================================
// CART
// ============================================================

window.addToListingCart =
function(
    id,
    title,
    price,
    location
) {

    const currentUser =
        auth.currentUser;


    if (!currentUser) {

        alert(
            "Please sign in or create an account to add items to your cart."
        );


        const authModal =
            document.getElementById(
                "authModal"
            );


        if (authModal) {

            authModal.style.display =
                "block";
        }


        return;
    }


    let cart =
        JSON.parse(
            localStorage.getItem(
                "gas_cart"
            )
        ) || [];


    const existingIndex =
        cart.findIndex(
            item =>
                item.id === id
        );


    if (
        existingIndex > -1
    ) {

        cart[
            existingIndex
        ].quantity += 1;

    } else {

        cart.push({

            id,

            title,

            price:
                Number(price) || 0,

            location,

            quantity: 1
        });
    }


    localStorage.setItem(
        "gas_cart",
        JSON.stringify(cart)
    );


    updateCartUI();


    alert(
        `${title} added to your cart.`
    );
};


// ============================================================
// CART QUANTITY
// ============================================================

window.updateCartQuantity =
function(
    id,
    delta
) {

    let cart =
        JSON.parse(
            localStorage.getItem(
                "gas_cart"
            )
        ) || [];


    const index =
        cart.findIndex(
            item =>
                item.id === id
        );


    if (index > -1) {

        cart[index].quantity +=
            Number(delta);


        if (
            cart[index].quantity <= 0
        ) {

            cart.splice(
                index,
                1
            );
        }
    }


    localStorage.setItem(
        "gas_cart",
        JSON.stringify(cart)
    );


    renderCartView();

    updateCartUI();
};


// ============================================================
// REMOVE CART ITEM
// ============================================================

window.removeFromCart =
function(id) {

    let cart =
        JSON.parse(
            localStorage.getItem(
                "gas_cart"
            )
        ) || [];


    cart =
        cart.filter(
            item =>
                item.id !== id
        );


    localStorage.setItem(
        "gas_cart",
        JSON.stringify(cart)
    );


    renderCartView();

    updateCartUI();
};


// ============================================================
// CART UI
// ============================================================

function updateCartUI() {

    const cart =
        JSON.parse(
            localStorage.getItem(
                "gas_cart"
            )
        ) || [];


    const totalCount =
        cart.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.quantity || 0
                ),
            0
        );


    const cartLink =
        document.getElementById(
            "cartLink"
        );


    if (!cartLink) {
        return;
    }


    cartLink.innerHTML = `

        <span
            style="
                position:relative;
                display:inline-flex;
                align-items:center;
                cursor:pointer;
            "
            title="Cart"
        >

            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >

                <circle
                    cx="9"
                    cy="21"
                    r="1"
                ></circle>

                <circle
                    cx="20"
                    cy="21"
                    r="1"
                ></circle>

                <path
                    d="
                        M1 1h4l2.68 13.39
                        a2 2 0 0 0 2 1.61h9.72
                        a2 2 0 0 0 2-1.61L23 6H6
                    "
                ></path>

            </svg>


            ${
                totalCount > 0
                    ? `
                        <span
                            id="cartCount"
                            class="cart-badge"
                            style="
                                position:absolute;
                                top:-8px;
                                right:-10px;
                            "
                        >
                            ${totalCount}
                        </span>
                    `
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
        document.getElementById(
            "cartItemsList"
        );


    const cartSubtotal =
        document.getElementById(
            "cartSubtotal"
        );


    const cartTotal =
        document.getElementById(
            "cartTotal"
        );


    if (!cartItemsList) {
        return;
    }


    const cart =
        JSON.parse(
            localStorage.getItem(
                "gas_cart"
            )
        ) || [];


    if (
        cart.length === 0
    ) {

        cartItemsList.innerHTML =
            "<p>Your cart is currently empty.</p>";


        if (cartSubtotal) {

            cartSubtotal.textContent =
                "KES 0";
        }


        if (cartTotal) {

            cartTotal.textContent =
                "KES 200";
        }


        return;
    }


    let html = "";

    let subtotal = 0;


    cart.forEach(
        item => {

            const itemPrice =
                Number(item.price) || 0;


            const quantity =
                Number(item.quantity) || 0;


            subtotal +=
                itemPrice * quantity;


            html += `

                <div
                    class="cart-item-row"
                >

                    <div>

                        <strong>
                            ${escapeHTML(item.title)}
                        </strong>

                        <p
                            style="
                                font-size:0.85rem;
                                color:var(--text-muted);
                            "
                        >
                            KES ${itemPrice} each
                        </p>

                        <small
                            style="
                                color:var(--text-muted);
                            "
                        >
                            ${escapeHTML(item.location || "")}
                        </small>

                    </div>


                    <div
                        style="
                            display:flex;
                            align-items:center;
                            gap:0.5rem;
                        "
                    >

                        <button
                            type="button"
                            class="btn-secondary"
                            style="padding:2px 10px;"
                            onclick="
                                window.updateCartQuantity(
                                    '${escapeJS(item.id)}',
                                    -1
                                )
                            "
                        >
                            -
                        </button>


                        <span>
                            ${quantity}
                        </span>


                        <button
                            type="button"
                            class="btn-secondary"
                            style="padding:2px 10px;"
                            onclick="
                                window.updateCartQuantity(
                                    '${escapeJS(item.id)}',
                                    1
                                )
                            "
                        >
                            +
                        </button>


                        <button
                            type="button"
                            onclick="
                                window.removeFromCart(
                                    '${escapeJS(item.id)}'
                                )
                            "
                            style="
                                background:#ef4444;
                                color:#fff;
                                border:none;
                                padding:4px 8px;
                                border-radius:4px;
                                cursor:pointer;
                                margin-left:0.5rem;
                                font-size:0.85rem;
                            "
                        >
                            Remove
                        </button>

                    </div>

                </div>
            `;
        }
    );


    cartItemsList.innerHTML =
        html;


    if (cartSubtotal) {

        cartSubtotal.textContent =
            `KES ${subtotal}`;
    }


    if (cartTotal) {

        cartTotal.textContent =
            `KES ${subtotal + 200}`;
    }
}


// ============================================================
// LOAD LISTINGS
// ============================================================

async function loadListings() {

    if (!productGrid) {
        return;
    }


    productGrid.innerHTML = `
        <p>
            Loading gas suppliers & inventory...
        </p>
    `;


    try {

        const listingsRef =
            collection(
                db,
                "listings"
            );


        const querySnapshot =
            await getDocs(
                listingsRef
            );


        productGrid.innerHTML =
            "";


        if (
            querySnapshot.empty
        ) {

            productGrid.innerHTML = `
                <p>
                    No active cooking gas listings found.
                </p>
            `;

            return;
        }


        // ====================================================
        // FILTER VALUES
        // ====================================================

        const selectedSize =
            filterSize
                ? normalize(
                    filterSize.value
                )
                : "";


        const selectedCategory =
            filterCategory
                ? normalize(
                    filterCategory.value
                )
                : "";


        const selectedLocation =
            filterLocation
                ? normalize(
                    filterLocation.value
                )
                : "";


        const selectedBrand =
            filterBrand
                ? normalize(
                    filterBrand.value
                )
                : "";


        const searchQuery =
            searchInput
                ? normalize(
                    searchInput.value
                )
                : "";


        let matchCount = 0;


        // ====================================================
        // RESOLVE LOCATIONS BEFORE DISPLAY
        // ====================================================

        const listingData = [];


        for (
            const docSnap of querySnapshot.docs
        ) {

            const item =
                docSnap.data();


            const itemId =
                docSnap.id;


            const location =
                await resolveListingLocation(
                    item
                );


            listingData.push({
                item,
                itemId,
                location
            });
        }


        // ====================================================
        // PROCESS LISTINGS
        // ====================================================

        for (
            const listing of listingData
        ) {

            const {
                item,
                itemId,
                location
            } = listing;


            // ------------------------------------------------
            // SIZE
            // ------------------------------------------------

            if (
                !sizeMatches(
                    item,
                    selectedSize
                )
            ) {
                continue;
            }


            // ------------------------------------------------
            // CATEGORY
            // ------------------------------------------------

            if (
                !categoryMatches(
                    item,
                    selectedCategory
                )
            ) {
                continue;
            }


            // ------------------------------------------------
            // LOCATION
            // ------------------------------------------------

            if (
                !locationMatches(
                    location,
                    selectedLocation
                )
            ) {
                continue;
            }


            // ------------------------------------------------
            // BRAND
            // ------------------------------------------------

            if (
                !brandMatches(
                    item,
                    selectedBrand
                )
            ) {
                continue;
            }


            // ------------------------------------------------
            // SEARCH
            // ------------------------------------------------

            if (searchQuery) {

                const searchableText = [

                    item.title,

                    item.description,

                    location,

                    item.brand,

                    item.gasBrand,

                    item.category,

                    item.size,

                    item.weight

                ]
                    .filter(Boolean)
                    .map(normalize)
                    .join(" ");


                if (
                    !searchableText.includes(
                        searchQuery
                    )
                ) {
                    continue;
                }
            }


            matchCount++;


            // =================================================
            // PRODUCT CARD
            // =================================================

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "product-card";


            // =================================================
            // MAP PIN
            // =================================================

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
                    "
                >

                    <path
                        d="
                            M21 10
                            c0 7-9 13-9 13
                            S3 17 3 10
                            a9 9 0 0 1 18 0z
                        "
                    ></path>

                    <circle
                        cx="12"
                        cy="10"
                        r="3"
                    ></circle>

                </svg>
            `;


            // =================================================
            // IMAGES
            // =================================================

            let displayImages = [];


            if (
                Array.isArray(item.images) &&
                item.images.length > 0
            ) {

                displayImages =
                    item.images;

            } else if (
                Array.isArray(item.imageUrls) &&
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


            displayImages =
                [
                    ...new Set(
                        displayImages
                    )
                ];


            // =================================================
            // DISPLAY VALUES
            // =================================================

            const title =
                item.title ||
                "Cooking Gas";


            const price =
                item.price !== undefined &&
                item.price !== null &&
                item.price !== ""
                    ? item.price
                    : "Price on request";


            const size =
                item.size ||
                item.weight ||
                "Size not specified";


            const description =
                item.description ||
                "";


            // =================================================
            // IMAGE TICKER
            // =================================================

            const imageTicker =
                createImageTicker(
                    displayImages,
                    title
                );


            // =================================================
            // SAFE VALUES
            // =================================================

            const safeTitle =
                escapeJS(
                    title
                );


            const safeLocation =
                escapeJS(
                    location
                );


            const numericPrice =
                Number(
                    item.price
                ) || 0;


            // =================================================
            // CARD
            // =================================================

            card.innerHTML = `

                <div>

                    ${imageTicker}


                    <div
                        class="card-body"
                    >

                        <h4>
                            ${escapeHTML(title)}
                        </h4>


                        <p
                            class="price"
                        >

                            KES
                            ${escapeHTML(price)}

                            <span
                                style="
                                    font-size:0.8rem;
                                    font-weight:normal;
                                    color:var(--text-muted);
                                "
                            >
                                (${escapeHTML(size)})
                            </span>

                        </p>


                        <p
                            class="location"
                            title="Supplier registered location"
                        >

                            ${mapPinSvg}

                            ${escapeHTML(
                                location
                            )}

                        </p>


                        <p
                            style="
                                font-size:0.85rem;
                                color:var(--text-muted);
                                line-height:1.4;
                            "
                        >
                            ${escapeHTML(
                                description
                            )}
                        </p>

                    </div>

                </div>


                <div
                    style="
                        padding:0 1rem 1rem 1rem;
                    "
                >

                    <button
                        class="btn-primary"
                        onclick="
                            window.addToListingCart(
                                '${escapeJS(itemId)}',
                                '${safeTitle}',
                                ${numericPrice},
                                '${safeLocation}'
                            )
                        "
                    >
                        Order Now
                    </button>

                </div>

            `;


            productGrid.appendChild(
                card
            );
        }


        // ====================================================
        // NO RESULTS
        // ====================================================

        if (
            matchCount === 0
        ) {

            productGrid.innerHTML = `

                <div
                    style="
                        grid-column:1/-1;
                        text-align:center;
                        padding:40px 20px;
                        color:var(--text-muted);
                    "
                >

                    <h4>
                        No listings found
                    </h4>

                    <p>
                        Try changing your location,
                        brand, size or category filter.
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

            <div
                style="
                    grid-column:1/-1;
                    text-align:center;
                    padding:30px;
                "
            >

                <p>
                    Error loading platform inventory.
                </p>

                <small>
                    ${escapeHTML(
                        err.message ||
                        "Please try again."
                    )}
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
// INITIALIZE MARKETPLACE
// ============================================================

function initializeMarketplace() {

    // --------------------------------------------------------
    // ELEMENTS
    // --------------------------------------------------------

    productGrid =
        document.getElementById(
            "productGrid"
        );


    filterSize =
        document.getElementById(
            "filterSize"
        );


    filterCategory =
        document.getElementById(
            "filterCategory"
        );


    filterLocation =
        document.getElementById(
            "filterLocation"
        );


    filterBrand =
        document.getElementById(
            "filterBrand"
        );


    clearFiltersBtn =
        document.getElementById(
            "clearFiltersBtn"
        );


    searchBtn =
        document.getElementById(
            "searchBtn"
        );


    searchInput =
        document.getElementById(
            "searchInput"
        );


    // --------------------------------------------------------
    // CART
    // --------------------------------------------------------

    updateCartUI();


    // --------------------------------------------------------
    // NAVIGATION
    // --------------------------------------------------------

    const homeLink =
        document.getElementById(
            "homeLink"
        );


    const cartLink =
        document.getElementById(
            "cartLink"
        );


    const hamburger =
        document.querySelector(
            ".hamburger"
        );


    const navLinks =
        document.querySelector(
            ".nav-links"
        );


    // --------------------------------------------------------
    // HOME
    // --------------------------------------------------------

    if (homeLink) {

        homeLink.addEventListener(
            "click",
            e => {

                e.preventDefault();


                switchView(
                    "marketplaceView"
                );


                if (navLinks) {

                    navLinks.classList.remove(
                        "active"
                    );
                }
            }
        );
    }


    // --------------------------------------------------------
    // CART
    // --------------------------------------------------------

    if (cartLink) {

        cartLink.addEventListener(
            "click",
            e => {

                e.preventDefault();


                renderCartView();


                switchView(
                    "cartView"
                );


                if (navLinks) {

                    navLinks.classList.remove(
                        "active"
                    );
                }
            }
        );
    }


    // --------------------------------------------------------
    // HAMBURGER
    // --------------------------------------------------------

    if (
        hamburger &&
        navLinks
    ) {

        hamburger.addEventListener(
            "click",
            e => {

                e.preventDefault();


                navLinks.classList.toggle(
                    "active"
                );
            }
        );
    }


    // --------------------------------------------------------
    // FILTERS
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // CLEAR
    // --------------------------------------------------------

    if (clearFiltersBtn) {

        clearFiltersBtn.addEventListener(
            "click",
            clearFilters
        );
    }


    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

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

                if (
                    e.key === "Enter"
                ) {

                    e.preventDefault();

                    loadListings();
                }
            }
        );
    }


    // --------------------------------------------------------
    // LOAD
    // --------------------------------------------------------

    loadListings();
}


// ============================================================
// START
// ============================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMarketplace
    );

} else {

    initializeMarketplace();
}