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

});

async function checkFirstTimeUser(user) {
    if (!user) return;

    if (user.login_count === 1) {
        $('#changePasswordModal').modal('show');
    }
}

async function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    const userId = user.id;

    if (newPassword !== confirmPassword) {
        alert("New password and confirm password do not match.");
        return;
    }

    try {
        const response = await fetch("/api/change-password/firsttime", {
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
            alert("✅ Password updated successfully!");
            document.getElementById("currentPassword").value = "";
            document.getElementById("newPassword").value = "";
            document.getElementById("confirmPassword").value = "";

            $('#changePasswordModal').modal('hide');
        } else {
            alert(data.message);
        }

    } catch (error) {
        console.error("Error:", error);
        alert("Something went wrong. Please try again later.");
    }
}

document.querySelector('.forgot-password').addEventListener('click', (event) => {
    event.preventDefault(); // prevent page reload
    openForgotPasswordModal();
});

function openForgotPasswordModal() {
    $('#forgotPasswordModal').modal('show');
}

async function forgotPassword() {
    const email = document.getElementById("userEmail").value.trim();
    try {
        const response = await fetch('/api/getUserByEmail', {
            method: 'POST',  
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })         // Send ID in request body
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();  
        const user = data.user;  // Parse JSON response
        const encryptedId = await encryptionID(user.id);
        const userEmail = user.email;
        const resetPasswordURL = "https://skyintel.zulsyah.com/reset-password?user=" + encodeURIComponent(encryptedId);
        sendForgotPasswordEmail(userEmail, resetPasswordURL);
    } catch (error) {
        console.error('Failed to fetch user by ID:', error);
        throw error;                           // Rethrow for higher-level handling
    }
}

function sendForgotPasswordEmail(email, resetPasswordURL) {
    let params = {
        email: email,
        link: resetPasswordURL,
    };

    let serviceID = "service_8c9mvse";
    let templateID = "template_egvb9jz";

    emailjs.send(serviceID, templateID, params)
        .then(function (response) {
            alert("✅ Email sent successfully!");
            console.log("SUCCESS!", response.status, response.text);
            $('#forgotPasswordModal').modal('hide');
        })
        .catch(function (error) {
            alert("❌ Failed to send email. Please try again.");
            console.error("FAILED...", error);
        });
}