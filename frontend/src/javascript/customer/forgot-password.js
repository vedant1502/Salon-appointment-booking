document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const passwordToggles = document.querySelectorAll("[data-password-toggle]");
    const recoveryForm = document.querySelector("[data-recovery-form]");
    const resetForm = document.querySelector("[data-reset-form]");
    const resetMessage = document.querySelector("[data-reset-message]");
    const customerSession = window.GlowGraceCustomerSession;

    const setMessage = (message, isError = false) => {
        if (!resetMessage) {
            return;
        }

        resetMessage.textContent = message;
        resetMessage.classList.toggle("error", isError);
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

    const getFormPayload = (form) => {
        const formData = new FormData(form);

        return {
            email: formData.get("email"),
            mobile: formData.get("mobile"),
            recoveryQuestion: formData.get("recoveryQuestion"),
            recoveryAnswer: formData.get("recoveryAnswer"),
        };
    };

    const setSubmitting = (form, isSubmitting) => {
        const button = form && form.querySelector('[type="submit"]');

        if (button) {
            button.disabled = isSubmitting;
        }
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

    passwordToggles.forEach((button) => {
        button.addEventListener("click", () => {
            const input = button.parentElement.querySelector("input");
            const showPassword = input.type === "password";

            input.type = showPassword ? "text" : "password";
            button.textContent = showPassword ? "Hide" : "Show";
            button.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
        });
    });

    if (recoveryForm && resetForm) {
        recoveryForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!recoveryForm.checkValidity()) {
                recoveryForm.reportValidity();
                return;
            }

            const payload = getFormPayload(recoveryForm);

            setSubmitting(recoveryForm, true);
            setMessage("Checking your security answer...");

            try {
                await request("/verify-recovery", payload);

                Object.entries(payload).forEach(([key, value]) => {
                    const input = resetForm.elements[key];

                    if (input) {
                        input.value = value;
                    }
                });

                recoveryForm.classList.remove("active");
                resetForm.classList.add("active");
                setMessage("Answer verified. Type and confirm your new password.");

                const passwordInput = resetForm.querySelector('input[name="newPassword"]');
                if (passwordInput) {
                    passwordInput.focus();
                }
            } catch (error) {
                setMessage(error.message, true);
            } finally {
                setSubmitting(recoveryForm, false);
            }
        });
    }

    if (resetForm) {
        resetForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!resetForm.checkValidity()) {
                resetForm.reportValidity();
                return;
            }

            const formData = new FormData(resetForm);
            const newPassword = String(formData.get("newPassword") || "");
            const confirmPassword = String(formData.get("confirmPassword") || "");

            if (newPassword !== confirmPassword) {
                setMessage("New password and confirm password must match.", true);
                return;
            }

            setSubmitting(resetForm, true);
            setMessage("Resetting password...");

            try {
                await request("/reset-password", {
                    email: formData.get("email"),
                    mobile: formData.get("mobile"),
                    recoveryQuestion: formData.get("recoveryQuestion"),
                    recoveryAnswer: formData.get("recoveryAnswer"),
                    newPassword,
                });

                resetForm.reset();
                setMessage("Password reset successful. Opening login page...");

                window.setTimeout(() => {
                    window.location.href = "login-register.html";
                }, 1100);
            } catch (error) {
                setMessage(error.message, true);
            } finally {
                setSubmitting(resetForm, false);
            }
        });
    }
});
