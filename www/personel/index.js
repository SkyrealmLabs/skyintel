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
        document.getElementById("right-sidenav").style.width = "410px";
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

    fetchUsers();

});

async function fetchUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        const userData = JSON.parse(localStorage.getItem("user"));

        if (response.ok) {
            const container = document.querySelector('#userContainer');
            container.innerHTML = '';

            // loop through users
            for (const user of data.users) {
                // 1. get encrypted ID from API
                const encrypted = await encryptionID(user.id);

                console.log(user)
                // 2. build the card AFTER encryption is done
                const card = document.createElement('div');
                card.className = 'col-lg-4 col-md-6 mb-5';
                let dropdownItems = ` 
                    <a class="dropdown-item" href="./details/?id=${encodeURIComponent(encrypted)}&action=view">View</a>
                `;
                if (adminAction(userData.role) || selfAction(user.id)) {
                    dropdownItems += `
                        <a class="dropdown-item" href="./details/?id=${encodeURIComponent(encrypted)}&action=edit">Edit</a>
                    `;
                }
                if (adminAction(userData.role) && !selfAction(user.id)) {
                    dropdownItems += `
                                        <a class="dropdown-item" href="#" onclick="deactivateUser(${user.id})">Deactivate</a>
                                    `;

                }
                if (adminAction(userData.role) && !selfAction(user.id)) {
                    dropdownItems += `
                                        <a class="dropdown-item" href="#" onclick="deleteUser(${user.id})">Delete</a>
                                    `;

                }
                card.innerHTML = `
                                    <div class="card">
                                        <div class="card-body p-3">
                                            <div class="d-flex mt-n2">
                                                <div class="avatar avatar-xl bg-gradient-dark-blue border-radius-xl p-2 mt-n4">
                                                    <span class="text-4xl">${user.name.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div class="ms-3 my-auto">
                                                    <h5 class="capitalize mb-0">${user.name}</h5>
                                                    <span class="capitalize">${user.role_name}</span>
                                                </div>
                                                <div class="ms-auto">
                                                    <div class="dropdown position-relative">
                                                        <button class="btn btn-link text-secondary ps-0 pe-2" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                            <i class="material-icons text-lg position-relative icon-color">more_vert</i>
                                                        </button>
                                                        <div class="dropdown-menu dropdown-menu-end me-sm-n4 me-n3">
                                                            ${dropdownItems}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <hr class="horizontal dark">
                                            <div class="row">
                                                <div class="col-2"><i class="material-icons text-lg position-relative icon-color">phone</i></div>
                                                <div class="col-10 text-end"><p class="text-secondary text-md font-weight-normal mb-0">${user.phoneno || '-'}</p></div>
                                            </div>
                                            <div class="row">
                                                <div class="col-2"><i class="material-icons text-lg position-relative icon-color">mail</i></div>
                                                <div class="col-10 text-end"><p class="text-secondary text-md font-weight-normal mb-0">${user.email}</p></div>
                                            </div>
                                            <div class="row">
                                                <div class="col-2"><i class="material-icons text-lg position-relative icon-color">person</i></div>
                                                <div class="col-10 text-end"><p class="text-secondary text-md font-weight-normal mb-0" style="color: ${user.isDeactive == 1 ? 'red' : 'green'} !important;">${user.isDeactive ? "Deactive" : "Active"}</p></div>
                                            </div>
                                        </div>
                                    </div>
                                `;
                container.appendChild(card);
            }
        } else {
            console.error("Server error:", data.message || response.statusText);
            alert("Unable to fetch users.");
        }
    } catch (err) {
        console.error(err);
    }
}

function adminAction(role_id) {

    if (role_id == 1 || role_id == 2) {
        return true
    }

}

function selfAction(role_id) {

    if (role_id == user.id) {
        return true
    }

}

async function addUser() {
    const userData = {
        user_name: document.getElementById("userName").value.trim(),
        role: document.getElementById("role").value,
        first_name: document.getElementById("firstName").value.trim(),
        last_name: document.getElementById("lastName").value.trim(),
        department: document.getElementById("department").value.trim(),
        designation: document.getElementById("designation").value.trim(),
        gender: document.getElementById("gender").value,
        birthday: document.getElementById("birthday").value,
        email: document.getElementById("email").value.trim(),
        phoneno: document.getElementById("phoneNo").value.trim(),
    };

    try {
        const response = await fetch('/api/user/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (response.ok) {
            // ✅ Close the modal
            const modalEl = document.getElementById('addUserModal');
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.hide();

            // ✅ Reset the form
            resetAddUserForm();

            // ✅ Show success alert
            alert("✅ " + result.message);

            // ✅ Send email
            sendEmail(result.data);

            fetchUsers();
            // location.reload();
        } else {
            alert("❌ Error: " + (result.error || result.message));
        }
    } catch (error) {
        console.error("Request failed:", error);
        alert("⚠️ Failed to connect to the server");
    }
}

function resetAddUserForm() {
    document.getElementById("userName").value = "";
    document.getElementById("role").selectedIndex = 0; // Reset to first option (placeholder)
    document.getElementById("firstName").value = "";
    document.getElementById("lastName").value = "";
    document.getElementById("department").value = "";
    document.getElementById("designation").value = "";
    document.getElementById("gender").selectedIndex = 0; // Reset gender dropdown
    document.getElementById("birthday").value = "";
    document.getElementById("email").value = "";
    document.getElementById("phoneNo").value = "";
}

function sendEmail(data) {
    let params = {
        username: data.username,
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        password: data.password,
    };

    let serviceID = "service_8c9mvse";
    let templateID = "template_6ne0vlg";

    emailjs.send(serviceID, templateID, params)
        .then(function (response) {
            alert("✅ Email sent successfully!");
            console.log("SUCCESS!", response.status, response.text);
        })
        .catch(function (error) {
            alert("❌ Failed to send email. Please try again.");
            console.error("FAILED...", error);
        });
}

async function deactivateUser(userId) {
    try {
        const response = await fetch("/api/user/deactivate", {
            method: "PUT", // or "POST" depending on your backend
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: userId }),
        });

        const result = await response.json();

        if (response.ok) {
            alert("Deactivate user successful")
            window.location.reload();
        } else {
            alert("❌ Failed to update: " + (result.error || "Unknown error"));
        }
    } catch (error) {
        console.error("Error updating user:", error);
        alert("⚠️ An error occurred while updating the user.");
    }
}

async function deleteUser(userId) {
    try {
        const response = await fetch("/api/user/delete", {
            method: "PUT", // or "POST" depending on your backend
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: userId }),
        });

        const result = await response.json();

        if (response.ok) {
            alert("Delete user successful")
            window.location.reload();
        } else {
            alert("❌ Failed to update: " + (result.error || "Unknown error"));
        }
    } catch (error) {
        console.error("Error updating user:", error);
        alert("⚠️ An error occurred while updating the user.");
    }
}