import { db, auth } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const productGrid = document.getElementById("productGrid");
const filterSize = document.getElementById("filterSize");
const filterCategory = document.getElementById("filterCategory");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");

// View Switching Helper
window.switchView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const target = document.getElementById(viewId);
    if (target) target.style.display = 'block';
};

// Cart Item Management Functions with Authentication Check
window.addToListingCart = function(id, title, price, location) {
    // Check if a user is currently authenticated via Firebase Auth
    const currentUser = auth.currentUser;

    if (!currentUser) {
        // User is not logged in: Block action and trigger auth modal popup
        alert("Please sign in or create an account to add items to your cart.");
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.style.display = 'block';
        }
        return;
    }

    // User is logged in, proceed to add item to local cart storage
    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
    const existingIndex = cart.findIndex(item => item.id === id);
    
    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({ id, title, price, location, quantity: 1 });
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

function updateCartUI() {
    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartLink = document.getElementById("cartLink");
    
    if (cartLink) {
        // Professional e-commerce Shopping Cart SVG icon with dynamic badge indicator
        const cartSvgIcon = `
            <span style="position: relative; display: inline-flex; align-items: center; cursor: pointer;" title="Cart">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                ${totalCount > 0 ? `<span id="cartCount" class="cart-badge" style="position: absolute; top: -8px; right: -10px;">${totalCount}</span>` : ''}
            </span>
        `;
        cartLink.innerHTML = cartSvgIcon;
    }
}

function renderCartView() {
    const cartItemsList = document.getElementById("cartItemsList");
    const cartSubtotal = document.getElementById("cartSubtotal");
    const cartTotal = document.getElementById("cartTotal");
    
    if (!cartItemsList) return;
    
    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
    
    if (cart.length === 0) {
        cartItemsList.innerHTML = "<p>Your cart is currently empty.</p>";
        if (cartSubtotal) cartSubtotal.textContent = "KES 0";
        if (cartTotal) cartTotal.textContent = "KES 200"; // Base delivery fee
        return;
    }

    let html = "";
    let subtotal = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        html += `
            <div class="cart-item-row">
                <div>
                    <strong>${item.title}</strong>
                    <p style="font-size:0.85rem; color:var(--text-muted);">KES ${item.price} each</p>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <button type="button" class="btn-secondary" style="padding:2px 10px;" onclick="window.updateCartQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button type="button" class="btn-secondary" style="padding:2px 10px;" onclick="window.updateCartQuantity('${item.id}', 1)">+</button>
                    <button type="button" onclick="window.removeFromCart('${item.id}')" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:0.5rem; font-size:0.85rem;">Remove</button>
                </div>
            </div>
        `;
    });

    cartItemsList.innerHTML = html;
    if (cartSubtotal) cartSubtotal.textContent = `KES ${subtotal}`;
    if (cartTotal) cartTotal.textContent = `KES ${subtotal + 200}`;
}

async function loadListings() {
    if (!productGrid) return;
    
    productGrid.innerHTML = "<p>Loading gas suppliers & inventory...</p>";
    try {
        let q = collection(db, "listings");
        const querySnapshot = await getDocs(q);
        
        productGrid.innerHTML = "";
        if (querySnapshot.empty) {
            productGrid.innerHTML = "<p>No active cooking gas listings found.</p>";
            return;
        }

        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";
        let matchCount = 0;

        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const itemId = docSnap.id;
            
            // Apply Filters safely if elements exist
            if (filterSize && filterSize.value && item.size !== filterSize.value) return;
            if (filterCategory && filterCategory.value && item.category !== filterCategory.value) return;

            // Apply Search Query matching (Title, Description, or Location)
            if (searchQuery) {
                const matchTitle = item.title && item.title.toLowerCase().includes(searchQuery);
                const matchDesc = item.description && item.description.toLowerCase().includes(searchQuery);
                const matchLocation = item.location && item.location.toLowerCase().includes(searchQuery);
                if (!matchTitle && !matchDesc && !matchLocation) return;
            }

matchCount++;
            const card = document.createElement("div");
            card.className = "product-card";

            // Professional SVG Map Marker Icon
            const mapPinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; color: var(--primary);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

            // Support multi-image array or single fallback image
            const displayImages = item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
            const primaryImage = displayImages.length > 0 ? displayImages[0] : '';

            card.innerHTML = `
                <div>
                    ${primaryImage ? `<div class="card-img-container"><img src="${primaryImage}" alt="${item.title}"></div>` : ''}
                    <div class="card-body">
                        <h4>${item.title}</h4>
                        <p class="price">KES ${item.price} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">(${item.size})</span></p>
                        <p class="location">${mapPinSvg} ${item.location || 'Local Delivery'}</p>
                        <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">${item.description || ''}</p>
                    </div>
                </div>
                <div style="padding: 0 1rem 1rem 1rem;">
                    <button class="btn-primary" onclick="window.addToListingCart('${itemId}', '${item.title.replace(/'/g, "\\'")}', ${item.price}, '${item.location || ''}')">Order Now</button>
                </div>
            `;
            productGrid.appendChild(card);
        });

        if (matchCount === 0) {
            productGrid.innerHTML = "<p>No listings match your search criteria.</p>";
        }

    } catch (err) {
        productGrid.innerHTML = "<p>Error loading platform inventory.</p>";
        console.error(err);
    }
}

// Navigation and Event Listeners Setup
document.addEventListener("DOMContentLoaded", () => {
    updateCartUI();

    const homeLink = document.getElementById("homeLink");
    const cartLink = document.getElementById("cartLink");
    const hamburger = document.querySelector(".hamburger");
    const navLinks = document.querySelector(".nav-links");

    if (homeLink) {
        homeLink.addEventListener("click", (e) => {
            e.preventDefault();
            switchView("marketplaceView");
            if (navLinks) navLinks.classList.remove("active");
        });
    }

    if (cartLink) {
        cartLink.addEventListener("click", (e) => {
            e.preventDefault();
            renderCartView();
            switchView("cartView");
            if (navLinks) navLinks.classList.remove("active");
        });
    }

    // Responsive Mobile Hamburger Menu Toggle
    if (hamburger && navLinks) {
        hamburger.addEventListener("click", () => {
            navLinks.classList.toggle("active");
        });
    }
});

// Filter & Search Event Listeners with Null Safeguards
if (filterSize) filterSize.addEventListener("change", loadListings);
if (filterCategory) filterCategory.addEventListener("change", loadListings);
if (searchBtn) searchBtn.addEventListener("click", loadListings);
if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            loadListings();
        }
    });
}

// Initial Data Load
loadListings();
