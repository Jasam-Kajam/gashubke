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
// HELPER - GET FIELD VALUE
// ============================================================

function getFieldValue(...ids) {

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (!element) {
            continue;
        }

        const value =
            String(element.value || "").trim();

        if (value) {
            return value;
        }
    }

    return "";
}


// ============================================================
// NORMALIZE ROLE
// ============================================================

function isSupplierRole(role) {

    const normalizedRole =
        String(role || "")
            .trim()
            .toLowerCase();

    return (
        normalizedRole === "supplier" ||
        normalizedRole === "vendor"
    );
}


// ============================================================
// SUPPLIER BUSINESS LOCATION
//
// AUTHORITATIVE FORMAT:
//
// Town, County
//
// Examples:
//
// Ruiru, Kiambu
// Kitale, Trans Nzoia
// Nanyuki, Laikipia
//
// NO AREA.
// ============================================================

function getSupplierLocation() {

    let town =
        getFieldValue(
            "supplierTown",
            "town",
            "businessTown",
            "registeredTown",
            "supplierLocationTown",
            "businessLocationTown"
        );

    let county =
        getFieldValue(
            "supplierCounty",
            "county",
            "businessCounty",
            "registeredCounty",
            "supplierLocationCounty",
            "businessLocationCounty"
        );


    // --------------------------------------------------------
    // DIRECT BUSINESS LOCATION FIELD
    // --------------------------------------------------------

    let businessLocation =
        getFieldValue(
            "businessLocation",
            "supplierBusinessLocation",
            "registeredBusinessLocation"
        );


    // --------------------------------------------------------
    // IF TOWN/COUNTY ARE MISSING, TRY BUSINESS LOCATION
    //
    // Example:
    // "Ruiru, Kiambu"
    // --------------------------------------------------------

    if (
        businessLocation &&
        (!town || !county)
    ) {

        const parts =
            businessLocation
                .split(",")
                .map(value => value.trim())
                .filter(Boolean);


        if (!town && parts[0]) {
            town = parts[0];
        }


        if (!county && parts[1]) {
            county = parts[1];
        }
    }


    // --------------------------------------------------------
    // BUILD AUTHORITATIVE LOCATION
    // --------------------------------------------------------

    const location =
        [town, county]
            .filter(Boolean)
            .join(", ");


    return {

        town:
            String(town || "").trim(),

        county:
            String(county || "").trim(),

        location:
            location ||
            String(businessLocation || "").trim()

    };
}


// ============================================================
// UPDATE USER PROFILE
// ============================================================

export async function updateUserProfile({
    businessName = "",
    town = "",
    county = ""
} = {}) {

    const user =
        auth.currentUser;


    if (!user) {

        throw new Error(
            "You must be signed in to update your profile."
        );

    }


    businessName =
        String(businessName).trim();

    town =
        String(town).trim();

    county =
        String(county).trim();


    const location =
        [town, county]
            .filter(Boolean)
            .join(", ");


    // --------------------------------------------------------
    // UPDATE FIREBASE AUTH PROFILE
    // --------------------------------------------------------

    if (businessName) {

        await updateProfile(
            user,
            {
                displayName:
                    businessName
            }
        );

    }


    // --------------------------------------------------------
    // GET EXISTING FIRESTORE PROFILE
    // --------------------------------------------------------

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    const existingDoc =
        await getDoc(
            userRef
        );


    const existingData =
        existingDoc.exists()
            ? existingDoc.data()
            : {};


    const role =
        existingData.role ||
        "customer";


    // --------------------------------------------------------
    // BASE PROFILE
    // --------------------------------------------------------

    const updatedData = {

        businessName:
            businessName ||
            existingData.businessName ||
            "Independent Supplier",

        email:
            user.email ||
            existingData.email ||
            "",

        role,

        updatedAt:
            new Date().toISOString()

    };


    // --------------------------------------------------------
    // BUSINESS LOCATION
    // --------------------------------------------------------

    if (town && county) {

        // Basic fields
        updatedData.town =
            town;

        updatedData.county =
            county;


        // Compatibility fields
        updatedData.supplierTown =
            town;

        updatedData.supplierCounty =
            county;


        // PRIMARY LOCATION FIELD
        updatedData.businessLocation =
            location;


        // Other compatibility fields
        updatedData.registeredBusinessLocation =
            location;

        updatedData.location =
            location;


        // Structured location
        updatedData.supplierLocation = {

            town:
                town,

            county:
                county,

            label:
                location,

            display:
                location

        };

    }


    // --------------------------------------------------------
    // SAVE PROFILE
    // --------------------------------------------------------

    await setDoc(
        userRef,
        updatedData,
        {
            merge: true
        }
    );


    // --------------------------------------------------------
    // RETURN PROFILE
    // --------------------------------------------------------

    return {

        uid:
            user.uid,

        businessName:
            updatedData.businessName,

        email:
            updatedData.email,

        role:
            updatedData.role,

        town:
            updatedData.town ||
            existingData.town ||
            existingData.supplierTown ||
            existingData.supplierLocation?.town ||
            "",

        county:
            updatedData.county ||
            existingData.county ||
            existingData.supplierCounty ||
            existingData.supplierLocation?.county ||
            "",

        location:
            updatedData.businessLocation ||
            existingData.businessLocation ||
            updatedData.location ||
            existingData.location ||
            existingData.registeredBusinessLocation ||
            existingData.supplierLocation?.label ||
            existingData.supplierLocation?.display ||
            ""

    };
}


