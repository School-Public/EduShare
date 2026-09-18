import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, setDoc, deleteDoc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// DOM Elements
const authSection = document.getElementById('auth-section');
const onboardingSection = document.getElementById('onboarding-section');
const pendingSection = document.getElementById('pending-section');
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

// --- THEME TOGGLE ---
const themeToggle = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '☀️';
}
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) {
        localStorage.setItem('theme', 'dark');
        themeToggle.textContent = '☀️';
    } else {
        localStorage.setItem('theme', 'light');
        themeToggle.textContent = '🌙';
    }
});

function hideAllSections() {
    authSection.classList.add('hidden');
    onboardingSection.classList.add('hidden');
    pendingSection.classList.add('hidden');
    dashboardSection.classList.add('hidden');
}

// --- AUTH STATE & ONBOARDING ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        profileListener = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                currentUserData = docSnap.data();
                
                if (currentUserData.isBanned) {
                    alert("Your account has been banned or your access request was denied.");
                    signOut(auth);
                    return;
                }
                
                if (currentUserData.status === "pending") {
                    hideAllSections();
                    pendingSection.classList.remove('hidden');
                } else if (currentUserData.status === "approved" || currentUserData.role === "admin") {
                    hideAllSections();
                    setupDashboard();
                }
            } else {
                pendingUserAuth = user;
                hideAllSections();
                onboardingSection.classList.remove('hidden');
            }
        });
    } else {
        if (profileListener) profileListener(); 
        hideAllSections();
        authSection.classList.remove('hidden');
        userInfo.innerHTML = '';
        currentUserData = null;
    }
});

document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value;
    const username = document.getElementById('profile-username').value;
    const classSec = document.getElementById('profile-class').value;

    if (name && username && classSec && pendingUserAuth) {
        const newUserData = { email: pendingUserAuth.email, name, username, classSection: classSec, role: "student", canUpload: false, isBanned: false, status: "pending" };
        await setDoc(doc(db, "users", pendingUserAuth.uid), newUserData);
    } else {
        alert("Please fill in all profile fields to request access.");
    }
});

document.getElementById('logout-pending-btn').addEventListener('click', () => signOut(auth));

