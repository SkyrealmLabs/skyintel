const params = new URLSearchParams(window.location.search);
const encryptedId = params.get('id');
const action = params.get('action');
const userData = JSON.parse(localStorage.getItem("user"));

document.addEventListener('DOMContentLoaded', () => {
  const openSideNav = document.getElementById("open-sidenav-button");
  const closeSideNav = document.getElementById("close-sidenav-button");

  openSideNav.addEventListener("click", function () {
    openSidenav();
  })

  closeSideNav.addEventListener("click", function () {
    closeSidenav();
  })

  function openSidenav() {
    document.getElementById("right-sidenav").style.width = "400px";
  }

  function closeSidenav() {
    document.getElementById("right-sidenav").style.width = "0";
  }

  const droneToggleLink = document.querySelector('[data-bs-toggle="collapse"][href="#droneDropdown"]');
  const adminToggleLink = document.querySelector('[data-bs-toggle="collapse"][href="#adminDropdown"]');
  const droneDropdownIcon = droneToggleLink.querySelector('#droneDropdownIcon');
  const droneListTarget = document.querySelector('#droneDropdown');
  const adminDropdownIcon = adminToggleLink.querySelector('#adminDropdownIcon');
  const adminListTarget = document.querySelector('#adminDropdown');

  droneListTarget.addEventListener('show.bs.collapse', () => {
    droneDropdownIcon.classList.add('rotate-180');
  });

  droneListTarget.addEventListener('hide.bs.collapse', () => {
    droneDropdownIcon.classList.remove('rotate-180');
  });

  adminListTarget.addEventListener('show.bs.collapse', () => {
    adminDropdownIcon.classList.add('rotate-180');
  });

  adminListTarget.addEventListener('hide.bs.collapse', () => {
    adminDropdownIcon.classList.remove('rotate-180');
  });

  handleUserDecryption(encryptedId);
});

async function handleUserDecryption(encryptedId) {
  try {
    const originalId = await decryptionID(encryptedId); // wait for decryption to finish
    getUserById(originalId); // only runs after decryption is done
  } catch (err) {
    console.error("Decryption failed:", err);
  }
}

async function getUserById(id) {
  try {
    const response = await fetch('/api/getUserByID', {
      method: 'POST',                      // We use POST because ID is in the body
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })         // Send ID in request body
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();    // Parse JSON response
    appendUserData(data);
    // return data;                           // Return the fetched data
  } catch (error) {
    console.error('Failed to fetch user by ID:', error);
    throw error;                           // Rethrow for higher-level handling
  }
}

function appendUserData(data) {
  console.log("🚀 ~ appendUserData ~ data:", data)
  const username = document.getElementById("username-title");
  const role = document.getElementById("role");
  const firstName = document.getElementById("firstName");
  const lastName = document.getElementById("lastName");
  const department = document.getElementById("department");
  const designation = document.getElementById("designation");
  const gender = document.getElementById("gender");
  const birthday = document.getElementById("birthday");
  const email = document.getElementById("email");
  const phoneNo = document.getElementById("phoneNo");
  const user = data.user;

  username.innerText = user.name;
  role.innerText = user.role_name;
  firstName.value = user.first_name;
  lastName.value = user.last_name;
  department.value = user.department;
  designation.value = user.designation;
  gender.value = user.gender;
  email.value = user.email;
  phoneNo.value = user.phoneno;

  validateAction(action, user);
}

function validateAction(action, user) {
  const allFields = document.querySelectorAll('input, select, textarea');
  const button = document.getElementById('actionButton');
  const selected_user_role = user.role_name;
  const selected_user_id = user.id;
  const current_user_id = userData.id;
  const current_user_role = userData.role;

  if (action == 'view') {
    if (current_user_role == 1 || current_user_role == 2 || selected_user_id == current_user_id) {
      button.style.display = 'inline-block';
      button.innerText = 'Edit';
      // 👇 Pass the button itself as a parameter
      button.setAttribute('onclick', `enableInputColumn(this, '${current_user_role}', '${selected_user_id}')`);
    } else {
      button.style.display = 'none';
    }
  } else {
    // Directly call it with the button reference
    enableInputColumn(button, current_user_role, selected_user_id);
  }
}

function enableInputColumn(button, role_id, user_id) {
  let fieldIds = [];

  if (role_id == 1 || role_id == 2) {
    fieldIds = ["firstName", "lastName", "department", "designation", "gender", "birthday", "email", "phoneNo", "currentPassword", "newPassword", "confirmPassword"];
  } else {
    fieldIds = ["email", "phoneNo", "currentPassword", "newPassword", "confirmPassword"];
  }

  fieldIds.forEach(id => {
    const field = document.getElementById(id);
    if (field) field.disabled = false;
  });

  button.style.display = 'inline-block';
  button.innerText = 'Save';
  button.setAttribute('onclick', `updateUserDetails(${user_id})`);

}

async function updateUserDetails(user_id) {
  const currentPassword = document.getElementById('currentPassword').value.trim();
  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();

  const userData = {
    id: user_id,
    first_name: document.getElementById("firstName")?.value.trim(),
    last_name: document.getElementById("lastName")?.value.trim(),
    department: document.getElementById("department")?.value.trim(),
    designation: document.getElementById("designation")?.value.trim(),
    gender: document.getElementById("gender")?.value,
    birthday: document.getElementById("birthday")?.value.trim(),
    email: document.getElementById("email")?.value.trim(),
    phoneno: document.getElementById("phoneNo")?.value.trim()
  };

  console.log("📦 Data to send:", userData);

  try {
    const response = await fetch("/api/user/update", {
      method: "PUT", // or "POST" depending on your backend
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const result = await response.json();

    if (response.ok) {
      if (currentPassword || newPassword || confirmPassword) {
        updatePassword(userData.id, currentPassword, newPassword, confirmPassword);
      } else {
        alert("✅ User details updated successfully!");
        window.location.href = "../";
      }

    } else {
      alert("❌ Failed to update: " + (result.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Error updating user:", error);
    alert("⚠️ An error occurred while updating the user.");
  }

}

async function updatePassword(userId, currentPassword, newPassword, confirmPassword) {

  if (newPassword !== confirmPassword) {
    alert("New password and confirm password do not match.");
    return;
  }

  try {
    const response = await fetch("/api/change-password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        currentPassword,
        newPassword,
        confirmPassword
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert("✅ User details updated successfully with password!");
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
      window.location.href = "../";
    } else {
      alert(data.message);
    }

  } catch (error) {
    console.error("Error:", error);
    alert("Something went wrong. Please try again later.");
  }
}
