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

import {
    kenyaCounties,
    getTowns
} from "./counties.js";


/* =========================================================
   AUTH UI ELEMENTS
========================================================= */

const authLink = document.getElementById("authLink");
const authModal = document.getElementById("authModal");
const closeModal = document.getElementById("closeModal");
const authForm = document.getElementById("authForm");
const authModalTitle = document.getElementById("authModalTitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const toggleAuthMode = document.getElementById("toggleAuthMode");
const vendorFields = document.getElementById("vendorFields");
const userRoleSelect = document.getElementById("userRole");
const supplierExtraFields = document.getElementById("supplierExtraFields");
const supplierCountySelect = document.getElementById("supplierCounty");
const supplierAreaSelect = document.getElementById("supplierArea");

let isRegistering = false;
let profileCompletionOpen = false;


/* =========================================================
   GENERAL HELPERS
========================================================= */

function getFieldValue(...ids) {
    for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        const value = String(element.value || "").trim();
        if (value) return value;
    }
    return "";
}

function isSupplierRole(role) {
    const normalizedRole = String(role || "").trim().toLowerCase();
    return normalizedRole === "supplier" || normalizedRole === "vendor";
}

function buildLocation(town = "", county = "") {
    town = String(town || "").trim();
    county = String(county || "").trim();
    return [town, county].filter(Boolean).join(", ");
}


/* =========================================================
   SUPPLIER LOCATION
========================================================= */

function getSupplierLocation() {
    let town = getFieldValue(
        "supplierArea",
        "supplierTown",
        "town",
        "businessTown",
        "registeredTown",
        "supplierLocationTown",
        "businessLocationTown"
    );

    let county = getFieldValue(
        "supplierCounty",
        "county",
        "businessCounty",
        "registeredCounty",
        "supplierLocationCounty",
        "businessLocationCounty"
    );

    let businessLocation = getFieldValue(
        "businessLocation",
        "supplierBusinessLocation",
        "registeredBusinessLocation"
    );

    if (businessLocation && (!town || !county)) {
        const parts = businessLocation
            .split(",")
            .map(value => value.trim())
            .filter(Boolean);

        if (!town && parts[0]) town = parts[0];
        if (!county && parts[1]) county = parts[1];
    }

    const location = buildLocation(town, county);

    return {
        town,
        county,
        location: location || businessLocation
    };
}


/* =========================================================
   COUNTIES.JS HELPERS
========================================================= */

function populateProfileCounties(countySelect, selectedCounty = "") {
    if (!countySelect) return;

    countySelect.innerHTML = `<option value="">Select County</option>`;

    if (!Array.isArray(kenyaCounties)) {
        console.error("kenyaCounties was not loaded correctly from counties.js");
        return;
    }

    kenyaCounties.forEach(county => {
        const option = document.createElement("option");
        option.value = county;
        option.textContent = county;

        if (String(county).trim().toLowerCase() === String(selectedCounty).trim().toLowerCase()) {
            option.selected = true;
        }

        countySelect.appendChild(option);
    });
}

function populateProfileTowns(townSelect, county, selectedTown = "") {
    if (!townSelect) return;

    townSelect.innerHTML = `<option value="">Select Town / Area</option>`;
    townSelect.disabled = true;

    if (!county) return;

    let towns = [];
    try {
        towns = getTowns(county) || [];
    } catch (error) {
        console.error("Unable to load towns for county:", county, error);
        return;
    }

    towns.forEach(town => {
        const option = document.createElement("option");
        option.value = town;
        option.textContent = town;

        if (String(town).trim().toLowerCase() === String(selectedTown).trim().toLowerCase()) {
            option.selected = true;
        }

        townSelect.appendChild(option);
    });

    townSelect.disabled = false;
}


/* =========================================================
   REGISTRATION ROLE & DROPDOWN SYNC
========================================================= */

