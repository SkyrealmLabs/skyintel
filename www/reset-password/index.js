async function resetPassword() {
    const newPassword = document.getElementById("newPassword")?.value.trim();
    const confirmPassword = document.getElementById("confirmPassword")?.value.trim();

    // Validate inputs before sending
    if (!newPassword || !confirmPassword) {
        alert("Please fill in both password fields.");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    const decodedUser = decodeURIComponent(userParam);
    const originalId = await decryptionID(decodedUser); // assuming this returns the plain user ID

    try {
        const response = await fetch("/api/reset-password", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            // ✅ Send data at the top level
            body: JSON.stringify({
                userId: originalId,
                newPassword: newPassword,
                confirmPassword: confirmPassword
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert("✅ Password reset successful!");
            window.location.href = "../";
        } else {
            alert(`⚠️ ${data.message}`);
        }

    } catch (error) {
        console.error("Error:", error);
        alert("Something went wrong. Please try again later.");
    }
}


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