// ============================================================
// LOAD CURRENT USER PROFILE
// ============================================================

export async function getCurrentUserProfile() {

    const user =
        auth.currentUser;


    if (!user) {

        throw new Error(
            "You must be signed in."
        );

    }


    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    const userDoc =
        await getDoc(
            userRef
        );


    const data =
        userDoc.exists()
            ? userDoc.data()
            : {};


    return {

        uid:
            user.uid,

        email:
            user.email ||
            data.email ||
            "",

        displayName:
            user.displayName ||
            data.businessName ||
            "",

        businessName:
            data.businessName ||
            user.displayName ||
            "",

        role:
            data.role ||
            "customer",

        town:
            data.town ||
            data.supplierTown ||
            data.supplierLocation?.town ||
            "",

        county:
            data.county ||
            data.supplierCounty ||
            data.supplierLocation?.county ||
            "",

        // businessLocation is checked FIRST
        location:
            data.businessLocation ||
            data.registeredBusinessLocation ||
            data.location ||
            data.supplierLocation?.label ||
            data.supplierLocation?.display ||
            ""

    };
}


// ============================================================
// FORGOT PASSWORD BUTTON
// ============================================================

function ensureForgotPasswordButton() {

    if (!authForm) {
        return;
    }


    if (
        document.getElementById(
            "forgotPassword"
        )
    ) {
        return;
    }


    const passwordInput =
        document.getElementById(
            "authPassword"
        );


    if (!passwordInput) {
        return;
    }


    const wrapper =
        document.createElement("div");


    wrapper.className =
        "text-end mt-2";


    const button =
        document.createElement("button");


    button.type =
        "button";

    button.id =
        "forgotPassword";

    button.className =
        "btn btn-link p-0";

    button.textContent =
        "Forgot Password?";


    wrapper.appendChild(
        button
    );


    passwordInput.parentElement?.appendChild(
        wrapper
    );
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

async function handleForgotPassword() {

    const email =
        document.getElementById(
            "authEmail"
        )?.value.trim() || "";


    if (!email) {

        alert(
            "Enter your email address first."
        );

        document.getElementById(
            "authEmail"
        )?.focus();

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


            case "auth/too-many-requests":

                message =
                    "Too many attempts. Please try again later.";

                break;

        }


        alert(
            "Password Reset Error: " +
            message
        );
    }
}


// ============================================================
// FORGOT PASSWORD EVENT
// ============================================================

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "#forgotPassword"
            );


        if (!button) {
            return;
        }


        event.preventDefault();

        handleForgotPassword();

    }
);


ensureForgotPasswordButton();


// ============================================================
// AUTH LINK
// ============================================================

