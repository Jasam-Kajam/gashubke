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
// Example:
// Ruiru, Kiambu
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

    let businessLocation =
        getFieldValue(
            "businessLocation",
            "supplierBusinessLocation",
            "registeredBusinessLocation"
        );


    // --------------------------------------------------------
    // TRY TO EXTRACT TOWN + COUNTY FROM LOCATION
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
    // BUILD LOCATION
    // --------------------------------------------------------

    const location =
        town && county
            ? `${town}, ${county}`
            : "";


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


    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    const location =
        town && county
            ? `${town}, ${county}`
            : "";


    if (!town || !county) {

        throw new Error(
            "Both Town and County are required."
        );

    }


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
    // FIRESTORE USER REFERENCE
    // --------------------------------------------------------

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    // --------------------------------------------------------
    // GET EXISTING PROFILE
    // --------------------------------------------------------

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
        "supplier";


    // --------------------------------------------------------
    // UPDATED PROFILE
    // --------------------------------------------------------

    const updatedData = {

        uid:
            user.uid,

        businessName:
            businessName ||
            existingData.businessName ||
            user.displayName ||
            "Independent Supplier",

        email:
            user.email ||
            existingData.email ||
            "",

        role,

        // Main location
        town,
        county,

        // Compatibility fields
        supplierTown:
            town,

        supplierCounty:
            county,

        businessLocation:
            location,

        location:
            location,

        registeredBusinessLocation:
            location,

        // Structured location
        supplierLocation: {

            town,

            county,

            label:
                location,

            display:
                location

        },

        updatedAt:
            new Date().toISOString()

    };


    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    await setDoc(
        userRef,
        updatedData,
        {
            merge: true
        }
    );


    // --------------------------------------------------------
    // VERIFY
    // --------------------------------------------------------

    const verifiedDoc =
        await getDoc(
            userRef
        );


    if (!verifiedDoc.exists()) {

        throw new Error(
            "Profile was not saved. Please try again."
        );

    }


    const verifiedData =
        verifiedDoc.data();


    if (
        !verifiedData.businessLocation ||
        !verifiedData.supplierLocation?.town ||
        !verifiedData.supplierLocation?.county
    ) {

        throw new Error(
            "Business Location could not be verified."
        );

    }


    return {

        uid:
            user.uid,

        businessName:
            verifiedData.businessName,

        email:
            verifiedData.email,

        role:
            verifiedData.role,

        town:
            verifiedData.supplierLocation.town,

        county:
            verifiedData.supplierLocation.county,

        location:
            verifiedData.businessLocation

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
// SUPPLIER PROFILE COMPLETION FORM
//
// THIS FORM IS CREATED DIRECTLY BY AUTH.JS.
// NO SETTINGS PAGE IS REQUIRED.
// ============================================================

function showSupplierProfileForm(user) {

    const existingOverlay =
        document.getElementById(
            "gasHubSupplierProfileOverlay"
        );

    if (existingOverlay) {
        existingOverlay.remove();
    }


    const overlay =
        document.createElement("div");

    overlay.id =
        "gasHubSupplierProfileOverlay";


    overlay.innerHTML = `

        <div class="gasHubSupplierProfileBox">

            <div class="gasHubSupplierProfileHeader">

                <div class="gasHubSupplierProfileIcon">
                    G
                </div>

                <div>
                    <h2>Complete Business Profile</h2>

                    <p>
                        Your account has been created.
                        Please complete your business details
                        before continuing.
                    </p>
                </div>

            </div>


            <form id="gasHubSupplierProfileForm">

                <div class="gasHubProfileGroup">

                    <label for="gasHubProfileBusinessName">
                        Business Name
                    </label>

                    <input
                        type="text"
                        id="gasHubProfileBusinessName"
                        placeholder="Enter business name"
                        autocomplete="organization"
                        required
                    >

                </div>


                <div class="gasHubProfileGroup">

                    <label for="gasHubProfileTown">
                        Town
                    </label>

                    <input
                        type="text"
                        id="gasHubProfileTown"
                        placeholder="e.g. Ruiru"
                        required
                    >

                </div>


                <div class="gasHubProfileGroup">

                    <label for="gasHubProfileCounty">
                        County
                    </label>

                    <input
                        type="text"
                        id="gasHubProfileCounty"
                        placeholder="e.g. Kiambu"
                        required
                    >

                </div>


                <div class="gasHubProfileLocation">

                    <span>
                        Business Location
                    </span>

                    <strong id="gasHubProfileLocationPreview">
                        Enter Town and County
                    </strong>

                </div>


                <button
                    type="submit"
                    id="gasHubSaveSupplierProfile"
                >
                    Save Business Profile
                </button>


                <div
                    id="gasHubSupplierProfileMessage"
                    class="gasHubSupplierProfileMessage"
                ></div>

            </form>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    // ========================================================
    // PROFILE FORM CSS
    // ========================================================

    if (
        !document.getElementById(
            "gasHubSupplierProfileStyles"
        )
    ) {

        const style =
            document.createElement("style");

        style.id =
            "gasHubSupplierProfileStyles";


        style.textContent = `

            #gasHubSupplierProfileOverlay {
                position: fixed;
                inset: 0;
                z-index: 999999;
                background: rgba(15, 23, 42, .80);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                overflow-y: auto;
            }

            .gasHubSupplierProfileBox {
                width: 100%;
                max-width: 500px;
                background: #ffffff;
                border-radius: 18px;
                padding: 28px;
                box-shadow:
                    0 25px 70px rgba(0,0,0,.28);
            }

            .gasHubSupplierProfileHeader {
                display: flex;
                gap: 14px;
                align-items: flex-start;
                margin-bottom: 24px;
            }

            .gasHubSupplierProfileIcon {
                width: 48px;
                height: 48px;
                min-width: 48px;
                border-radius: 50%;
                background: #f97316;
                color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 21px;
                font-weight: 800;
            }

            .gasHubSupplierProfileHeader h2 {
                margin: 0;
                color: #1e293b;
                font-size: 21px;
            }

            .gasHubSupplierProfileHeader p {
                margin: 6px 0 0;
                color: #64748b;
                font-size: 14px;
                line-height: 1.5;
            }

            .gasHubProfileGroup {
                margin-bottom: 17px;
            }

            .gasHubProfileGroup label {
                display: block;
                margin-bottom: 7px;
                color: #334155;
                font-size: 14px;
                font-weight: 600;
            }

            .gasHubProfileGroup input {
                width: 100%;
                box-sizing: border-box;
                padding: 13px 14px;
                border: 1px solid #cbd5e1;
                border-radius: 10px;
                outline: none;
                font-size: 15px;
                background: #ffffff;
            }

            .gasHubProfileGroup input:focus {
                border-color: #f97316;
                box-shadow:
                    0 0 0 3px rgba(249,115,22,.12);
            }

            .gasHubProfileLocation {
                margin-top: 5px;
                padding: 13px;
                border: 1px solid #fed7aa;
                background: #fff7ed;
                border-radius: 10px;
                color: #9a3412;
                font-size: 13px;
            }

            .gasHubProfileLocation span {
                display: block;
                margin-bottom: 4px;
            }

            .gasHubProfileLocation strong {
                display: block;
                font-size: 15px;
            }

            #gasHubSaveSupplierProfile {
                width: 100%;
                margin-top: 20px;
                padding: 14px;
                border: none;
                border-radius: 10px;
                background: #f97316;
                color: #ffffff;
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
            }

            #gasHubSaveSupplierProfile:hover {
                background: #ea580c;
            }

            #gasHubSaveSupplierProfile:disabled {
                opacity: .65;
                cursor: not-allowed;
            }

            .gasHubSupplierProfileMessage {
                margin-top: 12px;
                text-align: center;
                font-size: 14px;
                line-height: 1.4;
            }

            @media (max-width: 500px) {

                #gasHubSupplierProfileOverlay {
                    padding: 14px;
                }

                .gasHubSupplierProfileBox {
                    padding: 22px;
                    border-radius: 15px;
                }

                .gasHubSupplierProfileHeader h2 {
                    font-size: 18px;
                }

            }

        `;


        document.head.appendChild(
            style
        );
    }


    // ========================================================
    // FORM ELEMENTS
    // ========================================================

    const businessNameInput =
        document.getElementById(
            "gasHubProfileBusinessName"
        );

    const townInput =
        document.getElementById(
            "gasHubProfileTown"
        );

    const countyInput =
        document.getElementById(
            "gasHubProfileCounty"
        );

    const locationPreview =
        document.getElementById(
            "gasHubProfileLocationPreview"
        );


    // ========================================================
    // LOAD EXISTING PROFILE
    // ========================================================

    getDoc(
        doc(
            db,
            "users",
            user.uid
        )
    )
    .then(snapshot => {

        if (!snapshot.exists()) {
            return;
        }


        const data =
            snapshot.data();


        businessNameInput.value =
            data.businessName ||
            user.displayName ||
            "";


        townInput.value =
            data.town ||
            data.supplierTown ||
            data.supplierLocation?.town ||
            "";


        countyInput.value =
            data.county ||
            data.supplierCounty ||
            data.supplierLocation?.county ||
            "";


        updateProfileLocationPreview();

    })
    .catch(error => {

        console.error(
            "Unable to load existing profile:",
            error
        );

    });


    // ========================================================
    // LOCATION PREVIEW
    // ========================================================

    function updateProfileLocationPreview() {

        const town =
            townInput.value.trim();

        const county =
            countyInput.value.trim();


        if (town && county) {

            locationPreview.textContent =
                `${town}, ${county}`;

        } else {

            locationPreview.textContent =
                "Enter Town and County";

        }

    }


    townInput.addEventListener(
        "input",
        updateProfileLocationPreview
    );

    countyInput.addEventListener(
        "input",
        updateProfileLocationPreview
    );


    // ========================================================
    // SAVE PROFILE
    // ========================================================

    document
        .getElementById(
            "gasHubSupplierProfileForm"
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const businessName =
                    businessNameInput.value.trim();

                const town =
                    townInput.value.trim();

                const county =
                    countyInput.value.trim();


                const message =
                    document.getElementById(
                        "gasHubSupplierProfileMessage"
                    );


                const saveButton =
                    document.getElementById(
                        "gasHubSaveSupplierProfile"
                    );


                // ------------------------------------------------
                // VALIDATION
                // ------------------------------------------------

                if (!businessName) {

                    message.textContent =
                        "Please enter your business name.";

                    businessNameInput.focus();

                    return;
                }


                if (!town) {

                    message.textContent =
                        "Please enter your town.";

                    townInput.focus();

                    return;
                }


                if (!county) {

                    message.textContent =
                        "Please enter your county.";

                    countyInput.focus();

                    return;
                }


                // ------------------------------------------------
                // SAVE
                // ------------------------------------------------

                saveButton.disabled =
                    true;

                saveButton.textContent =
                    "Saving...";

                message.textContent =
                    "";


                try {

                    const profile =
                        await updateUserProfile({

                            businessName,

                            town,

                            county

                        });


                    console.log(
                        "Supplier profile completed:",
                        profile
                    );


                    message.textContent =
                        "Business profile saved successfully.";


                    saveButton.textContent =
                        "Saved";


                    // ------------------------------------------------
                    // GO TO SUPPLIER DASHBOARD
                    // ------------------------------------------------

                    setTimeout(() => {

                        window.location.href =
                            "/supplier-dashboard/";

                    }, 700);


                } catch (error) {

                    console.error(
                        "Supplier profile save error:",
                        error
                    );


                    message.textContent =
                        error.message ||
                        "Unable to save your profile.";

                    saveButton.disabled =
                        false;

                    saveButton.textContent =
                        "Save Business Profile";

                }

            }
        );
}


// ============================================================
// SHOW PROFILE AFTER ERROR
//
// IMPORTANT:
// alert() pauses JavaScript until the user presses OK.
// ============================================================

function showProfileAfterRegistrationError(
    user,
    errorMessage = ""
) {

    alert(
        errorMessage ||
        "Your account was created, but your Business Profile needs to be completed.\n\n" +
        "Press OK to enter your Business Name, Town and County."
    );


    showSupplierProfileForm(
        user
    );
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


            // ==================================================
            // REGISTRATION
            // ==================================================

            if (isRegistering) {

                let role =
                    getFieldValue(
                        "userRole"
                    ) || "customer";


                const supplierAccount =
                    isSupplierRole(
                        role
                    );


                const businessName =
                    getFieldValue(
                        "businessName"
                    ) ||
                    "Independent Supplier";


                const {
                    town,
                    county,
                    location
                } =
                    getSupplierLocation();


                console.log(
                    "GasHubKE registration:",
                    {
                        email,
                        role,
                        businessName,
                        town,
                        county,
                        location
                    }
                );


                let user = null;


                try {

                    // ==========================================
                    // CREATE FIREBASE AUTH ACCOUNT
                    // ==========================================

                    const userCredential =
                        await createUserWithEmailAndPassword(
                            auth,
                            email,
                            password
                        );


                    user =
                        userCredential.user;


                    // ==========================================
                    // UPDATE AUTH DISPLAY NAME
                    // ==========================================

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


                    // ==========================================
                    // BASE FIRESTORE DATA
                    // ==========================================

                    const userData = {

                        uid:
                            user.uid,

                        email:
                            user.email ||
                            email,

                        role,

                        businessName,

                        createdAt:
                            new Date().toISOString(),

                        updatedAt:
                            new Date().toISOString()

                    };


                    // ==========================================
                    // SUPPLIER DATA
                    //
                    // LOCATION IS OPTIONAL AT THIS STAGE.
                    // ==========================================

                    if (supplierAccount) {

                        if (town) {

                            userData.town =
                                town;

                            userData.supplierTown =
                                town;

                        }


                        if (county) {

                            userData.county =
                                county;

                            userData.supplierCounty =
                                county;

                        }


                        if (
                            town &&
                            county
                        ) {

                            userData.businessLocation =
                                `${town}, ${county}`;

                            userData.location =
                                `${town}, ${county}`;

                            userData.registeredBusinessLocation =
                                `${town}, ${county}`;

                            userData.supplierLocation = {

                                town,

                                county,

                                label:
                                    `${town}, ${county}`,

                                display:
                                    `${town}, ${county}`

                            };

                        }

                    }


                    // ==========================================
                    // SAVE FIRESTORE PROFILE
                    // ==========================================

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


                    // ==========================================
                    // VERIFY PROFILE
                    // ==========================================

                    const savedProfile =
                        await getDoc(
                            doc(
                                db,
                                "users",
                                user.uid
                            )
                        );


                    const savedData =
                        savedProfile.exists()
                            ? savedProfile.data()
                            : {};


                    console.log(
                        "GasHubKE saved profile:",
                        savedData
                    );


                    // ==========================================
                    // SUPPLIER PROFILE CHECK
                    // ==========================================

                    if (supplierAccount) {

                        const hasLocation =
                            Boolean(
                                savedData.businessLocation &&
                                (
                                    savedData.town ||
                                    savedData.supplierTown
                                ) &&
                                (
                                    savedData.county ||
                                    savedData.supplierCounty
                                )
                            );


                        // --------------------------------------
                        // LOCATION MISSING
                        // --------------------------------------

                        if (!hasLocation) {

                            if (authModal) {

                                authModal.style.display =
                                    "none";

                            }


                            showProfileAfterRegistrationError(
                                user
                            );

                            return;

                        }

                    }


                    // ==========================================
                    // NORMAL SUCCESS
                    // ==========================================

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


                } catch (error) {

                    console.error(
                        "Registration error:",
                        error
                    );


                    // ==================================================
                    // IMPORTANT:
                    //
                    // Firebase Auth may have already created the
                    // account even if Firestore then failed.
                    //
                    // In that case, show the profile form after OK.
                    // ==================================================

                    if (
                        supplierAccount &&
                        user
                    ) {

                        if (authModal) {

                            authModal.style.display =
                                "none";

                        }


                        showProfileAfterRegistrationError(
                            user,
                            "Your account was created, but your business profile could not be completed.\n\n" +
                            "Press OK to enter your Business Name, Town and County."
                        );


                        return;

                    }


                    // ==================================================
                    // IF AUTH ACCOUNT WAS CREATED BUT VARIABLE WAS
                    // NOT REACHED, CHECK CURRENT USER
                    // ==================================================

                    if (
                        supplierAccount &&
                        auth.currentUser
                    ) {

                        if (authModal) {

                            authModal.style.display =
                                "none";

                        }


                        showProfileAfterRegistrationError(
                            auth.currentUser,
                            "Your account was created, but your business profile needs to be completed.\n\n" +
                            "Press OK to enter your Business Name, Town and County."
                        );


                        return;

                    }


                    // ==================================================
                    // NORMAL AUTH ERROR
                    // ==================================================

                    let message =
                        error.message ||
                        "Registration failed.";


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


                    alert(
                        "Registration Error: " +
                        message
                    );

                }


                return;
            }


            // ==================================================
            // LOGIN
            // ==================================================

            try {

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


                let profileData = {};


                if (
                    userDoc.exists()
                ) {

                    profileData =
                        userDoc.data();

                    role =
                        profileData.role ||
                        "customer";

                }


                // ------------------------------------------------
                // SUPPLIER LOGIN
                // ------------------------------------------------

                if (
                    isSupplierRole(role)
                ) {

                    const hasLocation =
                        Boolean(
                            profileData.businessLocation ||
                            (
                                profileData.supplierTown &&
                                profileData.supplierCounty
                            )
                        );


                    if (!hasLocation) {

                        if (authModal) {

                            authModal.style.display =
                                "none";

                        }


                        alert(
                            "Your supplier profile is incomplete.\n\n" +
                            "Press OK to add your Business Name, Town and County."
                        );


                        showSupplierProfileForm(
                            user
                        );


                        return;

                    }

                }


                // ------------------------------------------------
                // NORMAL LOGIN SUCCESS
                // ------------------------------------------------

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
                    "Login error:",
                    error
                );


                let message =
                    error.message ||
                    "Authentication failed.";


                switch (error.code) {

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
                            "Network error. Check your internet connection.";

                        break;


                    case "auth/too-many-requests":

                        message =
                            "Too many attempts. Please try again later.";

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

        if (!user) {

            if (
                window.handlePostLogoutUI
            ) {

                window.handlePostLogoutUI();

            }

            return;

        }


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


            let profileData = {};


            if (
                userDoc.exists()
            ) {

                profileData =
                    userDoc.data();

                role =
                    profileData.role ||
                    "customer";

            }


            // ------------------------------------------------
            // DO NOT AUTOMATICALLY OPEN THE PROFILE FORM
            // FROM AUTH STATE.
            //
            // Registration/login handlers already handle it.
            // ------------------------------------------------

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

    }
);


// ============================================================
// GLOBAL ACCESS
// ============================================================

window.gasHubAuth = {

    updateUserProfile,

    getCurrentUserProfile,

    getSupplierLocation,

    showSupplierProfileForm

};