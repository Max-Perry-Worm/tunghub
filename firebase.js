
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

const firebaseConfig = { apiKey: "AIzaSyCPJ9VFXPo1aglNmyQdy3wYdkxOO0NF-Ls", authDomain: "tunghub-11719.firebaseapp.com", projectId: "tunghub-11719", storageBucket: "tunghub-11719.firebasestorage.app", messagingSenderId: "930834864244", appId: "1:930834864244:web:1f82ddd763635577b9d921", measurementId: "G-XX3BNXM4N2" };

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
