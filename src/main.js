// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, doc, query, orderBy, writeBatch } from "firebase/firestore";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { defaultRoutes, defaultRouteStops } from "./data.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB7U7xiIN5g65pONLqfklnjr1ZhGh-cbug",
    authDomain: "ritians-transport.firebaseapp.com",
    projectId: "ritians-transport",
    storageBucket: "ritians-transport.firebasestorage.app",
    messagingSenderId: "1021044694281",
    appId: "1:1021044694281:web:7899123f19df484c7bc7d8",
    measurementId: "G-R4QSPHSK83"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Global State
let routes = [];
let routeStops = {};
window.parkingData = {};
window.isAdminLoggedIn = false;
window.isDriverLoggedIn = false;
window.currentSearchTerm = "";
const API_BASE = "/api";

// Auth Helpers
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

function setAuthToken(token) {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
}

async function apiFetch(url, options = {}) {
    const token = getAuthToken();
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    const response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
        // Session expired or unauthorized
        setAuthToken(null);
        window.isAdminLoggedIn = false;
        window.isDriverLoggedIn = false;
        // Optionally redirect or show message
    }
    return response;
}


// -------- Helper Functions --------
function escapeHTML(str) {
    if (!str) return "";
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
}

function updateClock() {

    const now = new Date();
    const weekdayEl = document.getElementById("currentDate_Weekday");
    const fullDateEl = document.getElementById("currentDate_Full");
    const timeOnlyEl = document.getElementById("currentTime_HHMMSS");
    const ampmEl = document.getElementById("currentTime_AMPM");
    if (weekdayEl) weekdayEl.innerText = now.toLocaleDateString("en-US", { weekday: 'long' }) + ",";
    if (fullDateEl) fullDateEl.innerText = now.toLocaleDateString("en-US", { day: 'numeric', month: 'short', year: 'numeric' });
    if (timeOnlyEl) {
        const timeStr = now.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const parts = timeStr.split(' ');
        timeOnlyEl.innerText = parts[0];
        if (ampmEl) ampmEl.innerText = parts[1].toLowerCase();
    }
}
setInterval(updateClock, 1000);

function formatDayPill(d) {
    return d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase() + " " + d.getDate();
}

// -------- Rendering Logic --------
function renderWeekStrip() {
    const strip = document.getElementById("weekDays");
    if (!strip) return;
    const today = new Date();
    const days = 7;
    let html = "";
    for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const isActive = i === 0 ? "active" : "";
        html += `<div class="day-pill ${isActive}" onclick="selectDate(this)">${formatDayPill(d)}</div>`;
    }
    strip.innerHTML = html;
    const label = document.getElementById("selectedDateLabel");
    if (label) label.innerText = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

window.selectDate = function (el) {
    document.querySelectorAll(".day-pill").forEach(p => p.classList.remove("active"));
    el.classList.add("active");
};

function applySearchAndRender() {
    const term = window.currentSearchTerm.toLowerCase();
    const filtered = routes.filter(r => {
        const no = (r.routeNo || "").toLowerCase();
        const name = (r.routeName || "").toLowerCase();
        const start = (r.start || "").toLowerCase();
        if (no.includes(term) || name.includes(term) || start.includes(term)) return true;
        const stops = routeStops[r.routeNo] || defaultRouteStops[r.routeNo] || [];
        return stops.some(s => (s.stop || "").toLowerCase().includes(term));
    });
    renderRoutesTable(filtered, term);
    renderAdminRoutesTable(filtered);
}

