/**
 * ETS2 Logbook & Telemetry Dashboard
 * Univerzální klientský engine pro GitHub Pages (LocalStorage SPA) i Flask server.
 */

// Výchozí vzorová data pro inicializaci nového uživatele na GitHub Pages
const DEFAULT_TRUCKS = [
    {
        id: 1,
        brand: "Scania",
        model: "S 730 V8 Highline",
        license_plate: "1AB 8899",
        tank_capacity_l: 1400.0,
        base_consumption_l_100km: 32.5,
        current_odometer_km: 12540.0,
        notes: "Topline kabina, V8 King of the Road edice",
        is_active: 1
    },
    {
        id: 2,
        brand: "Volvo",
        model: "FH16 750 Globetrotter XL",
        license_plate: "2CZ 4421",
        tank_capacity_l: 1380.0,
        base_consumption_l_100km: 31.0,
        current_odometer_km: 8920.0,
        notes: "Silný tahač na těžké nadrozměrné náklady",
        is_active: 1
    },
    {
        id: 3,
        brand: "MAN",
        model: "TGX 18.640 Individual Lion",
        license_plate: "3EX 7711",
        tank_capacity_l: 1160.0,
        base_consumption_l_100km: 29.8,
        current_odometer_km: 4310.0,
        notes: "Dálková přeprava, komfortní kabina",
        is_active: 1
    }
];

const DEFAULT_TRIPS = [
    {
        id: 1,
        truck_id: 1,
        origin_city: "Praha",
        destination_city: "Rotterdam",
        distance_km: 890.0,
        cargo_name: "Mobilní jeřáb",
        cargo_category: "Těžká technika / Heavy Cargo",
        cargo_weight_t: 24.5,
        revenue: 2850.0,
        diesel_price_per_l: 1.45,
        effective_consumption_l_100km: 38.63,
        fuel_consumed_l: 343.8,
        fuel_cost: 498.51,
        net_profit: 2351.49,
        odometer_start_km: 11650.0,
        odometer_end_km: 12540.0,
        completed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        notes: "Hladký přejezd přes Německo bez pokut"
    },
    {
        id: 2,
        truck_id: 2,
        origin_city: "Bratislava",
        destination_city: "Mnichov",
        distance_km: 510.0,
        cargo_name: "Lékařská technika",
        cargo_category: "Křehký náklad (Elektronika / Sklo)",
        cargo_weight_t: 8.2,
        revenue: 1680.0,
        diesel_price_per_l: 1.42,
        effective_consumption_l_100km: 33.05,
        fuel_consumed_l: 168.56,
        fuel_cost: 239.36,
        net_profit: 1440.64,
        odometer_start_km: 8410.0,
        odometer_end_km: 8920.0,
        completed_at: new Date(Date.now() - 86400000).toISOString(),
        notes: "Dodáno včas v nočních hodinách"
    }
];

let profitChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    const isSpaMode = document.getElementById("view-dashboard") !== null;

    if (isSpaMode) {
        initSpaEngine();
    } else {
        // Flask render mode
        initLiveCalculation();
        initCitySwap();
        initTableSearch();
    }
});

// ==============================================================================
// GITHUB PAGES / LOCAL STORAGE SPA ENGINE
// ==============================================================================
function initSpaEngine() {
    // 1. Ověření a inicializace dat v LocalStorage
    if (!localStorage.getItem("ets2_trucks")) {
        localStorage.setItem("ets2_trucks", JSON.stringify(DEFAULT_TRUCKS));
    }
    if (!localStorage.getItem("ets2_trips")) {
        localStorage.setItem("ets2_trips", JSON.stringify(DEFAULT_TRIPS));
    }

    // 2. Zapojení navigace mezi taby
    initTabNavigation();

    // 3. Vykreslení dat
    renderAll();

    // 4. Formuláře a živá kalkulace
    initLiveCalculation();
    initCitySwap();
    initTableSearch();

    // 5. Submit formuláře pro jízdu
    const tripForm = document.getElementById("tripForm");
    if (tripForm) {
        tripForm.addEventListener("submit", handleTripSubmit);
    }

    // 6. Submit formuláře pro nový tahač
    const truckForm = document.getElementById("addTruckForm");
    if (truckForm) {
        truckForm.addEventListener("submit", handleTruckSubmit);
    }
}

function getStoredTrucks() {
    try {
        return JSON.parse(localStorage.getItem("ets2_trucks")) || [];
    } catch {
        return [];
    }
}

