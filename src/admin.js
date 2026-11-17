
import './admin.css';

import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from './firebase';

import {
  collection,
  getDocs,
  getDocsFromServer,
  collectionGroup
} from 'firebase/firestore';

const ADMIN_EMAIL = 'kamadiksiadvokasi@gmail.com';

const loginButton = document.getElementById('google-login');
const logoutButton = document.getElementById('logout');
const statusText = document.getElementById('admin-status');
const dashboard = document.getElementById('dashboard');
const studentList = document.getElementById('student-list');
const refreshButton = document.getElementById('refresh-students');

if (refreshButton) {
  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Memuat...';
    await loadStudents();
    refreshButton.disabled = false;
    refreshButton.textContent = '🔄 Segarkan Data';
  });
}

const provider = new GoogleAuthProvider();


// =================================
// 1. LOGIN GOOGLE
// =================================

loginButton.addEventListener('click', async () => {
  try {
    statusText.textContent = 'Menghubungkan akun Google...';

    await signInWithPopup(auth, provider);

  } catch (error) {
    console.error('Login error:', error);

    statusText.textContent =
      'Login gagal. Silakan coba lagi.';
  }
});


// =================================
// 2. LOGOUT
// =================================

logoutButton.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.reload();

  } catch (error) {
    console.error('Logout error:', error);

    statusText.textContent = 'Gagal logout.';
  }
});


// =================================
// 3. CEK AUTHENTICATION ADMIN
// =================================

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    loginButton.hidden = false;
    logoutButton.hidden = true;
    dashboard.hidden = true;

    statusText.textContent =
      'Silakan login menggunakan akun admin.';

    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    statusText.textContent =
      'Akses ditolak. Akun ini bukan admin.';

    await signOut(auth);
    return;
  }

  try {
    statusText.textContent =
      'Memeriksa hak akses admin...';

    const tokenResult = await user.getIdTokenResult(true);

    if (tokenResult.claims.admin !== true) {
      statusText.textContent =
        'Hak akses admin belum ditemukan.';

      await signOut(auth);
      return;
    }

    loginButton.hidden = true;
    logoutButton.hidden = false;
    dashboard.hidden = false;

    statusText.textContent =
      `Login sebagai ${user.email}`;

    console.log('Admin berhasil login.');
    console.log('Email admin:', user.email);
    console.log('UID admin:', user.uid);
    console.log('Custom claim admin:', tokenResult.claims.admin);

    await loadStudents();

  } catch (error) {
    console.error('Admin authentication error:', error);

    statusText.textContent =
      'Gagal memeriksa hak akses admin.';
  }
});


// =================================
// 4. DATA MAHASISWA
// =================================

// Helper untuk selalu mengambil data langsung dari server Firestore (mencegah cache kosong)
async function fetchDocsFresh(ref) {
  try {
    return await getDocsFromServer(ref);
  } catch (err) {
    console.warn('getDocsFromServer gagal, fallback ke getDocs:', err.message);
    return await getDocs(ref);
  }
}

let allStudents = [];

async function loadStudents() {
  studentList.textContent = 'Memuat data mahasiswa...';

  try {
    const usersRef = collection(db, 'users');
    const snapshot = await fetchDocsFresh(usersRef);

    allStudents = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (!data.name || !data.studyProgram) return;

      allStudents.push({
        ...data,
        id: docSnapshot.id
      });
    });

    console.log('Jumlah seluruh dokumen users:', snapshot.size);
    console.log('Jumlah profil mahasiswa:', allStudents.length);

    allStudents.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    createStudentFilters();
    renderStudents();

  } catch (error) {
    console.error('Gagal mengambil mahasiswa:', error);
    studentList.innerHTML = `
      <div style="padding: 12px; background: #f8d7da; color: #721c24; border-radius: 6px;">
        <strong>Gagal mengambil data mahasiswa.</strong>
        <p style="margin: 4px 0 0 0; font-size: 13px;">Error: ${error.message || error}</p>
      </div>
    `;
  }
}


// =================================
// 5. FILTER DAN PENCARIAN
// =================================

function createStudentFilters() {

  if (document.getElementById('student-filters')) {
    return;
  }

  const filters = document.createElement('div');

  filters.id = 'student-filters';

  const search = document.createElement('input');

  search.type = 'search';
  search.id = 'student-search';
  search.placeholder = 'Cari nama mahasiswa...';

  const select = document.createElement('select');

  select.id = 'study-program-filter';

  const programs = [
    'Semua Program Studi',
    'Desain Komunikasi Visual (DKV)',
    'Ilmu Komunikasi',
    'Animasi',
    'Teknik Informatika',
    'Sistem Informasi',
    'Film dan Televisi',
    'Teknik Industri',
    'Teknik Biomedis',
    'Teknik Elektro',
    'Manajemen',
    'Akuntansi',
    'Bisnis Digital',
    'Sastra Jepang',
    'Bahasa Inggris',
    'Pengelolaan Perhotelan',
    'Kesehatan Masyarakat',
    'Kesehatan Lingkungan',
    'Manajemen Informasi Kesehatan',
    'Rekam Medis dan Informasi Kesehatan'
  ];

  programs.forEach((program, index) => {

    const option = document.createElement('option');

    option.value = index === 0 ? '' : program;
    option.textContent = program;

    select.appendChild(option);

  });

  search.addEventListener('input', renderStudents);

  select.addEventListener('change', renderStudents);

  filters.append(search, select);

  studentList.parentNode.insertBefore(
    filters,
    studentList
  );
}


