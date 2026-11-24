import { db, auth } from "./firebase-config.js";

import {
    collection,
    getDocs,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// GAS HUB KE - MARKETPLACE.JS
// Dynamic Location & Brand Filters, Vendor Delivery Offers,
// Multi-Image Card Scrolling & Product Detail Modal
// ============================================================

const CART_STORAGE_KEY = "gas_cart";

let productGrid;
let filterSize;
let filterCategory;
let filterLocation;
let filterBrand;
let clearFiltersBtn;
let searchBtn;
let searchInput;

const supplierProfileCache = new Map();
const listingCache = new Map();


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

function formatKES(amount) {
    return `KES ${(Number(amount) || 0).toLocaleString()}`;
}

function parseNumericFee(value) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
    const cleaned = String(value).replace(/[^\d.]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function showMarketplaceToast(message) {
    if (!message) return;

    let toast = document.getElementById("gasHubMarketplaceToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "gasHubMarketplaceToast";
        toast.style.cssText = [
            "position:fixed",
            "bottom:20px",
            "right:20px",
            "z-index:99999",
            "background:#0f172a",
            "color:#ffffff",
            "padding:10px 16px",
            "border-radius:10px",
            "font-size:14px",
            "box-shadow:0 10px 25px rgba(0,0,0,0.22)",
            "transition:opacity 0.2s ease",
            "opacity:0",
            "pointer-events:none"
        ].join(";");
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = "1";

    clearTimeout(showMarketplaceToast._timer);
    showMarketplaceToast._timer = setTimeout(() => {
        toast.style.opacity = "0";
    }, 2200);
}


// ============================================================
// SUPPLIER PROFILE, LOCATION & DELIVERY OFFER RESOLUTION
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

function extractDeliveryDetails(source) {
    if (!source) return { fee: null, offer: "" };

    const rawFee =
        source.deliveryFee ??
        source.delivery_fee ??
        source.shippingFee ??
        source.deliveryCost ??
        source.deliveryCharge;

    const fee = parseNumericFee(rawFee);

    const offer = String(
        source.deliveryOffer ||
        source.delivery_offer ||
        source.deliveryNote ||
        source.deliveryTerms ||
        ""
    ).trim();

    return { fee, offer };
}

async function getSupplierDetails(supplierId) {
    if (!supplierId) {
        return { location: "", businessName: "", deliveryFee: null, deliveryOffer: "" };
    }

    const cacheKey = String(supplierId);
    if (supplierProfileCache.has(cacheKey)) {
        return supplierProfileCache.get(cacheKey);
    }

    const resolved = {
        location: "",
        businessName: "",
        deliveryFee: null,
        deliveryOffer: ""
    };

    try {
        const supplierSnap = await getDoc(doc(db, "suppliers", cacheKey));
        if (supplierSnap.exists()) {
            const data = supplierSnap.data();
            resolved.location = extractSupplierLocation(data) || resolved.location;
            resolved.businessName = data.businessName || data.supplierName || data.name || resolved.businessName;
            const delivery = extractDeliveryDetails(data);
            if (delivery.fee !== null) resolved.deliveryFee = delivery.fee;
            if (delivery.offer) resolved.deliveryOffer = delivery.offer;
        }

        const userSnap = await getDoc(doc(db, "users", cacheKey));
        if (userSnap.exists()) {
            const data = userSnap.data();
            resolved.location = resolved.location || extractSupplierLocation(data);
            resolved.businessName = resolved.businessName || data.businessName || data.supplierName || data.name || "";
            const delivery = extractDeliveryDetails(data);
            if (resolved.deliveryFee === null && delivery.fee !== null) {
                resolved.deliveryFee = delivery.fee;
            }
            if (!resolved.deliveryOffer && delivery.offer) {
                resolved.deliveryOffer = delivery.offer;
            }
        }
    } catch (error) {
        console.warn("Unable to load supplier details:", supplierId, error);
    }

    supplierProfileCache.set(cacheKey, resolved);
    return resolved;
}

function getListingVendorId(item) {
    return String(
        item.vendorId ||
        item.vendorID ||
        item.supplierId ||
        item.supplierID ||
        item.sellerId ||
        item.sellerID ||
        item.ownerId ||
        item.ownerID ||
        ""
    ).trim();
}

async function resolveListingMeta(item) {
    const vendorId = getListingVendorId(item);
    const supplierDetails = vendorId
        ? await getSupplierDetails(vendorId)
        : { location: "", businessName: "", deliveryFee: null, deliveryOffer: "" };

    let location = "";
    if (item.supplierLocation) {
        location = formatLocation(item.supplierLocation);
    }
    if (!location && supplierDetails.location) {
        location = supplierDetails.location;
    }
    if (!location) {
        const legacyLocations = [
            item.location,
            item.town,
            item.city,
            item.county,
            item.area,
            item.deliveryLocation,
            item.deliveryArea
        ];
        for (const candidate of legacyLocations) {
            const formatted = formatLocation(candidate);
            if (formatted) {
                location = formatted;
                break;
            }
        }
    }
    if (!location) {
        location = "Location unavailable";
    }

    const supplierName = String(
        item.supplierName ||
        item.businessName ||
        item.vendorName ||
        supplierDetails.businessName ||
        ""
    ).trim();

    const listingDelivery = extractDeliveryDetails(item);
    const deliveryFee =
        listingDelivery.fee !== null
            ? listingDelivery.fee
            : (supplierDetails.deliveryFee !== null ? supplierDetails.deliveryFee : 0);

    const deliveryOffer =
        listingDelivery.offer ||
        supplierDetails.deliveryOffer ||
        (deliveryFee === 0 ? "Free Delivery" : "");

    return {
        location,
        vendorId,
        supplierName,
        deliveryFee,
        deliveryOffer
    };
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
// MULTI-IMAGE HORIZONTAL SCROLL TICKER
// ============================================================

function createImageTicker(images, title, itemId = "") {
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

    const slides = validImages
        .map((image, index) => `
            <div class="listing-image-slide" data-slide="${index}" onclick="window.openProductDetail('${escapeJS(itemId)}')">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(title)} - Photo ${index + 1}"
                    loading="${index === 0 ? "eager" : "lazy"}"
                    onerror="this.style.visibility='hidden';"
                >
            </div>
        `)
        .join("");

    if (validImages.length === 1) {
        return `
            <div id="${tickerId}" class="listing-image-ticker">
                <div class="listing-image-track">${slides}</div>
            </div>
        `;
    }

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

        const track = ticker.querySelector(".listing-image-track");
        const tickerSlides = ticker.querySelectorAll(".listing-image-slide");
        const tickerDots = ticker.querySelectorAll(".listing-image-dot");
        const counter = ticker.querySelector(".listing-image-counter");

        if (!track || tickerSlides.length <= 1) return;

        let currentIndex = 0;
        let isPaused = false;
        let scrollDebounce;

        function updateIndicators(idx) {
            tickerDots.forEach((dot, dIdx) => dot.classList.toggle("active", dIdx === idx));
            if (counter) counter.textContent = `${idx + 1} / ${tickerSlides.length}`;
        }

        function scrollToSlide(index) {
            const total = tickerSlides.length;
            currentIndex = ((index % total) + total) % total;
            const slideWidth = track.clientWidth || track.getBoundingClientRect().width || 1;
            track.scrollLeft = currentIndex * slideWidth;
            updateIndicators(currentIndex);
        }

        tickerDots.forEach((dot, idx) => {
            dot.addEventListener("click", event => {
                event.stopPropagation();
                scrollToSlide(idx);
            });
        });

        track.addEventListener("scroll", () => {
            clearTimeout(scrollDebounce);
            scrollDebounce = setTimeout(() => {
                const slideWidth = track.clientWidth || 1;
                const nearest = Math.round(track.scrollLeft / slideWidth);
                if (nearest >= 0 && nearest < tickerSlides.length && nearest !== currentIndex) {
                    currentIndex = nearest;
                    updateIndicators(currentIndex);
                }
            }, 90);
        }, { passive: true });

        track.addEventListener("pointerenter", () => { isPaused = true; });
        track.addEventListener("pointerleave", () => { isPaused = false; });
        track.addEventListener("touchstart", () => { isPaused = true; }, { passive: true });
        track.addEventListener("touchend", () => { isPaused = false; }, { passive: true });

        const timer = setInterval(() => {
            if (!document.body.contains(ticker)) {
                clearInterval(timer);
                return;
            }
            if (!isPaused) {
                const nextIdx = (currentIndex + 1) % tickerSlides.length;
                scrollToSlide(nextIdx);
            }
        }, 3000);
    }, 80);

    return html;
}


// ============================================================
// CART & VENDOR-BASED DELIVERY CALCULATIONS
// ============================================================

function readCartStorage() {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("Unable to read cart from localStorage:", error);
        return [];
    }
}

function writeCartStorage(nextCart) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextCart));
    } catch (error) {
        console.warn("Unable to save cart to localStorage:", error);
    }
}

