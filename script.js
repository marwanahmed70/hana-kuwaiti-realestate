import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// إعدادات Firebase الخاصة بمشروعك
const firebaseConfig = {
    apiKey: "AIzaSyCDpZYvH3K6SKl3RfPBhsa6tZNIPWugRSM",
    authDomain: "hanaelkuwaitiarealestate.firebaseapp.com",
    projectId: "hanaelkuwaitiarealestate",
    storageBucket: "hanaelkuwaitiarealestate.firebasestorage.app",
    messagingSenderId: "977437776988",
    appId: "1:977437776988:web:d2cbc1a51ee0ce7b669a99"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ربط الدوال وقاعدة البيانات بالنطاق العام (Window) لتعمل مع HTML
window.db = db;
window.collection = collection;
window.addDoc = addDoc;

// هيكل المحافظات والمدن في الكويت
const kuwaitLocations = {
    "مدينة المطلاع السكنية": ["المطلاع N1", "المطلاع N2", "المطلاع N3", "المطلاع N4", "المطلاع N5", "المطلاع N6", "المطلاع N7", "المطلاع N8", "المطلاع N9", "المطلاع N10", "المطلاع N11", "المطلاع N12"],
    "محافظة الجهراء": ["جابر الأحمد", "الجهراء القديمة", "النسيم", "العيون", "الواحة", "سعد العبدالله", "القصر", "نعيم", "كبد"],
    "محافظة العاصمة": ["مدينة الكويت", "شرق", "قبلة", "الشويخ", "بنيد القار", "الدعية", "القادسية", "المنصورية", "الفيحاء", "النزهة", "الخالدية", "كيفان", "اليرموك", "قرطبة", "السرة"],
    "محافظة حولي": ["حولي", "السالمية", "الجابرية", "رميثية", "بيان", "مشرف", "مبارك الكبير", "سلوى", "الزهراء", "الصديق", "السلام", "حطين", "الشهداء"],
    "محافظة الأحمدي": ["المنقف", "الفحيحيل", "أبو حليفة", "الرقة", "هدية", "الصباحية", "صباح الأحمد السكنية", "الخيران السكنية", "الوفرة السكنية", "عقيلة"],
    "محافظة الفروانية": ["الفروانية", "خيطان", "خيطان الجديدة", "الفردوس", "العارضية", "الأندلس", "جليب الشيوخ", "اشبيلية", "عبدالله المبارك", "غرب عبدالله المبارك"],
    "محافظة مبارك الكبير": ["مبارك الكبير", "العدان", "القصور", "القرين", "المسيلة", "أبو فطيرة", "الفنيطيس", "صباح السالم"]
};

// إدارة المستخدمين والصلاحيات
let users = JSON.parse(localStorage.getItem('kuwaiti_users')) || [
    { name: "حياه", role: "admin", password: "1234" },
    { name: "ابو عمر", role: "agent", password: "112005" },
    { name: "ابو صلاح", role: "agent", password: "1114" }
];

let currentUser = JSON.parse(localStorage.getItem('kuwaiti_current_user')) || null;

function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

function canModify(aptAgent) {
    if (!currentUser) return false;
    return isAdmin() || (currentUser.name === aptAgent);
}

let apartments = [];
let currentLocalVideoFile = null;

// IndexedDB لتخزين وفيديوهات المعاينة محلياً
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("RealEstateDB", 1);
        request.onerror = (event) => reject(event.target.error);
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains("videos")) {
                dbInstance.createObjectStore("videos", { keyPath: "id" });
            }
        };
    });
}