// =================================
// 6. MENAMPILKAN DAFTAR MAHASISWA
// =================================

function renderStudents() {

  const searchInput =
    document.getElementById('student-search');

  const programFilter =
    document.getElementById('study-program-filter');

  if (!searchInput || !programFilter) return;

  const keyword =
    searchInput.value.trim().toLowerCase();

  const selectedProgram =
    programFilter.value;

  const filteredStudents = allStudents.filter((student) => {

    const matchesName = student.name
      .toLowerCase()
      .includes(keyword);

    const matchesProgram =
      !selectedProgram ||
      student.studyProgram === selectedProgram;

    return matchesName && matchesProgram;

  });

  studentList.innerHTML = '';

  if (filteredStudents.length === 0) {

    studentList.textContent =
      'Mahasiswa tidak ditemukan.';

    return;
  }

  filteredStudents.forEach((data) => {

    const student = document.createElement('div');

    student.style.padding = '12px';
    student.style.marginBottom = '12px';
    student.style.border = '1px solid #ddd';
    student.style.borderRadius = '8px';

    const name = document.createElement('strong');

    name.textContent = data.name;

    const program = document.createElement('p');

    program.textContent = data.studyProgram;

    const button = document.createElement('button');

    button.textContent =
      'Lihat Riwayat Percakapan';

    const history = document.createElement('div');

    history.hidden = true;
    history.style.marginTop = '12px';

    button.addEventListener('click', async () => {

      console.log('----------------------------');
      console.log('Mahasiswa dipilih:', data.name);
      console.log('ID dokumen mahasiswa:', data.id);
      console.log('----------------------------');

      if (!history.hidden) {

        history.hidden = true;

        button.textContent =
          'Lihat Riwayat Percakapan';

        return;
      }

      history.hidden = false;

      if (history.dataset.loaded === 'true') {

        button.textContent =
          'Tutup Riwayat Percakapan';

        return;
      }

      button.textContent = 'Memuat...';

      history.textContent =
        'Memuat riwayat percakapan...';

      const success = await loadConversationHistory(
        data.id,
        history
      );

      if (success) {
        history.dataset.loaded = 'true';
      }

      button.textContent =
        'Tutup Riwayat Percakapan';

    });

    student.append(
      name,
      program,
      button,
      history
    );

    studentList.appendChild(student);

  });
}


// =================================
// 7. MEMUAT RIWAYAT PERCAKAPAN (MULTI-STRATEGI)
// =================================

