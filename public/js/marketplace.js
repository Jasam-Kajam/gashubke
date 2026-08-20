import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const productGrid = document.getElementById("productGrid");
const filterSize = document.getElementById("filterSize");
const filterCategory = document.getElementById("filterCategory");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");

// Helper function to handle cart additions globally
window.addToListingCart = function(id, title, price, location) {
    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
    const existing = cart.find(item => item.id === id);
    
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, title, price, location, quantity: 1 });
    }
    
    localStorage.setItem("gas_cart", JSON.stringify(cart));
    
    // Update badge count in header
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) cartCountEl.textContent = totalCount;

    alert(`${title} added to your cart.`);
};

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
            
            // Client-side filtering check
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
                <button class="btn-primary" onclick="window.addToListingCart('${itemId}', '${item.escapedTitle || item.title.replace(/'/g, "\\'")}', ${item.price}, '${item.location}')">Add to Cart</button>
            `;
            productGrid.appendChild(card);
        });
    } catch (err) {
        productGrid.innerHTML = "<p>Error loading marketplace inventory.</p>";
        console.error(err);
    }
}

filterSize.addEventListener("change", loadListings);
filterCategory.addEventListener("change", loadListings);
searchBtn.addEventListener("click", loadListings);

// Initial Load & Cart Counter Initialization
document.addEventListener("DOMContentLoaded", () => {
    let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) cartCountEl.textContent = totalCount;
});

loadListings();
