// Complete comprehensive data mapping of all 47 Kenyan Counties and their respective towns and operational areas
const kenyaLocations = {
    "Baringo": ["Kabarnet", "Eldama Ravine", "Marigat", "Mogotio", "Kiptagich", "Eldume", "Kimaro", "Tangulbei", "Bartabwa", "Koron", "Chemolingot", "Loboi"],
    "Bomet": ["Bomet Town", "Sotik", "Longisa", "Mulot", "Sigor", "Chebunyo", "Ndanai", "Merigi", "Kaplong", "Tenwek", "Bishara Market"],
    "Bungoma": ["Bungoma Town", "Webuye", "Kimiliti", "Chwele", "Malaba (Border)", "Kanduyi", "Sirisia", "Kimilili", "Kaptama", "Naitiri", "Luuanda", "Myanga"],
    "Busia": ["Busia Town", "Malaba", "Port Victoria", "Nambale", "Butula", "Amagoro", "Funyula", "Sio Port", "Matayos", "Murende", "Bumula"],
    "Elgeyo-Marakwet": ["Iten", "Kapsowar", "Chebiemit", "Kapsowar", "Kamariny", "Tambach", "Biretwo", "Chesongoch", "Kapcherop", "Kibargoi"],
    "Embu": ["Embu Town", "Runyenjes", "Kiritiri", "Siakago", "Ishiara", "Kianjokoma", "Manyatta", "Karurumo", "Rianjeru", "Gachoka"],
    "Garissa": ["Garissa Town", "Masalani", "Dadaab", "Hulugho", "Balambala", "Liboi", "Modogashe", "Bura East", "Hagadera", "Danyere"],
    "Homa Bay": ["Homa Bay Town", "Kendu Bay", "Ndhiwa", "Mbita", "Oyugis", "Kosele", "Ringa", "Sindo", "Katito (Border)", "Magunga", "Kachuor", "Arujo"],
    "Isiolo": ["Isiolo Town", "Garba Tula", "Merti", "Kula Mawe", "Oldonyiro", "Kinna", "Sericho", "Bulla Pesa"],
    "Kajiado": ["Kitengela", "Ongata Rongai", "Kajiado Town", "Ngong", "Bissil", "Kimana", "Loitokitok", "Isinya", "Mashuuru", "Namanga", "Rongai", "Kiserian", "Matasia", "Entarara"],
    "Kakamega": ["Kakamega Town", "Mumias", "Butere", "Lugari", "Malava", "Khwisero", "Shinyalu", "Ikolomani", "Likuyani", "Matungu", "Khayega", "Bukura", "Mahiakalo", "Navakholo"],
    "Kericho": ["Kericho Town", "Litein", "Kipkelion", "Sosiot", "Londiani", "Kabianga", "Chepseon", "Roret", "Fort Ternan", "Kiptere", "Kenyagoro"],
    "Kiambu": ["Ruiru", "Juja", "Thika", "Kiambu Town", "Kikuyu", "Kahawa Wendani", "Kahawa Sukari", "Banana Hill", "Limuru", "Githunguri", "Kahuho", "Gatundu", "Gatundu South", "Kamakis", "Ndumberi", "Tigoni", "Ngecha", "Kenyenya", "Karuri"],
    "Kilifi": ["Kilifi Town", "Malindi", "Watamu", "Mtwapa", "Mariakani", "Kilifi CBD", "Kaloleni", "Rabai", "Matsangoni", "Gede", "Marereni", "Kakoneni", "Vipingo"],
    "Kirinyaga": ["Kerugoya", "Kutus", "Baricho", "Wanguru", "Sagana", "Kagio", "Mutithi", "Kianjogu", "Karatina (Border)", "Kutus Town"],
    "Kisii": ["Kisii Town", "Ogembo", "Keroka", "Suneka", "Nyamache", "Tabaka", "Masimba", "Mosocho", "Nyakoe", "Keumbu", "Itibo", "Gesonso"],
    "Kisumu": ["Kisumu City", "Ahero", "Maseno", "Awasi", "Kombewa", "Katito", "Nyahera", "Mamboleo", "Kajulu", "Holo", "Chemelil", "Muhoroni", "Sondu (Border)"],
    "Kitui": ["Kitui Town", "Mwingi", "Mutomo", "Kyuuni", "Zombe", "Mutitu", "Kabati", "Ikutha", "Kyuso", "Migwani", "Endau", "Nguni"],
    "Kwale": ["Kwale Town", "Diani", "Ukunda", "Msambweni", "Lungalunga", "Kinango", "Ramisi", "Shimoni", "Vanga", "Majengo", "Mariakani (Border)"],
    "Laikipia": ["Nanyuki", "Nyahururu", "Rumuruti", "Doldol", "Kinamba", "Wiyumiririe", "Manguo", "Ol Joro Orok (Border)"],
    "Lamu": ["Lamu Town", "Mpeketoni", "Witu", "Kiunga", "Faza", "Hindi", "Kizingitini", "Paté", "Mokowe"],
    "Machakos": ["Machakos Town", "Athi River", "Mlolongo", "Syokimau", "Kangundo", "Matuu", "Tala", "Kathiani", "Masinga", "Mitaboni", "Tala-Kangundo", "Sultan Hamud (Border)"],
    "Makueni": ["Wote", "Emali", "Makindu", "Sultan Hamud", "Kibwezi", "Mtito Andei", "Salama", "Nziu", "Kathonzweni", "Kikima", "Tawa"],
    "Mandera": ["Mandera Town", "Elwak", "Rhamu", "Takaba", "Banissa", "Lafey", "Kiliwehiri", "Ashabito"],
    "Marsabit": ["Marsabit Town", "Moyale", "Laisamis", "North Horr", "Loiyangalani", "South Horr", "Turbi", "Merille"],
    "Meru": ["Meru Town", "Nkubu", "Maua", "Timau", "Chuka (Border)", "Meru CBD", "Antubetwe", "Kianjai", "Laare", "Mutuati", "Gakoromone", "Ruiri", "Kibirichia"],
    "Migori": ["Migori Town", "Awendo", "Rongo", "Kehancha", "Isebania", "Uriri", "Nyatike", "Sori", "Muhuru Bay", "Kuja", "Macalder"],
    "Mombasa": ["Mombasa Island", "Nyali", "Bamburi", "Likoni", "Changamwe", "Jomvu", "Tudor", "Kisauni", "Mvita", "Port Reitz", "Tononoka", "Ganjoni", "Kuruwitu", "Shanzu"],
    "Murang'a": ["Murang'a Town", "Kenol", "Kangema", "Maragua", "Sabasaba", "Gatanga", "Kigumo", "Kiria-ini", "Mioro", "Kahuro", "Gakurwe", "Makuyu"],
    "Nairobi": ["CBD", "Westlands", "Kilimani", "Kileleshwa", "Lavington", "Eastleigh", "Embakasi", "Kasarani", "Roysambu", "Karen", "Lang'ata", "Pipeline", "Umoja", "Donholm", "Kariobangi", "Kayole", "Zimmerman", "Githurai 44", "Githurai 45", "Dandora", "Utawala", "Kahawa West", "South B", "South C", "Upperhill", "Parklands", "Highridge", "Ngara", "Huruma", "Mathare", "Kibera", "Kawangware", "Dagoretti", "Riruta", "Muthaiga", "Gigiri", "Runda", "Mountain View", "Imara Daima"],
    "Nakuru": ["Nakuru CBD", "Naivasha", "Gilgil", "Molo", "Njoro", "Subukia", "Olenguruone", "Rongai", "Bahati", "Mau Narok", "Elburgon", "Kuresoi", "Solai", "Salgaa", "Maili Sita"],
    "Nandi": ["Kapsabet", "Nandi Hills", "Mosoriot", "Kobujoi", "Chepterwai", "Baraton", "Kaptumo", "Meteitei", "Samoi", "Kabiyet"],
    "Narok": ["Narok Town", "Kilgoris", "Maela", "Suswa", "Naroosura", "Ololulung'a", "Mulot (Border)", "Ntulele", "Lolgorien", "Maai Mahiu (Border)"],
    "Nyamira": ["Nyamira Town", "Keroka (Border)", "Nyansiongo", "Magombo", "Ekerenyo", "Rigoma", "Manga", "Kiabonyoru", "Senta"],
    "Nyandarua": ["Ol Kalou", "Nyahururu", "Engineer", "Shamata", "Kinangop", "Rurii", "Miharati", "Mai Mahiu (Border)", "Magumu", "Wanjohi", "Ndunyu Njeru"],
    "Nyeri": ["Nyeri Town", "Karatina", "Othaya", "Mukurwe-ini", "Naro Moru", "Mweiga", "Kieni", "Chinga", "Gakawa", "Endarasha", "Thegu River"],
    "Samburu": ["Maralal", "Baragoi", "Wamba", "Archers Post", "Suguta Marmar", "South Horr", "Baragoi Town"],
    "Siaya": ["Siaya Town", "Bondo", "Ugunja", "Yala", "Alego", "Usenge", "Rarieda", "Ngiya", "Madiany", "Lwanda", "Ukwala"],
    "Taita-Taveta": ["Voi", "Wundanyi", "Taveta", "Mwatate", "Bura", "Mackinnon Road", "Mgange", "Kasigau", "Ziwani"],
    "Tana River": ["Hola", "Garsen", "Bura", "Madogo", "Kipini", "Garsen Town", "Wenje", "Bangale"],
    "Tharaka-Nithi": ["Chuka", "Kathwana", "Marimanti", "Muthara", "Gatunga", "Chiakariga", "Igambang'ombe", "Magumoni"],
    "Trans-Nzoia": ["Kitale", "Endebess", "Kiminini", "Kwanza", "Cherang'any", "Saboti", "Matisi", "Machewa"],
    "Turkana": ["Lodwar", "Kakuma", "Lokichoggio", "Kalokol", "Kibish", "Lokichar", "Katilu", "Kakuma Refugee Camp", "Kaikor", "Namanga (Border)"],
    "Uasin Gishu": ["Eldoret", "Turbo", "Moi's Bridge", "Burnt Forest", "Kaptagat", "Ziwa", "Sugoi", "Ainabkoi", "Langas", "Kamagut", "Pioneer", "Kapsoya"],
    "Vihiga": ["Mbale", "Chavakali", "Luanda", "Hamisi", "Vihiga Town", "Kilingili", "Emuhaya", "Sabatia", "Majengo", "Gisambai"],
    "Wajir": ["Wajir Town", "Habaswein", "Griftu", "Buna", "Tarbaj", "Bojicha", "Eldas", "Diif", "Leheley"],
    "West Pokot": ["Kapenguria", "Sigor", "Makutano", "Chepareria", "Ortum", "Kacheliba", "Alale", "Lomut"]
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