function getStoredTrips() {
    try {
        return JSON.parse(localStorage.getItem("ets2_trips")) || [];
    } catch {
        return [];
    }
}

function saveStoredTrucks(trucks) {
    localStorage.setItem("ets2_trucks", JSON.stringify(trucks));
}

function saveStoredTrips(trips) {
    localStorage.setItem("ets2_trips", JSON.stringify(trips));
}

function renderAll() {
    renderDashboard();
    renderTruckSelectOptions();
    renderTripsTable();
    renderTrucksCards();
}

// ------------------------------------------------------------------------------
// TAB NAVIGACE
// ------------------------------------------------------------------------------
function initTabNavigation() {
    const navButtons = document.querySelectorAll(".nav-menu .nav-item");
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            if (tabName) switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    const navButtons = document.querySelectorAll(".nav-menu .nav-item");
    const tabViews = document.querySelectorAll(".tab-view");
    const heading = document.getElementById("pageHeading");
    const subHeading = document.getElementById("pageSubHeading");

    navButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    tabViews.forEach(view => {
        view.classList.toggle("active", view.id === `view-${tabName}`);
    });

    if (heading && subHeading) {
        if (tabName === "dashboard") {
            heading.textContent = "Telemetrický Dashboard";
            subHeading.textContent = "Statistický souhrn všech odjetých zakázek a ekonomika flotily";
        } else if (tabName === "logbook") {
            heading.textContent = "Záznam tras & Logbook";
            subHeading.textContent = "Zadejte novou odjetou trasu nebo procházejte kompletní historii přeprav";
        } else if (tabName === "trucks") {
            heading.textContent = "Vozový park & Tahače";
            subHeading.textContent = "Evidence tahačů, technických parametrů nádrže, spotřeby a stavu tachometrů";
        } else if (tabName === "data-management") {
            heading.textContent = "Záloha & Správa dat";
            subHeading.textContent = "Export a import databáze v JSON formátu pro GitHub Pages";
        }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ------------------------------------------------------------------------------
// VYKRESLENÍ DASHBOARDU A CHART.JS
// ------------------------------------------------------------------------------
function renderDashboard() {
    const trips = getStoredTrips();
    const trucks = getStoredTrucks();

    let totalDist = 0;
    let totalFuel = 0;
    let totalFuelCost = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    const truckUsage = {};
    const routeStats = {};

    trips.forEach(trip => {
        totalDist += Number(trip.distance_km) || 0;
        totalFuel += Number(trip.fuel_consumed_l) || 0;
        totalFuelCost += Number(trip.fuel_cost) || 0;
        totalRevenue += Number(trip.revenue) || 0;
        totalProfit += Number(trip.net_profit) || 0;

        // Truck usage
        truckUsage[trip.truck_id] = (truckUsage[trip.truck_id] || 0) + 1;

        // Route stats
        const routeKey = `${trip.origin_city} -> ${trip.destination_city}`;
        if (!routeStats[routeKey]) {
            routeStats[routeKey] = {
                origin: trip.origin_city,
                dest: trip.destination_city,
                count: 0,
                totalProfit: 0
            };
        }
        routeStats[routeKey].count += 1;
        routeStats[routeKey].totalProfit += Number(trip.net_profit) || 0;
    });

    const avgConsumption = totalDist > 0 ? ((totalFuel / totalDist) * 100) : 0;

    // Aktualizace KPI elementů
    const distEl = document.getElementById("dashTotalDistance");
    const tripsEl = document.getElementById("dashTotalTrips");
    const fuelEl = document.getElementById("dashTotalFuel");
    const fuelCostEl = document.getElementById("dashTotalFuelCost");
    const profitEl = document.getElementById("dashTotalProfit");
    const revEl = document.getElementById("dashTotalRevenue");
    const avgConsEl = document.getElementById("dashAvgConsumption");

    if (distEl) distEl.textContent = totalDist.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (tripsEl) tripsEl.textContent = trips.length;
    if (fuelEl) fuelEl.textContent = totalFuel.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (fuelCostEl) fuelCostEl.textContent = totalFuelCost.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    if (profitEl) profitEl.textContent = totalProfit.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (revEl) revEl.textContent = totalRevenue.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    if (avgConsEl) avgConsEl.textContent = avgConsumption.toFixed(2);

    // Nejpoužívanější tahač
    let topTruckId = null;
    let maxTrips = -1;
    for (const [tId, count] of Object.entries(truckUsage)) {
        if (count > maxTrips) {
            maxTrips = count;
            topTruckId = Number(tId);
        }
    }
    const topTruck = trucks.find(t => t.id === topTruckId);
    if (topTruck) {
        document.getElementById("dashTopTruckName").textContent = `${topTruck.brand} ${topTruck.model}`;
        document.getElementById("dashTopTruckPlate").textContent = topTruck.license_plate;
        document.getElementById("dashTopTruckCount").textContent = maxTrips;
        document.getElementById("dashTopTruckKm").textContent = Number(topTruck.current_odometer_km).toLocaleString("cs-CZ") + " km";
    }

    // Nejziskovější trasa
    let topRoute = null;
    let maxRouteProfit = -Infinity;
    for (const r of Object.values(routeStats)) {
        if (r.totalProfit > maxRouteProfit) {
            maxRouteProfit = r.totalProfit;
            topRoute = r;
        }
    }
    if (topRoute) {
        document.getElementById("dashTopRouteOrigin").textContent = topRoute.origin;
        document.getElementById("dashTopRouteDestination").textContent = topRoute.dest;
        document.getElementById("dashTopRouteProfit").textContent = topRoute.totalProfit.toLocaleString("cs-CZ", { minimumFractionDigits: 2 }) + " €";
        document.getElementById("dashTopRouteAvg").textContent = (topRoute.totalProfit / topRoute.count).toLocaleString("cs-CZ", { minimumFractionDigits: 2 }) + " €";
        document.getElementById("dashTopRouteCount").textContent = `${topRoute.count}x odjeto`;
    }

    // Poslední jízdy do tabulky na dashboardu
    const recentTableBody = document.getElementById("dashRecentTripsTableBody");
    if (recentTableBody) {
        const sortedTrips = [...trips].reverse().slice(0, 5);
        if (sortedTrips.length === 0) {
            recentTableBody.innerHTML = `<tr><td colspan="8" class="text-center empty-cell">Zatím nebyla vložena žádná jízda.</td></tr>`;
        } else {
            recentTableBody.innerHTML = sortedTrips.map(trip => {
                const tr = trucks.find(t => t.id === Number(trip.truck_id));
                const truckName = tr ? `${tr.brand} ${tr.model}` : "Tahač";
                const dateStr = trip.completed_at ? trip.completed_at.slice(0, 10) : "";
                return `
                    <tr>
                        <td><strong class="route-text">${trip.origin_city} &rarr; ${trip.destination_city}</strong></td>
                        <td><span class="badge-truck">${truckName}</span></td>
                        <td>${trip.cargo_name} <span class="dim-text">(${trip.cargo_weight_t} t)</span></td>
                        <td class="num">${Number(trip.distance_km).toFixed(1)} km</td>
                        <td class="num">${Number(trip.fuel_consumed_l).toFixed(1)} L <span class="sub-num">(${Number(trip.effective_consumption_l_100km).toFixed(2)} l/100km)</span></td>
                        <td class="num text-danger">${Number(trip.fuel_cost).toFixed(2)} €</td>
                        <td class="num text-success font-bold">+${Number(trip.net_profit).toFixed(2)} €</td>
                        <td class="dim-text">${dateStr}</td>
                    </tr>
                `;
            }).join("");
        }
    }

    // Aktualizace grafu Chart.js
    updateChart(trips);
}

function updateChart(trips) {
    const canvas = document.getElementById("profitChart");
    if (!canvas) return;

    const chartTrips = [...trips].slice(-10);
    const labels = chartTrips.map(t => `${t.origin_city} -> ${t.destination_city}`);
    const profits = chartTrips.map(t => Number(t.net_profit).toFixed(2));
    const costs = chartTrips.map(t => Number(t.fuel_cost).toFixed(2));

    if (profitChartInstance) {
        profitChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    profitChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Čistý zisk (€)",
                    data: profits,
                    backgroundColor: "rgba(16, 185, 129, 0.75)",
                    borderColor: "#10b981",
                    borderWidth: 1.5,
                    borderRadius: 6
                },
                {
                    label: "Náklady na palivo (€)",
                    data: costs,
                    backgroundColor: "rgba(239, 68, 68, 0.65)",
                    borderColor: "#ef4444",
                    borderWidth: 1.5,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#cbd5e1", font: { family: "Outfit", size: 12 } } },
                tooltip: {
                    backgroundColor: "#161b22",
                    borderColor: "#30363d",
                    borderWidth: 1,
                    titleColor: "#f59e0b",
                    bodyColor: "#e2e8f0",
                    padding: 12
                }
            },
            scales: {
                x: {
                    ticks: { color: "#94a3b8", font: { family: "Outfit", size: 11 } },
                    grid: { color: "rgba(255, 255, 255, 0.04)" }
                },
                y: {
                    ticks: { color: "#94a3b8", callback: val => val + " €" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" }
                }
            }
        }
    });
}

