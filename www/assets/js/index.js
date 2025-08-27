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