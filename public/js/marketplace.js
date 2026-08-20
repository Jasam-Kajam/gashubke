import { db } from "./firebase-config.js";
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

// Cart Item Management Functions
window.addToListingCart = function(id, title, price, location) {
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
    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) cartCountEl.textContent = totalCount;
}

function renderCartView() {
    const cartItemsList = document.getElementById("cartItemsList");
    const cartSubtotal = document.getElementById("cartSubtotal");
    const cartTotal = document.getElementById("cartTotal");
    
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
                    <p style="font-size:0.85rem; color:#64748b;">KES ${item.price} each</p>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <button type="button" onclick="window.updateCartQuantity('${item.id}', -1)" style="padding:2px 8px;">-</button>
                    <span>${item.quantity}</span>
                    <button type="button" onclick="window.updateCartQuantity('${item.id}', 1)" style="padding:2px 8px;">+</button>
                    <button type="button" onclick="window.removeFromCart('${item.id}')" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:0.5rem;">Remove</button>
                </div>
            </div>
        `;
    });

    cartItemsList.innerHTML = html;
    if (cartSubtotal) cartSubtotal.textContent = `KES ${subtotal}`;
    if (cartTotal) cartTotal.textContent = `KES ${subtotal + 200}`;
}

async function loadListings() {
    productGrid.innerHTML = "<p>Loading gas suppliers & inventory...</p>";
    try {
        let q = collection(db, "listings");
        const querySnapshot = await getDocs(q);
        
        productGrid.innerHTML = "";
        if (querySnapshot.empty) {
            productGrid.innerHTML = "<p>No active cooking gas listings found.</p>";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const itemId = docSnap.id;
            
            if (filterSize.value && item.size !== filterSize.value) return;
            if (filterCategory.value && item.category !== filterCategory.value) return;

            const card = document.createElement("div");
            card.className = "product-card";
            card.innerHTML = `
                <div>
                    <h4>${item.title}</h4>
                    <p class="price">KES ${item.price}</p>
                    <p class="location">Location: ${item.location}</p>
                    <p style="font-size:0.85rem; color:#475569; margin-bottom:0.5rem;">${item.description}</p>
                </div>
                <button class="btn-primary" onclick="window.addToListingCart('${itemId}', '${item.title.replace(/'/g, "\\'")}', ${item.price}, '${item.location}')">Add to Cart</button>
            `;
            productGrid.appendChild(card);
        });
    } catch (err) {
        productGrid.innerHTML = "<p>Error loading marketplace inventory.</p>";
        console.error(err);
    }
}

// Navigation event links setup
document.addEventListener("DOMContentLoaded", () => {
    updateCartUI();

    const homeLink = document.getElementById("homeLink");
    const cartLink = document.getElementById("cartLink");

    if (homeLink) {
        homeLink.addEventListener("click", (e) => {
            e.preventDefault();
            switchView("marketplaceView");
        });
    }

    if (cartLink) {
        cartLink.addEventListener("click", (e) => {
            e.preventDefault();
            renderCartView();
            switchView("cartView");
        });
    }
});

filterSize.addEventListener("change", loadListings);
filterCategory.addEventListener("change", loadListings);
searchBtn.addEventListener("click", loadListings);

loadListings();
