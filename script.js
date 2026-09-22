import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, setDoc, deleteDoc, getDocs, updateDoc, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Paste your Firebase Config here!
const firebaseConfig = {
    apiKey: "AIzaSyC4nP0HVlsAr7Rg1NxwJJkiD2sKNSGHgJc",
    authDomain: "class-resource-hub-fed71.firebaseapp.com",
    projectId: "class-resource-hub-fed71",
    storageBucket: "class-resource-hub-fed71.firebasestorage.app",
    messagingSenderId: "88256561576",
    appId: "1:88256561576:web:1eff14bc04711907dedd9d",
    measurementId: "G-8XL7TCJLDR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loadingScreen = document.getElementById('loading-screen');
const authSection = document.getElementById('auth-section');
const onboardingSection = document.getElementById('onboarding-section');
const pendingSection = document.getElementById('pending-section');
const maintenanceSection = document.getElementById('maintenance-section');
const dashboardSection = document.getElementById('dashboard-section');
const uploadBox = document.getElementById('upload-box');
const adminTab = document.getElementById('tab-admin');
const resourceList = document.getElementById('resource-list');
const studentList = document.getElementById('student-list');
const pendingList = document.getElementById('pending-list');
const pendingRequestsContainer = document.getElementById('pending-requests-container');
const userInfo = document.getElementById('user-info');

let currentUserData = null;
let pendingUserAuth = null; 
let profileListener = null;
let settingsListener = null;
let systemSettings = { maintenanceMode: false, categories: ["Physics", "Chemistry", "Math", "General"] };
let currentFilter = "all";

// --- THEME TOGGLE ---
const themeToggle = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-theme'); themeToggle.textContent = '☀️'; }
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) { localStorage.setItem('theme', 'dark'); themeToggle.textContent = '☀️'; } 
    else { localStorage.setItem('theme', 'light'); themeToggle.textContent = '🌙'; }
});

function hideAllSections() {
    loadingScreen.classList.add('hidden'); authSection.classList.add('hidden'); onboardingSection.classList.add('hidden');
    pendingSection.classList.add('hidden'); maintenanceSection.classList.add('hidden'); dashboardSection.classList.add('hidden');
}

// --- AUTH & SYSTEM LISTENER ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        profileListener = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                currentUserData = docSnap.data();
                if (currentUserData.isBanned) { alert("Your account has been banned."); signOut(auth); return; }
                if (currentUserData.status === "pending") { hideAllSections(); pendingSection.classList.remove('hidden'); } 
                else if (currentUserData.status === "approved" || currentUserData.role === "admin") { initializeSystem(); }
            } else {
                pendingUserAuth = user; hideAllSections(); onboardingSection.classList.remove('hidden');
            }
        });
    } else {
        if (profileListener) profileListener(); if (settingsListener) settingsListener();
        hideAllSections(); authSection.classList.remove('hidden'); userInfo.innerHTML = ''; currentUserData = null;
    }
});

function initializeSystem() {
    if (settingsListener) settingsListener();
    settingsListener = onSnapshot(doc(db, "settings", "system"), async (docSnap) => {
        if (!docSnap.exists()) { if (currentUserData.role === 'admin') { await setDoc(doc(db, "settings", "system"), systemSettings); } return; }
        systemSettings = docSnap.data(); updateCategoryUI();
        
        if (systemSettings.maintenanceMode && currentUserData.role !== 'admin') {
            hideAllSections(); maintenanceSection.classList.remove('hidden');
        } else {
            if (dashboardSection.classList.contains('hidden')) setupDashboard();
            const mBtn = document.getElementById('toggle-maintenance-btn');
            if (systemSettings.maintenanceMode) { mBtn.innerText = "Disable Maintenance"; mBtn.classList.add('maintenance-active'); } 
            else { mBtn.innerText = "Enable Maintenance"; mBtn.classList.remove('maintenance-active'); }
        }
    });
}

