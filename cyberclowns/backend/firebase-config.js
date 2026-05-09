// Firebase configuration for Tilloff
// Replace these with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyATPBdbfBmbT0FVzDTzzQfc1l5ttXpWaDA",
  authDomain: "project-tilloff.firebaseapp.com",
  projectId: "project-tilloff",
  storageBucket: "project-tilloff.firebasestorage.app",
  messagingSenderId: "189540866790",
  appId: "1:189540866790:web:8c9477787bbbe577463927",
  measurementId: "G-GR35BGQ5W3"
};
// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
