(function () {
    const sessionKey = "glow-grace-customer-session";
    const profileKey = "glow-grace-profile";
    const localAuthBase = "http://localhost:8000/api/auth";
    const protectedPages = new Set([
        "booking.html",
        "booking-summary.html",
        "my-appointments.html",
        "payment.html",
        "payment-status.html",
        "profile.html",
    ]);

    const readJson = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value || fallback;
        } catch (error) {
            return fallback;
        }
    };

    const saveJson = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };


    const getCurrentPage = () => {
        const pageName = window.location.pathname.split(/[\\/]/).pop();
        return pageName || "home-page.html";
    };

    const isProtectedPage = () => protectedPages.has(getCurrentPage());

    const normalizeCustomer = (user = {}) => ({
        id: user.id || "",
        name: user.name || "",
        email: user.email || "",
        mobile: user.mobile || "",
        role: "customer",
        accountType: "customer",
        signedIn: true,
        serverVerified: true,
        signedInAt: user.signedInAt || new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
    });

    const saveSession = (data = {}) => {
        const session = normalizeCustomer(data);
        const existingProfile = readJson(profileKey, {});

        saveJson(sessionKey, session);
        saveJson(profileKey, {
            ...existingProfile,
            name: session.name || existingProfile.name || "",
            email: session.email || existingProfile.email || "",
            mobile: session.mobile || existingProfile.mobile || "",
            updatedAt: new Date().toISOString(),
        });

        updateHeaderAction();
        return session;
    };

    const getSession = () => {
        const session = readJson(sessionKey, null);

        if (!session || session.signedIn === false || !session.serverVerified) {
            return null;
        }

        return session;
    };

    const clearLocalSession = () => {
        saveJson(sessionKey, {
            signedIn: false,
            signedOutAt: new Date().toISOString(),
        });
        updateHeaderAction();
    };

    const isLocalDevelopment = () => {
        const localHosts = ["localhost", "127.0.0.1", "::1"];
        return window.location.protocol === "file:" ? true : localHosts.includes(window.location.hostname);
    };

    const getBackendBase = () => String(window.GLOW_GRACE_BACKEND_URL || "").trim().replace(/\/+$/, "");

    const getAuthUrls = (path) => {
        const backendBase = getBackendBase();

        if (backendBase) {
            return [`${backendBase}/api/auth${path}`];
        }

        if (!isLocalDevelopment()) {
            return [];
        }

        const urls = [`/api/auth${path}`];

        if (window.location.origin !== "http://localhost:8000") {
            urls.push(`${localAuthBase}${path}`);
        }

        return urls;
    };

    const request = async (path, options = {}) => {
        const authUrls = getAuthUrls(path);
        let lastError = null;
        let data = {};

        if (authUrls.length === 0) {
            throw new Error("Online login is not connected yet. Add your hosted backend URL in frontend/src/javascript/backend-config.js.");
        }

        for (const url of authUrls) {
            try {
                const response = await fetch(url, {
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        ...(options.headers || {}),
                    },
                    ...options,
                });
                data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.error || "Request failed.");
                }

                return data;
            } catch (error) {
                lastError = error;
            }
        }

        if (lastError && lastError.name !== "TypeError") {
            throw lastError;
        }

        if (!isLocalDevelopment()) {
            throw new Error("Online login is not connected yet. This deployment needs a hosted backend API and database.");
        }

        throw new Error("Cannot reach the login server. Open the site from http://localhost:8000 and make sure the backend is running.");
    };

    const refreshSession = async ({ redirectIfMissing = false } = {}) => {
        try {
            const data = await request("/me");
            const user = data.user || {};

            if (user.accountType !== "customer") {
                clearLocalSession();
                if (redirectIfMissing) {
                    window.location.href = "login-register.html";
                }
                return null;
            }

            return saveSession(user);
        } catch (error) {
            clearLocalSession();

            if (redirectIfMissing) {
                window.location.href = "login-register.html";
            }

            return null;
        }
    };

    const clearSession = async () => {
        try {
            await request("/logout", { method: "POST", body: "{}" });
        } catch (error) {
            // The local state still needs to be cleared if the server is unavailable.
        }

        clearLocalSession();
    };

    const updateHeaderAction = () => {
        const action = document.querySelector("[data-customer-action], .header-action");

        if (!action) {
            return;
        }

        const session = getSession();
        const currentPage = getCurrentPage();

        document.documentElement.classList.toggle("customer-logged-in", Boolean(session));

        if (session) {
            action.textContent = "Profile";
            action.setAttribute("href", "profile.html");
            action.setAttribute("aria-label", "Open customer profile");
            action.classList.toggle("active", currentPage === "profile.html");
            return;
        }

        action.textContent = "Sign in";
        action.setAttribute("href", "login-register.html");
        action.setAttribute("aria-label", "Sign in or register");
        action.classList.toggle("active", currentPage === "login-register.html");
    };

    window.GlowGraceCustomerSession = {
        clear: clearSession,
        get: getSession,
        keys: {
            profileKey,
            sessionKey,
        },
        refresh: refreshSession,
        request,
        save: saveSession,
        updateHeader: updateHeaderAction,
    };


    document.addEventListener("DOMContentLoaded", () => {
        updateHeaderAction();
        refreshSession({ redirectIfMissing: isProtectedPage() });
    });
}());