function updateCategoryUI() {
    const uploadSelect = document.getElementById('resource-category');
    const filterSelect = document.getElementById('feed-filter');
    const editSelect = document.getElementById('edit-resource-category');
    const adminCatList = document.getElementById('admin-category-list');
    
    uploadSelect.innerHTML = ''; filterSelect.innerHTML = '<option value="all">All Categories</option>';
    editSelect.innerHTML = ''; adminCatList.innerHTML = '';

    systemSettings.categories.forEach(cat => {
        uploadSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        filterSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        editSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        adminCatList.innerHTML += `<div class="admin-cat-tag">${cat} <button class="delete-cat-btn" data-cat="${cat}">×</button></div>`;
    });
    filterSelect.value = currentFilter; 
}

// --- PROFILE SETTINGS & MODALS ---
document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value; const username = document.getElementById('profile-username').value;
    const grade = document.getElementById('profile-grade').value; const section = document.getElementById('profile-section').value;
    if (name && username && grade && section && pendingUserAuth) {
        const newUserData = { email: pendingUserAuth.email, name, username, classSection: `Class ${grade} ${section}`, accessGrades: [grade], role: "student", canUpload: false, isBanned: false, status: "pending" };
        await setDoc(doc(db, "users", pendingUserAuth.uid), newUserData);
    } else alert("Please fill in all profile fields.");
});

function closeModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('profile-modal').classList.add('hidden');
    document.getElementById('resource-modal').classList.add('hidden');
}

document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeModals));
document.getElementById('modal-overlay').addEventListener('click', closeModals);

// Submit Profile Edit
document.getElementById('submit-profile-edit').addEventListener('click', async () => {
    const newUsername = document.getElementById('edit-username').value.trim();
    const newName = document.getElementById('edit-name').value.trim();
    const newGrade = document.getElementById('edit-grade').value;
    const newSection = document.getElementById('edit-section').value.trim();
    const newClassSection = `Class ${newGrade} ${newSection}`;
    
    let updates = {};
    let requiresApproval = false;

    if (newUsername !== currentUserData.username && newUsername !== "") updates.username = newUsername;
    
    if (newName !== currentUserData.name || newClassSection !== currentUserData.classSection) {
        updates.pendingUpdate = { name: newName, grade: newGrade, section: newSection, classSection: newClassSection };
        requiresApproval = true;
    }
    
    if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), updates);
        alert(requiresApproval ? "Username updated! Name/Class changes sent to Admin for approval." : "Profile updated successfully!");
    }
    closeModals();
});

// --- DASHBOARD SETUP ---
function setupDashboard() {
    hideAllSections(); dashboardSection.classList.remove('hidden');
    
    // User Info Panel with Settings Gear
    userInfo.innerHTML = `
        <span style="font-weight:600;">@${currentUserData.username}</span> 
        <button id="profile-settings-btn" class="icon-btn" style="font-size: 1.1rem; padding: 0 5px;" title="Profile Settings">⚙️</button>
        <button id="logout-btn" class="secondary" style="margin-left:10px; padding: 0.4rem 0.8rem;">Logout</button>
    `;
    
    document.getElementById('logout-btn').addEventListener('click', () => { localStorage.removeItem('activeTab'); signOut(auth); });
    
    // Open Profile Settings Modal
    document.getElementById('profile-settings-btn').addEventListener('click', () => {
        document.getElementById('edit-username').value = currentUserData.username;
        document.getElementById('edit-name').value = currentUserData.name;
        const match = currentUserData.classSection.match(/Class (\d+) (.*)/);
        if (match) { document.getElementById('edit-grade').value = match[1]; document.getElementById('edit-section').value = match[2]; }
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('profile-modal').classList.remove('hidden');
    });

    if (currentUserData.role === 'admin' || currentUserData.canUpload) uploadBox.classList.remove('hidden'); else uploadBox.classList.add('hidden');
    if (currentUserData.role === 'admin') { adminTab.classList.remove('hidden'); loadAdminPanel(); }
    
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab === 'admin' && currentUserData.role === 'admin') {
        document.getElementById('admin-view').classList.remove('hidden'); document.getElementById('feed-view').classList.add('hidden');
        adminTab.classList.add('active'); document.getElementById('tab-feed').classList.remove('active');
    } else {
        document.getElementById('feed-view').classList.remove('hidden'); document.getElementById('admin-view').classList.add('hidden');
        document.getElementById('tab-feed').classList.add('active'); adminTab.classList.remove('active');
    }
    loadResources();
}