async function loadConversationHistory(userId, container) {
  try {
    container.innerHTML = '<p style="color:#536453; font-size:13px;">Memuat percakapan dari server Firestore...</p>';
    console.log('--- MEMERIKSA RIWAYAT PERCAKAPAN ---');
    console.log('Target User ID:', userId);

    let conversationsFound = [];

    // 1. Ambil dokumen percakapan mahasiswa: users/{userId}/conversations
    const convRef = collection(db, 'users', userId, 'conversations');
    const convSnap = await fetchDocsFresh(convRef);

    if (convSnap.empty) {
      container.innerHTML = `
        <div style="padding: 12px; background: #fff3cd; color: #856404; border: 1px solid #ffeeba; border-radius: 8px; font-size: 13px;">
          <strong>Belum ada percakapan.</strong>
          <p style="margin: 4px 0 0 0;">Mahasiswa ini belum mengirimkan pesan chat.</p>
        </div>
      `;
      return true;
    }

    console.log('Ditemukan dokumen percakapan:', convSnap.size);

    for (const cDoc of convSnap.docs) {
      const cData = cDoc.data();
      const convId = cDoc.id;

      // Ambil subkoleksi pesan: users/{userId}/conversations/{convId}/messages
      const msgRef = collection(db, 'users', userId, 'conversations', convId, 'messages');
      const msgSnap = await fetchDocsFresh(msgRef);

      const messages = msgSnap.docs.map(mDoc => ({
        id: mDoc.id,
        ...mDoc.data()
      }));

      messages.sort((a, b) => {
        const timeA = a.orderTime ?? a.timestamp?.toMillis?.() ?? 0;
        const timeB = b.orderTime ?? b.timestamp?.toMillis?.() ?? 0;
        return timeA - timeB || a.id.localeCompare(b.id);
      });

      conversationsFound.push({
        id: convId,
        title: cData.title || 'Percakapan baru',
        updatedAt: cData.updatedAt?.toMillis?.() || cData.createdAt?.toMillis?.() || 0,
        messages
      });
    }

    // TAMPILKAN HASIL
    container.innerHTML = '';

    if (conversationsFound.length === 0) {
      container.innerHTML = `
        <div style="padding: 12px; background: #fff3cd; color: #856404; border: 1px solid #ffeeba; border-radius: 8px; font-size: 13px;">
          <strong>Belum ada percakapan.</strong>
          <p style="margin: 4px 0 0 0;">Tidak ditemukan riwayat pesan di Firestore untuk mahasiswa ini (UID: <code>${userId}</code>).</p>
        </div>
      `;
      console.warn('Firestore tidak menemukan dokumen percakapan untuk UID:', userId);
      return true;
    }

    // Urutkan percakapan terbaru
    conversationsFound.sort((a, b) => b.updatedAt - a.updatedAt);

    conversationsFound.forEach((conversation) => {
      const conversationBox = document.createElement('div');
      conversationBox.style.padding = '12px';
      conversationBox.style.marginTop = '10px';
      conversationBox.style.background = '#f9fbf8';
      conversationBox.style.border = '1px solid #dce8d7';
      conversationBox.style.borderRadius = '8px';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '10px';

      const title = document.createElement('strong');
      title.textContent = `${conversation.title} (${conversation.messages.length} pesan)`;
      title.style.color = '#174b16';
      title.style.fontSize = '14px';

      const convIdBadge = document.createElement('span');
      convIdBadge.textContent = `ID: ${conversation.id}`;
      convIdBadge.style.fontSize = '11px';
      convIdBadge.style.color = '#738373';
      convIdBadge.style.background = '#eef3eb';
      convIdBadge.style.padding = '3px 8px';
      convIdBadge.style.borderRadius = '4px';

      header.append(title, convIdBadge);
      conversationBox.appendChild(header);

      if (conversation.messages.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Belum ada pesan dalam percakapan ini.';
        empty.style.color = '#888';
        empty.style.fontSize = '13px';
        conversationBox.appendChild(empty);
      } else {
        conversation.messages.forEach((message) => {
          const messageBox = document.createElement('div');
          messageBox.style.padding = '8px 12px';
          messageBox.style.marginBottom = '6px';
          messageBox.style.borderRadius = '6px';
          messageBox.style.fontSize = '13px';
          messageBox.style.lineHeight = '1.45';

          const isUser = message.sender === 'user';
          messageBox.style.background = isUser ? '#ffffff' : '#eaf2e8';
          messageBox.style.border = isUser ? '1px solid #e1e9dd' : '1px solid #c9dcc6';

          const sender = isUser ? 'Mahasiswa' : 'Teman Cerita AI';
          const senderTag = document.createElement('strong');
          senderTag.textContent = `${sender}: `;
          senderTag.style.color = isUser ? '#2b4429' : '#174b16';

          const contentSpan = document.createElement('span');
          contentSpan.textContent = message.content || '';
          contentSpan.style.whiteSpace = 'pre-wrap';

          messageBox.append(senderTag, contentSpan);
          conversationBox.appendChild(messageBox);
        });
      }

      container.appendChild(conversationBox);
    });

    console.log('Berhasil memuat seluruh riwayat percakapan.');
    return true;

  } catch (error) {
    console.error('Gagal memuat riwayat:', error);

    let helpMsg = '';
    if (error.code === 'permission-denied') {
      helpMsg = `
        <div style="margin-top: 8px; font-size: 12px; line-height: 1.4;">
          <strong>Penyebab:</strong> Firestore Security Rules belum mengizinkan admin membaca subkoleksi mahasiswa.<br>
          Tambahkan aturan berikut di Firebase Console (Firestore Rules):<br>
          <code style="background: rgba(0,0,0,0.06); padding: 2px 4px; border-radius: 4px;">allow read: if request.auth != null && request.auth.token.admin == true;</code>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="padding: 12px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px; font-size: 13px;">
        <strong>Gagal memuat riwayat percakapan.</strong>
        <p style="margin: 4px 0;">Kode Error: <code>${error.code || 'Tidak diketahui'}</code></p>
        <p style="margin: 4px 0;">Pesan: ${error.message || error}</p>
        <div style="margin: 8px 0; padding: 6px; background: rgba(0,0,0,0.05); border-radius: 4px; font-family: monospace; font-size: 11px;">
          Auth Email : ${auth.currentUser?.email || '(kosong)'}<br>
          Auth UID   : ${auth.currentUser?.uid || '(kosong)'}<br>
          Target UID : ${userId}<br>
          Provider   : ${auth.currentUser?.providerData[0]?.providerId || '(kosong)'}
        </div>
        ${helpMsg}
      </div>
    `;

    return false;
  }
}
