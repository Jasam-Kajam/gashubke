import { db } from "./firebase-config.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const productGrid = document.getElementById("productGrid");
const filterSize = document.getElementById("filterSize");
const filterCategory = document.getElementById("filterCategory");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");

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
                    <p style="font-size:0.85rem; color:#475569;">${item.description}</p>
                </div>
                <button class="btn-primary" style="margin-top:1rem;" onclick="alert('Order initiated with supplier!')">Order Gas Now</button>
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

// Initial Load
loadListings();
