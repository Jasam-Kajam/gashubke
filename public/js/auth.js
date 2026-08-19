import { auth, db } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const authLink = document.getElementById("authLink");
const authModal = document.getElementById("authModal");
const closeModal = document.getElementById("closeModal");
const authForm = document.getElementById("authForm");
const authModalTitle = document.getElementById("authModalTitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const toggleAuthMode = document.getElementById("toggleAuthMode");
const vendorFields = document.getElementById("vendorFields");
const vendorDashboardLink = document.getElementById("vendorDashboardLink");

let isRegistering = false;

authLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (auth.currentUser) {
        signOut(auth).then(() => window.location.reload());
    } else {
        authModal.style.display = "flex";
    }
});

closeModal.addEventListener("click", () => authModal.style.display = "none");

toggleAuthMode.addEventListener("click", () => {
    isRegistering = !isRegistering;
    if (isRegistering) {
        authModalTitle.innerText = "Register Marketplace Account";
        authSubmitBtn.innerText = "Sign Up";
        toggleAuthMode.innerText = "Already have an account? Sign In";
        vendorFields.style.display = "block";
    } else {
        authModalTitle.innerText = "Sign In";
        authSubmitBtn.innerText = "Sign In";
        toggleAuthMode.innerText = "Need an account? Register";
        vendorFields.style.display = "none";
    }
});

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    try {
        if (isRegistering) {
            const role = document.getElementById("userRole").value;
            const businessName = document.getElementById("businessName").value;
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            await setDoc(doc(db, "users", userCredential.user.uid), {
                email,
                role,
                businessName: businessName || "Independent Supplier",
                createdAt: new Date().toISOString()
            });
            alert("Registration successful!");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            alert("Signed in successfully!");
        }
        authModal.style.display = "none";
        window.location.reload();
    } catch (error) {
        alert("Authentication Error: " + error.message);
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        authLink.innerText = "Sign Out";
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'vendor') {
            vendorDashboardLink.style.display = "inline";
        }
    } else {
        authLink.innerText = "Sign In";
        vendorDashboardLink.style.display = "none";
    }
});