async function saveVideoToIndexedDB(id, fileBlob) {
    const dbInstance = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(["videos"], "readwrite");
        const store = transaction.objectStore("videos");
        const request = store.put({ id: id, blob: fileBlob });
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getVideoFromIndexedDB(id) {
    const dbInstance = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(["videos"], "readonly");
        const store = transaction.objectStore("videos");
        const request = store.get(id);
        request.onsuccess = (event) => {
            const result = event.target.result;
            if (result && result.blob) {
                resolve(URL.createObjectURL(result.blob));
            } else {
                resolve(null);
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

// مزامنة البيانات مع Firebase Firestore
async function fetchApartmentsFromCloud() {
    try {
        const querySnapshot = await getDocs(collection(db, "apartments"));
        apartments = [];
        querySnapshot.forEach((docSnap) => {
            apartments.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderApartmentsTable();
    } catch (e) {
        console.error("خطأ في جلب البيانات من السحاب:", e);
    }
}

async function saveApartmentToCloud(aptId, aptData) {
    try {
        await setDoc(doc(db, "apartments", aptId), aptData);
        await fetchApartmentsFromCloud();
    } catch (e) {
        console.error("خطأ في الحفظ على السحاب:", e);
        alert("حدث خطأ أثناء الحفظ بالسحاب.");
    }
}

async function deleteApartmentFromCloud(aptId) {
    try {
        await deleteDoc(doc(db, "apartments", aptId));
        await fetchApartmentsFromCloud();
    } catch (e) {
        console.error("خطأ في الحذف من السحاب:", e);
    }
}

// الأحداث والتهيئة عند تحميل الصفحةwindow.addEventListener('DOMContentLoaded', () => {
    initAuthModal();
    initLocationDropdowns();
    if (currentUser) {
        const authModal = document.getElementById('authModal');
        if(authModal) authModal.classList.add('hidden');
        setupUserInterface();
    }
    fetchApartmentsFromCloud();
});

function initAuthModal() {
    const select = document.getElementById('loginUserSelect');
    if (!select) {
        console.warn("لم يتم العثور على عنصر loginUserSelect في الصفحة");
        return;
    }
    
    select.innerHTML = users.map(u => `<option value="${u.name}">${u.name} ${u.role === 'admin' ? '(أدمن - الاء)' : '(مندوب)'}</option>`).join('');
    console.log("تم تحميل أسماء المستخدمين في نافذة الدخول بنجاح.");
}
window.LoginRole = function(role) {
    console.log("تم اختيار الدور:", role);
};

window.handleLogin = function(e) {
    e.preventDefault();
    const selectName = document.getElementById('loginUserSelect').value;
    const passwordInput = document.getElementById('userPasswordInput').value;
    const selectedUser = users.find(u => u.name === selectName);

    if (!selectedUser || selectedUser.password !== passwordInput) {
        alert("كلمة المرور غير صحيحة!");
        return;
    }

    currentUser = selectedUser;
    localStorage.setItem('kuwaiti_current_user', JSON.stringify(currentUser));
    document.getElementById('authModal').classList.add('hidden');
    setupUserInterface();
}

window.logout = function() {
    localStorage.removeItem('kuwaiti_current_user');
    location.reload();
}

function setupUserInterface() {
    const badge = document.getElementById('currentUserBadge');
    if (badge) badge.innerHTML = `<i class="fa-solid fa-user-check text-emerald-400"></i> ${currentUser.name} (${isAdmin() ? 'أدمن' : 'مندوب'})`;

    const adminBtn = document.getElementById('adminPanelBtnContainer');
    if (adminBtn) {
        if (isAdmin()) adminBtn.classList.remove('hidden');
        else adminBtn.classList.add('hidden');
    }

    const agentInput = document.getElementById('aptAgent');
    if (agentInput) agentInput.value = currentUser.name;

    renderApartmentsTable();
}

// إدارة الحسابات للأدمن
window.openUsersModal = function() {
    if (!isAdmin()) return;
    renderUsersList();
    document.getElementById('usersModal').classList.remove('hidden');
}

window.closeUsersModal = function() {
    document.getElementById('usersModal').classList.add('hidden');
}

function renderUsersList() {
    const container = document.getElementById('usersListContainer');
    if (!container) return;
    container.innerHTML = users.map((u, index) => `
        <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-bold">
            <div>${u.name} <span class="text-[10px] px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}">${u.role === 'admin' ? 'أدمن' : 'مندوب'}</span></div>
            ${u.name !== 'الاء' ? `<button onclick="deleteUser(${index})" class="text-rose-600 hover:text-rose-800"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
    `).join('');
}

window.addNewUser = function(e) {
    e.preventDefault();
    const name = document.getElementById('newUserName').value.trim();
    const role = document.getElementById('newUserRole').value;
    const password = document.getElementById('newUserPassword')?.value || "123";

    if (users.some(u => u.name === name)) {
        alert("هذا المستخدم موجود بالفعل!");
        return;
    }

    users.push({ name, role, password });
    localStorage.setItem('kuwaiti_users', JSON.stringify(users));
    initAuthModal();
    renderUsersList();
    document.getElementById('newUserName').value = '';
    alert("تم إضافة الحساب بنجاح!");
}

window.deleteUser = function(index) {
    if (confirm("هل أنت متأكد من حذف هذا الحساب؟")) {
        users.splice(index, 1);
        localStorage.setItem('kuwaiti_users', JSON.stringify(users));
        initAuthModal();
        renderUsersList();
    }
}

// تهيئة قوائم المحافظات
function initLocationDropdowns() {
    const govSelect = document.getElementById('governorateSelect');
    const filterGovSelect = document.getElementById('filterGovernorate');
    if (!govSelect || !filterGovSelect) return;

    govSelect.innerHTML = '';
    filterGovSelect.innerHTML = '<option value="">جميع المحافظات والمدن</option>';

    for(let gov in kuwaitLocations) {
        govSelect.appendChild(new Option(gov, gov));
        filterGovSelect.appendChild(new Option(gov, gov));
    }
    window.updateCityOptions();
}

window.updateCityOptions = function() {
    const selectedGov = document.getElementById('governorateSelect').value;
    const citySelect = document.getElementById('citySelect');
    if (!citySelect) return;
    citySelect.innerHTML = '';
    if(kuwaitLocations[selectedGov]) {
        kuwaitLocations[selectedGov].forEach(city => citySelect.appendChild(new Option(city, city)));
    }
}

window.toggleSwapFields = function() {
    const dealType = document.getElementById('dealType').value;
    const priceContainer = document.getElementById('priceContainer');
    const swapContainer = document.getElementById('swapContainer');
    if(!dealType || !priceContainer || !swapContainer) return;

    if(dealType === 'للبدل') {
        priceContainer.classList.add('hidden');
        swapContainer.classList.remove('hidden');
    } else {
        priceContainer.classList.remove('hidden');
        swapContainer.classList.add('hidden');
    }
}

window.handleLocalVideoSelect = function(event) {
    const file = event.target.files[0];
    if(file) {
        currentLocalVideoFile = file;
        const preview = document.getElementById('videoPreview');
        if(preview) {
            preview.src = URL.createObjectURL(file);
            document.getElementById('videoPreviewContainer').classList.remove('hidden');
        }
    }
}

window.switchTab = function(tabId) {
    ['apartments', 'add', 'inventory'].forEach(id => {
        const sec = document.getElementById(`section-${id}`);
        const tab = document.getElementById(`tab-${id}`);
        if(sec) sec.classList.add('hidden');
        if(tab) tab.className = "flex-1 py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-100";
    });
    
    const targetSec = document.getElementById(`section-${tabId}`);
    const targetTab = document.getElementById(`tab-${tabId}`);
    if(targetSec) targetSec.classList.remove('hidden');
    if(targetTab) targetTab.className = "flex-1 py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 bg-amber-500 text-slate-950 shadow-md font-bold";

    if(tabId === 'apartments') renderApartmentsTable();
    if(tabId === 'inventory') renderInventoryDashboard();
}

// عرض وتحديث جدول العقارات
function renderApartmentsTable() {
    const statusF = document.getElementById('filterStatus')?.value || '';
    const dealTypeF = document.getElementById('filterDealType')?.value || '';
    const propTypeF = document.getElementById('filterPropType')?.value || '';
    const govF = document.getElementById('filterGovernorate')?.value || '';
    const agentF = document.getElementById('filterAgent')?.value || '';
    const searchF = document.getElementById('filterSearch')?.value.toLowerCase() || '';

    const agents = [...new Set(apartments.map(a => a.agent))];
    const agentSelect = document.getElementById('filterAgent');
    if(agentSelect) {
        const currentAg = agentSelect.value;
        agentSelect.innerHTML = '<option value="">جميع المناديب</option>' + agents.map(ag => `<option value="${ag}">${ag}</option>`).join('');
        agentSelect.value = currentAg;
    }

    const tbody = document.getElementById('apartmentsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const filtered = apartments.filter(apt => {
        const matchStatus = !statusF || apt.status === statusF;
        const matchDeal = !dealTypeF || apt.dealType === dealTypeF;
        const matchProp = !propTypeF || apt.propType === propTypeF;
        const matchGov = !govF || apt.governorate === govF;
        const matchAgent = !agentF || apt.agent === agentF;
        const matchSearch = (apt.notes || '').toLowerCase().includes(searchF) || 
                            (apt.city || '').toLowerCase().includes(searchF) || 
                            (apt.ownerName || '').toLowerCase().includes(searchF) ||
                            (apt.agent || '').toLowerCase().includes(searchF);
        return matchStatus && matchDeal && matchProp && matchGov && matchAgent && matchSearch;
    });

    const resCount = document.getElementById('resultsCount');
    if(resCount) resCount.innerText = `عرض ${filtered.length} من إجمالي ${apartments.length} عقار بالشركة`;

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400 font-bold">لا توجد عقارات مطابقة للفلتر المطلوب</td></tr>`;
        renderMarqueeBar();
        return;
    }

    filtered.forEach((apt) => {
        let statusBadge = '';
        if (apt.status === 'متاحة') statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">متاح</span>';
        else if (apt.status === 'محجوزة') statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800">محجوز</span>';
        else statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800">مباع / تم البدل</span>';

        let dealBadge = '';
        if(apt.dealType === 'للبيع') dealBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800">للبيع</span>';
        else if(apt.dealType === 'للإيجار') dealBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800">للإيجار</span>';
        else dealBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-900">للبدل</span>';

        let priceOrSwapDisplay = apt.dealType === 'للبدل' ? 
            `<div class="text-xs space-y-1 bg-amber-50 p-2 rounded-lg border border-amber-200"><div class="text-amber-900 font-bold">الموفر: ${apt.swapOffered || '-'}</div></div>` : 
            `<span class="font-black text-slate-900 text-base">${Number(apt.price || 0).toLocaleString()} د.ك</span>`;

        let ownerInfoDisplay = `<div class="font-bold text-slate-800"><i class="fa-solid fa-user-tie text-amber-600"></i> ${apt.agent || '-'}</div>`;
        
        const canSeePhone = isAdmin() || (currentUser && apt.agent === currentUser.name);
        if (canSeePhone) {
            ownerInfoDisplay += `<div class="text-xs text-emerald-700 font-bold mt-1 bg-emerald-50 p-1.5 rounded border border-emerald-200"><i class="fa-solid fa-phone"></i> ${apt.ownerPhone || '-'} (${apt.ownerName || '-'})</div>`;
        } else {
            ownerInfoDisplay += `<div class="text-[11px] text-amber-800 font-bold mt-0.5 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block"><i class="fa-solid fa-lock"></i> محجوب</div>`;
        }

        const realIndex = apartments.findIndex(a => a.id === apt.id);
        const tr = document.createElement('tr');
        tr.className = apt.status === 'مباعة' ? "bg-slate-50/70 opacity-75 hover:bg-slate-100 cursor-pointer transition" : "hover:bg-slate-50 cursor-pointer transition";
        
        tr.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('a')) return;
            window.openApartmentDetails(realIndex);
        };

        let actionButtons = '';
        if (canModify(apt.agent)) {
            actionButtons = `
                <button onclick="editApartment('${apt.id}')" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition inline-flex items-center justify-center" title="تعديل"><i class="fa-solid fa-pen-to-square text-xs"></i></button>
                <button onclick="deleteApartment('${apt.id}')" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition inline-flex items-center justify-center" title="حذف"><i class="fa-solid fa-trash text-xs"></i></button>
            `;
        } else {
            actionButtons = `<span class="text-[10px] text-slate-400 font-bold">غير مسموح</span>`;
        }

        tr.innerHTML = `
            <td class="py-3.5 px-4 font-black text-slate-800">${apt.propType || '-'}</td>
            <td class="py-3.5 px-4">${statusBadge}</td>
            <td class="py-3.5 px-4">${dealBadge}</td>
            <td class="py-3.5 px-4 font-bold text-slate-700">${apt.governorate || '-'} <br><span class="text-xs font-medium text-amber-600">${apt.city || '-'}</span></td>
            <td class="py-3.5 px-4 text-slate-600 font-semibold">${apt.floor || '-'}</td>
            <td class="py-3.5 px-4">${priceOrSwapDisplay}</td>
            <td class="py-3.5 px-4">${ownerInfoDisplay}</td>
            <td class="py-3.5 px-4 text-center">
                ${apt.videoId ? `<button onclick="openApartmentDetails(${realIndex})" class="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1.5 rounded-xl font-black transition flex items-center gap-1 mx-auto shadow-sm"><i class="fa-solid fa-play"></i> المعاينة</button>` : '<span class="text-xs text-slate-400">بدون فيديو</span>'}
            </td>
            <td class="py-3.5 px-4 text-center space-x-1 space-x-reverse" onclick="event.stopPropagation()">
                ${actionButtons}
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderMarqueeBar();
}

window.resetFilters = function() {
    ['filterStatus', 'filterDealType', 'filterPropType', 'filterGovernorate', 'filterAgent', 'filterSearch'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    renderApartmentsTable();
}

// دالة الحفظ الرئيسية (handleAddProperty)
window.handleAddProperty = async function(e) {
    if(e && e.preventDefault) e.preventDefault();
    const editId = document.getElementById('editIndex')?.value || "";

    let existingOwnerPhone = "";
    let originalAgent = currentUser ? currentUser.name : "مندوب";
    let existingVideoId = "vid_" + Date.now();

    if (editId !== "") {
        const found = apartments.find(a => a.id === editId);
        if (found) {
            if (!canModify(found.agent)) {
                alert("عذراً، لا تملك صلاحية تعديل هذا العقار!");
                return;
            }
            existingOwnerPhone = found.ownerPhone || "";
            originalAgent = found.agent || originalAgent;
            existingVideoId = found.videoId || existingVideoId;
        }
    }                return;
            }
            existingOwnerPhone = found.ownerPhone || "";
            originalAgent = found.agent || originalAgent;
            existingVideoId = found.videoId || existingVideoId;
        }
    }

    const phoneInput = document.getElementById('ownerPhone');
    const finalPhone = (phoneInput && !phoneInput.disabled && phoneInput.value !== "محجوب") 
        ? phoneInput.value 
        : existingOwnerPhone;

    const aptId = editId !== "" ? editId : "apt_" + Date.now();
    let videoUniqueId = existingVideoId;

    if (currentLocalVideoFile) {
        await saveVideoToIndexedDB(videoUniqueId, currentLocalVideoFile);
    }

    const aptData = {
        ownerName: document.getElementById('ownerName')?.value || '',
        ownerPhone: finalPhone,
        dealType: document.getElementById('dealType')?.value || 'للبيع',
        propType: document.getElementById('propType')?.value || 'شقة',
        floor: document.getElementById('aptFloor')?.value || 'الأرضي',
        governorate: document.getElementById('governorateSelect')?.value || '',
        city: document.getElementById('citySelect')?.value || '',
        price: Number(document.getElementById('aptPrice')?.value) || 0,
        swapOffered: document.getElementById('swapOffered')?.value || '',
        swapRequired: document.getElementById('swapRequired')?.value || '',
        agent: originalAgent,
        status: document.getElementById('aptStatus')?.value || 'متاحة',
        videoId: videoUniqueId,
        notes: document.getElementById('aptNotes')?.value || ''
    };

    await saveApartmentToCloud(aptId, aptData);
    alert("تم حفظ العقار بنجاح بنظام الشركة!");

    const form = document.getElementById('apartmentForm');
    if(form) form.reset();
    if(phoneInput) phoneInput.disabled = false;

    currentLocalVideoFile = null;
    const previewCont = document.getElementById('videoPreviewContainer');
    if(previewCont) previewCont.classList.add('hidden');
    
    const editIdxElem = document.getElementById('editIndex');
    if(editIdxElem) editIdxElem.value = "";
    
    const formTitle = document.getElementById('formTitle');
    if(formTitle) formTitle.innerText = "إضافة عقار جديد لمكتب الكويتية للعقارات والمقاولات";
    
    setupUserInterface();
    window.switchTab('apartments');
}

window.editApartment = function(id) {
    const apt = apartments.find(a => a.id === id);
    if(!apt) return;

    if (!canModify(apt.agent)) {
        alert("عذراً، هذا العقار أضافه مندوب آخر ولا تملك صلاحية تعديله!");
        return;
    }

    const canSeePhone = isAdmin() || (currentUser && apt.agent === currentUser.name);

    const editIndexElem = document.getElementById('editIndex');
    if(editIndexElem) editIndexElem.value = apt.id;

    const ownerNameElem = document.getElementById('ownerName');
    if(ownerNameElem) ownerNameElem.value = apt.ownerName || '';
    
    const phoneInput = document.getElementById('ownerPhone');
    if (phoneInput) {
        if (canSeePhone) {
            phoneInput.value = apt.ownerPhone || '';
            phoneInput.disabled = false;
        } else {
            phoneInput.value = "محجوب";
            phoneInput.disabled = true;
        }
    }

    const dealTypeElem = document.getElementById('dealType');
    if(dealTypeElem) {
        dealTypeElem.value = apt.dealType;
        window.toggleSwapFields();
    }

    const propTypeElem = document.getElementById('propType');
    if(propTypeElem) propTypeElem.value = apt.propType;

    const floorElem = document.getElementById('aptFloor');
    if(floorElem) floorElem.value = apt.floor;

    const govElem = document.getElementById('governorateSelect');
    if(govElem) {
        govElem.value = apt.governorate;
        window.updateCityOptions();
    }

    const cityElem = document.getElementById('citySelect');
    if(cityElem) cityElem.value = apt.city;

    const priceElem = document.getElementById('aptPrice');
    if(priceElem) priceElem.value = apt.price || '';

    const swapOffElem = document.getElementById('swapOffered');
    if(swapOffElem) swapOffElem.value = apt.swapOffered || '';

    const swapReqElem = document.getElementById('swapRequired');
    if(swapReqElem) swapReqElem.value = apt.swapRequired || '';

    const agentElem = document.getElementById('aptAgent');
    if(agentElem) agentElem.value = apt.agent || (currentUser ? currentUser.name : '');

    const statusElem = document.getElementById('aptStatus');
    if(statusElem) statusElem.value = apt.status;

    const notesElem = document.getElementById('aptNotes');
    if(notesElem) notesElem.value = apt.notes || '';

    currentLocalVideoFile = null;
    if(apt.videoId) {
        getVideoFromIndexedDB(apt.videoId).then(url => {
            const preview = document.getElementById('videoPreview');
            const previewCont = document.getElementById('videoPreviewContainer');
            if(preview && previewCont && url) {
                preview.src = url;
                previewCont.classList.remove('hidden');
            }
        });
    }

    const formTitle = document.getElementById('formTitle');
    if(formTitle) formTitle.innerText = "تعديل عقار في النظام";

    window.switchTab('add');
}

window.deleteApartment = async function(id) {
    const apt = apartments.find(a => a.id === id);
    if (!apt) return;

    if (!canModify(apt.agent)) {
        alert("عذراً، لا تملك صلاحية حذف هذا العقار!");
        return;
    }

    if(confirm("هل أنت متأكد من حذف هذا العقار من نظام الشركة والسحاب؟")) {
        await deleteApartmentFromCloud(id);
    }
}

window.openApartmentDetails = async function(index) {
    const apt = apartments[index];
    if (!apt) return;

    const modalTitle = document.getElementById('modalPropTitle');
    if(modalTitle) modalTitle.innerText = `${apt.propType} - ${apt.governorate} (${apt.city})`;
    
    const modalBadge = document.getElementById('modalPropBadge');
    if(modalBadge) modalBadge.innerHTML = `${apt.dealType} | ${apt.status}`;

    document.getElementById('detailsModal')?.classList.remove('hidden');
}

window.closeDetailsModal = function() {
    document.getElementById('detailsModal')?.classList.add('hidden');
}

function renderMarqueeBar() {
    const bar = document.getElementById('videoMarqueeBar');
    if(!bar) return;
    bar.innerHTML = '';

    if(apartments.length === 0) {
        bar.innerHTML = '<span class="text-xs text-slate-400 px-4">لا توجد عقارات مسجلة للعرض</span>';
        return;
    }

    apartments.forEach((apt, realIndex) => {
        const card = document.createElement('div');
        card.className = "flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-white shrink-0 shadow-md hover:border-amber-500 cursor-pointer transition";
        card.onclick = () => window.openApartmentDetails(realIndex);
        card.innerHTML = `<div class="text-xs font-black text-amber-400">${apt.governorate || ''} - ${apt.city || ''}</div>`;
        bar.appendChild(card);
    });
}

function renderInventoryDashboard() {
    const kpiTotal = document.getElementById('kpiTotal');
    const kpiAvailable = document.getElementById('kpiAvailable');
    if(kpiTotal) kpiTotal.innerText = apartments.length;
    if(kpiAvailable) kpiAvailable.innerText = apartments.filter(a => a.status === 'متاحة').length;
}