// ------------------------------------------------------------------------------
// VYKRESLENÍ SELECTU PRO FORMULÁŘ
// ------------------------------------------------------------------------------
function renderTruckSelectOptions() {
    const truckSelect = document.getElementById("truck_id");
    if (!truckSelect) return;

    const trucks = getStoredTrucks();
    const currentVal = truckSelect.value;

    truckSelect.innerHTML = `<option value="" disabled selected>-- Vyberte tahač z flotily --</option>` +
        trucks.map(truck => `
            <option value="${truck.id}"
                    data-consumption="${truck.base_consumption_l_100km}"
                    data-odometer="${truck.current_odometer_km}"
                    data-tank="${truck.tank_capacity_l}">
                ${truck.brand} ${truck.model} (${truck.license_plate}) — ${truck.base_consumption_l_100km} l/100km | Tachometr: ${Number(truck.current_odometer_km).toLocaleString("cs-CZ")} km
            </option>
        `).join("");

    if (currentVal) truckSelect.value = currentVal;
}

// ------------------------------------------------------------------------------
// VYKRESLENÍ HISTORIE VŠECH JÍZD
// ------------------------------------------------------------------------------
function renderTripsTable() {
    const tableBody = document.getElementById("allTripsTableBody");
    const countBadge = document.getElementById("tripsCountBadge");
    if (!tableBody) return;

    const trips = getStoredTrips();
    const trucks = getStoredTrucks();

    if (countBadge) countBadge.textContent = trips.length;

    if (trips.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="11" class="text-center empty-cell">V logbooku zatím nejsou žádné záznamy.</td></tr>`;
        return;
    }

    const sortedTrips = [...trips].reverse();
    tableBody.innerHTML = sortedTrips.map(trip => {
        const truck = trucks.find(t => t.id === Number(trip.truck_id));
        const truckName = truck ? `${truck.brand} ${truck.model}` : "Neznámý tahač";
        const truckPlate = truck ? truck.license_plate : "";

        return `
            <tr id="trip-row-${trip.id}">
                <td class="dim-text">#${trip.id}</td>
                <td>
                    <strong class="route-text">${trip.origin_city} &rarr; ${trip.destination_city}</strong>
                    ${trip.notes ? `<div class="trip-subnote">${trip.notes}</div>` : ""}
                </td>
                <td>
                    <div class="badge-truck">${truckName}</div>
                    <div class="sub-num">${truckPlate}</div>
                </td>
                <td>
                    <strong>${trip.cargo_name}</strong>
                    <div class="dim-text">${trip.cargo_weight_t} t | ${trip.cargo_category || "Standardní"}</div>
                </td>
                <td class="num">${Number(trip.distance_km).toFixed(1)} km</td>
                <td class="num">
                    ${Number(trip.fuel_consumed_l).toFixed(1)} L
                    <div class="sub-num">${Number(trip.effective_consumption_l_100km).toFixed(2)} l/100km</div>
                </td>
                <td class="num text-danger">${Number(trip.fuel_cost).toFixed(2)} €</td>
                <td class="num">${Number(trip.revenue).toFixed(2)} €</td>
                <td class="num text-success font-bold">+${Number(trip.net_profit).toFixed(2)} €</td>
                <td class="num dim-text">${Number(trip.odometer_start_km).toFixed(0)} &rarr; ${Number(trip.odometer_end_km).toFixed(0)} km</td>
                <td>
                    <button class="btn btn-delete btn-sm" onclick="deleteSpaTrip(${trip.id})" title="Smazat záznam">Smazat</button>
                </td>
            </tr>
        `;
    }).join("");
}

// ------------------------------------------------------------------------------
// VYKRESLENÍ KARET TAHAČŮ
// ------------------------------------------------------------------------------
function renderTrucksCards() {
    const container = document.getElementById("trucksCardsContainer");
    if (!container) return;

    const trucks = getStoredTrucks();
    if (trucks.length === 0) {
        container.innerHTML = `<div class="empty-cell">V garáži není žádný tahač. Přidejte svůj první tahač formulářem.</div>`;
        return;
    }

    container.innerHTML = trucks.map(truck => {
        const theoreticalRange = (Number(truck.tank_capacity_l) / Number(truck.base_consumption_l_100km)) * 100;
        return `
            <div class="truck-card">
                <div class="truck-card-header">
                    <div class="truck-meta">
                        <span class="truck-brand-badge">${truck.brand}</span>
                        <h3 class="truck-name">${truck.model}</h3>
                    </div>
                    <div class="plate-badge">${truck.license_plate}</div>
                </div>

                <div class="truck-odometer-box">
                    <span class="odometer-label">STAV TACHOMETRU</span>
                    <span class="odometer-digits">${Number(truck.current_odometer_km).toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <small>KM</small></span>
                </div>

                <div class="truck-specs-grid">
                    <div class="spec-item">
                        <span class="spec-label">Objem nádrže</span>
                        <span class="spec-val">${Number(truck.tank_capacity_l).toLocaleString("cs-CZ")} L</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Základní spotřeba</span>
                        <span class="spec-val">${Number(truck.base_consumption_l_100km).toFixed(1)} l/100km</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Teoretický dojezd</span>
                        <span class="spec-val">${Math.round(theoreticalRange).toLocaleString("cs-CZ")} km</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Stav v garáži</span>
                        <span class="spec-val text-success">Aktivní tahač</span>
                    </div>
                </div>

                ${truck.notes ? `<div class="truck-notes"><span class="notes-tag">Poznámka:</span> ${truck.notes}</div>` : ""}
            </div>
        `;
    }).join("");
}

// ------------------------------------------------------------------------------
// SUBMIT: PŘIDÁNÍ JÍZDY (LOCAL STORAGE)
// ------------------------------------------------------------------------------
function handleTripSubmit(e) {
    e.preventDefault();

    const truckId = Number(document.getElementById("truck_id").value);
    const origin = document.getElementById("origin_city").value.trim();
    const dest = document.getElementById("destination_city").value.trim();
    const distanceKm = parseFloat(document.getElementById("distance_km").value) || 0;
    const cargoName = document.getElementById("cargo_name").value.trim();
    const cargoWeight = parseFloat(document.getElementById("cargo_weight_t").value) || 0;
    const revenue = parseFloat(document.getElementById("revenue").value) || 0;
    const dieselPrice = parseFloat(document.getElementById("diesel_price_per_l").value) || 1.45;
    const cargoCategory = document.getElementById("cargo_category").value;
    const notes = document.getElementById("notes").value.trim();

    if (!truckId || !origin || !dest || distanceKm <= 0) {
        showNotification("Vyplňte prosím všechna povinná pole.", "danger");
        return;
    }

    const trucks = getStoredTrucks();
    const truck = trucks.find(t => t.id === truckId);
    if (!truck) {
        showNotification("Vybraný kamion nebyl nalezen.", "danger");
        return;
    }

    // Matematická kalkulace
    const effectiveConsumption = Number(truck.base_consumption_l_100km) + (cargoWeight * 0.25);
    const fuelConsumed = (distanceKm * effectiveConsumption) / 100.0;
    const fuelCost = fuelConsumed * dieselPrice;
    const netProfit = revenue - fuelCost;

    const odoStart = Number(truck.current_odometer_km);
    const odoEnd = odoStart + distanceKm;

    // Aktualizace tachometru kamionu v paměti
    truck.current_odometer_km = odoEnd;
    saveStoredTrucks(trucks);

    // Vložení zakázky
    const trips = getStoredTrips();
    const newId = trips.length > 0 ? Math.max(...trips.map(t => t.id)) + 1 : 1;

    const newTrip = {
        id: newId,
        truck_id: truckId,
        origin_city: origin,
        destination_city: dest,
        distance_km: distanceKm,
        cargo_name: cargoName,
        cargo_category: cargoCategory,
        cargo_weight_t: cargoWeight,
        revenue: revenue,
        diesel_price_per_l: dieselPrice,
        effective_consumption_l_100km: parseFloat(effectiveConsumption.toFixed(2)),
        fuel_consumed_l: parseFloat(fuelConsumed.toFixed(2)),
        fuel_cost: parseFloat(fuelCost.toFixed(2)),
        net_profit: parseFloat(netProfit.toFixed(2)),
        odometer_start_km: odoStart,
        odometer_end_km: odoEnd,
        completed_at: new Date().toISOString(),
        notes: notes
    };

    trips.push(newTrip);
    saveStoredTrips(trips);

    // Reset formuláře
    document.getElementById("tripForm").reset();
    document.getElementById("diesel_price_per_l").value = "1.45";
    document.getElementById("cargo_weight_t").value = "0.0";

    renderAll();
    showNotification(`Trasa ${origin} -> ${dest} úspěšně uložena! Zisk: ${netProfit.toFixed(2)} €`, "success");
}

// ------------------------------------------------------------------------------
// SUBMIT: PŘIDÁNÍ TAHAČE (LOCAL STORAGE)
// ------------------------------------------------------------------------------
function handleTruckSubmit(e) {
    e.preventDefault();

    const brand = document.getElementById("truck_brand").value.trim();
    const model = document.getElementById("truck_model").value.trim();
    const plate = document.getElementById("truck_plate").value.trim().toUpperCase();
    const tank = parseFloat(document.getElementById("truck_tank").value) || 1200;
    const consumption = parseFloat(document.getElementById("truck_consumption").value) || 30.0;
    const odometer = parseFloat(document.getElementById("truck_odometer").value) || 0;
    const notes = document.getElementById("truck_notes").value.trim();

    if (!brand || !model || !plate) {
        showNotification("Vyplňte prosím povinné parametry tahače.", "danger");
        return;
    }

    const trucks = getStoredTrucks();
    const newId = trucks.length > 0 ? Math.max(...trucks.map(t => t.id)) + 1 : 1;

    trucks.push({
        id: newId,
        brand: brand,
        model: model,
        license_plate: plate,
        tank_capacity_l: tank,
        base_consumption_l_100km: consumption,
        current_odometer_km: odometer,
        notes: notes,
        is_active: 1
    });

    saveStoredTrucks(trucks);
    document.getElementById("addTruckForm").reset();

    renderAll();
    showNotification(`Tahač ${brand} ${model} (${plate}) byl přidán do flotily!`, "success");
}

// ------------------------------------------------------------------------------
// SMAZÁNÍ JÍZDY
// ------------------------------------------------------------------------------
function deleteSpaTrip(tripId) {
    if (!confirm(`Opravdu si přejete smazat záznam jízdy #${tripId}?`)) return;

    let trips = getStoredTrips();
    trips = trips.filter(t => t.id !== tripId);
    saveStoredTrips(trips);

    renderAll();
    showNotification(`Záznam #${tripId} byl smazán.`, "success");
}

// ------------------------------------------------------------------------------
// EXPORT & IMPORT JSON ZÁLOHY
// ------------------------------------------------------------------------------
function exportDataToJson() {
    const data = {
        exported_at: new Date().toISOString(),
        trucks: getStoredTrucks(),
        trips: getStoredTrips()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ets2-logbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("Záloha byla úspěšně stažena do souboru JSON.", "success");
}

function importDataFromJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data.trucks) && Array.isArray(data.trips)) {
                saveStoredTrucks(data.trucks);
                saveStoredTrips(data.trips);
                renderAll();
                showNotification(`Data úspěšně obnovena! Načteno ${data.trucks.length} tahačů a ${data.trips.length} jízd.`, "success");
            } else {
                showNotification("Neplatný formát souboru zálohy.", "danger");
            }
        } catch (err) {
            showNotification("Chyba při čtení souboru: " + err.message, "danger");
        }
    };
    reader.readAsText(file);
}