function calculateCartTotals(cartItems) {
    const subtotal = cartItems.reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + price * qty;
    }, 0);

    const vendorFees = new Map();
    cartItems.forEach(item => {
        const groupKey = item.vendorId ? `vendor:${item.vendorId}` : `item:${item.id}`;
        const itemFee = Math.max(0, Number(item.deliveryFee) || 0);
        if (!vendorFees.has(groupKey)) {
            vendorFees.set(groupKey, itemFee);
        } else {
            vendorFees.set(groupKey, Math.max(vendorFees.get(groupKey), itemFee));
        }
    });

    let deliveryFee = 0;
    vendorFees.forEach(fee => {
        deliveryFee += fee;
    });

    const total = subtotal + deliveryFee;

    return { subtotal, deliveryFee, total };
}

window.addToListingCart = function (
    id,
    title,
    price,
    location,
    vendorId = "",
    supplierName = "",
    deliveryFee = 0,
    deliveryOffer = ""
) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        showMarketplaceToast("Please sign in or register to add items to your cart.");
        const authModal = document.getElementById("authModal");
        if (authModal) {
            authModal.style.display = "flex";
        }
        return;
    }

    const cart = readCartStorage();
    const existingIndex = cart.findIndex(item => String(item.id) === String(id));
    const parsedDeliveryFee = Math.max(0, Number(deliveryFee) || 0);

    if (existingIndex > -1) {
        cart[existingIndex].quantity = (Number(cart[existingIndex].quantity) || 1) + 1;
        cart[existingIndex].deliveryFee = parsedDeliveryFee;
        if (deliveryOffer) cart[existingIndex].deliveryOffer = deliveryOffer;
        if (vendorId && !cart[existingIndex].vendorId) cart[existingIndex].vendorId = vendorId;
        if (supplierName && !cart[existingIndex].supplierName) cart[existingIndex].supplierName = supplierName;
    } else {
        cart.push({
            id,
            title,
            price: Number(price) || 0,
            location,
            vendorId,
            supplierName,
            deliveryFee: parsedDeliveryFee,
            deliveryOffer: deliveryOffer || (parsedDeliveryFee === 0 ? "Free Delivery" : ""),
            quantity: 1
        });
    }

    writeCartStorage(cart);
    updateCartUI();
    renderCartView();
    showMarketplaceToast(`${title} added to cart.`);
};

