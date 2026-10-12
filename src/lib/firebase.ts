import { initializeApp } from 'firebase/app';
import { doc, initializeFirestore } from 'firebase/firestore';

// Web config is public by design; access is limited by firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBnM_oolWJlxbn-BiZLDKPkOvFaRZobZX0',
  authDomain: 'engineer-learning-guide-be.firebaseapp.com',
  projectId: 'engineer-learning-guide-be',
  storageBucket: 'engineer-learning-guide-be.firebasestorage.app',
  messagingSenderId: '711723253975',
  appId: '1:711723253975:web:aaca4b8fceb05e8ec4b092',
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  // Optional fields like completedAt are left undefined rather than omitted.
  ignoreUndefinedProperties: true,
});

/** All progress lives in this single document. */
export const STATE_DOC = doc(db, 'engineeros', 'state');
