document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const tabButtons = document.querySelectorAll("[data-auth-tab]");
    const authPanels = document.querySelectorAll("[data-auth-panel]");
    const loginForms = document.querySelectorAll("[data-login-form]");
    const passwordToggles = document.querySelectorAll("[data-password-toggle]");
    const loginMessage = document.querySelector("[data-login-message]");
    const registerMessage = document.querySelector("[data-register-message]");
    const registerForm = document.querySelector("[data-register-form]");
    const revealItems = document.querySelectorAll(".reveal");
    const customerSession = window.GlowGraceCustomerSession;
    const customerHomePage = "home-page.html";

    const setMessage = (element, message, isError = false) => {
        if (!element) {
            return;
        }

        element.textContent = message;
        element.classList.toggle("error", isError);
    };

    const request = async (path, body) => {
        if (!customerSession || !customerSession.request) {
            throw new Error("Authentication server is not available. Start the backend server first.");
        }

        return customerSession.request(path, {
            method: "POST",
            body: JSON.stringify(body),
        });
    };

    const saveSignedInCustomer = (user) => {
        if (customerSession) {
            customerSession.save(user);
        }
    };

    const redirectHome = (delay = 650) => {
        window.setTimeout(() => {
            window.location.href = customerHomePage;
        }, delay);
    };

    const updateHeader = () => {
        if (!header) return;
        header.classList.toggle("scrolled", window.scrollY > 12);
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    if (navToggle && navMenu && header) {
        navToggle.addEventListener("click", () => {
            const isOpen = navMenu.classList.toggle("is-open");
            navToggle.classList.toggle("is-open", isOpen);
            header.classList.toggle("menu-open", isOpen);
            navToggle.setAttribute("aria-expanded", String(isOpen));
            navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
        });

        navMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("is-open");
                navToggle.classList.remove("is-open");
                header.classList.remove("menu-open");
                navToggle.setAttribute("aria-expanded", "false");
                navToggle.setAttribute("aria-label", "Open navigation");
            });
        });
    }

    tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const selectedPanel = button.dataset.authTab;

            tabButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-selected", String(isActive));
            });

            authPanels.forEach((panel) => {
                panel.classList.toggle("active", panel.dataset.authPanel === selectedPanel);
            });
        });
    });

    passwordToggles.forEach((button) => {
        button.addEventListener("click", () => {
            const input = button.parentElement.querySelector("input");
            const showPassword = input.type === "password";

            input.type = showPassword ? "text" : "password";
            button.textContent = showPassword ? "Hide" : "Show";
            button.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
        });
    });

    loginForms.forEach((form) => {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const submitButton = form.querySelector('[type="submit"]');
            const formData = new FormData(form);

            if (submitButton) {
                submitButton.disabled = true;
            }

            setMessage(loginMessage, "Signing in...");

            try {
                const data = await request("/login", {
                    identifier: formData.get("identifier"),
                    password: formData.get("password"),
                    remember: formData.get("remember") === "on",
                });

                saveSignedInCustomer(data.user);
                setMessage(loginMessage, "Login successful. Opening the home page...");
                redirectHome();
            } catch (error) {
                setMessage(loginMessage, error.message, true);
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    });

    if (registerForm && registerMessage) {
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!registerForm.checkValidity()) {
                registerForm.reportValidity();
                return;
            }

            const submitButton = registerForm.querySelector('[type="submit"]');
            const formData = new FormData(registerForm);

            if (submitButton) {
                submitButton.disabled = true;
            }

            setMessage(registerMessage, "Creating account...");

            try {
                const data = await request("/register", {
                    name: formData.get("name"),
                    email: formData.get("email"),
                    mobile: formData.get("mobile"),
                    password: formData.get("password"),
                    recoveryQuestion: formData.get("recoveryQuestion"),
                    recoveryAnswer: formData.get("recoveryAnswer"),
                    remember: true,
                });
                const name = data.user && data.user.name ? data.user.name : "customer";

                saveSignedInCustomer(data.user);
                setMessage(registerMessage, `Account created for ${name}. Opening the home page...`);
                redirectHome(800);
            } catch (error) {
                setMessage(registerMessage, error.message, true);
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.14 });

    revealItems.forEach((item) => revealObserver.observe(item));
});
