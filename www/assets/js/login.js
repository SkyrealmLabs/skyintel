// import { ROLES } from "../../../constant.js";

const loginCard = document.getElementById("login-card");
const profileLogin = document.getElementById("profileLogin");
const profileContent = document.getElementById("profileContent");
const sidebarLogin = document.getElementById("sidebarLogin");
const sidebarContent = document.getElementById("sidebarContent");
const user = JSON.parse(localStorage.getItem("user"));

document.addEventListener("DOMContentLoaded", () => {
  const isLogin = localStorage.getItem("isLogin");

  // If not logged in and not already on main page, redirect
  if (!isLogin && window.location.pathname !== "/") {
    window.location.href = "/";
  }

  if (isLogin) {
    username.innerText = user.name;
    showProfileContent();
    showSidebarContent();
  } else {
    username.innerText = "Login";
    showProfileLogin();
    showSidebarLogin();
  }

  function showProfileLogin() {
    profileLogin.classList.remove("hidden");
    profileContent.classList.add("hidden");
  }

  function showProfileContent() {
    profileLogin.classList.add("hidden");
    profileContent.classList.remove("hidden");
    appendProfileData();
  }

  function appendProfileData() {
    document.getElementById("usernameTxt").innerText = user.name;
    document.getElementById("emailTxt").innerText = user.email;
  }

  function showSidebarLogin() {
    sidebarLogin.classList.remove("hidden");
    sidebarContent.classList.add("hidden");
  }

  function showSidebarContent() {
    sidebarLogin.classList.add("hidden");
    sidebarContent.classList.remove("hidden");
  }

  $(document).on("click", ".btn-logout", function (event) {
    console.log("LOGOUTTT")
    event.stopPropagation();
    logout();
  })

  async function logout() {
    const id = user.id;

    try {
      const response = await fetch("/api/logout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.removeItem("token");
        localStorage.removeItem("isLogin");
        localStorage.removeItem("user");
        alert("✅ Logout Success!");
        window.location.reload();
      } else {
        alert("❌ " + data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("⚠️ Something went wrong, please try again.");
    }
  }

  checkFirstTimeUser(user);
});

// Attach same handler to both forms
document.getElementById("loginForm1")?.addEventListener("submit", function (e) {
  e.preventDefault();
  const email = document.getElementById("email1").value;
  const password = document.getElementById("password1").value;
  handleLogin(email, password);
});

document.getElementById("loginForm2")?.addEventListener("submit", function (e) {
  e.preventDefault();
  const email = document.getElementById("email2").value;
  const password = document.getElementById("password2").value;
  handleLogin(email, password);
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
      // Check role (1 = admin, 2 = super admin, 3 = client)
      if (data.user.role === 1 || data.user.role === 2 || data.user.role === 4) {
        // Save login state
        localStorage.setItem("token", data.token);
        localStorage.setItem("isLogin", "true");
        localStorage.setItem("user", JSON.stringify(data.user));

        alert("✅ Login Success!");
        window.location.reload(); // refresh to apply UI change
      } else {
        alert("❌ Access Denied: Only Admin and Super Admin can log in.");
      }
    } else {
      alert("❌ " + data.message);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("⚠️ Something went wrong, please try again.");
  }
}

// Call the /api/encrypt endpoint
async function encryptionID(id) {
  try {
    const response = await fetch('/api/encrypt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })
    });

    if (!response.ok) {
      throw new Error('Failed to encrypt ID');
    }

    const data = await response.json();
    return data.encrypted; // The encrypted value from the server
  } catch (error) {
    console.error('Encrypt API error:', error);
    return null;
  }
}

// Call the /api/decrypt endpoint
async function decryptionID(encrypted) {
  try {
    const response = await fetch('/api/decrypt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ encrypted })
    });

    if (!response.ok) {
      throw new Error('Failed to decrypt value');
    }

    const data = await response.json();
    return data.id; // The original ID from the server
  } catch (error) {
    console.error('Decrypt API error:', error);
    return null;
  }
}