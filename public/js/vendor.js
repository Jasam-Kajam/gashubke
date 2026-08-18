import { auth, db } from "./firebase-config.js";
import { collection, addFile, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const vendorDashboardLink = document.getElementById("vendorDashboardLink");
const marketplaceView = document.getElementById("marketplaceView");
const vendorView = document.getElementById("vendorView");
const listingForm = document.getElementById("listingForm");
const vendorListingsGrid = document.getElementById("vendorListingsGrid");

vendorDashboardLink.addEventListener("click", (e) => {
    e.preventDefault();
    marketplaceView.style.display = "none";
    vendorView.style.display = "grid";
    loadVendorListings();
});

listingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!auth.currentUser) {
        alert("Please sign in as a vendor first.");
        return;
    }

    const title = document.getElementById("itemTitle").value;
    const size = document.getElementById("itemSize").value;
    const category = document.getElementById("itemCategory").value;
    const price = Number(document.getElementById("itemPrice").value);
    const location = document.getElementById("itemLocation").value;
    const description = document.getElementById("itemDescription").value;

    try {
        await addDoc(collection(db, "listings"), {
            vendorId: auth.currentUser.uid,
            title,
            size,
            category,
            price,
            location,
            description,
            createdAt: new Date().toISOString()
        });
        alert("Listing published successfully!");
        listingForm.reset();
        loadVendorListings();
    } catch (err) {
        alert("Error publishing listing: " + err.message);
    }
});

async function loadVendorListings() {
    if (!auth.currentUser) return;
    vendorListingsGrid.innerHTML = "<p>Loading your listings...</p>";
    try {
        const q = query(collection(db, "listings"), where("vendorId", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        vendorListingsGrid.innerHTML = "";
        if (querySnapshot.empty) {
            vendorListingsGrid.innerHTML = "<p>You have not posted any gas listings yet.</p>";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const div = document.createElement("div");
            div.className = "product-card";
            div.style.marginBottom = "1rem";
            div.innerHTML = `
                <h4>${item.title}</h4>
                <p class="price">KES ${item.price} (${item.size})</p>
                <p class="location">Zone: ${item.location}</p>
            `;
            vendorListingsGrid.appendChild(div);
        });
    } catch (err) {
        console.error(err);
    }
}
