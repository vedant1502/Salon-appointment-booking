document.addEventListener("DOMContentLoaded", () => {
    const contactMessagesKey = "glow-grace-contact-messages";
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const contactForm = document.querySelector("[data-contact-form]");
    const formMessage = document.querySelector("[data-form-message]");
    const revealItems = document.querySelectorAll(".reveal");

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

    if (contactForm && formMessage) {
        contactForm.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!contactForm.checkValidity()) {
                contactForm.reportValidity();
                return;
            }

            const formData = new FormData(contactForm);
            const email = String(formData.get("email") || "").trim();
            const mobile = String(formData.get("mobile") || "").trim();

            if (!email && !mobile) {
                formMessage.classList.add("error");
                formMessage.textContent = "Please add either email or mobile number.";
                return;
            }

            const messages = readJson(contactMessagesKey, []);
            const contactMessage = {
                id: `MSG-${Date.now().toString().slice(-6)}`,
                name: String(formData.get("name") || "").trim(),
                email,
                mobile,
                topic: formData.get("topic"),
                preferredContact: formData.get("preferredContact"),
                message: String(formData.get("message") || "").trim(),
                status: "new",
                createdAt: new Date().toISOString(),
            };

            saveJson(contactMessagesKey, [contactMessage, ...messages].slice(0, 30));
            contactForm.reset();
            formMessage.classList.remove("error");
            formMessage.textContent = `Message saved. Reference ${contactMessage.id}.`;
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
