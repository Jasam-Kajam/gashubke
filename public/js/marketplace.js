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
// Dynamic Firestore Location + Brand Filters
// ============================================================

let productGrid;
let filterSize;
let filterCategory;
let filterLocation;
let filterBrand;
let clearFiltersBtn;
let searchBtn;
let searchInput;

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

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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

        return town || county || location.name || location.label || "";
    }

    return String(location);
}

function extractSupplierLocation(profile) {
    if (!profile) return "";

    if (profile.supplierLocation) {
        const location = formatLocation(profile.supplierLocation);
        if (location) return location;
    }

    const nestedLocations = [
        profile.location,
        profile.address,
        profile.businessLocation,
        profile.registeredLocation
    ];

    for (const location of nestedLocations) {
        const formatted = formatLocation(location);
        if (formatted) return formatted;
    }

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

    const area =
        profile.area ||
        profile.businessArea ||
        profile.supplierArea ||
        "";

    if (town && county) return `${town}, ${county}`;
    if (town) return String(town);
    if (area) return String(area);
    if (county) return String(county);

    return "";
}

async function getSupplierLocation(supplierId) {
    if (!supplierId) return "";

    const cacheKey = String(supplierId);
    if (supplierLocationCache.has(cacheKey)) {
        return supplierLocationCache.get(cacheKey);
    }

    try {
        const supplierSnap = await getDoc(doc(db, "suppliers", cacheKey));
        if (supplierSnap.exists()) {
            const location = extractSupplierLocation(supplierSnap.data());
            if (location) {
                supplierLocationCache.set(cacheKey, location);
                return location;
            }
        }

        const userSnap = await getDoc(doc(db, "users", cacheKey));
        if (userSnap.exists()) {
            const location = extractSupplierLocation(userSnap.data());
            if (location) {
                supplierLocationCache.set(cacheKey, location);
                return location;
            }
        }
    } catch (error) {
        console.warn("Unable to load supplier location:", supplierId, error);
    }

    supplierLocationCache.set(cacheKey, "");
    return "";
}

async function resolveListingLocation(item) {
    if (item.supplierLocation) {
        const location = formatLocation(item.supplierLocation);
        if (location) return location;
    }

    const supplierId =
        item.supplierId ||
        item.supplierID ||
        item.vendorId ||
        item.vendorID ||
        item.sellerId ||
        item.sellerID ||
        item.ownerId ||
        item.ownerID ||
        "";

    if (supplierId) {
        const supplierLocation = await getSupplierLocation(supplierId);
        if (supplierLocation) return supplierLocation;
    }

    const legacyLocations = [
        item.location,
        item.town,
        item.city,
        item.county,
        item.area,
        item.deliveryLocation,
        item.deliveryArea
    ];

    for (const location of legacyLocations) {
        const formatted = formatLocation(location);
        if (formatted) return formatted;
    }

    return "Location unavailable";
}


// ============================================================
// DYNAMIC BRAND EXTRACTION
// ============================================================

function getListingBrand(item) {
    if (!item) return "";

    const explicitBrand =
        item.brand ||
        item.gasBrand ||
        item.productBrand ||
        item.gas_brand ||
        item.product_brand ||
        "";

    if (explicitBrand) {
        return String(explicitBrand).trim();
    }

    const title = String(item.title || "").trim();
    if (!title) return "";

    const sizeMatch = title.match(/^(.+?)\s+\d+(?:\.\d+)?\s*KG\b/i);
    if (sizeMatch) {
        return sizeMatch[1].trim().replace(/\s+/g, " ");
    }

    return "";
}


// ============================================================
// POPULATE DYNAMIC LOCATION + BRAND FILTERS
// ============================================================

function populateDynamicFilters(listingData) {
    if (!filterLocation || !filterBrand) return;

    const previousLocation = filterLocation.value;
    const previousBrand = filterBrand.value;

    const locations = new Map();
    const brands = new Map();

    listingData.forEach(listing => {
        const location = String(listing.location || "").trim();
        if (location && location !== "Location unavailable") {
            const key = normalize(location);
            if (!locations.has(key)) {
                locations.set(key, location);
            }
        }

        const brand = getListingBrand(listing.item);
        if (brand) {
            const key = normalize(brand);
            if (!brands.has(key)) {
                brands.set(key, brand);
            }
        }
    });

    filterLocation.innerHTML = `<option value="">All Locations</option>`;
    [...locations.values()]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .forEach(location => {
            const option = document.createElement("option");
            option.value = location;
            option.textContent = location;
            filterLocation.appendChild(option);
        });

    filterBrand.innerHTML = `<option value="">All Brands</option>`;
    [...brands.values()]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .forEach(brand => {
            const option = document.createElement("option");
            option.value = brand;
            option.textContent = brand;
            filterBrand.appendChild(option);
        });

    if (
        previousLocation &&
        [...filterLocation.options].some(option => normalize(option.value) === normalize(previousLocation))
    ) {
        filterLocation.value = previousLocation;
    }

    if (
        previousBrand &&
        [...filterBrand.options].some(option => normalize(option.value) === normalize(previousBrand))
    ) {
        filterBrand.value = previousBrand;
    }
}