function renderRoutesTable(data, searchTerm = "") {
    const tbody = document.getElementById("routesTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    data.forEach(r => {
        const tr = document.createElement("tr");
        const liveInfo = window.parkingData && window.parkingData[r.routeNo];
        const parkingLoc = liveInfo ? escapeHTML(liveInfo.location) : 'Not updated';

        let availBadge = '<span class="badge badge-secondary">Unknown</span>';
        if (liveInfo && liveInfo.availability) {
            const status = liveInfo.availability;
            let colorClass = status === "Available" ? "badge-success" : (status === "Not Available" ? "badge-danger" : "badge-dark");
            availBadge = `<span class="badge ${colorClass}">${status}</span>`;
        }
        let matchedStopText = "";
        if (searchTerm.length > 1) {
            const stops = routeStops[r.routeNo] || defaultRouteStops[r.routeNo] || [];
            const match = stops.find(s => (s.stop || "").toLowerCase().includes(searchTerm));
            if (match && !(r.routeName || "").toLowerCase().includes(searchTerm)) {
                matchedStopText = `<div class="matched-stop-hint">Via ${match.stop}</div>`;
            }
        }
        let timingBadge = `<span class="badge badge-dark">${r.start}</span>`;
        if (r.start && r.start.toLowerCase().includes("am")) {
            const timeStr = r.start.split(' ')[0] || "";
            const parts = timeStr.replace('.', ':').split(':');
            const totalMin = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
            let status = "Regular", statusClass = "regular";
            if (totalMin < 360) { status = "Early"; statusClass = "early"; }
            else if (totalMin >= 390) { status = "Late"; statusClass = "late"; }
            timingBadge = `<div class="time-status-wrapper ${statusClass}"><span class="time-val"><i class="far fa-clock"></i> ${r.start}</span><span class="dot-sep">•</span><span class="status-label">${status}</span></div>`;
        }
        tr.innerHTML = `<td>${r.no}</td><td><strong>${r.routeNo}</strong></td><td><div class="route-name-cell"><div class="route-info"><div class="main-route-name"><i class="fas fa-bus-simple" style="margin-right: 8px; font-size: 0.9em; color: var(--accent);"></i>${r.routeName}</div>${matchedStopText}</div><button class="btn-icon-sm-alt" onclick="showStops('${r.routeNo}')"><i class="fas fa-route"></i></button></div></td><td>Full Route</td><td>${timingBadge}</td><td><div class="parking-cell-alt"><i class="fas fa-circle ${liveInfo ? 'text-green' : 'text-muted'}"></i><span>${parkingLoc}</span></div></td><td>${availBadge}</td>`;
        tbody.appendChild(tr);
    });
    const noResultsEl = document.getElementById("noResults");
    if (noResultsEl) {
        if (data.length === 0) noResultsEl.classList.remove("hidden");
        else noResultsEl.classList.add("hidden");
    }
}

function renderAdminRoutesTable(data) {
    const tbody = document.getElementById("adminRoutesTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    data.forEach(r => {
        const tr = document.createElement("tr");
        const liveInfo = window.parkingData && window.parkingData[r.routeNo];
        let availBadge = '<span class="text-muted">No update</span>';
        if (liveInfo && liveInfo.availability) {
            const status = liveInfo.availability;
            let colorClass = status === "Available" ? "badge-success" : (status === "Not Available" ? "badge-danger" : "badge-dark");
            availBadge = `<span class="badge ${colorClass}">${status}</span>`;
        }
        tr.innerHTML = `<td>${r.no}</td><td><strong style="color: var(--accent);">${r.routeNo}</strong></td><td>${r.routeName}</td><td><span class="text-muted" style="font-size: 11px;">${r.timing}</span></td><td><span class="badge badge-dark">${r.start}</span></td><td>${availBadge}</td><td style="text-align: right;"><button class="btn-icon-sm edit" onclick="editRoute('${r.routeNo}')"><i class="fas fa-pen"></i></button><button class="btn-icon-sm delete" onclick="deleteRoute('${r.routeNo}')"><i class="fas fa-trash"></i></button></td>`;
        tbody.appendChild(tr);
    });
}

