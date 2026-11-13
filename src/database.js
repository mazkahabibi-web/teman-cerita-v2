
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';

import { db } from './firebase';

// Penanda urutan pesan
let lastMessageTime = 0;

// Membuat percakapan baru
export async function createConversation(userId) {
  const conversationsRef = collection(
    db,
    'users',
    userId,
    'conversations'
  );

  const conversation = await addDoc(conversationsRef, {
    title: 'Percakapan baru',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return conversation.id;
}

// Menyimpan pesan
export async function saveMessage(
  userId,
  conversationId,
  sender,
  content
) {
  const messagesRef = collection(
    db,
    'users',
    userId,
    'conversations',
    conversationId,
    'messages'
  );

  // Pastikan setiap pesan memiliki waktu unik dan meningkat
  const orderTime = Math.max(
    Date.now(),
    lastMessageTime + 1
  );

  lastMessageTime = orderTime;

  try {
    await addDoc(messagesRef, {
      sender,
      content,
      orderTime,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
}

// Mengambil riwayat pesan
export async function getMessages(userId, conversationId) {
  const messagesRef = collection(
    db,
    'users',
    userId,
    'conversations',
    conversationId,
    'messages'
  );

  const snapshot = await getDocs(messagesRef);

  const result = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  result.sort((a, b) => {
    const timeA =
      a.orderTime ??
      a.timestamp?.toMillis?.() ??
      0;

    const timeB =
      b.orderTime ??
      b.timestamp?.toMillis?.() ??
      0;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return a.id.localeCompare(b.id);
  });

  // Sinkronkan penghitung dengan pesan terbaru
  if (result.length > 0) {
    const latestTime = Math.max(
      ...result.map(message =>
        message.orderTime ??
        message.timestamp?.toMillis?.() ??
        0
      )
    );

    lastMessageTime = Math.max(
      lastMessageTime,
      latestTime
    );
  }

  return result;
}