function setupDashboard() {
    dashboardSection.classList.remove('hidden');
    
    userInfo.innerHTML = `
        <span style="font-weight:600;">@${currentUserData.username}</span> 
        <button id="logout-btn" class="secondary" style="margin-left:10px; padding: 0.4rem 0.8rem;">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

    if (currentUserData.role === 'admin' || currentUserData.canUpload === true) {
        uploadBox.classList.remove('hidden');
    } else {
        uploadBox.classList.add('hidden');
    }

    if (currentUserData.role === 'admin') {
        adminTab.classList.remove('hidden');
        loadAdminPanel(); 
    }
    
    loadResources();
}

// --- LOAD RESOURCES ---
let resourcesUnsubscribe = null;
function loadResources() {
    if (resourcesUnsubscribe) resourcesUnsubscribe();
    resourcesUnsubscribe = onSnapshot(collection(db, "resources"), (snapshot) => {
        resourceList.innerHTML = '';
        snapshot.forEach((firestoreDoc) => {
            const data = firestoreDoc.data();
            let deleteBtnHtml = '';
            if (currentUserData && (currentUserData.username === data.uploadedByUsername || currentUserData.role === 'admin')) {
                deleteBtnHtml = `<button class="delete-btn" data-id="${firestoreDoc.id}" style="background: var(--danger); padding: 0.4rem 0.8rem; font-size: 0.85rem; margin-top: 15px;">Delete</button>`;
            }

            resourceList.innerHTML += `
                <div class="resource-card" style="animation-delay: 0.1s;">
                    <h4>${data.title}</h4>
                    <a href="${data.url}" target="_blank">View Resource</a>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">
                        Shared by: <strong>@${data.uploadedByUsername}</strong> | ${data.uploadedByClass}
                    </p>
                    ${deleteBtnHtml}
                </div>
            `;
        });
    });
}

resourceList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        if (confirm("Are you sure you want to delete this resource?")) {
            await deleteDoc(doc(db, "resources", e.target.getAttribute('data-id')));
        }
    }
});

// --- ADMIN PANEL LOGIC ---
async function loadAdminPanel() {
    const usersSnapshot = await getDocs(collection(db, "users"));
    studentList.innerHTML = '';
    pendingList.innerHTML = '';
    
    let studentCount = 0;
    let pendingCount = 0;
    
    usersSnapshot.forEach((userDoc) => {
        const user = userDoc.data();
        const userId = userDoc.id;
        
        if (user.role !== 'admin' && !user.isBanned) {
            if (user.status === "pending") {
                pendingCount++;
                pendingList.innerHTML += `
                    <div class="student-row" style="border-left: 4px solid #f59e0b;">
                        <div class="student-info">
                            <strong>${user.name} (@${user.username})</strong>
                            <span>Class: ${user.classSection} | Email: ${user.email}</span>
                        </div>
                        <div>
                            <button class="approve-btn" data-uid="${userId}">Approve</button>
                            <button class="deny-btn" data-uid="${userId}">Deny</button>
                        </div>
                    </div>
                `;
            } else if (user.status === "approved") {
                studentCount++;
                const isGranted = user.canUpload;
                const accessBtnClass = isGranted ? 'access-granted' : '';
                const accessBtnText = isGranted ? 'Revoke Upload' : 'Grant Upload';

                studentList.innerHTML += `
                    <div class="student-row">
                        <div class="student-info">
                            <strong>${user.name} (@${user.username})</strong>
                            <span>Class: ${user.classSection} | Email: ${user.email}</span>
                        </div>
                        <div>
                            <button class="access-btn ${accessBtnClass}" data-uid="${userId}" data-status="${isGranted}">${accessBtnText}</button>
                            <button class="ban-btn" data-uid="${userId}" data-banned="false">Ban</button>
                        </div>
                    </div>
                `;
            }
        } else if (user.isBanned && user.role !== 'admin') {
            studentList.innerHTML += `
                <div class="student-row student-banned">
                    <div class="student-info">
                        <strong>${user.name} (@${user.username}) <span style="color:var(--danger);">(BANNED)</span></strong>
                        <span>Class: ${user.classSection} | Email: ${user.email}</span>
                    </div>
                    <div>
                        <button class="access-btn" disabled style="opacity:0.5">Upload Revoked</button>
                        <button class="ban-btn unban" data-uid="${userId}" data-banned="true">Unban User</button>
                    </div>
                </div>
            `;
        }
    });
    
    document.getElementById('stat-students').innerText = `${studentCount} Approved Students`;
    if (pendingCount > 0) pendingRequestsContainer.classList.remove('hidden');
    else pendingRequestsContainer.classList.add('hidden');
}

document.getElementById('admin-view').addEventListener('click', async (e) => {
    if (e.target.classList.contains('approve-btn')) {
        e.target.innerText = "Approving...";
        await updateDoc(doc(db, "users", e.target.getAttribute('data-uid')), { status: "approved" });
        loadAdminPanel();
    }
    
    if (e.target.classList.contains('deny-btn')) {
        e.target.innerText = "Denying...";
        await updateDoc(doc(db, "users", e.target.getAttribute('data-uid')), { isBanned: true });
        loadAdminPanel();
    }

    if (e.target.classList.contains('access-btn') && !e.target.disabled) {
        const uid = e.target.getAttribute('data-uid');
        const currentStatus = e.target.getAttribute('data-status') === 'true';
        e.target.innerText = "Updating...";
        await updateDoc(doc(db, "users", uid), { canUpload: !currentStatus });
        loadAdminPanel();
    }
    
    if (e.target.classList.contains('ban-btn')) {
        const uid = e.target.getAttribute('data-uid');
        const currentBannedStatus = e.target.getAttribute('data-banned') === 'true';
        const confirmMsg = currentBannedStatus ? "Allow this student back into the portal?" : "Are you sure you want to ban this student?";
            
        if (confirm(confirmMsg)) {
            e.target.innerText = "Updating...";
            await updateDoc(doc(db, "users", uid), { isBanned: !currentBannedStatus, canUpload: false, status: currentBannedStatus ? "approved" : "rejected" });
            loadAdminPanel();
        }
    }
});

// --- CLOUDINARY UPLOAD LOGIC ---
document.getElementById('upload-btn').addEventListener('click', async () => {
    const title = document.getElementById('resource-title').value;
    const file = document.getElementById('resource-file').files[0];
    const uploadBtn = document.getElementById('upload-btn');
    const progressDiv = document.getElementById('upload-progress');

    if (title && file && currentUserData) {
        uploadBtn.disabled = true; uploadBtn.style.opacity = '0.5';
        progressDiv.classList.remove('hidden'); document.getElementById('progress-text').innerText = "Uploading to cloud...";

        const cloudName = "aqqngm6u"; 
        const uploadPreset = "class_hub_preset"; // TODO: PASTE YOUR CLOUDINARY PRESET HERE

        const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", uploadPreset);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: formData });
            const data = await response.json();
            if (data.secure_url) {
                await addDoc(collection(db, "resources"), {
                    title, url: data.secure_url, fileName: file.name,
                    uploadedByUsername: currentUserData.username, uploadedByClass: currentUserData.classSection, timestamp: new Date()
                });
                document.getElementById('resource-title').value = ''; document.getElementById('resource-file').value = '';
                uploadBtn.disabled = false; uploadBtn.style.opacity = '1'; progressDiv.classList.add('hidden');
            } else throw new Error("Upload failed");
        } catch (error) {
            alert("Upload failed! Check console.");
            uploadBtn.disabled = false; uploadBtn.style.opacity = '1'; progressDiv.classList.add('hidden');
        }
    } else alert("Please provide a title and select a file!");
});

// --- GOOGLE SIGN IN ONLY ---
document.getElementById('google-btn').addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => console.error("Google Login Error:", err));
});

// Switch Tabs
document.getElementById('tab-feed').addEventListener('click', (e) => {
    document.getElementById('feed-view').classList.remove('hidden'); document.getElementById('admin-view').classList.add('hidden');
    e.target.classList.add('active'); document.getElementById('tab-admin').classList.remove('active');
});
document.getElementById('tab-admin').addEventListener('click', (e) => {
    document.getElementById('admin-view').classList.remove('hidden'); document.getElementById('feed-view').classList.add('hidden');
    e.target.classList.add('active'); document.getElementById('tab-feed').classList.remove('active');
});

// ==========================================
// DYNAMIC CHEMISTRY MOLECULE BACKGROUND
// ==========================================
const canvas = document.getElementById('chem-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];
const maxParticles = 60; // Adjust for density
const connectionDistance = 150; // How close atoms need to be to draw a bond

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1; // Size of the atom
        this.speedX = Math.random() * 1 - 0.5; // Drift speed
        this.speedY = Math.random() * 1 - 0.5;
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Bounce off edges
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }
    
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        // Atom color (adapts to light/dark mode based on body class check during animation)
        const isDark = document.body.classList.contains('dark-theme');
        ctx.fillStyle = isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(59, 130, 246, 0.4)';
        ctx.fill();
    }
}

function init() {
    particlesArray = [];
    for (let i = 0; i < maxParticles; i++) {
        particlesArray.push(new Particle());
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.body.classList.contains('dark-theme');
    const bondColor = isDark ? '96, 165, 250' : '59, 130, 246'; // RGB values for the bond lines

    // Update and draw atoms
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
        
        // Check distance to all other atoms to draw bonds
        for (let j = i; j < particlesArray.length; j++) {
            const dx = particlesArray[i].x - particlesArray[j].x;
            const dy = particlesArray[i].y - particlesArray[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < connectionDistance) {
                // The closer they are, the more opaque the bond line
                const opacity = 1 - (distance / connectionDistance);
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${bondColor}, ${opacity * 0.5})`; // Keep it subtle (max 0.5 opacity)
                ctx.lineWidth = 1;
                ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
                ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animate);
}

init();
animate();