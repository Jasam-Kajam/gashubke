import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// GASHUBKE AUTHENTICATION
// ============================================================

const authLink = document.getElementById("authLink");
const authModal = document.getElementById("authModal");
const closeModal = document.getElementById("closeModal");
const authForm = document.getElementById("authForm");
const authModalTitle = document.getElementById("authModalTitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const toggleAuthMode = document.getElementById("toggleAuthMode");
const vendorFields = document.getElementById("vendorFields");

let isRegistering = false;


// ============================================================
// HELPER: GET FIELD VALUE
// ============================================================

function getFieldValue(...ids) {
    for (const id of ids) {
        const element = document.getElementById(id);

        if (element && element.value) {
            const value = element.value.trim();

            if (value) {
                return value;
            }
        }
    }

    return "";
}


// ============================================================
// BUILD SUPPLIER LOCATION
// FORMAT:
// Ruiru, Kiambu
// Westlands, Nairobi
// Kitale, Trans Nzoia
// Nanyuki, Laikipia
// ============================================================

function getSupplierLocation() {

    // IMPORTANT:
    // Do NOT use "city" here.
    // We want the actual town/area selected by the supplier.

    const town = getFieldValue(
        "supplierTown",
        "town",
        "businessTown",
        "registeredTown",
        "area",
        "supplierArea"
    );

    const county = getFieldValue(
        "supplierCounty",
        "county",
        "businessCounty",
        "registeredCounty"
    );

    const location = [town, county]
        .filter(Boolean)
        .join(", ");

    return {
        town,
        county,
        location
    };
}


// ============================================================
// AUTH LINK
// ============================================================

if (authLink) {

    authLink.addEventListener("click", async (e) => {

        e.preventDefault();

        if (auth.currentUser) {

            try {

                await signOut(auth);

                if (window.handlePostLogoutUI) {
                    window.handlePostLogoutUI();
                }

            } catch (error) {

                console.error("Logout error:", error);
                alert("Unable to sign out. Please try again.");

            }

        } else {

            if (authModal) {
                authModal.style.display = "flex";
            }

        }

    });

}


// ============================================================
// CLOSE AUTH MODAL
// ============================================================

if (closeModal) {

    closeModal.addEventListener("click", () => {

        if (authModal) {
            authModal.style.display = "none";
        }

    });

}


// ============================================================
// TOGGLE LOGIN / REGISTRATION
// ============================================================

if (toggleAuthMode) {

    toggleAuthMode.addEventListener("click", () => {

        isRegistering = !isRegistering;

        if (isRegistering) {

            if (authModalTitle) {
                authModalTitle.innerText = "Register Platform Account";
            }

            if (authSubmitBtn) {
                authSubmitBtn.innerText = "Sign Up";
            }

            toggleAuthMode.innerText =
                "Already have an account? Sign In";

            if (vendorFields) {
                vendorFields.style.display = "block";
            }

        } else {

            if (authModalTitle) {
                authModalTitle.innerText = "Sign In";
            }

            if (authSubmitBtn) {
                authSubmitBtn.innerText = "Sign In";
            }

            toggleAuthMode.innerText =
                "Need an account? Register";

            if (vendorFields) {
                vendorFields.style.display = "none";
            }

        }

    });

}


// ============================================================
// AUTH FORM SUBMIT
// ============================================================

if (authForm) {

    authForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email =
            document.getElementById("authEmail")?.value.trim() || "";

        const password =
            document.getElementById("authPassword")?.value || "";

        if (!email || !password) {

            alert("Please enter your email and password.");
            return;

        }

        try {

            // ==================================================
            // REGISTRATION
            // ==================================================

            if (isRegistering) {

                const role =
                    getFieldValue("userRole") || "customer";

                const businessName =
                    getFieldValue("businessName") ||
                    "Independent Supplier";

                // Get supplier location ONLY during registration.
                const {
                    town,
                    county,
                    location
                } = getSupplierLocation();


                // ----------------------------------------------
                // Validate supplier location
                // ----------------------------------------------

                if (role === "supplier") {

                    if (!town) {

                        alert(
                            "Please select or enter your town/area."
                        );

                        return;
                    }

                    if (!county) {

                        alert(
                            "Please select your county."
                        );

                        return;
                    }

                }


                // ----------------------------------------------
                // Create Firebase Auth account
                // ----------------------------------------------

                const userCredential =
                    await createUserWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                const user = userCredential.user;


                // ----------------------------------------------
                // Update Firebase Auth profile
                // ----------------------------------------------

                try {

                    await updateProfile(user, {
                        displayName: businessName
                    });

                } catch (profileError) {

                    console.warn(
                        "Could not update Auth profile:",
                        profileError
                    );

                }


                // ----------------------------------------------
                // Firestore user data
                // ----------------------------------------------

                const userData = {

                    email: user.email,

                    role,

                    businessName,

                    createdAt: new Date().toISOString()

                };


                // ----------------------------------------------
                // Supplier location
                // ----------------------------------------------

                if (role === "supplier") {

                    userData.town = town;

                    userData.county = county;

                    userData.location = location;

                    userData.supplierLocation = {

                        town: town,

                        county: county,

                        display: location

                    };

                }


                // ----------------------------------------------
                // Save user profile
                // ----------------------------------------------

                await setDoc(
                    doc(db, "users", user.uid),
                    userData
                );


                alert("Registration successful!");


                if (authModal) {
                    authModal.style.display = "none";
                }


                if (window.handlePostLoginUI) {

                    window.handlePostLoginUI(role);

                }


            } else {

                // ==================================================
                // LOGIN
                // ==================================================

                const userCredential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                const user = userCredential.user;

                const userDoc =
                    await getDoc(
                        doc(db, "users", user.uid)
                    );

                let role = "customer";

                if (userDoc.exists()) {

                    role =
                        userDoc.data().role ||
                        "customer";

                }


                alert("Signed in successfully!");


                if (authModal) {
                    authModal.style.display = "none";
                }


                if (window.handlePostLoginUI) {

                    window.handlePostLoginUI(role);

                }

            }

        } catch (error) {

            console.error(
                "Authentication error:",
                error
            );

            let message =
                error.message ||
                "Authentication failed.";

            switch (error.code) {

                case "auth/email-already-in-use":
                    message =
                        "An account with this email already exists.";
                    break;

                case "auth/invalid-email":
                    message =
                        "Please enter a valid email address.";
                    break;

                case "auth/weak-password":
                    message =
                        "Password is too weak. Please use a stronger password.";
                    break;

                case "auth/invalid-credential":
                    message =
                        "Incorrect email or password.";
                    break;

                case "auth/user-not-found":
                    message =
                        "No account exists with this email.";
                    break;

                case "auth/wrong-password":
                    message =
                        "Incorrect password.";
                    break;

                case "auth/network-request-failed":
                    message =
                        "Network error. Check your internet connection and try again.";
                    break;

                case "auth/too-many-requests":
                    message =
                        "Too many attempts. Please try again later.";
                    break;

                case "auth/operation-not-allowed":
                    message =
                        "This sign-in method is not enabled in Firebase.";
                    break;

            }

            alert("Authentication Error: " + message);

        }

    });

}