// ============================================================
// MATCHERS
// ============================================================

function brandMatches(item, selectedBrand) {
    if (!selectedBrand) return true;
    const listingBrand = getListingBrand(item);
    if (!listingBrand) return false;
    return normalize(listingBrand) === normalize(selectedBrand);
}

function locationMatches(location, selectedLocation) {
    if (!selectedLocation) return true;
    const selected = normalize(selectedLocation);
    const actualLocation = normalize(location);
    if (!actualLocation) return false;
    return (
        actualLocation === selected ||
        actualLocation.includes(selected) ||
        selected.includes(actualLocation)
    );
}

function sizeMatches(item, selectedSize) {
    if (!selectedSize) return true;
    const selected = normalizeKey(selectedSize);
    const itemSize = normalizeKey(item.size || item.weight || "");
    return (
        itemSize === selected ||
        itemSize.includes(selected) ||
        selected.includes(itemSize)
    );
}

function categoryMatches(item, selectedCategory) {
    if (!selectedCategory) return true;
    const selected = normalizeKey(selectedCategory);
    const itemCategory = normalizeKey(item.category || item.productCategory || item.type || "");
    return (
        itemCategory === selected ||
        itemCategory.includes(selected) ||
        selected.includes(itemCategory)
    );
}


// ============================================================
// IMAGE TICKER
// ============================================================

function createImageTicker(images, title) {
    if (!Array.isArray(images)) return "";

    const validImages = [
        ...new Set(
            images
                .filter(Boolean)
                .map(image => String(image).trim())
                .filter(Boolean)
        )
    ];

    if (validImages.length === 0) return "";

    const tickerId = "ticker-" + Math.random().toString(36).substring(2, 12);

    if (validImages.length === 1) {
        return `
            <div id="${tickerId}" class="listing-image-ticker">
                <div class="listing-image-track">
                    <div class="listing-image-slide active">
                        <img
                            src="${escapeHTML(validImages[0])}"
                            alt="${escapeHTML(title)}"
                            loading="lazy"
                            onerror="this.style.display='none';"
                        >
                    </div>
                </div>
            </div>
        `;
    }

    const slides = validImages
        .map((image, index) => `
            <div class="listing-image-slide ${index === 0 ? "active" : ""}" data-slide="${index}">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(title)} - Photo ${index + 1}"
                    loading="${index === 0 ? "eager" : "lazy"}"
                    onerror="this.style.visibility='hidden';"
                >
            </div>
        `)
        .join("");

    const indicators = validImages
        .map((_, index) => `
            <span class="listing-image-dot ${index === 0 ? "active" : ""}" data-slide="${index}"></span>
        `)
        .join("");

    const html = `
        <div id="${tickerId}" class="listing-image-ticker">
            <div class="listing-image-track">${slides}</div>
            <div class="listing-image-indicators">${indicators}</div>
            <div class="listing-image-counter">1 / ${validImages.length}</div>
        </div>
    `;

    setTimeout(() => {
        const ticker = document.getElementById(tickerId);
        if (!ticker) return;

        const tickerSlides = ticker.querySelectorAll(".listing-image-slide");
        const tickerDots = ticker.querySelectorAll(".listing-image-dot");
        const counter = ticker.querySelector(".listing-image-counter");

        let currentIndex = 0;

        const timer = setInterval(() => {
            if (!document.body.contains(ticker)) {
                clearInterval(timer);
                return;
            }

            tickerSlides[currentIndex]?.classList.remove("active");
            tickerDots[currentIndex]?.classList.remove("active");

            currentIndex = (currentIndex + 1) % tickerSlides.length;

            tickerSlides[currentIndex]?.classList.add("active");
            tickerDots[currentIndex]?.classList.add("active");

            if (counter) {
                counter.textContent = `${currentIndex + 1} / ${tickerSlides.length}`;
            }
        }, 3000);
    }, 100);

    return html;
}


