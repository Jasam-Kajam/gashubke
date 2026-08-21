// Complete data mapping of all 47 Kenyan Counties to their respective towns and areas of operation
const kenyaLocations = {
    "Mombasa": ["Mombasa Island", "Nyali", "Bamburi", "Likoni", "Changamwe", "Jomvu", "Tudor", "Kisauni"],
    "Kwale": ["Kwale Town", "Diani", "Ukunda", "Msambweni", "Lungalunga", "Kinango"],
    "Kilifi": ["Kilifi Town", "Malindi", "Watamu", "Mtwapa", "Mariakani", "Kilifi CBD", "Kaloleni"],
    "Tana River": ["Hola", "Garsen", "Bura", "Madogo"],
    "Lamu": ["Lamu Town", "Mpeketoni", "Witu", "Kiunga", "Faza"],
    "Taita-Taveta": ["Voi", "Wundanyi", "Taveta", "Mwatate"],
    "Garissa": ["Garissa Town", "Masalani", "Dadaab", "Hulugho"],
    "Wajir": ["Wajir Town", "Habaswein", "Griftu", "Buna", "Tarbaj"],
    "Mandera": ["Mandera Town", "Elwak", "Rhamu", "Takaba", "Banissa"],
    "Marsabit": ["Marsabit Town", "Moyale", "Laisamis", "North Horr"],
    "Isiolo": ["Isiolo Town", "Garba Tula", "Merti"],
    "Meru": ["Meru Town", "Nkubu", "Maua", "Timau", "Chuka (Border)", "Meru CBD"],
    "Tharaka-Nithi": ["Chuka", "Kathwana", "Marimanti", "Muthara"],
    "Embu": ["Embu Town", "Runyenjes", "Kiritiri", "Siakago"],
    "Kitui": ["Kitui Town", "Mwingi", "Mutomo", "Kyuuni"],
    "Machakos": ["Machakos Town", "Athi River", "Mlolongo", "Syokimau", "Kangundo", "Matuu", "Tala"],
    "Makueni": ["Wote", "Emali", "Makindu", "Sultan Hamud", "Kibwezi"],
    "Nyandarua": ["Ol Kalou", "Nyahururu", "Engineer", "Shamata", "Kinangop"],
    "Nyeri": ["Nyeri Town", "Karatina", "Othaya", "Mukurwe-ini", "Naro Moru"],
    "Kirinyaga": ["Kerugoya", "Kutus", "Baricho", "Wanguru", "Sagana"],
    "Murang'a": ["Murang'a Town", "Kenol", "Kangema", "Maragua", "Sabasaba"],
    "Kiambu": ["Ruiru", "Juja", "Thika", "Kiambu Town", "Kikuyu", "Kahawa Wendani", "Kahawa Sukari", "Banana Hill", "Limuru", "Githunguri", "Kahuho"],
    "Turkana": ["Lodwar", "Kakuma", "Lokichoggio", "Kalokol"],
    "West Pokot": ["Kapenguria", "Sigor", "Makutano", "Chepareria"],
    "Samburu": ["Maralal", "Baragoi", "Wamba"],
    "Trans-Nzoia": ["Kitale", "Endebess", "Kiminini", "Kwanza"],
    "Uasin Gishu": ["Eldoret", "Turbo", "Moi's Bridge", "Burnt Forest", "Kaptagat"],
    "Elgeyo-Marakwet": ["Iten", "Kapsowar", "Chebiemit"],
    "Nandi": ["Kapsabet", "Nandi Hills", "Mosoriot", "Kobujoi"],
    "Baringo": ["Kabarnet", "Eldama Ravine", "Marigat", "Mogotio"],
    "Laikipia": ["Nanyuki", "Nyahururu", "Rumuruti", "Doldol"],
    "Nakuru": ["Nakuru CBD", "Naivasha", "Gilgil", "Molo", "Njoro", "Subukia", "Olenguruone"],
    "Narok": ["Narok Town", "Kilgoris", "Maela", "Suswa"],
    "Kajiado": ["Kitengela", "Ongata Rongai", "Kajiado Town", "Ngong", "Bissil", "Kimana", "Loitokitok"],
    "Kericho": ["Kericho Town", "Litein", "Kipkelion", "Sosiot"],
    "Bomet": ["Bomet Town", "Sotik", "Longisa", "Mulot"],
    "Kakamega": ["Kakamega Town", "Mumias", "Butere", "Lugari", "Malava", "Khwisero"],
    "Vihiga": ["Mbale", "Chavakali", "Luanda", "Hamisi", "Vihiga Town"],
    "Bungoma": ["Bungoma Town", "Webuye", "Kimiliti", "Chwele", "Malaba (Border)"],
    "Busia": ["Busia Town", "Malaba", "Port Victoria", "Nambale"],
    "Siaya": ["Siaya Town", "Bondo", "Ugunja", "Yala", "Alego"],
    "Kisumu": ["Kisumu City", "Ahero", "Maseno", "Awasi", "Kombewa"],
    "Homa Bay": ["Homa Bay Town", "Kendu Bay", "Ondo", "Mbita", "Oyugis"],
    "Migori": ["Migori Town", "Awendo", "Rongo", "Kehancha", "Isebania"],
    "Kisii": ["Kisii Town", "Ogembo", "Keroka", "Suneka", "Nyamache"],
    "Nyamira": ["Nyamira Town", "Keroka (Border)", "Nyansiongo", "Magombo"],
    "Nairobi": ["CBD", "Westlands", "Kilimani", "Kileleshwa", "Lavington", "Eastleigh", "Embakasi", "Kasarani", "Roysambu", "Karen", "Lang'ata", "Pipeline", "Umoja", "Donholm", "Kariobangi"]
};

document.addEventListener("DOMContentLoaded", () => {
    const countySelect = document.getElementById("supplierCounty");
    const areaSelect = document.getElementById("supplierArea");

    if (countySelect && areaSelect) {
        // Populate Counties alphabetical order for easy user lookup
        countySelect.innerHTML = '<option value="">Select County</option>';
        const sortedCounties = Object.keys(kenyaLocations).sort();
        
        sortedCounties.forEach(county => {
            const option = document.createElement("option");
            option.value = county;
            option.textContent = county;
            countySelect.appendChild(option);
        });

        // Update Towns/Areas dynamically when County changes
        countySelect.addEventListener("change", (e) => {
            const selectedCounty = e.target.value;
            areaSelect.innerHTML = '<option value="">Select Town / Area</option>';
            
            if (selectedCounty && kenyaLocations[selectedCounty]) {
                const sortedTowns = kenyaLocations[selectedCounty].sort();
                sortedTowns.forEach(area => {
                    const option = document.createElement("option");
                    option.value = area;
                    option.textContent = area;
                    areaSelect.appendChild(option);
                });
            }
        });
    }
});