window.updateCartQuantity = function (id, delta) {
    const cart = readCartStorage();
    const index = cart.findIndex(item => String(item.id) === String(id));

    if (index > -1) {
        const nextQty = (Number(cart[index].quantity) || 1) + Number(delta || 0);
        if (nextQty <= 0) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = nextQty;
        }
    }

    writeCartStorage(cart);
    renderCartView();
    updateCartUI();
};

window.removeFromCart = function (id) {
    const cart = readCartStorage().filter(item => String(item.id) !== String(id));
    writeCartStorage(cart);
    renderCartView();
    updateCartUI();
    showMarketplaceToast("Item removed from cart.");
};

window.clearListingCart = function () {
    writeCartStorage([]);
    renderCartView();
    updateCartUI();
};

function updateCartUI() {
    const cart = readCartStorage();
    const totalCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) {
        cartCountEl.textContent = String(totalCount);
        cartCountEl.style.display = totalCount > 0 ? "inline-flex" : "none";
    }
}

function renderCartView() {
    const cartItemsList = document.getElementById("cartItemsList");
    const cartSubtotal = document.getElementById("cartSubtotal");
    const cartDelivery = document.getElementById("cartDelivery");
    const cartTotal = document.getElementById("cartTotal");

    const cart = readCartStorage();
    const { subtotal, deliveryFee, total } = calculateCartTotals(cart);

    if (cartSubtotal) cartSubtotal.textContent = formatKES(subtotal);
    if (cartDelivery) {
        cartDelivery.textContent = cart.length === 0
            ? "KES 0"
            : (deliveryFee === 0 ? "Free (Vendor Offer)" : formatKES(deliveryFee));
    }
    if (cartTotal) cartTotal.textContent = formatKES(total);

    if (!cartItemsList) return;

    if (cart.length === 0) {
        cartItemsList.innerHTML = `<p style="color:#64748b;padding:0.75rem 0;">Your cart is currently empty.</p>`;
        return;
    }

    cartItemsList.innerHTML = cart
        .map(item => {
            const itemPrice = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 1;
            const lineTotal = itemPrice * quantity;
            const itemDeliveryFee = Math.max(0, Number(item.deliveryFee) || 0);
            const deliveryTag = item.deliveryOffer
                ? escapeHTML(item.deliveryOffer)
                : (itemDeliveryFee === 0 ? "Free Delivery" : `Delivery: ${formatKES(itemDeliveryFee)}`);
            const supplierLabel = item.supplierName ? ` · ${escapeHTML(item.supplierName)}` : "";

            return `
                <div class="cart-item-row" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;padding:0.85rem 0;border-bottom:1px solid #e2e8f0;">
                    <div>
                        <strong>${escapeHTML(item.title)}</strong>
                        <p style="font-size:0.85rem;color:#64748b;margin:0.25rem 0;">${formatKES(itemPrice)} each · Subtotal: ${formatKES(lineTotal)}</p>
                        <small style="color:#64748b;display:block;">${escapeHTML(item.location || "")}${supplierLabel}</small>
                        <small style="color:#16a34a;font-weight:600;display:inline-block;margin-top:0.2rem;">${deliveryTag}</small>
                    </div>

                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <button type="button" class="btn-secondary" style="padding:2px 10px;" onclick="window.updateCartQuantity('${escapeJS(item.id)}', -1)">-</button>
                        <span style="min-width:1.4rem;text-align:center;font-weight:600;">${quantity}</span>
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
        })
        .join("");
}

window.renderCartView = renderCartView;
window.getGasCartSummary = function () {
    const items = readCartStorage();
    return {
        items,
        ...calculateCartTotals(items)
    };
};


// ============================================================
// PRODUCT DETAIL / READ MORE MODAL
// ============================================================

window.openProductDetail = function (itemId) {
    const entry = listingCache.get(String(itemId));
    if (!entry) return;

    const { item, location, vendorId, supplierName, deliveryFee, deliveryOffer } = entry;
    const modal = document.getElementById("productDetailModal");
    if (!modal) return;

    const images = Array.isArray(item.images) && item.images.length > 0
        ? [...new Set(item.images.filter(Boolean))]
        : (item.imageUrl ? [item.imageUrl] : []);

    const mainImg = document.getElementById("detailMainImage");
    const thumbRow = document.getElementById("detailThumbRow");
    const sizeBadge = document.getElementById("detailSizeBadge");
    const titleEl = document.getElementById("detailTitle");
    const priceEl = document.getElementById("detailPrice");
    const metaEl = document.getElementById("detailMeta");
    const sizeSelect = document.getElementById("detailSizeSelect");
    const descEl = document.getElementById("detailDescription");

    const title = item.title || "Cooking Gas";
    const price = Number(item.price) || 0;
    const sizeText = item.size || item.weight || "13kg";

    if (mainImg) {
        mainImg.src = images[0] || "";
        mainImg.alt = title;
    }

    if (sizeBadge) {
        sizeBadge.textContent = sizeText.toUpperCase();
        sizeBadge.style.display = sizeText ? "inline-block" : "none";
    }

    if (thumbRow) {
        if (images.length > 1) {
            thumbRow.style.display = "flex";
            thumbRow.innerHTML = images.map((imgUrl, idx) => `
                <button type="button" class="gh-detail-thumb-btn ${idx === 0 ? "active" : ""}" data-thumb="${escapeHTML(imgUrl)}">
                    <img src="${escapeHTML(imgUrl)}" alt="Thumbnail ${idx + 1}">
                </button>
            `).join("");
            thumbRow.querySelectorAll(".gh-detail-thumb-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    thumbRow.querySelectorAll(".gh-detail-thumb-btn").forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                    if (mainImg) mainImg.src = btn.getAttribute("data-thumb") || "";
                });
            });
        } else {
            thumbRow.style.display = "none";
            thumbRow.innerHTML = "";
        }
    }

    if (titleEl) titleEl.textContent = title.toUpperCase();
    if (priceEl) priceEl.textContent = formatKES(price);
    if (metaEl) {
        const offerLabel = deliveryOffer || (deliveryFee === 0 ? "Free Delivery" : `Delivery: ${formatKES(deliveryFee)}`);
        metaEl.textContent = `${location}${supplierName ? ` • ${supplierName}` : ""} • ${offerLabel}`;
    }
    if (sizeSelect) {
        const matched = [...sizeSelect.options].find(o => o.value.toLowerCase() === String(sizeText).toLowerCase());
        sizeSelect.value = matched ? matched.value : "13kg";
    }
    if (descEl) {
        descEl.textContent = item.description || "Verified LPG cylinder/refill available through GasHubKE suppliers.";
    }

    const pageUrl = encodeURIComponent(window.location.href);
    const shareText = encodeURIComponent(`${title} (${sizeText}) - ${formatKES(price)} on GasHubKE`);
    const shareFb = document.getElementById("shareFb");
    const shareTw = document.getElementById("shareTw");
    const sharePin = document.getElementById("sharePin");
    const shareIn = document.getElementById("shareIn");
    const shareWa = document.getElementById("shareWa");

    if (shareFb) shareFb.href = `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`;
    if (shareTw) shareTw.href = `https://twitter.com/intent/tweet?text=${shareText}&url=${pageUrl}`;
    if (sharePin) sharePin.href = `https://pinterest.com/pin/create/button/?url=${pageUrl}&description=${shareText}`;
    if (shareIn) shareIn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`;
    if (shareWa) shareWa.href = `https://wa.me/?text=${shareText}%20${pageUrl}`;

    const addBtn = document.getElementById("detailAddToCartBtn");
    const viewCartBtn = document.getElementById("detailViewCartBtn");
    const checkoutBtn = document.getElementById("detailCheckoutBtn");

    if (addBtn) {
        addBtn.onclick = () => {
            const chosenSize = sizeSelect ? sizeSelect.value : sizeText;
            window.addToListingCart(
                itemId,
                `${title} (${chosenSize})`,
                price,
                location,
                vendorId,
                supplierName,
                deliveryFee,
                deliveryOffer
            );
        };
    }

    if (viewCartBtn) {
        viewCartBtn.onclick = () => {
            modal.style.display = "none";
            if (typeof window.renderCartView === "function") window.renderCartView();
            if (typeof window.switchView === "function") window.switchView("cartView");
        };
    }

    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            const chosenSize = sizeSelect ? sizeSelect.value : sizeText;
            window.addToListingCart(
                itemId,
                `${title} (${chosenSize})`,
                price,
                location,
                vendorId,
                supplierName,
                deliveryFee,
                deliveryOffer
            );
            modal.style.display = "none";
            if (typeof window.renderCartView === "function") window.renderCartView();
            if (typeof window.switchView === "function") window.switchView("cartView");
        };
    }

    modal.style.display = "flex";
};