// -------- Realtime Location Tracking --------
let lastCheckDate = new Date().toDateString();
function fetchBusLocations() {
    const locationsRef = ref(rtdb, 'locations');
    onValue(locationsRef, (snapshot) => {
        const rawData = snapshot.val() || {};
        const filteredData = {};
        const todayStr = new Date().toDateString();
        lastCheckDate = todayStr;
        Object.entries(rawData).forEach(([rNo, info]) => {
            if (info.timestamp && new Date(info.timestamp).toDateString() === todayStr) filteredData[rNo] = info;
        });
        window.parkingData = filteredData;
        if (routes.length > 0) applySearchAndRender();
        const activeCount = Object.keys(window.parkingData).length;
        const statEl = document.getElementById("statActiveParking");
        if (statEl) statEl.innerText = activeCount;
    });
    setInterval(() => {
        const currentDate = new Date().toDateString();
        if (currentDate !== lastCheckDate) {
            lastCheckDate = currentDate;
            window.parkingData = {};
            if (routes.length > 0) applySearchAndRender();
            const statEl = document.getElementById("statActiveParking");
            if (statEl) statEl.innerText = "0";
        }
    }, 30000);
}

// -------- Business Logic --------
async function init() {
    setupUIListeners();
    updateClock();
    renderWeekStrip();
    fetchBusLocations();

    try {
        const response = await fetch(`${API_BASE}/routes`);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            routes = data.routes;
            routeStops = data.routeStops || {};
        } else {
            routes = defaultRoutes;
            routeStops = defaultRouteStops;
        }
        updateStats();
        applySearchAndRender();
    } catch (error) {
        console.error("Backend API error, falling back to Local:", error);
        routes = defaultRoutes;
        routeStops = defaultRouteStops;
        applySearchAndRender();
    }
}