// --- RESOURCE FEED & EDITING ---
document.getElementById('feed-filter').addEventListener('change', (e) => { currentFilter = e.target.value; loadResources(); });
document.getElementById('refresh-feed-btn').addEventListener('click', (e) => {
    const btn = e.currentTarget; btn.classList.add('spin-anim');
    setTimeout(() => btn.classList.remove('spin-anim'), 500); loadResources(); 
});

let resourcesUnsubscribe = null;
function loadResources() {
    if (resourcesUnsubscribe) resourcesUnsubscribe();
    resourcesUnsubscribe = onSnapshot(collection(db, "resources"), (snapshot) => {
        resourceList.innerHTML = '';
        snapshot.forEach((firestoreDoc) => {
            const data = firestoreDoc.data();
            const target = data.targetGrade || "both"; 
            const category = data.category || "General";
            const userGrades = currentUserData.accessGrades || [];
            
            let hasAccess = false;
            if (currentUserData.role === 'admin' || target === 'both' || userGrades.includes(target)) hasAccess = true;
            if (currentFilter !== "all" && category !== currentFilter) hasAccess = false;

            if (hasAccess) {
                let badgeHtml = '';
                if (target === '11') badgeHtml = `<span class="badge class-11">Class 11</span>`;
                else if (target === '12') badgeHtml = `<span class="badge class-12">Class 12</span>`;
                else badgeHtml = `<span class="badge class-both">Class 11 & 12</span>`;

                let actionBtnsHtml = '';
                if (currentUserData && (currentUserData.username === data.uploadedByUsername || currentUserData.role === 'admin')) {
                    actionBtnsHtml = `
                        <div style="margin-top: 15px;">
                            <button class="edit-resource-btn" data-id="${firestoreDoc.id}" data-title="${data.title}" data-grade="${target}" data-category="${category}" style="background: #f59e0b; padding: 0.4rem 0.8rem; font-size: 0.85rem; margin-right: 5px;">Edit</button>
                            <button class="delete-btn" data-id="${firestoreDoc.id}" style="background: var(--danger); padding: 0.4rem 0.8rem; font-size: 0.85rem;">Delete</button>
                        </div>
                    `;
                }

                resourceList.innerHTML += `
                    <div class="resource-card" style="animation-delay: 0.1s;">
                        ${badgeHtml} <span class="badge category">${category}</span>
                        <h4>${data.title}</h4>
                        <a href="${data.url}" target="_blank">View Resource</a>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">
                            Shared by: <strong>@${data.uploadedByUsername}</strong> | ${data.uploadedByClass}
                        </p>
                        ${actionBtnsHtml}
                    </div>
                `;
            }
        });
    });
}

// Handle Edit/Delete Clicks in Feed
resourceList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        if (confirm("Are you sure you want to delete this resource?")) await deleteDoc(doc(db, "resources", e.target.getAttribute('data-id')));
    }
    if (e.target.classList.contains('edit-resource-btn')) {
        document.getElementById('edit-resource-id').value = e.target.getAttribute('data-id');
        document.getElementById('edit-resource-title').value = e.target.getAttribute('data-title');
        document.getElementById('edit-resource-grade').value = e.target.getAttribute('data-grade');
        document.getElementById('edit-resource-category').value = e.target.getAttribute('data-category');
        
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('resource-modal').classList.remove('hidden');
    }
});

// Submit Resource Edit
document.getElementById('submit-resource-edit').addEventListener('click', async () => {
    const docId = document.getElementById('edit-resource-id').value;
    const newTitle = document.getElementById('edit-resource-title').value;
    const newGrade = document.getElementById('edit-resource-grade').value;
    const newCategory = document.getElementById('edit-resource-category').value;
    
    if (newTitle) {
        await updateDoc(doc(db, "resources", docId), { title: newTitle, targetGrade: newGrade, category: newCategory });
        closeModals();
    }
});