// ============================================================
// LOAD LISTINGS
// ============================================================

async function loadListings() {
    if (!productGrid) return;

    productGrid.innerHTML = `<p>Loading gas suppliers &amp; inventory...</p>`;

    try {
        const querySnapshot = await getDocs(collection(db, "listings"));

        const listingData = await Promise.all(
            querySnapshot.docs.map(async docSnap => {
                const item = docSnap.data();
                const itemId = docSnap.id;
                const meta = await resolveListingMeta(item);
                const record = { item, itemId, ...meta };
                listingCache.set(String(itemId), record);
                return record;
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
            const {
                item,
                itemId,
                location,
                vendorId,
                supplierName,
                deliveryFee,
                deliveryOffer
            } = listing;

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
                    item.weight,
                    supplierName,
                    deliveryOffer
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
            const deliveryBadgeText = deliveryOffer
                ? deliveryOffer
                : (deliveryFee === 0 ? "Free Delivery" : `Delivery: ${formatKES(deliveryFee)}`);

            const imageTicker = createImageTicker(displayImages, title, itemId);
            const safeTitle = escapeJS(title);
            const safeLocation = escapeJS(location);
            const safeVendorId = escapeJS(vendorId);
            const safeSupplierName = escapeJS(supplierName);
            const safeDeliveryOffer = escapeJS(deliveryOffer);
            const numericPrice = Number(item.price) || 0;

            card.innerHTML = `
                <div>
                    ${imageTicker}
                    <div class="card-body">
                        <h4 style="cursor:pointer;" onclick="window.openProductDetail('${escapeJS(itemId)}')">${escapeHTML(title)}</h4>
                        <p class="price">
                            KES ${escapeHTML(price)}
                            <span style="font-size:0.8rem;font-weight:normal;color:var(--text-muted);">
                                (${escapeHTML(size)})
                            </span>
                        </p>
                        <p class="location" title="Supplier registered location">
                            ${mapPinSvg} ${escapeHTML(location)}
                        </p>
                        <p style="font-size:0.8rem;font-weight:600;color:#16a34a;margin:0.2rem 0 0.45rem 0;">
                            ${escapeHTML(deliveryBadgeText)}
                        </p>
                        <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.4;">
                            ${escapeHTML(description)}
                        </p>
                    </div>
                </div>

                <div style="padding:0 1rem 1rem 1rem;display:flex;gap:0.45rem;">
                    <button
                        type="button"
                        class="btn-primary"
                        onclick="window.addToListingCart('${escapeJS(itemId)}', '${safeTitle}', ${numericPrice}, '${safeLocation}', '${safeVendorId}', '${safeSupplierName}', ${deliveryFee}, '${safeDeliveryOffer}')"
                    >
                        Add to Cart
                    </button>
                    <button
                        type="button"
                        class="btn-secondary"
                        onclick="window.openProductDetail('${escapeJS(itemId)}')"
                    >
                        Details
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
    document.querySelectorAll('[data-quick-brand]').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[data-quick-category]').forEach(c => {
        c.classList.toggle('active', (c.getAttribute('data-quick-category') || '') === '');
    });
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
    renderCartView();

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

    const detailModal = document.getElementById("productDetailModal");
    const closeDetailModal = document.getElementById("closeDetailModal");
    const backToTopBtn = document.getElementById("backToTopBtn");

    closeDetailModal?.addEventListener("click", () => {
        if (detailModal) detailModal.style.display = "none";
    });

    detailModal?.addEventListener("click", e => {
        if (e.target === detailModal) detailModal.style.display = "none";
    });

    backToTopBtn?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    loadListings();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeMarketplace);
} else {
    initializeMarketplace();
}
