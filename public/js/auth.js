import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile as firebaseUpdateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// GAS HUB KE - AUTHENTICATION
// Login / Registration / Forgot Password / Update Profile
// ============================================================

const authLink =
    document.getElementById("authLink");

const authModal =
    document.getElementById("authModal");

const closeModal =
    document.getElementById("closeModal");

const authForm =
    document.getElementById("authForm");

const authModalTitle =
    document.getElementById("authModalTitle");

const authSubmitBtn =
    document.getElementById("authSubmitBtn");

const toggleAuthMode =
    document.getElementById("toggleAuthMode");

const vendorFields =
    document.getElementById("vendorFields");


let isRegistering = false;


// ============================================================
// SAFE ELEMENT VALUE
// ============================================================

function getValue(...ids) {

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {

            return String(
                element.value || ""
            ).trim();
        }
    }

    return "";
}


// ============================================================
// GET CURRENT USER PROFILE
// ============================================================

async function getCurrentUserProfile() {

    if (!auth.currentUser) {
        return null;
    }

    try {

        const userRef =
            doc(
                db,
                "users",
                auth.currentUser.uid
            );

        const snapshot =
            await getDoc(userRef);

        if (snapshot.exists()) {

            return {
                uid: auth.currentUser.uid,
                ...snapshot.data()
            };
        }

        return {
            uid: auth.currentUser.uid
        };

    } catch (error) {

        console.error(
            "Error loading user profile:",
            error
        );

        return null;
    }
}


// ============================================================
// AUTH LINK
// ============================================================

