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

    const isLocalDevelopment = () => {
        const localHosts = ["localhost", "127.0.0.1", "::1"];
        return window.location.protocol === "file:" ? true : localHosts.includes(window.location.hostname);
    };

    const getBackendBase = () => String(window.GLOW_GRACE_BACKEND_URL || "").trim().replace(/\/+$/, "");

    const getAuthUrl = (path) => {
        const backendBase = getBackendBase();

        if (backendBase) {
            return `${backendBase}/api/auth${path}`;
        }

        return isLocalDevelopment() ? `/api/auth${path}` : "";
    };

    const ensureAdmin = async () => {
        try {
            const authUrl = getAuthUrl("/me");

            if (!authUrl) {
                throw new Error("Hosted backend URL is missing.");
            }

            const response = await fetch(authUrl, {
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