function syncRegistrationFields() {
    if (!isRegistering) return;

    const selectedRole = userRoleSelect ? userRoleSelect.value : "customer";
    const showSupplierFields = isSupplierRole(selectedRole);

    if (supplierExtraFields) {
        supplierExtraFields.style.display = showSupplierFields ? "block" : "none";
    }

    if (showSupplierFields && supplierCountySelect && supplierCountySelect.options.length <= 1) {
        populateProfileCounties(supplierCountySelect);
    }
}

if (userRoleSelect) {
    userRoleSelect.addEventListener("change", syncRegistrationFields);
}

if (supplierCountySelect) {
    supplierCountySelect.addEventListener("change", () => {
        populateProfileTowns(supplierAreaSelect, supplierCountySelect.value);
    });
}


/* =========================================================
   UPDATE USER PROFILE
========================================================= */

export async function updateUserProfile({
    businessName = "",
    town = "",
    county = ""
} = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("You must be signed in to update your profile.");
    }

    businessName = String(businessName).trim();
    town = String(town).trim();
    county = String(county).trim();

    if (!businessName) throw new Error("Please enter your business name.");
    if (!town) throw new Error("Please select your town.");
    if (!county) throw new Error("Please select your county.");

    const location = buildLocation(town, county);
    const userRef = doc(db, "users", user.uid);
    const existingDoc = await getDoc(userRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};
    const role = existingData.role || "supplier";

    try {
        await updateProfile(user, { displayName: businessName });
    } catch (error) {
        console.warn("Firebase Auth profile update failed:", error);
    }

    const updatedData = {
        uid: user.uid,
        email: user.email || existingData.email || "",
        role,
        businessName,
        town,
        county,
        supplierTown: town,
        supplierCounty: county,
        businessLocation: location,
        registeredBusinessLocation: location,
        location,
        supplierLocation: {
            town,
            county,
            label: location,
            display: location
        },
        updatedAt: new Date().toISOString()
    };

    await setDoc(userRef, updatedData, { merge: true });

    return {
        uid: user.uid,
        businessName,
        email: user.email || existingData.email || "",
        role,
        town,
        county,
        location,
        supplierLocation: {
            town,
            county,
            label: location
        }
    };
}


/* =========================================================
   GET CURRENT USER PROFILE
========================================================= */

export async function getCurrentUserProfile() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("You must be signed in.");
    }

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    const data = userDoc.exists() ? userDoc.data() : {};
    const supplierLocation = data.supplierLocation || {};

    return {
        uid: user.uid,
        email: user.email || data.email || "",
        displayName: user.displayName || data.businessName || "",
        businessName: data.businessName || user.displayName || "",
        role: data.role || "customer",
        town: data.town || data.supplierTown || supplierLocation.town || "",
        county: data.county || data.supplierCounty || supplierLocation.county || "",
        location:
            data.businessLocation ||
            data.registeredBusinessLocation ||
            data.location ||
            supplierLocation.label ||
            supplierLocation.display ||
            ""
    };
}


/* =========================================================
   SUPPLIER PROFILE COMPLETION FORM
========================================================= */