// ============================================================
// CART
// ============================================================

window.addToListingCart = function (id, title, price, location) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        alert("Please sign in or create an account to add items to your cart.");
        const authModal = document.getElementById("authModal");
        if (authModal) {
            authModal.style.display = "flex";
        }
        return;
    }

    const cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
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

window.updateCartQuantity = function (id, delta) {
    const cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
    const index = cart.findIndex(item => item.id === id);

    if (index > -1) {
        cart[index].quantity += Number(delta);
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
    }

    localStorage.setItem("gas_cart", JSON.stringify(cart));
    renderCartView();
    updateCartUI();
};

window.removeFromCart = function (id) {
    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
    cart = cart.filter(item => item.id !== id);
    localStorage.setItem("gas_cart", JSON.stringify(cart));
    renderCartView();
    updateCartUI();
};

function updateCartUI() {
    const cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
    const totalCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) {
        cartCountEl.textContent = String(totalCount);
        cartCountEl.style.display = totalCount > 0 ? "inline-block" : "none";
    }
}

function renderCartView() {
    const cartItemsList = document.getElementById("cartItemsList");
    const cartSubtotal = document.getElementById("cartSubtotal");
    const cartTotal = document.getElementById("cartTotal");

    if (!cartItemsList) return;

    const cart = JSON.parse(localStorage.getItem("gas_cart")) || [];

    if (cart.length === 0) {
        cartItemsList.innerHTML = "<p>Your cart is currently empty.</p>";
        if (cartSubtotal) cartSubtotal.textContent = "KES 0";
        if (cartTotal) cartTotal.textContent = "KES 200";
        return;
    }

    let html = "";
    let subtotal = 0;

    cart.forEach(item => {
        const itemPrice = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        subtotal += itemPrice * quantity;

        html += `
            <div class="cart-item-row" style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 0;border-bottom:1px solid #e2e8f0;">
                <div>
                    <strong>${escapeHTML(item.title)}</strong>
                    <p style="font-size:0.85rem;color:#64748b;margin:0.25rem 0;">KES ${itemPrice} each</p>
                    <small style="color:#64748b;">${escapeHTML(item.location || "")}</small>
                </div>

                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <button type="button" class="btn-secondary" style="padding:2px 10px;" onclick="window.updateCartQuantity('${escapeJS(item.id)}', -1)">-</button>
                    <span>${quantity}</span>
                    <button type="button" class="btn-secondary" style="padding:2px 10px;" onclick="window.updateCartQuantity('${escapeJS(item.id)}', 1)">+</button>
                    <button
                        type="button"
                        onclick="window.removeFromCart('${escapeJS(item.id)}')"
                        style="background:#ef4444;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;margin-left:0.5rem;font-size:0.85rem;"
                    >
                        Remove
                    </button>
                </div>
            </div>
        `;
    });

    cartItemsList.innerHTML = html;
    if (cartSubtotal) cartSubtotal.textContent = `KES ${subtotal}`;
    if (cartTotal) cartTotal.textContent = `KES ${subtotal + 200}`;
}

window.renderCartView = renderCartView;


// ============================================================
// LOAD LISTINGS
// ============================================================