// --- ADMIN PANEL LOGIC ---
document.getElementById('toggle-maintenance-btn').addEventListener('click', async () => {
    try { await setDoc(doc(db, "settings", "system"), { maintenanceMode: !systemSettings.maintenanceMode }, { merge: true }); } 
    catch (error) { alert("Error: " + error.message); }
});

document.getElementById('add-category-btn').addEventListener('click', async () => {
    try {
        const input = document.getElementById('new-category-input'); const newCat = input.value.trim();
        if (newCat) { await setDoc(doc(db, "settings", "system"), { categories: arrayUnion(newCat) }, { merge: true }); input.value = ''; }
    } catch (error) { alert("Error: " + error.message); }
});

document.getElementById('admin-category-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-cat-btn')) {
        const cat = e.target.getAttribute('data-cat');
        if(confirm(`Remove category "${cat}"?`)) await updateDoc(doc(db, "settings", "system"), { categories: arrayRemove(cat) });
    }
});

// Load Students & Pending Profile Updates
async function loadAdminPanel() {
    const usersSnapshot = await getDocs(collection(db, "users"));
    studentList.innerHTML = ''; pendingList.innerHTML = '';
    let studentCount = 0; let pendingCount = 0;
    
    usersSnapshot.forEach((userDoc) => {
        const user = userDoc.data(); const userId = userDoc.id;
        if (user.role !== 'admin' && !user.isBanned) {
            if (user.status === "pending") {
                pendingCount++;
                pendingList.innerHTML += `
                    <div class="student-row" style="border-left: 4px solid #f59e0b;">
                        <div class="student-info"><strong>${user.name} (@${user.username})</strong><span>${user.classSection} | Email: ${user.email}</span></div>
                        <div><button class="approve-btn" data-uid="${userId}">Approve</button><button class="deny-btn" data-uid="${userId}">Deny</button></div>
                    </div>`;
            } else if (user.status === "approved") {
                studentCount++;
                const isGranted = user.canUpload;
                const userGrades = user.accessGrades || [];
                const class11Active = userGrades.includes('11') ? 'access-granted' : '';
                const class12Active = userGrades.includes('12') ? 'access-granted' : '';
                
                // Show Pending Profile Edit Request if exists
                let pendingEditHtml = '';
                if (user.pendingUpdate) {
                    pendingEditHtml = `
                        <div style="background: rgba(245, 158, 11, 0.1); border: 1px dashed #f59e0b; padding: 10px; margin-top: 10px; border-radius: 8px;">
                            <strong style="color: #f59e0b; font-size: 0.8rem;">Review Requested Profile Change:</strong><br>
                            <span style="font-size: 0.85rem; display:block; margin-bottom: 5px;">Change to: <strong>${user.pendingUpdate.name}</strong> | <strong>${user.pendingUpdate.classSection}</strong></span>
                            <button class="approve-profile-btn" data-uid="${userId}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Approve Change</button>
                            <button class="deny-profile-btn" data-uid="${userId}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; background: transparent; border: 1px solid var(--danger); color: var(--danger);">Deny</button>
                        </div>
                    `;
                }

                studentList.innerHTML += `
                    <div class="student-row" style="flex-direction: column; align-items: stretch;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="student-info">
                                <strong>${user.name} (@${user.username})</strong><span>${user.classSection} | Email: ${user.email}</span>
                                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                                    <span style="font-size: 0.8rem; font-weight:600; margin-right: 5px;">Feed Access:</span>
                                    <button class="access-btn grade-toggle ${class11Active}" data-uid="${userId}" data-grade="11" data-current='${JSON.stringify(userGrades)}'>11th</button>
                                    <button class="access-btn grade-toggle ${class12Active}" data-uid="${userId}" data-grade="12" data-current='${JSON.stringify(userGrades)}'>12th</button>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <button class="access-btn upload-toggle ${isGranted ? 'access-granted' : ''}" data-uid="${userId}" data-status="${isGranted}">${isGranted ? 'Revoke Upload' : 'Grant Upload'}</button>
                                <button class="ban-btn" data-uid="${userId}" data-banned="false">Ban</button>
                            </div>
                        </div>
                        ${pendingEditHtml}
                    </div>`;
            }
        } else if (user.isBanned && user.role !== 'admin') {
            studentList.innerHTML += `
                <div class="student-row student-banned">
                    <div class="student-info"><strong>${user.name} (@${user.username}) <span style="color:var(--danger);">(BANNED)</span></strong><span>${user.classSection} | Email: ${user.email}</span></div>
                    <div><button class="access-btn" disabled style="opacity:0.5">Upload Revoked</button><button class="ban-btn unban" data-uid="${userId}" data-banned="true">Unban User</button></div>
                </div>`;
        }
    });
    
    document.getElementById('stat-students').innerText = `${studentCount} Approved Students`;
    if (pendingCount > 0) pendingRequestsContainer.classList.remove('hidden'); else pendingRequestsContainer.classList.add('hidden');
}