if (authLink) {

    authLink.addEventListener(
        "click",
        (e) => {

            e.preventDefault();

            if (auth.currentUser) {

                signOut(auth)
                    .then(() => {

                        if (
                            window.handlePostLogoutUI
                        ) {

                            window.handlePostLogoutUI();
                        }

                    })
                    .catch(error => {

                        console.error(
                            "Logout error:",
                            error
                        );

                        alert(
                            "Unable to sign out. Please try again."
                        );
                    });

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
// SWITCH LOGIN / REGISTER
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
// REGISTRATION
// ============================================================

if (authForm) {

    authForm.addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();

            const email =
                getValue("authEmail");

            const password =
                document.getElementById(
                    "authPassword"
                )?.value || "";

            try {

                // ==================================================
                // REGISTER
                // ==================================================

                if (isRegistering) {

                    const role =
                        getValue(
                            "userRole"
                        ) || "customer";

                    const businessName =
                        getValue(
                            "businessName",
                            "supplierBusinessName",
                            "business_name"
                        );

                    // ----------------------------------------------
                    // LOCATION
                    // ----------------------------------------------

                    const county =
                        getValue(
                            "county",
                            "supplierCounty",
                            "businessCounty",
                            "registeredCounty"
                        );

                    const town =
                        getValue(
                            "town",
                            "supplierTown",
                            "businessTown",
                            "registeredTown",
                            "city"
                        );

                    let location =
                        getValue(
                            "location",
                            "supplierLocation",
                            "businessLocation",
                            "registeredLocation",
                            "address"
                        );


                    // ----------------------------------------------
                    // PHONE
                    // ----------------------------------------------

                    const phone =
                        getValue(
                            "phone",
                            "supplierPhone",
                            "businessPhone",
                            "phoneNumber",
                            "authPhone"
                        );


                    // ----------------------------------------------
                    // BUILD LOCATION
                    // ----------------------------------------------

                    if (!location) {

                        if (
                            town &&
                            county
                        ) {

                            location =
                                `${town}, ${county}`;

                        } else {

                            location =
                                town ||
                                county ||
                                "";
                        }
                    }


                    // ----------------------------------------------
                    // SUPPLIER VALIDATION
                    // ----------------------------------------------

                    if (
                        role === "supplier"
                    ) {

                        if (!businessName) {

                            alert(
                                "Please enter your business name."
                            );

                            return;
                        }

                        if (!county) {

                            alert(
                                "Please select your county."
                            );

                            return;
                        }

                        if (!town) {

                            alert(
                                "Please select your town."
                            );

                            return;
                        }
                    }


                    if (!email) {

                        alert(
                            "Please enter your email address."
                        );

                        return;
                    }


                    if (!password) {

                        alert(
                            "Please enter a password."
                        );

                        return;
                    }


                    if (password.length < 6) {

                        alert(
                            "Password must contain at least 6 characters."
                        );

                        return;
                    }


                    // ----------------------------------------------
                    // CREATE FIREBASE ACCOUNT
                    // ----------------------------------------------

                    const userCredential =
                        await createUserWithEmailAndPassword(
                            auth,
                            email,
                            password
                        );


                    const user =
                        userCredential.user;


                    // ----------------------------------------------
                    // UPDATE FIREBASE AUTH PROFILE
                    // ----------------------------------------------

                    const displayName =
                        businessName ||
                        email.split("@")[0];


                    try {

                        await firebaseUpdateProfile(
                            user,
                            {
                                displayName
                            }
                        );

                    } catch (profileError) {

                        console.warn(
                            "Auth profile update failed:",
                            profileError
                        );
                    }


                    // ----------------------------------------------
                    // SAVE FIRESTORE USER PROFILE
                    // ----------------------------------------------

                    await setDoc(
                        doc(
                            db,
                            "users",
                            user.uid
                        ),
                        {

                            uid:
                                user.uid,

                            email:
                                email,

                            role:
                                role,

                            businessName:
                                businessName ||
                                "Independent Supplier",

                            phone:
                                phone,

                            county:
                                county,

                            town:
                                town,

                            location:
                                location,

                            // ----------------------------------
                            // STRUCTURED SUPPLIER LOCATION
                            // ----------------------------------

                            supplierLocation: {

                                town:
                                    town,

                                county:
                                    county,

                                display:
                                    location
                            },

                            createdAt:
                                new Date().toISOString(),

                            updatedAt:
                                new Date().toISOString()
                        },

                        {
                            merge: true
                        }
                    );


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


                    return;
                }


                // ==================================================
                // LOGIN
                // ==================================================

                if (!email) {

                    alert(
                        "Please enter your email address."
                    );

                    return;
                }


                if (!password) {

                    alert(
                        "Please enter your password."
                    );

                    return;
                }


                const userCredential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    userCredential.user;


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


            } catch (error) {

                console.error(
                    "Authentication Error:",
                    error
                );


                alert(
                    getAuthErrorMessage(
                        error
                    )
                );
            }
        }
    );
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

window.forgotPassword =
async function () {

    const email =
        getValue("authEmail");


    if (!email) {

        alert(
            "Enter your email address first."
        );

        document
            .getElementById("authEmail")
            ?.focus();

        return;
    }


    try {

        await sendPasswordResetEmail(
            auth,
            email
        );


        alert(
            "Password reset email sent. Please check your email inbox and spam folder."
        );


    } catch (error) {

        console.error(
            "Password reset error:",
            error
        );


        alert(
            getAuthErrorMessage(
                error
            )
        );
    }
};


// ============================================================
// ALSO SUPPORT A FORGOT PASSWORD BUTTON/LINK
// ============================================================

const forgotPasswordBtn =
    document.getElementById(
        "forgotPassword"
    ) ||
    document.getElementById(
        "forgotPasswordBtn"
    );


if (forgotPasswordBtn) {

    forgotPasswordBtn.addEventListener(
        "click",
        (e) => {

            e.preventDefault();

            window.forgotPassword();
        }
    );
}


// ============================================================
// UPDATE PROFILE
// ============================================================

window.updateSupplierProfile =
async function () {

    if (!auth.currentUser) {

        alert(
            "Please sign in first."
        );

        return;
    }


    try {

        const user =
            auth.currentUser;


        // ======================================================
        // READ PROFILE FIELDS
        // ======================================================

        const businessName =
            getValue(
                "profileBusinessName",
                "businessName",
                "supplierBusinessName",
                "business_name"
            );


        const phone =
            getValue(
                "profilePhone",
                "phone",
                "supplierPhone",
                "businessPhone",
                "phoneNumber"
            );


        const county =
            getValue(
                "profileCounty",
                "county",
                "supplierCounty",
                "businessCounty"
            );


        const town =
            getValue(
                "profileTown",
                "town",
                "supplierTown",
                "businessTown",
                "city"
            );


        let location =
            getValue(
                "profileLocation",
                "location",
                "supplierLocation",
                "businessLocation",
                "registeredLocation",
                "address"
            );


        // ======================================================
        // BUILD LOCATION
        // ======================================================

        if (!location) {

            if (
                town &&
                county
            ) {

                location =
                    `${town}, ${county}`;

            } else {

                location =
                    town ||
                    county ||
                    "";
            }
        }


        // ======================================================
        // UPDATE FIREBASE AUTH DISPLAY NAME
        // ======================================================

        const displayName =
            businessName ||
            user.displayName ||
            user.email?.split("@")[0] ||
            "GasHubKE User";


        await firebaseUpdateProfile(
            user,
            {
                displayName
            }
        );


        // ======================================================
        // UPDATE FIRESTORE PROFILE
        // ======================================================

        await setDoc(
            doc(
                db,
                "users",
                user.uid
            ),
            {

                uid:
                    user.uid,

                email:
                    user.email,

                businessName:
                    businessName ||
                    "Independent Supplier",

                phone:
                    phone,

                county:
                    county,

                town:
                    town,

                location:
                    location,

                supplierLocation: {

                    town:
                        town,

                    county:
                        county,

                    display:
                        location
                },

                updatedAt:
                    new Date().toISOString()

            },

            {
                merge: true
            }
        );


        alert(
            "Profile updated successfully!"
        );


        // Refresh page UI if available
        if (
            window.handlePostLoginUI
        ) {

            const profile =
                await getCurrentUserProfile();

            const role =
                profile?.role ||
                "customer";

            window.handlePostLoginUI(
                role
            );
        }


    } catch (error) {

        console.error(
            "Profile update error:",
            error
        );


        alert(
            "Failed to update profile: " +
            getAuthErrorMessage(error)
        );
    }
};


// ============================================================
// UPDATE PROFILE BUTTON
// ============================================================

const updateProfileBtn =
    document.getElementById(
        "updateProfileBtn"
    ) ||
    document.getElementById(
        "saveProfileBtn"
    );


if (updateProfileBtn) {

    updateProfileBtn.addEventListener(
        "click",
        (e) => {

            e.preventDefault();

            window.updateSupplierProfile();
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


            } catch (err) {

                console.error(
                    "Error loading user state:",
                    err
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


// ============================================================
// FIREBASE ERROR MESSAGES
// ============================================================

function getAuthErrorMessage(error) {

    switch (error?.code) {

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/user-not-found":
            return "No account exists with this email address.";

        case "auth/wrong-password":
            return "Incorrect email or password.";

        case "auth/invalid-credential":
            return "Incorrect email or password.";

        case "auth/email-already-in-use":
            return "An account with this email already exists.";

        case "auth/weak-password":
            return "Password is too weak. Use at least 6 characters.";

        case "auth/user-disabled":
            return "This account has been disabled.";

        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";

        case "auth/network-request-failed":
            return "Network error. Check your internet connection.";

        case "auth/operation-not-allowed":
            return "This authentication method is not enabled in Firebase.";

        case "auth/requires-recent-login":
            return "Please sign in again before updating your profile.";

        case "auth/unauthorized-domain":
            return "This website domain is not authorized in Firebase.";

        default:
            return (
                error?.message ||
                "An authentication error occurred."
            );
    }
}