function setupUIListeners() {
    // Search Listener
    document.getElementById("searchInput")?.addEventListener("input", (e) => {
        window.currentSearchTerm = e.target.value;
        applySearchAndRender();
    });

    // Tab view listeners
    document.getElementById("pillStudent")?.addEventListener("click", () => switchView("Student"));
    document.getElementById("pillAdmin")?.addEventListener("click", () => {
        if (window.isAdminLoggedIn) switchView("Admin");
        else document.getElementById("adminLoginModal").classList.remove("hidden");
    });
    document.getElementById("pillDriver")?.addEventListener("click", () => {
        if (window.isDriverLoggedIn) switchView("Driver");
        else document.getElementById("driverLoginModal").classList.remove("hidden");
    });

    // Modals
    const adminModal = document.getElementById("adminLoginModal");
    const driverModal = document.getElementById("driverLoginModal");
    const stopsModal = document.getElementById("stopsModal");
    document.getElementById("adminLoginCloseBtn")?.addEventListener("click", () => adminModal.classList.add("hidden"));
    document.getElementById("driverLoginCloseBtn")?.addEventListener("click", () => driverModal.classList.add("hidden"));
    document.getElementById("stopsCloseBtn")?.addEventListener("click", () => stopsModal.classList.add("hidden"));
    [adminModal, driverModal, stopsModal].forEach(modal => {
        modal?.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
    });

    // Login Forms
    document.getElementById("adminLoginForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("adminEmail").value;
        const password = document.getElementById("adminPassword").value;
        try {
            const response = await fetch(`${API_BASE}/login/admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!data.success) { showToast(data.error || "Invalid Credentials", "error"); return; }
            setAuthToken(data.token);
            window.isAdminLoggedIn = true;
            document.getElementById("adminStatusText").innerHTML = `<i class='fas fa-circle-check'></i> Admin: ${data.user.name}`;
            document.getElementById("adminStatusText").style.color = "#10b981";
            adminModal.classList.add("hidden");
            document.getElementById("adminLogoutBtn").style.display = "block";
            switchView("Admin");
            showToast("Welcome, Admin", "success");
        } catch (err) {
            console.error("Admin login error:", err);
            showToast("Cannot reach server. Please try again later.", "error");
        }
    });



    document.getElementById("driverLoginForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("driverEmail").value;
        const password = document.getElementById("driverPassword").value;
        try {
            const response = await fetch(`${API_BASE}/login/driver`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!data.success) { showToast(data.error || "Invalid Credentials", "error"); return; }
            setAuthToken(data.token);
            window.isDriverLoggedIn = true;
            window.currentDriverId = data.user.driverId || email;
            document.getElementById("driverStatusText").innerHTML = `<i class='fas fa-user-check'></i> Driver: ${data.user.name}`;
            document.getElementById("driverStatusText").style.color = "#10b981";
            driverModal.classList.add("hidden");
            document.getElementById("driverLogoutBtn").style.display = "block";
            const select = document.getElementById("driverRouteSelect");
            if (select) select.innerHTML = routes.map(r => `<option value="${r.routeNo}">${r.routeNo} - ${r.routeName}</option>`).join("");
            switchView("Driver");
            showToast("Welcome, Driver", "success");
        } catch (err) {
            console.error("Driver login error:", err);
            showToast("Cannot reach server. Please try again later.", "error");
        }
    });



    document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
        window.isAdminLoggedIn = false;
        setAuthToken(null);
        document.getElementById("adminLogoutBtn").style.display = "none";
        document.getElementById("adminStatusText").innerText = "Admin access: locked";
        document.getElementById("adminStatusText").style.color = "inherit";
        switchView("Student");
    });

    document.getElementById("driverLogoutBtn")?.addEventListener("click", () => {
        window.isDriverLoggedIn = false;
        setAuthToken(null);
        document.getElementById("driverLogoutBtn").style.display = "none";
        document.getElementById("driverStatusText").innerText = "Driver access: locked";
        document.getElementById("driverStatusText").style.color = "inherit";
        switchView("Student");
    });


    // Reset / Seed
    const seedFunc = async () => {
        const masterKey = prompt("Enter Master Key to continue:");
        if (!masterKey) return;
        if (!confirm("This will overwrite existing route data and staff accounts. Continue?")) return;
        try {
            const response = await fetch(`${API_BASE}/admin/seed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ masterKey })
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || "Database Seeded!", "success");
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast(data.error || "Seed failed", "error");
            }
        } catch (err) { showToast("Seed error", "error"); }
    };

    document.getElementById("adminResetBtn")?.addEventListener("click", seedFunc);
    document.getElementById("adminModalResetBtn")?.addEventListener("click", seedFunc);
    document.getElementById("adminClearParkingBtn")?.addEventListener("click", async () => {
        if (!confirm("Clear all live parking?")) return;
        try {
            const response = await apiFetch(`${API_BASE}/admin/reset-daily`, { method: 'POST' });
            const data = await response.json();
            if (data.success) showToast("Live Parking Cleared!", "success");
        } catch (err) { showToast("Failed to clear parking", "error"); }
    });


    // Driver Update
    document.getElementById("driverParkingForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const rNo = document.getElementById("driverRouteSelect").value;
        const loc = document.getElementById("driverLocationSelect").value;
        const avail = document.getElementById("driverAvailabilitySelect").value;
        try {
            const response = await apiFetch(`${API_BASE}/driver/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routeNo: rNo, location: loc, availability: avail, driverId: window.currentDriverId })
            });
            const data = await response.json();
            if (data.success) showToast("Parking Published!", "success");
            else throw new Error(data.error);
        } catch (err) { showToast("Update failed", "error"); }
    });


    // Admin CRUD
    const adminRouteForm = document.getElementById("adminRouteForm");
    adminRouteForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const routeNo = document.getElementById("adminRouteNo").value;
        const routeName = document.getElementById("adminRouteName").value;
        const timing = document.getElementById("adminTiming").value;
        const start = document.getElementById("adminStartTime").value;
        const stopsRaw = document.getElementById("adminStops").value;

        let stops = [];
        try {
            if (stopsRaw) stops = JSON.parse(stopsRaw);
        } catch (err) {
            showToast("Invalid JSON in stops field", "error");
            return;
        }

        const existingRoute = routes.find(r => r.routeNo === routeNo);
        const no = existingRoute ? existingRoute.no : (routes.length + 1);

        try {
            // Save Route Info
            const rRes = await apiFetch(`${API_BASE}/routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ no, routeNo, routeName, timing, start })
            });
            const rData = await rRes.json();

            // Save Stops
            if (rData.success && stops.length > 0) {
                await apiFetch(`${API_BASE}/routes/${routeNo}/stops`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stops })
                });
            }

            if (rData.success) {
                showToast("Route saved successfully!", "success");
                adminRouteForm.reset();
                document.getElementById("adminRouteNo").readOnly = false;
                document.getElementById("adminSaveLabel").innerText = "Save Route";
                document.getElementById("adminFormTitle").innerText = "Add New Route";
                init();
            } else throw new Error(rData.error);
        } catch (err) { showToast("Save failed", "error"); }
    });


    document.getElementById("adminClearBtn")?.addEventListener("click", () => {
        adminRouteForm.reset();
        document.getElementById("adminRouteNo").readOnly = false;
        document.getElementById("adminSaveLabel").innerText = "Save Route";
        document.getElementById("adminFormTitle").innerText = "Add New Route";
    });

    document.getElementById("reportForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        showToast("Thank you for your feedback!", "success");
        e.target.reset();
    });

    document.getElementById("backToStudentFromAdmin")?.addEventListener("click", () => switchView("Student"));
    document.getElementById("backToStudentFromDriver")?.addEventListener("click", () => switchView("Student"));

    // Registration Logic
    const registerModal = document.getElementById("registerModal");
    const adminRegisterLink = document.getElementById("adminRegisterLink");
    const driverRegisterLink = document.getElementById("driverRegisterLink");
    const backToLoginLink = document.getElementById("backToLoginLink");
    const registerCloseBtn = document.getElementById("registerCloseBtn");

    if (registerModal) {
        // Open Admin Registration
        adminRegisterLink?.addEventListener("click", (e) => {
            e.preventDefault();
            document.getElementById("adminLoginModal").classList.add("hidden");
            registerModal.classList.remove("hidden");
            document.getElementById("registerTitle").innerText = "Admin Registration";
            document.getElementById("registerRoleName").innerText = "Admin Portal";
            document.getElementById("registerRole").value = "admin";
            document.getElementById("driverRegisterFields").classList.add("hidden");
        });

        // Open Driver Registration
        driverRegisterLink?.addEventListener("click", (e) => {
            e.preventDefault();
            document.getElementById("driverLoginModal").classList.add("hidden");
            registerModal.classList.remove("hidden");
            document.getElementById("registerTitle").innerText = "Driver Registration";
            document.getElementById("registerRoleName").innerText = "Driver Portal";
            document.getElementById("registerRole").value = "driver";
            document.getElementById("driverRegisterFields").classList.remove("hidden");
        });

        // Back to Login
        backToLoginLink?.addEventListener("click", (e) => {
            e.preventDefault();
            registerModal.classList.add("hidden");
            const role = document.getElementById("registerRole").value;
            if (role === "admin") document.getElementById("adminLoginModal").classList.remove("hidden");
            else document.getElementById("driverLoginModal").classList.remove("hidden");
        });

        // Close Modal
        registerCloseBtn?.addEventListener("click", () => registerModal.classList.add("hidden"));

        // Submit Registration
        document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const role = document.getElementById("registerRole").value;
            const name = document.getElementById("registerName").value;
            const email = document.getElementById("registerEmail").value;
            const password = document.getElementById("registerPassword").value;
            const driverId = document.getElementById("registerDriverId").value;

            // Simple validation
            if (!email.includes("@")) {
                showToast("Please enter a valid email", "error");
                return;
            }

            const masterKey = prompt("Enter Master Registration Key:");
            if (!masterKey) return;

            const payload = { role, name, email, password, masterKey };
            if (role === "driver") {

                payload.driverId = driverId || ("D-" + Math.floor(1000 + Math.random() * 9000));
                payload.pin = "1234"; // Default PIN for now, or ask user
            }

            try {
                const response = await fetch(`${API_BASE}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                if (data.success) {
                    showToast("Registration successful! Please login.", "success");
                    registerModal.classList.add("hidden");
                    if (role === "admin") document.getElementById("adminLoginModal").classList.remove("hidden");
                    else document.getElementById("driverLoginModal").classList.remove("hidden");
                } else {
                    showToast(data.error || "Registration failed", "error");
                }
            } catch (err) {
                showToast("Network error during registration", "error");
            }
        });
    }
}

window.editRoute = function (routeNo) {
    const route = routes.find(r => r.routeNo === routeNo);
    if (!route) return;

    document.getElementById("adminRouteNo").value = route.routeNo;
    document.getElementById("adminRouteNo").readOnly = true;
    document.getElementById("adminRouteName").value = route.routeName;
    document.getElementById("adminTiming").value = route.timing;
    document.getElementById("adminStartTime").value = route.start;

    const stops = routeStops[routeNo] || [];
    document.getElementById("adminStops").value = JSON.stringify(stops, null, 2);

    document.getElementById("adminSaveLabel").innerText = "Update Route";
    document.getElementById("adminFormTitle").innerText = "Edit Route: " + routeNo;
    document.getElementById("adminFormTitle").scrollIntoView({ behavior: 'smooth' });
}

window.deleteRoute = async function (routeNo) {
    if (!confirm(`Are you sure you want to delete route ${routeNo}?`)) return;
    try {
        const response = await apiFetch(`${API_BASE}/routes/${routeNo}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            showToast("Route deleted", "success");
            init();
        } else throw new Error(data.error);
    } catch (err) { showToast("Delete failed", "error"); }
}


