// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyD2WZnOuDXBLXR7uAq_LTK46q7tr13Mqvw",
    authDomain: "gadendigitech.firebaseapp.com",
    projectId: "gadendigitech",
    storageBucket: "gadendigitech.firebasestorage.app",
    messagingSenderId: "134032321432",
    appId: "1:134032321432:web:dedbb189a68980661259ed",
    measurementId: "G-VLG9G3FCP0"
  });
}
const auth = firebase.auth();

// Show/hide password toggle
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
togglePasswordBtn.addEventListener('click', () => {
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.textContent = '🙈';
  } else {
    passwordInput.type = 'password';
    eyeIcon.textContent = '👁️';
  }
});

// Login form handler
document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = passwordInput.value;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      window.location = 'home.html';
    })
    .catch(err => alert(err.message));
});

// Forgot password handler
document.getElementById('forgotPasswordLink').addEventListener('click', e => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  if (!email) {
    alert('Enter your email above first.');
    return;
  }
  auth.sendPasswordResetEmail(email)
    .then(() => {
      alert('A password reset link has been sent to your email.');
    })
    .catch(err => alert(err.message));
});