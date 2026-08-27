import { auth, db } from "./firebase-config.js";
import { collection, addDoc, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const vendorDashboardLink = document.getElementById("vendorDashboardLink");
const marketplaceView = document.getElementById("marketplaceView");
const vendorView = document.getElementById("vendorView");
const listingForm = document.getElementById("listingForm");
const vendorListingsGrid = document.getElementById("vendorListingsGrid");

if (vendorDashboardLink) {
    vendorDashboardLink.addEventListener("click", (e) => {
        e.preventDefault();
        marketplaceView.style.display = "none";
        vendorView.style.display = "grid";
        loadVendorListings();
    });
}

// Helper function to convert uploaded image file to Base64 string
const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

if (listingForm) {
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
        const description = document.getElementById("itemDescription").value;
        const imageInput = document.getElementById("itemImage");

        try {
            // Fetch registered vendor profile data to get county, area, and business name automatically
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            const userDoc = await getDoc(userDocRef);

            let supplierCounty = "Nairobi";
            let supplierArea = "CBD";
            let businessName = "Registered Vendor";

            if (userDoc.exists()) {
                const userData = userDoc.data();
                supplierCounty = userData.county || "Nairobi";
                supplierArea = userData.area || "CBD";
                businessName = userData.businessName || "Registered Vendor";
            }

            // Process image file if attached
            let imageUrl = "";
            if (imageInput && imageInput.files[0]) {
                imageUrl = await convertFileToBase64(imageInput.files[0]);
            }

            // Save listing with registered location data
            await addDoc(collection(db, "listings"), {
                vendorId: auth.currentUser.uid,
                businessName,
                title,
                size,
                category,
                price,
                county: supplierCounty,
                area: supplierArea,
                location: `${supplierArea}, ${supplierCounty}`,
                imageUrl,
                description,
                createdAt: new Date().toISOString()
            });

            alert("Listing published successfully with your registered location!");
            listingForm.reset();
            loadVendorListings();
        } catch (err) {
            alert("Error publishing listing: " + err.message);
        }
    });
}

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
            div.className = "product-card card";
            div.style.marginBottom = "1rem";
            div.style.overflow = "hidden";
            div.innerHTML = `
                ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 6px 6px 0 0;">` : ''}
                <div style="padding: 0.75rem;">
                    <h4>${item.title}</h4>
                    <p class="price" style="font-weight: bold; color: var(--primary);">KES ${item.price} (${item.size})</p>
                    <p class="location" style="font-size: 0.85rem; color: #64748b;">Zone: ${item.location || 'N/A'}</p>
                </div>
            `;
            vendorListingsGrid.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading vendor listings:", err);
        vendorListingsGrid.innerHTML = "<p>Failed to load your listings.</p>";
    }
}
