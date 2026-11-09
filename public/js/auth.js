function getSupplierLocation() {
    let town = getFieldValue(
        "supplierArea", // <-- Added support for index.html's supplierArea ID
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
```[cite: 3]

#### 2. Populate Counties when opening Register Mode
Inside your `toggleAuthMode` event listener, populate the county dropdown when `vendorFields` becomes visible:

```javascript
if (toggleAuthMode) {
    toggleAuthMode.addEventListener(
        "click",
        () => {
            isRegistering = !isRegistering;

            if (isRegistering) {
                if (authModalTitle) {
                    authModalTitle.innerText = "Register Platform Account";
                }

                if (authSubmitBtn) {
                    authSubmitBtn.innerText = "Sign Up";
                }

                toggleAuthMode.innerText = "Already have an account? Sign In";

                if (vendorFields) {
                    vendorFields.style.display = "block";
                    
                    // Populate county dropdown on registration toggle
                    const countySelect = document.getElementById("supplierCounty");
                    if (countySelect) {
                        populateProfileCounties(countySelect);
                    }
                }

            } else {
                if (authModalTitle) {
                    authModalTitle.innerText = "Sign In";
                }

                if (authSubmitBtn) {
                    authSubmitBtn.innerText = "Sign In";
                }

                toggleAuthMode.innerText = "Need an account? Register";

                if (vendorFields) {
                    vendorFields.style.display = "none";
                }
            }
        }
    );
}
```[cite: 3]

#### 3. Add the County Change Listener for Dynamic Town Loading
Add this event listener near your other event handlers to ensure selecting a county automatically populates `#supplierArea` with its corresponding towns:

```javascript
document.addEventListener(
    "change",
    event => {
        if (event.target && event.target.id === "supplierCounty") {
            const county = event.target.value;
            const townSelect = document.getElementById("supplierArea");
            if (townSelect) {
                populateProfileTowns(townSelect, county);
            }
        }
    }
);
```[cite: 3]

*Verification:* Click **Register** in your app, select a county from the dropdown (e.g., *Kiambu* or *Nairobi*), and verify that the town dropdown (`#supplierArea`) populates instantly with matching towns. Submitting the form will now successfully authenticate and save your account data[cite: 3].
