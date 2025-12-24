// import { ROLES } from "../../../constant.js";

const loginCard = document.getElementById("login-card");
const profileLogin = document.getElementById("profileLogin");
const profileContent = document.getElementById("profileContent");
const sidebarLogin = document.getElementById("sidebarLogin");
const sidebarContent = document.getElementById("sidebarContent");
const user = JSON.parse(localStorage.getItem("user")) || null;

document.addEventListener("DOMContentLoaded", () => {
  const isLogin = localStorage.getItem("isLogin");
  const currentPath = window.location.pathname;

  // --- 1. BASIC ACCESS CONTROL ---
  // If not logged in and not on login page, redirect to /login
  if (!isLogin) {
    if (!currentPath.includes("/login")) {
      window.location.href = "/login";
      return; 
    }
  }

  // --- 2. ROLE 3 RESTRICTION ---
  // If user is role 3, they are strictly limited to the location enrollment page
  if (isLogin && user && user.role == 3) {
    const allowedPage = "/public/location-enrollment";
    if (!currentPath.includes(allowedPage) && !currentPath.includes("/login")) {
      window.location.href = allowedPage;
      return;
    }
  }

  // --- 3. AUTHENTICATED REDIRECT ---
  // Prevent logged-in users from seeing the login page
  if (isLogin && currentPath.includes("/login") && user) {
    if (user.role == 3) {
      window.location.href = "/public/location-enrollment";
    } else {
      window.location.href = "/";
    }
    return;
  }

  // --- UI INITIALIZATION ---
  if (isLogin && user) {
    const usernameEl = document.getElementById("username");
    if (usernameEl) usernameEl.innerText = user.name;
    showProfileContent();
    showSidebarContent();
    checkFirstTimeUser(user); // Restored original function call
  } else {
    const usernameEl = document.getElementById("username");
    if (usernameEl) usernameEl.innerText = "Login";
    showProfileLogin();
    showSidebarLogin();
  }

  function showProfileLogin() {
    profileLogin?.classList.remove("hidden");
    profileContent?.classList.add("hidden");
  }

  function showProfileContent() {
    profileLogin?.classList.add("hidden");
    profileContent?.classList.remove("hidden");
    appendProfileData();
  }

  function appendProfileData() {
    if (user) {
      const nameTxt = document.getElementById("usernameTxt");
      const emailTxt = document.getElementById("emailTxt");
      if (nameTxt) nameTxt.innerText = user.name;
      if (emailTxt) emailTxt.innerText = user.email;
    }
  }

  function showSidebarLogin() {
    sidebarLogin?.classList.remove("hidden");
    sidebarContent?.classList.add("hidden");
  }

  function showSidebarContent() {
    sidebarLogin?.classList.add("hidden");
    sidebarContent?.classList.remove("hidden");
  }

  // JQuery Logout Handler
  $(document).on("click", ".btn-logout", function (event) {
    console.log("LOGOUTTT");
    event.stopPropagation();
    logout();
  });

  async function logout() {
    if (!user) return;
    const id = user.id;

    try {
      const response = await fetch("/api/logout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.clear(); // Clears token, isLogin, and user
        alert("✅ Logout Success!");
        window.location.href = "/login";
      } else {
        alert("❌ " + data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("⚠️ Something went wrong, please try again.");
    }
  }
  
  // Placeholder for the function called in your original code
  function checkFirstTimeUser(userData) {
      console.log("Checking session for:", userData.name);
  }
});

// --- LOGIN FORM HANDLERS ---
document.getElementById("loginForm1")?.addEventListener("submit", function (e) {
  e.preventDefault();
  handleLogin(document.getElementById("email1").value, document.getElementById("password1").value);
});

document.getElementById("loginForm2")?.addEventListener("submit", function (e) {
  e.preventDefault();
  handleLogin(document.getElementById("email2").value, document.getElementById("password2").value);
});

async function handleLogin(email, password) {
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("isLogin", "true");
      localStorage.setItem("user", JSON.stringify(data.user));

      alert("✅ Login Success!");
      
      // Role-based redirect
      if (data.user && data.user.role == 3) {
        window.location.href = "/public/location-enrollment";
      } else {
        window.location.href = "/";
      }
    } else {
      alert("❌ " + data.message);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("⚠️ Something went wrong, please try again.");
  }
}

// --- ENCRYPTION & DECRYPTION HELPERS (Restored) ---

async function encryptionID(id) {
  try {
    const response = await fetch('/api/encrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Failed to encrypt ID');
    const data = await response.json();
    return data.encrypted;
  } catch (error) {
    console.error('Encrypt API error:', error);
    return null;
  }
}

async function decryptionID(encrypted) {
  try {
    const response = await fetch('/api/decrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encrypted })
    });
    if (!response.ok) throw new Error('Failed to decrypt value');
    const data = await response.json();
    return data.id; 
  } catch (error) {
    console.error('Decrypt API error:', error);
    return null;
  }
}