if (authLink) {

    authLink.addEventListener(
        "click",
        async event => {

            event.preventDefault();


            if (auth.currentUser) {

                try {

                    await signOut(
                        auth
                    );


                    if (
                        window.handlePostLogoutUI
                    ) {

                        window.handlePostLogoutUI();

                    }


                } catch (error) {

                    console.error(
                        "Logout error:",
                        error
                    );


                    alert(
                        "Unable to sign out. Please try again."
                    );
                }


            } else {

                if (authModal) {

                    authModal.style.display =
                        "flex";

                }

            }

        }
    );
}


// ============================================================
// CLOSE AUTH MODAL
// ============================================================

if (closeModal) {

    closeModal.addEventListener(
        "click",
        () => {

            if (authModal) {

                authModal.style.display =
                    "none";

            }

        }
    );
}


// ============================================================
// LOGIN / REGISTRATION TOGGLE
// ============================================================

if (toggleAuthMode) {

    toggleAuthMode.addEventListener(
        "click",
        () => {

            isRegistering =
                !isRegistering;


            if (isRegistering) {

                if (authModalTitle) {

                    authModalTitle.innerText =
                        "Register Platform Account";

                }


                if (authSubmitBtn) {

                    authSubmitBtn.innerText =
                        "Sign Up";

                }


                toggleAuthMode.innerText =
                    "Already have an account? Sign In";


                if (vendorFields) {

                    vendorFields.style.display =
                        "block";

                }


            } else {

                if (authModalTitle) {

                    authModalTitle.innerText =
                        "Sign In";

                }


                if (authSubmitBtn) {

                    authSubmitBtn.innerText =
                        "Sign In";

                }


                toggleAuthMode.innerText =
                    "Need an account? Register";


                if (vendorFields) {

                    vendorFields.style.display =
                        "none";

                }

            }

        }
    );
}


// ============================================================
// LOGIN / REGISTRATION
// ============================================================