// Student Action Buttons (Including new Profile Request Handlers)
document.getElementById('admin-view').addEventListener('click', async (e) => {
    // Approve/Deny Profile Edit Request
    if (e.target.classList.contains('approve-profile-btn')) {
        const uid = e.target.getAttribute('data-uid');
        const userDoc = await getDoc(doc(db, "users", uid));
        const pending = userDoc.data().pendingUpdate;
        e.target.innerText = "Updating...";
        await updateDoc(doc(db, "users", uid), {
            name: pending.name, classSection: pending.classSection,
            accessGrades: arrayUnion(pending.grade), // Ensure they get feed access to their new grade
            pendingUpdate: deleteField() // Remove the request box
        });
        loadAdminPanel();
    }
    if (e.target.classList.contains('deny-profile-btn')) {
        const uid = e.target.getAttribute('data-uid'); e.target.innerText = "Denying...";
        await updateDoc(doc(db, "users", uid), { pendingUpdate: deleteField() }); loadAdminPanel();
    }
    
    // Existing Admin Controls
    if (e.target.classList.contains('approve-btn')) { e.target.innerText = "..."; await updateDoc(doc(db, "users", e.target.getAttribute('data-uid')), { status: "approved" }); loadAdminPanel(); }
    if (e.target.classList.contains('deny-btn')) { e.target.innerText = "..."; await updateDoc(doc(db, "users", e.target.getAttribute('data-uid')), { isBanned: true }); loadAdminPanel(); }
    if (e.target.classList.contains('upload-toggle') && !e.target.disabled) {
        const uid = e.target.getAttribute('data-uid'); const currentStatus = e.target.getAttribute('data-status') === 'true';
        e.target.innerText = "..."; await updateDoc(doc(db, "users", uid), { canUpload: !currentStatus }); loadAdminPanel();
    }
    if (e.target.classList.contains('grade-toggle')) {
        const uid = e.target.getAttribute('data-uid'); const targetGrade = e.target.getAttribute('data-grade');
        let currentGrades = JSON.parse(e.target.getAttribute('data-current'));
        if (currentGrades.includes(targetGrade)) {
            if (currentGrades.length === 1) { alert("A student must have access to at least one feed!"); return; }
            currentGrades = currentGrades.filter(g => g !== targetGrade);
        } else currentGrades.push(targetGrade);
        e.target.innerText = "..."; await updateDoc(doc(db, "users", uid), { accessGrades: currentGrades }); loadAdminPanel();
    }
    if (e.target.classList.contains('ban-btn')) {
        const uid = e.target.getAttribute('data-uid'); const currentBannedStatus = e.target.getAttribute('data-banned') === 'true';
        if (confirm(currentBannedStatus ? "Allow this student back into the portal?" : "Are you sure you want to ban this student?")) {
            e.target.innerText = "..."; await updateDoc(doc(db, "users", uid), { isBanned: !currentBannedStatus, canUpload: false, status: currentBannedStatus ? "approved" : "rejected" }); loadAdminPanel();
        }
    }
});