function resetToSampleData() {
    if (!confirm("Opravdu si přejete obnovit výchozí testovací data? Vaše současné záznamy budou přepsány.")) return;
    localStorage.setItem("ets2_trucks", JSON.stringify(DEFAULT_TRUCKS));
    localStorage.setItem("ets2_trips", JSON.stringify(DEFAULT_TRIPS));
    renderAll();
    showNotification("Byla obnovena výchozí data ETS2.", "success");
}

function showNotification(message, type) {
    const area = document.getElementById("notificationArea");
    if (!area) return;

    area.innerHTML = `
        <div class="alert alert-${type}">
            <span class="alert-icon">${type === "success" ? "&#10003;" : "!"}</span>
            <span>${message}</span>
        </div>
    `;
    setTimeout(() => {
        area.innerHTML = "";
    }, 4000);
}

// ------------------------------------------------------------------------------
// ŽIVÝ VÝPOČET SPOTŘEBY & ZISKU (PŘI ZADÁVÁNÍ FORMULÁŘE)
// ------------------------------------------------------------------------------
function initLiveCalculation() {
    const truckSelect = document.getElementById("truck_id");
    const distanceInput = document.getElementById("distance_km");
    const weightInput = document.getElementById("cargo_weight_t");
    const dieselInput = document.getElementById("diesel_price_per_l");
    const revenueInput = document.getElementById("revenue");

    if (!truckSelect || !distanceInput) return;

    const previewConsumption = document.getElementById("previewConsumption");
    const previewFuel = document.getElementById("previewFuel");
    const previewFuelCost = document.getElementById("previewFuelCost");
    const previewProfit = document.getElementById("previewProfit");
    const previewProfitPerKm = document.getElementById("previewProfitPerKm");
    const previewNewOdometer = document.getElementById("previewNewOdometer");

    const updatePreview = () => {
        const selectedOption = truckSelect.options[truckSelect.selectedIndex];
        if (!selectedOption || !selectedOption.dataset.consumption) return;

        const baseConsumption = parseFloat(selectedOption.dataset.consumption) || 30.0;
        const currentOdometer = parseFloat(selectedOption.dataset.odometer) || 0.0;
        const distanceKm = parseFloat(distanceInput.value) || 0;
        const cargoWeightT = parseFloat(weightInput ? weightInput.value : 0) || 0;
        const dieselPrice = parseFloat(dieselInput ? dieselInput.value : 1.45) || 1.45;
        const revenue = parseFloat(revenueInput ? revenueInput.value : 0) || 0;

        if (distanceKm <= 0) {
            if (previewConsumption) previewConsumption.textContent = "--";
            if (previewFuel) previewFuel.textContent = "--";
            if (previewFuelCost) previewFuelCost.textContent = "--";
            if (previewProfit) previewProfit.textContent = "--";
            if (previewProfitPerKm) previewProfitPerKm.textContent = "-- € / km";
            if (previewNewOdometer) previewNewOdometer.textContent = "-- km";
            return;
        }

        const effectiveConsumption = baseConsumption + (cargoWeightT * 0.25);
        const fuelConsumed = (distanceKm * effectiveConsumption) / 100.0;
        const fuelCost = fuelConsumed * dieselPrice;
        const netProfit = revenue - fuelCost;
        const profitPerKm = distanceKm > 0 ? (netProfit / distanceKm) : 0;
        const newOdometer = currentOdometer + distanceKm;

        if (previewConsumption) previewConsumption.textContent = effectiveConsumption.toFixed(2);
        if (previewFuel) previewFuel.textContent = fuelConsumed.toFixed(1);
        if (previewFuelCost) previewFuelCost.textContent = fuelCost.toFixed(2) + " €";
        
        if (previewProfit) {
            previewProfit.textContent = (netProfit >= 0 ? "+" : "") + netProfit.toFixed(2) + " €";
            previewProfit.className = netProfit >= 0 ? "calc-value text-success" : "calc-value text-danger";
        }
        
        if (previewProfitPerKm) previewProfitPerKm.textContent = profitPerKm.toFixed(2) + " € / km";
        if (previewNewOdometer) previewNewOdometer.textContent = newOdometer.toLocaleString("cs-CZ", { maximumFractionDigits: 1 }) + " km";
    };

    [truckSelect, distanceInput, weightInput, dieselInput, revenueInput].forEach(elem => {
        if (elem) {
            elem.addEventListener("input", updatePreview);
            elem.addEventListener("change", updatePreview);
        }
    });

    updatePreview();
}

function initCitySwap() {
    const swapBtn = document.getElementById("swapCitiesBtn");
    const originInput = document.getElementById("origin_city");
    const destInput = document.getElementById("destination_city");

    if (swapBtn && originInput && destInput) {
        swapBtn.addEventListener("click", () => {
            const temp = originInput.value;
            originInput.value = destInput.value;
            destInput.value = temp;
        });
    }
}

function initTableSearch() {
    const searchInput = document.getElementById("tripSearchInput");
    const table = document.getElementById("tripsTable");

    if (!searchInput || !table) return;

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const rows = table.querySelectorAll("tbody tr");

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? "" : "none";
        });
    });
}