export async function showSupplierProfileForm(user) {
    if (!user) {
        alert("Your account could not be loaded. Please sign in again.");
        return;
    }

    profileCompletionOpen = true;

    const oldOverlay = document.getElementById("gasHubSupplierProfileOverlay");
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement("div");
    overlay.id = "gasHubSupplierProfileOverlay";

    overlay.innerHTML = `
        <div class="gasHubSupplierProfileCard">
            <div class="gasHubSupplierProfileHeader">
                <div>
                    <h2>Complete Supplier Profile</h2>
                    <p>Add your business name and registered supplier location.</p>
                </div>
            </div>

            <form id="gasHubSupplierProfileForm">
                <div class="gasHubProfileField">
                    <label for="profileBusinessName">Business Name</label>
                    <input type="text" id="profileBusinessName" class="form-control" placeholder="Enter business name" required>
                </div>

                <div class="gasHubProfileField">
                    <label for="profileCounty">County</label>
                    <select id="profileCounty" class="form-select" required>
                        <option value="">Select County</option>
                    </select>
                </div>

                <div class="gasHubProfileField">
                    <label for="profileTown">Town</label>
                    <select id="profileTown" class="form-select" required disabled>
                        <option value="">Select Town</option>
                    </select>
                    <small>Select a county first to load its towns.</small>
                </div>

                <div id="profileLocationPreview" class="gasHubLocationPreview">
                    Location: <strong>Select Town, County</strong>
                </div>

                <div id="gasHubSupplierProfileError" class="gasHubProfileError" style="display:none;"></div>

                <button type="submit" id="saveSupplierProfileBtn" class="btn btn-primary w-100">
                    Save Profile
                </button>
            </form>
        </div>
    `;

    const style = document.createElement("style");
    style.id = "gasHubSupplierProfileStyles";
    style.textContent = `
        #gasHubSupplierProfileOverlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(15, 23, 42, 0.72);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-y: auto;
        }
        .gasHubSupplierProfileCard {
            width: min(500px, 100%);
            background: #ffffff;
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        }
        .gasHubSupplierProfileHeader h2 {
            margin: 0 0 6px;
            color: #1e293b;
            font-size: 24px;
            font-weight: 700;
        }
        .gasHubSupplierProfileHeader p {
            margin: 0 0 24px;
            color: #64748b;
            font-size: 14px;
        }
        .gasHubProfileField {
            margin-bottom: 18px;
        }
        .gasHubProfileField label {
            display: block;
            margin-bottom: 7px;
            color: #1e293b;
            font-weight: 600;
            font-size: 14px;
        }
        .gasHubProfileField select,
        .gasHubProfileField input {
            width: 100%;
            min-height: 46px;
            padding: 10px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            box-sizing: border-box;
        }
        .gasHubProfileField small {
            display: block;
            margin-top: 6px;
            color: #64748b;
            font-size: 12px;
        }
        .gasHubLocationPreview {
            margin-bottom: 18px;
            padding: 12px 14px;
            border-radius: 10px;
            background: #fff7ed;
            border: 1px solid #fed7aa;
            color: #9a3412;
            font-size: 14px;
        }
        .gasHubProfileError {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #b91c1c;
            font-size: 14px;
        }
        #saveSupplierProfileBtn {
            width: 100%;
            min-height: 48px;
            border: 0;
            border-radius: 10px;
            background: #f97316;
            color: #ffffff;
            font-weight: 600;
            cursor: pointer;
        }
        #saveSupplierProfileBtn:hover {
            background: #ea580c;
        }
        #saveSupplierProfileBtn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        @media (max-width: 576px) {
            #gasHubSupplierProfileOverlay { padding: 12px; }
            .gasHubSupplierProfileCard { padding: 22px 18px; border-radius: 14px; }
            .gasHubSupplierProfileHeader h2 { font-size: 21px; }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    const form = document.getElementById("gasHubSupplierProfileForm");
    const businessNameInput = document.getElementById("profileBusinessName");
    const countySelect = document.getElementById("profileCounty");
    const townSelect = document.getElementById("profileTown");
    const preview = document.getElementById("profileLocationPreview");
    const errorBox = document.getElementById("gasHubSupplierProfileError");
    const saveButton = document.getElementById("saveSupplierProfileBtn");

    let existingData = {};
    try {
        const profileRef = doc(db, "users", user.uid);
        const profileDoc = await getDoc(profileRef);
        if (profileDoc.exists()) {
            existingData = profileDoc.data();
        }
    } catch (error) {
        console.warn("Could not load existing supplier profile:", error);
    }

    const existingSupplierLocation = existingData.supplierLocation || {};
    const existingBusinessName = existingData.businessName || user.displayName || "";
    const existingCounty = existingData.county || existingData.supplierCounty || existingSupplierLocation.county || "";
    const existingTown = existingData.town || existingData.supplierTown || existingSupplierLocation.town || "";

    businessNameInput.value = existingBusinessName;
    populateProfileCounties(countySelect, existingCounty);

    if (existingCounty) {
        populateProfileTowns(townSelect, existingCounty, existingTown);
    } else {
        townSelect.disabled = true;
    }

    function updateLocationPreview() {
        const town = townSelect.value.trim();
        const county = countySelect.value.trim();
        const location = buildLocation(town, county);
        preview.innerHTML = `Location: <strong>${location || "Select Town, County"}</strong>`;
    }

    updateLocationPreview();

    countySelect.addEventListener("change", () => {
        populateProfileTowns(townSelect, countySelect.value);
        updateLocationPreview();
    });

    townSelect.addEventListener("change", updateLocationPreview);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        errorBox.style.display = "none";
        errorBox.textContent = "";

        const businessName = businessNameInput.value.trim();
        const county = countySelect.value.trim();
        const town = townSelect.value.trim();

        if (!businessName) {
            errorBox.textContent = "Please enter your business name.";
            errorBox.style.display = "block";
            businessNameInput.focus();
            return;
        }

        if (!county) {
            errorBox.textContent = "Please select your county.";
            errorBox.style.display = "block";
            countySelect.focus();
            return;
        }

        if (!town) {
            errorBox.textContent = "Please select your town.";
            errorBox.style.display = "block";
            townSelect.focus();
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving Profile...";

        try {
            await updateUserProfile({ businessName, town, county });

            profileCompletionOpen = false;
            overlay.remove();

            const styles = document.getElementById("gasHubSupplierProfileStyles");
            if (styles) styles.remove();

            alert("Supplier profile updated successfully!");

            if (typeof window.handlePostLoginUI === "function") {
                window.handlePostLoginUI("supplier");
            }
        } catch (error) {
            console.error("Supplier profile update error:", error);
            errorBox.textContent = error.message || "Unable to save your supplier profile.";
            errorBox.style.display = "block";
            saveButton.disabled = false;
            saveButton.textContent = "Save Profile";
        }
    });
}

export async function showProfileAfterRegistrationError(user, errorMessage = "") {
    if (errorMessage) alert(errorMessage);
    await showSupplierProfileForm(user);
}


/* =========================================================
   FORGOT PASSWORD
========================================================= */

function ensureForgotPasswordButton() {
    if (!authForm) return;
    if (document.getElementById("forgotPassword")) return;

    const passwordInput = document.getElementById("authPassword");
    if (!passwordInput) return;

    const wrapper = document.createElement("div");
    wrapper.style.textAlign = "right";
    wrapper.style.margin = "-0.4rem 0 0.85rem";

    const button = document.createElement("button");
    button.type = "button";
    button.id = "forgotPassword";
    button.style.background = "none";
    button.style.border = "none";
    button.style.color = "#64748b";
    button.style.fontSize = "0.85rem";
    button.style.cursor = "pointer";
    button.style.textDecoration = "underline";
    button.textContent = "Forgot Password?";

    wrapper.appendChild(button);
    passwordInput.insertAdjacentElement("afterend", wrapper);
}

async function handleForgotPassword() {
    const email = document.getElementById("authEmail")?.value.trim() || "";
    if (!email) {
        alert("Enter your email address first.");
        document.getElementById("authEmail")?.focus();
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent. Please check your inbox and spam folder.");
    } catch (error) {
        console.error("Password reset error:", error);
        let message = "Unable to send password reset email.";
        switch (error.code) {
            case "auth/invalid-email":
                message = "Please enter a valid email address.";
                break;
            case "auth/user-not-found":
                message = "No account exists with this email.";
                break;
            case "auth/network-request-failed":
                message = "Network error. Check your internet connection.";
                break;
            case "auth/too-many-requests":
                message = "Too many attempts. Please try again later.";
                break;
        }
        alert("Password Reset Error: " + message);
    }
}

document.addEventListener("click", event => {
    const button = event.target.closest("#forgotPassword");
    if (!button) return;
    event.preventDefault();
    handleForgotPassword();
});

ensureForgotPasswordButton();


/* =========================================================
   AUTH LINK (SIGN IN / SIGN OUT)
========================================================= */

if (authLink) {
    authLink.addEventListener("click", async event => {
        event.preventDefault();

        if (auth.currentUser) {
            try {
                await signOut(auth);
                if (typeof window.handlePostLogoutUI === "function") {
                    window.handlePostLogoutUI();
                }
            } catch (error) {
                console.error("Logout error:", error);
                alert("Unable to sign out. Please try again.");
            }
        } else if (authModal) {
            authModal.style.display = "flex";
        }
    });
}


/* =========================================================
   CLOSE AUTH MODAL
========================================================= */

if (closeModal) {
    closeModal.addEventListener("click", () => {
        if (authModal) authModal.style.display = "none";
    });
}


/* =========================================================
   LOGIN / REGISTER TOGGLE
========================================================= */

function setAuthMode(registerMode) {
    isRegistering = Boolean(registerMode);

    if (isRegistering) {
        if (authModalTitle) authModalTitle.innerText = "Register Platform Account";
        if (authSubmitBtn) authSubmitBtn.innerText = "Create Account";
        if (toggleAuthMode) toggleAuthMode.innerText = "Already have an account? Sign In";
        if (vendorFields) vendorFields.style.display = "block";
        syncRegistrationFields();
    } else {
        if (authModalTitle) authModalTitle.innerText = "Sign In";
        if (authSubmitBtn) authSubmitBtn.innerText = "Sign In";
        if (toggleAuthMode) toggleAuthMode.innerText = "Need an account? Register";
        if (vendorFields) vendorFields.style.display = "none";
    }
}

if (toggleAuthMode) {
    toggleAuthMode.addEventListener("click", () => {
        setAuthMode(!isRegistering);
    });
}


/* =========================================================
   AUTH FORM SUBMISSION
========================================================= */

if (authForm) {
    authForm.addEventListener("submit", async event => {
        event.preventDefault();

        const email = document.getElementById("authEmail")?.value.trim() || "";
        const password = document.getElementById("authPassword")?.value || "";

        if (!email || !password) {
            alert("Please enter your email and password.");
            return;
        }

        const originalBtnText = authSubmitBtn ? authSubmitBtn.innerText : "";
        if (authSubmitBtn) {
            authSubmitBtn.disabled = true;
            authSubmitBtn.innerText = isRegistering ? "Creating Account..." : "Signing In...";
        }

        try {
            if (isRegistering) {
                const role = getFieldValue("userRole") || "customer";
                const supplierAccount = isSupplierRole(role);
                const businessName = getFieldValue("businessName") || (supplierAccount ? "Independent Supplier" : "");
                const { town, county } = getSupplierLocation();

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                if (businessName) {
                    try {
                        await updateProfile(user, { displayName: businessName });
                    } catch (profileError) {
                        console.warn("Auth profile update failed:", profileError);
                    }
                }

                const userData = {
                    uid: user.uid,
                    email: user.email || email,
                    role,
                    businessName,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                if (supplierAccount && town && county) {
                    const supplierLocation = buildLocation(town, county);
                    userData.town = town;
                    userData.county = county;
                    userData.supplierTown = town;
                    userData.supplierCounty = county;
                    userData.businessLocation = supplierLocation;
                    userData.location = supplierLocation;
                    userData.registeredBusinessLocation = supplierLocation;
                    userData.supplierLocation = {
                        town,
                        county,
                        label: supplierLocation,
                        display: supplierLocation
                    };
                }

                try {
                    await setDoc(doc(db, "users", user.uid), userData, { merge: true });
                } catch (profileSaveError) {
                    console.error("Initial profile save failed:", profileSaveError);
                    if (supplierAccount) {
                        if (authModal) authModal.style.display = "none";
                        await showProfileAfterRegistrationError(
                            user,
                            "Your account was created, but your supplier profile could not be completed automatically. Please select your County and Town."
                        );
                        return;
                    }
                    throw profileSaveError;
                }

                if (supplierAccount) {
                    const savedProfile = await getDoc(doc(db, "users", user.uid));
                    const savedData = savedProfile.exists() ? savedProfile.data() : {};
                    const savedTown = savedData.town || savedData.supplierTown || savedData.supplierLocation?.town || "";
                    const savedCounty = savedData.county || savedData.supplierCounty || savedData.supplierLocation?.county || "";

                    if (!savedTown || !savedCounty) {
                        if (authModal) authModal.style.display = "none";
                        await showSupplierProfileForm(user);
                        return;
                    }
                }

                alert("Registration successful!");
                authForm.reset();
                setAuthMode(false);
                if (authModal) authModal.style.display = "none";

                if (typeof window.handlePostLoginUI === "function") {
                    window.handlePostLoginUI(role);
                }

            } else {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const role = userDoc.exists() ? (userDoc.data().role || "customer") : "customer";

                alert("Signed in successfully!");
                authForm.reset();
                if (authModal) authModal.style.display = "none";

                if (typeof window.handlePostLoginUI === "function") {
                    window.handlePostLoginUI(role);
                }
            }

        } catch (error) {
            console.error("Authentication error:", error);
            let message = error.message || "Authentication failed.";

            switch (error.code) {
                case "auth/email-already-in-use":
                    message = "An account with this email already exists.";
                    break;
                case "auth/invalid-email":
                    message = "Please enter a valid email address.";
                    break;
                case "auth/weak-password":
                    message = "Password is too weak. Please use at least 6 characters.";
                    break;
                case "auth/invalid-credential":
                    message = "Incorrect email or password.";
                    break;
                case "auth/user-not-found":
                    message = "No account exists with this email.";
                    break;
                case "auth/wrong-password":
                    message = "Incorrect password.";
                    break;
                case "auth/network-request-failed":
                    message = "Network error. Check your internet connection and try again.";
                    break;
                case "auth/too-many-requests":
                    message = "Too many attempts. Please try again later.";
                    break;
                case "auth/operation-not-allowed":
                    message = "Email/Password sign-in is not enabled in Firebase Authentication.";
                    break;
                case "permission-denied":
                    message = "Firebase denied access to your profile. Check your Firestore security rules.";
                    break;
            }

            alert("Authentication Error: " + message);
        } finally {
            if (authSubmitBtn) {
                authSubmitBtn.disabled = false;
                authSubmitBtn.innerText = originalBtnText || (isRegistering ? "Create Account" : "Sign In");
            }
        }
    });
}


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

onAuthStateChanged(auth, async user => {
    if (!user) {
        if (!profileCompletionOpen && typeof window.handlePostLogoutUI === "function") {
            window.handlePostLogoutUI();
        }
        return;
    }

    if (profileCompletionOpen) return;

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.exists() ? userDoc.data() : {};
        const role = data.role || "customer";

        if (isSupplierRole(role)) {
            const town = data.town || data.supplierTown || data.supplierLocation?.town || "";
            const county = data.county || data.supplierCounty || data.supplierLocation?.county || "";

            if (!town || !county) {
                await showSupplierProfileForm(user);
                return;
            }
        }

        if (typeof window.handlePostLoginUI === "function") {
            window.handlePostLoginUI(role);
        }
    } catch (error) {
        console.error("Error loading user state:", error);
    }
});