function switchView(viewName) {
    ["studentSection", "adminSection", "driverSection"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove("section-visible"); el.classList.add("section-hidden"); }
    });
    const target = document.getElementById(viewName.toLowerCase() + "Section");
    if (target) { target.classList.remove("section-hidden"); target.classList.add("section-visible"); }
    document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    const pill = document.getElementById("pill" + viewName);
    if (pill) pill.classList.add("active");
}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0"; toast.style.transform = "translateY(10px)"; toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function updateStats() {
    if (routes.length === 0) return;
    document.getElementById("statTotalRoutes").innerText = routes.length;
    if (document.getElementById("statRoutesBadge")) document.getElementById("statRoutesBadge").innerText = routes.length;
    document.getElementById("adminTotalRoutes").innerText = routes.length;
    const sorted = [...routes].sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    document.getElementById("statEarliest").innerText = sorted[0].start || "N/A";
    document.getElementById("statLatest").innerText = sorted[sorted.length - 1].start || "N/A";
}

window.showStops = function (routeNo) {
    const modal = document.getElementById("stopsModal"), body = document.getElementById("stopsModalBody"), title = document.getElementById("stopsModalTitle");
    if (!modal || !body) return;
    const route = routes.find(r => r.routeNo === routeNo);
    title.innerText = `Stoppings for ${routeNo}${route ? ` • ${route.routeName}` : ""}`;
    modal.classList.remove("hidden");
    const stops = routeStops[routeNo] || [];
    if (stops.length > 0) {
        body.innerHTML = `<table class="stops-table"><thead><tr><th width="40">#</th><th>STOP</th><th style="text-align: right;">TIME</th></tr></thead><tbody>${stops.map((s, idx) => `<tr><td class="text-muted">${idx + 1}</td><td><strong>${s.stop}</strong></td><td style="text-align: right;"><span class="badge badge-secondary">${s.time}</span></td></tr>`).join("")}</tbody></table>`;
    } else body.innerHTML = "<p class='text-muted' style='text-align: center; padding: 20px;'>No stopping data available.</p>";
}

init();