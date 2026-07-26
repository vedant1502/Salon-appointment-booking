(function () {
    const adminSessionKey = "glow-grace-admin-session";



    const saveAdminSession = (user) => {
        localStorage.setItem(adminSessionKey, JSON.stringify({
            role: user.role,
            email: user.email,
            accountType: "admin",
            serverVerified: true,
            loggedInAt: new Date().toISOString(),
        }));
    };

    const clearAdminSession = () => {
        localStorage.removeItem(adminSessionKey);
    };

    const ensureAdmin = async () => {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "include",
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.user || data.user.accountType !== "admin") {
                clearAdminSession();
                window.location.href = "admin-login.html";
                return null;
            }

            saveAdminSession(data.user);
            return data.user;
        } catch (error) {
            clearAdminSession();
            window.location.href = "admin-login.html";
            return null;
        }
    };

    window.GlowGraceAdminAuth = {
        ensure: ensureAdmin,
    };

    ensureAdmin();
}());
