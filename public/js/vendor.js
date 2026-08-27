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

// Helper function to convert an uploaded image file to a Base64 string
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
            alert("Please sign in as a supplier first.");
            return;
        }

        const title = document.getElementById("itemTitle").value;
        const size = document.getElementById("itemSize").value;
        const category = document.getElementById("itemCategory").value;
        const price = Number(document.getElementById("itemPrice").value);
        const description = document.getElementById("itemDescription").value;
        const imageInput = document.getElementById("itemImage");

        try {
            // Fetch registered supplier profile data to get county and area automatically
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            const userDoc = await getDoc(userDocRef);

            let supplierCounty = "Nairobi";
            let supplierArea = "CBD";
            let businessName = "Registered Supplier";

            if (userDoc.exists()) {
                const userData = userDoc.data();
                supplierCounty = userData.county || "Nairobi";
                supplierArea = userData.area || "CBD";
                businessName = userData.businessName || "Registered Supplier";
            }

            // Process up to 5 image files if attached
            let imageUrls = [];
            if (imageInput && imageInput.files.length > 0) {
                const filesToProcess = Array.from(imageInput.files).slice(0, 5); // Max 5 images limit
                for (const file of filesToProcess) {
                    const base64Str = await convertFileToBase64(file);
                    imageUrls.push(base64Str);
                }
            }

            // Save listing with image array and registered location data
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
                imageUrls, // Array containing up to 5 images
                imageUrl: imageUrls.length > 0 ? imageUrls[0] : "", // Backward compatibility fallback for single image views
                description,
                createdAt: new Date().toISOString()
            });

            alert("Listing published successfully with up to 5 images!");
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

            // Build preview gallery supporting multiple images (up to 5)
            let imagesHtml = "";
            const displayImages = item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
            
            if (displayImages.length > 0) {
                imagesHtml = `<div style="display: flex; gap: 4px; overflow-x: auto; background-color: #f8fafc; padding: 4px; border-bottom: 1px solid #e2e8f0;">`;
                displayImages.forEach((imgSrc, idx) => {
                    imagesHtml += `<img src="${imgSrc}" alt="${item.title} ${idx + 1}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0;">`;
                });
                imagesHtml += `</div>`;
            }

            div.innerHTML = `
                ${imagesHtml}
                <div style="padding: 0.75rem;">
                    <h4>${item.title}</h4>
                    <p class="price" style="font-weight: bold; color: var(--primary);">KES ${item.price} (${item.size})</p>
                    <p class="location" style="font-size: 0.85rem; color: #64748b;">Zone: ${item.location || 'N/A'}</p>
                    <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">Images attached: ${displayImages.length} / 5</p>
                </div>
            `;
            vendorListingsGrid.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading supplier listings:", err);
        vendorListingsGrid.innerHTML = "<p>Failed to load your listings.</p>";
    }
}