// --- CLOUDINARY UPLOAD LOGIC ---
document.getElementById('upload-btn').addEventListener('click', async () => {
    const title = document.getElementById('resource-title').value;
    const targetGrade = document.getElementById('resource-grade').value; 
    const category = document.getElementById('resource-category').value; 
    const file = document.getElementById('resource-file').files[0];
    const uploadBtn = document.getElementById('upload-btn');
    const progressDiv = document.getElementById('upload-progress');

    if (title && file && currentUserData) {
        uploadBtn.disabled = true; uploadBtn.style.opacity = '0.5';
        progressDiv.classList.remove('hidden'); document.getElementById('progress-text').innerText = "Uploading to cloud...";

        const cloudName = "aqqngm6u"; 
        const uploadPreset = "YOUR_UPLOAD_PRESET"; // TODO: PASTE YOUR ACTUAL CLOUDINARY PRESET HERE

        const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", uploadPreset);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: formData });
            const data = await response.json();
            if (data.secure_url) {
                await addDoc(collection(db, "resources"), {
                    title, url: data.secure_url, fileName: file.name, targetGrade: targetGrade, category: category,
                    uploadedByUsername: currentUserData.username, uploadedByClass: currentUserData.classSection, timestamp: new Date()
                });
                document.getElementById('resource-title').value = ''; document.getElementById('resource-file').value = '';
                uploadBtn.disabled = false; uploadBtn.style.opacity = '1'; progressDiv.classList.add('hidden');
            } else throw new Error("Upload failed");
        } catch (error) { alert("Upload failed! Check console."); uploadBtn.disabled = false; uploadBtn.style.opacity = '1'; progressDiv.classList.add('hidden'); }
    } else alert("Please provide a title and select a file!");
});

document.getElementById('google-btn').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()).catch(err => console.error("Login Error:", err)));
document.getElementById('logout-pending-btn').addEventListener('click', () => signOut(auth));
document.getElementById('logout-maintenance-btn').addEventListener('click', () => signOut(auth));

document.getElementById('tab-feed').addEventListener('click', (e) => {
    localStorage.setItem('activeTab', 'feed'); document.getElementById('feed-view').classList.remove('hidden'); document.getElementById('admin-view').classList.add('hidden');
    e.target.classList.add('active'); document.getElementById('tab-admin').classList.remove('active');
});

document.getElementById('tab-admin').addEventListener('click', (e) => {
    localStorage.setItem('activeTab', 'admin'); document.getElementById('admin-view').classList.remove('hidden'); document.getElementById('feed-view').classList.add('hidden');
    e.target.classList.add('active'); document.getElementById('tab-feed').classList.remove('active');
});

// ==========================================
// DYNAMIC CHEMISTRY MOLECULE BACKGROUND
// ==========================================
const canvas = document.getElementById('chem-canvas'); const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;
let particlesArray = []; const maxParticles = 60; const connectionDistance = 150; 
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
class Particle {
    constructor() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.size = Math.random() * 3 + 1; this.speedX = Math.random() * 1 - 0.5; this.speedY = Math.random() * 1 - 0.5; }
    update() { this.x += this.speedX; this.y += this.speedY; if (this.x < 0 || this.x > canvas.width) this.speedX *= -1; if (this.y < 0 || this.y > canvas.height) this.speedY *= -1; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = document.body.classList.contains('dark-theme') ? 'rgba(96, 165, 250, 0.5)' : 'rgba(59, 130, 246, 0.4)'; ctx.fill(); }
}
function init() { particlesArray = []; for (let i = 0; i < maxParticles; i++) particlesArray.push(new Particle()); }
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); const bondColor = document.body.classList.contains('dark-theme') ? '96, 165, 250' : '59, 130, 246'; 
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update(); particlesArray[i].draw();
        for (let j = i; j < particlesArray.length; j++) {
            const dx = particlesArray[i].x - particlesArray[j].x; const dy = particlesArray[i].y - particlesArray[j].y; const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < connectionDistance) {
                const opacity = 1 - (distance / connectionDistance); ctx.beginPath(); ctx.strokeStyle = `rgba(${bondColor}, ${opacity * 0.5})`; ctx.lineWidth = 1; ctx.moveTo(particlesArray[i].x, particlesArray[i].y); ctx.lineTo(particlesArray[j].x, particlesArray[j].y); ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animate);
}
init(); animate();