// ============================================================
// FORGOT PASSWORD
// ============================================================

const forgotPassword =
    document.getElementById("forgotPassword");

if (forgotPassword) {

    forgotPassword.addEventListener("click", async (e) => {

        e.preventDefault();

        const email =
            document.getElementById("authEmail")?.value.trim() || "";

        if (!email) {

            alert(
                "Enter your email address first."
            );

            return;

        }

        try {

            await sendPasswordResetEmail(
                auth,
                email
            );

            alert(
                "Password reset email sent. Please check your inbox and spam folder."
            );

        } catch (error) {

            console.error(
                "Password reset error:",
                error
            );

            let message =
                error.message ||
                "Unable to send password reset email.";

            switch (error.code) {

                case "auth/invalid-email":
                    message =
                        "Please enter a valid email address.";
                    break;

                case "auth/user-not-found":
                    message =
                        "No account exists with this email.";
                    break;

                case "auth/network-request-failed":
                    message =
                        "Network error. Check your internet connection.";
                    break;

            }

            alert(
                "Password Reset Error: " + message
            );

        }

    });

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, async (user) => {

    if (user) {

        try {

            const userDoc =
                await getDoc(
                    doc(db, "users", user.uid)
                );

            let role = "customer";

            if (userDoc.exists()) {

                role =
                    userDoc.data().role ||
                    "customer";

            }

            if (window.handlePostLoginUI) {

                window.handlePostLoginUI(role);

            }

        } catch (error) {

            console.error(
                "Error loading user state:",
                error
            );

        }

    } else {

        if (window.handlePostLogoutUI) {

            window.handlePostLogoutUI();

        }

    }

});