if (authForm) {

    authForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const email =
                document.getElementById(
                    "authEmail"
                )?.value.trim() || "";


            const password =
                document.getElementById(
                    "authPassword"
                )?.value || "";


            if (!email || !password) {

                alert(
                    "Please enter your email and password."
                );

                return;
            }


            try {

                // ==================================================
                // REGISTRATION
                // ==================================================

                if (isRegistering) {

                    // ------------------------------------------------
                    // ROLE
                    // ------------------------------------------------

                    const role =
                        getFieldValue(
                            "userRole"
                        ) || "customer";


                    const supplierAccount =
                        isSupplierRole(
                            role
                        );


                    // ------------------------------------------------
                    // BUSINESS NAME
                    // ------------------------------------------------

                    const businessName =
                        getFieldValue(
                            "businessName"
                        ) ||
                        "Independent Supplier";


                    // ------------------------------------------------
                    // LOCATION
                    // ------------------------------------------------

                    const {
                        town,
                        county,
                        location
                    } =
                        getSupplierLocation();


                    console.log(
                        "Registration location:",
                        {
                            town,
                            county,
                            location,
                            role
                        }
                    );


                    // ------------------------------------------------
                    // SUPPLIER LOCATION REQUIRED
                    // ------------------------------------------------

                    if (supplierAccount) {

                        if (!town) {

                            alert(
                                "Please select your town."
                            );

                            return;
                        }


                        if (!county) {

                            alert(
                                "Please select your county."
                            );

                            return;
                        }


                        if (!location) {

                            alert(
                                "Business location could not be created. Please select your town and county again."
                            );

                            return;
                        }

                    }


                    // ------------------------------------------------
                    // CREATE FIREBASE AUTH ACCOUNT
                    // ------------------------------------------------

                    const userCredential =
                        await createUserWithEmailAndPassword(
                            auth,
                            email,
                            password
                        );


                    const user =
                        userCredential.user;


                    // ------------------------------------------------
                    // UPDATE AUTH PROFILE
                    // ------------------------------------------------

                    try {

                        await updateProfile(
                            user,
                            {
                                displayName:
                                    businessName
                            }
                        );

                    } catch (profileError) {

                        console.warn(
                            "Auth profile update failed:",
                            profileError
                        );
                    }


                    // ------------------------------------------------
                    // BASE FIRESTORE USER DATA
                    // ------------------------------------------------

                    const userData = {

                        uid:
                            user.uid,

                        email:
                            user.email || email,

                        role,

                        businessName,

                        createdAt:
                            new Date().toISOString(),

                        updatedAt:
                            new Date().toISOString()

                    };


                    // ==================================================
                    // SUPPLIER / VENDOR LOCATION
                    // ==================================================

                    if (supplierAccount) {

                        // ------------------------------------------------
                        // BASIC TOWN + COUNTY
                        // ------------------------------------------------

                        userData.town =
                            town;

                        userData.county =
                            county;


                        // ------------------------------------------------
                        // COMPATIBILITY FIELDS
                        // ------------------------------------------------

                        userData.supplierTown =
                            town;

                        userData.supplierCounty =
                            county;


                        // ------------------------------------------------
                        // IMPORTANT:
                        // PRIMARY BUSINESS LOCATION
                        // ------------------------------------------------

                        userData.businessLocation =
                            location;


                        // ------------------------------------------------
                        // OTHER LOCATION FIELDS
                        // ------------------------------------------------

                        userData.location =
                            location;

                        userData.registeredBusinessLocation =
                            location;


                        // ------------------------------------------------
                        // STRUCTURED LOCATION
                        // ------------------------------------------------

                        userData.supplierLocation = {

                            town:
                                town,

                            county:
                                county,

                            label:
                                location,

                            display:
                                location

                        };


                        console.log(
                            "Saving supplier location:",
                            userData.supplierLocation
                        );

                    }


                    // ------------------------------------------------
                    // SAVE USER PROFILE
                    // ------------------------------------------------

                    await setDoc(
                        doc(
                            db,
                            "users",
                            user.uid
                        ),
                        userData,
                        {
                            merge: true
                        }
                    );


                    // ------------------------------------------------
                    // VERIFY PROFILE WAS SAVED
                    // ------------------------------------------------

                    const savedProfile =
                        await getDoc(
                            doc(
                                db,
                                "users",
                                user.uid
                            )
                        );


                    if (
                        savedProfile.exists()
                    ) {

                        console.log(
                            "GasHubKE registered user:",
                            savedProfile.data()
                        );

                    }


                    alert(
                        "Registration successful!"
                    );


                    if (authModal) {

                        authModal.style.display =
                            "none";

                    }


                    if (
                        window.handlePostLoginUI
                    ) {

                        window.handlePostLoginUI(
                            role
                        );

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


                    const user =
                        userCredential.user;


                    // ------------------------------------------------
                    // LOAD PROFILE
                    // ------------------------------------------------

                    const userDoc =
                        await getDoc(
                            doc(
                                db,
                                "users",
                                user.uid
                            )
                        );


                    let role =
                        "customer";


                    if (
                        userDoc.exists()
                    ) {

                        role =
                            userDoc.data().role ||
                            "customer";

                    }


                    alert(
                        "Signed in successfully!"
                    );


                    if (authModal) {

                        authModal.style.display =
                            "none";

                    }


                    if (
                        window.handlePostLoginUI
                    ) {

                        window.handlePostLoginUI(
                            role
                        );

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


                    case "permission-denied":

                        message =
                            "Firebase denied access to your profile. Check your Firestore security rules.";

                        break;

                }


                alert(
                    "Authentication Error: " +
                    message
                );
            }

        }
    );
}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if (user) {

            try {

                const userDoc =
                    await getDoc(
                        doc(
                            db,
                            "users",
                            user.uid
                        )
                    );


                let role =
                    "customer";


                if (
                    userDoc.exists()
                ) {

                    role =
                        userDoc.data().role ||
                        "customer";

                }


                if (
                    window.handlePostLoginUI
                ) {

                    window.handlePostLoginUI(
                        role
                    );

                }


            } catch (error) {

                console.error(
                    "Error loading user state:",
                    error
                );

            }


        } else {

            if (
                window.handlePostLogoutUI
            ) {

                window.handlePostLogoutUI();

            }

        }

    }
);