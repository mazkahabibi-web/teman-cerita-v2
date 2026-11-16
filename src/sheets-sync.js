
/* =================================
   SINKRONISASI KE GOOGLE SHEETS
   Fire-and-forget — tidak pernah
   memblokir antarmuka chat.
================================= */

const SYNC_URL = import.meta.env.VITE_SHEETS_SYNC_URL;


/**
 * Sinkronisasi profil mahasiswa ke Google Sheets.
 * Dipanggil setelah profil berhasil disimpan ke Firestore.
 * Tidak melempar error — semua kegagalan diabaikan.
 *
 * @param {object} user - Firebase Auth user object
 * @param {object} profile - { name, studyProgram }
 */
export function syncProfileToSheets(user, profile) {
  if (!SYNC_URL) return;

  user.getIdToken()
    .then(function (idToken) {
      return fetch(SYNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'syncProfile',
          idToken: idToken,
          userId: user.uid,
          name: profile.name,
          studyProgram: profile.studyProgram
        })
      });
    })
    .catch(function () {
      // Gagal sinkronisasi diabaikan.
      // Data tetap aman di Firestore.
      // Backfill dapat memulihkan data yang terlewat.
    });
}


/**
 * Sinkronisasi pesan percakapan ke Google Sheets.
 * Dipanggil setelah pesan berhasil disimpan ke Firestore.
 * Tidak melempar error — semua kegagalan diabaikan.
 *
 * @param {object} user - Firebase Auth user object
 * @param {object} data - { conversationId, messageId, sender, content, timestamp }
 */
export function syncMessageToSheets(user, data) {
  if (!SYNC_URL) return;

  user.getIdToken()
    .then(function (idToken) {
      return fetch(SYNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'syncMessage',
          idToken: idToken,
          userId: user.uid,
          studentName: data.studentName || '',
          studyProgram: data.studyProgram || '',
          conversationId: data.conversationId,
          messageId: data.messageId,
          sender: data.sender,
          content: data.content,
          timestamp: data.timestamp
        })
      });
    })
    .catch(function () {
      // Gagal sinkronisasi diabaikan.
      // Data tetap aman di Firestore.
      // Backfill dapat memulihkan data yang terlewat.
    });
}