async function loadListings() {
    if (!productGrid) return;

    productGrid.innerHTML = `<p>Loading gas suppliers & inventory...</p>`;

    try {
        const querySnapshot = await getDocs(collection(db, "listings"));

        // Resolve locations in parallel for fast initial loads
        const listingData = await Promise.all(
            querySnapshot.docs.map(async docSnap => {
                const item = docSnap.data();
                const itemId = docSnap.id;
                const location = await resolveListingLocation(item);
                return { item, itemId, location };
            })
        );

        populateDynamicFilters(listingData);
        productGrid.innerHTML = "";

        if (listingData.length === 0) {
            productGrid.innerHTML = `
                <div class="marketplace-empty-state">
                    <h3>No active cooking gas listings found</h3>
                    <p>New supplier listings will appear here.</p>
                </div>
            `;
            return;
        }

        const selectedSize = filterSize ? normalize(filterSize.value) : "";
        const selectedCategory = filterCategory ? normalize(filterCategory.value) : "";
        const selectedLocation = filterLocation ? normalize(filterLocation.value) : "";
        const selectedBrand = filterBrand ? normalize(filterBrand.value) : "";
        const searchQuery = searchInput ? normalize(searchInput.value) : "";

        let matchCount = 0;

        for (const listing of listingData) {
            const { item, itemId, location } = listing;

            if (!sizeMatches(item, selectedSize)) continue;
            if (!categoryMatches(item, selectedCategory)) continue;
            if (!locationMatches(location, selectedLocation)) continue;
            if (!brandMatches(item, selectedBrand)) continue;

            if (searchQuery) {
                const searchableText = [
                    item.title,
                    item.description,
                    location,
                    getListingBrand(item),
                    item.category,
                    item.size,
                    item.weight
                ]
                    .filter(Boolean)
                    .map(normalize)
                    .join(" ");

                if (!searchableText.includes(searchQuery)) continue;
            }

            matchCount++;

            const card = document.createElement("div");
            card.className = "product-card";

            const mapPinSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;color:var(--primary);">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
            `;

            let displayImages = [];
            if (Array.isArray(item.images) && item.images.length > 0) {
                displayImages = item.images;
            } else if (Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
                displayImages = item.imageUrls;
            } else if (item.imageUrl) {
                displayImages = [item.imageUrl];
            }
            displayImages = [...new Set(displayImages)];

            const title = item.title || "Cooking Gas";
            const price = item.price !== undefined && item.price !== null && item.price !== "" ? item.price : "Price on request";
            const size = item.size || item.weight || "Size not specified";
            const description = item.description || "";

            const imageTicker = createImageTicker(displayImages, title);
            const safeTitle = escapeJS(title);
            const safeLocation = escapeJS(location);
            const numericPrice = Number(item.price) || 0;

            card.innerHTML = `
                <div>
                    ${imageTicker}
                    <div class="card-body">
                        <h4>${escapeHTML(title)}</h4>
                        <p class="price">
                            KES ${escapeHTML(price)}
                            <span style="font-size:0.8rem;font-weight:normal;color:var(--text-muted);">
                                (${escapeHTML(size)})
                            </span>
                        </p>
                        <p class="location" title="Supplier registered location">
                            ${mapPinSvg} ${escapeHTML(location)}
                        </p>
                        <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.4;">
                            ${escapeHTML(description)}
                        </p>
                    </div>
                </div>

                <div style="padding:0 1rem 1rem 1rem;">
                    <button
                        class="btn-primary"
                        onclick="window.addToListingCart('${escapeJS(itemId)}', '${safeTitle}', ${numericPrice}, '${safeLocation}')"
                    >
                        Order Now
                    </button>
                </div>
            `;

            productGrid.appendChild(card);
        }

        if (matchCount === 0) {
            productGrid.innerHTML = `
                <div class="marketplace-empty-state">
                    <h3>No listings found</h3>
                    <p>Try changing your location, brand, size, or category filter.</p>
                </div>
            `;
        }
    } catch (err) {
        console.error("GasHubKE listings error:", err);
        productGrid.innerHTML = `
            <div class="marketplace-empty-state">
                <p>Error loading platform inventory.</p>
                <small>${escapeHTML(err.message || "Please try again.")}</small>
            </div>
        `;
    }
}


// ============================================================
// CLEAR FILTERS
// ============================================================

function clearFilters() {
    if (filterLocation) filterLocation.value = "";
    if (filterBrand) filterBrand.value = "";
    if (filterSize) filterSize.value = "";
    if (filterCategory) filterCategory.value = "";
    if (searchInput) searchInput.value = "";
    loadListings();
}


// ============================================================
// INITIALIZE MARKETPLACE
// ============================================================

function initializeMarketplace() {
    productGrid = document.getElementById("productGrid");
    filterSize = document.getElementById("filterSize");
    filterCategory = document.getElementById("filterCategory");
    filterLocation = document.getElementById("filterLocation");
    filterBrand = document.getElementById("filterBrand");
    clearFiltersBtn = document.getElementById("clearFiltersBtn");
    searchBtn = document.getElementById("searchBtn");
    searchInput = document.getElementById("searchInput");

    updateCartUI();

    [filterSize, filterCategory, filterLocation, filterBrand].forEach(select => {
        if (select) {
            select.addEventListener("change", loadListings);
        }
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener("click", clearFilters);
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", loadListings);
    }

    if (searchInput) {
        searchInput.addEventListener("keypress", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                loadListings();
            }
        });
    }

    loadListings();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeMarketplace);
} else {
    initializeMarketplace();
}
