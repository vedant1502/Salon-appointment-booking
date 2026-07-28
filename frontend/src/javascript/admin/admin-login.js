document.addEventListener("DOMContentLoaded", () => {
    const adminSessionKey = "glow-grace-admin-session";
    const appointmentsKey = "glow-grace-appointments";
    const staffKey = "glow-grace-staff";
    const loginForm = document.querySelector("[data-admin-login-form]");
    const passwordInput = document.querySelector("[data-password-input]");
    const passwordToggle = document.querySelector("[data-password-toggle]");
    const loginMessage = document.querySelector("[data-login-message]");

    const readJson = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value || fallback;
        } catch (error) {
            return fallback;
        }
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

        if (!isLocalDevelopment()) {
            throw new Error("Online admin login is not connected yet. Add your hosted backend URL in frontend/src/javascript/backend-config.js.");
        }

        return `/api/auth${path}`;
    };

    const request = async (path, body) => {
        const response = await fetch(getAuthUrl(path), {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Request failed.");
        }

        return data;
    };

    const setMessage = (message, isError = false) => {
        if (!loginMessage) {
            return;
        }

        loginMessage.textContent = message;
        loginMessage.classList.toggle("error", isError);
    };

    const saveAdminSession = (user, remember) => {
        localStorage.setItem(adminSessionKey, JSON.stringify({
            role: user.role,
            email: user.email,
            accountType: "admin",
            remember,
            serverVerified: true,
            loggedInAt: new Date().toISOString(),
        }));
    };

    const toDateValue = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const setMetric = (name, value) => {
        const target = document.querySelector(`[data-login-metric="${name}"]`);

        if (target) {
            target.textContent = value;
        }
    };

    const updateMetrics = () => {
        const staff = readJson(staffKey, []);
        const staffItems = Array.isArray(staff) ? staff : [];

        setMetric("today-bookings", 0);
        setMetric("available-staff", staffItems.filter((member) => member.available !== false).length);
        setMetric("pending-payments", 0);
    };

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener("click", () => {
            const willShow = passwordInput.type === "password";

            passwordInput.type = willShow ? "text" : "password";
            passwordToggle.textContent = willShow ? "Hide" : "Show";
            passwordToggle.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
        });
    }

    if (loginForm && loginMessage) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!loginForm.checkValidity()) {
                loginForm.reportValidity();
                return;
            }

            const submitButton = loginForm.querySelector('[type="submit"]');
            const formData = new FormData(loginForm);

            if (submitButton) {
                submitButton.disabled = true;
            }

            setMessage("Checking admin account...");

            try {
                const data = await request("/admin-login", {
                    role: formData.get("role"),
                    email: formData.get("email"),
                    password: formData.get("password"),
                    remember: formData.get("remember") === "on",
                });

                saveAdminSession(data.user, formData.get("remember") === "on");
                setMessage("Login successful. Opening dashboard...");

                window.setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 650);
            } catch (error) {
                setMessage(error.message, true);
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }

    updateMetrics();
});
