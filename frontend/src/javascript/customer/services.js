document.addEventListener("DOMContentLoaded", () => {
    const servicesKey = "glow-grace-services";
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const servicesGrid = document.querySelector("[data-services-grid]");
    const revealItems = document.querySelectorAll(".reveal");

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const formatCurrency = (amount) => `Rs. ${(Number(amount) || 0).toLocaleString("en-IN")}`;

    const readAdminServices = () => {
        try {
            const storedServices = JSON.parse(localStorage.getItem(servicesKey) || "null");
            return Array.isArray(storedServices) ? storedServices.filter((service) => service.active !== false) : [];
        } catch (error) {
            return [];
        }
    };

    const renderAdminServices = () => {
        if (!servicesGrid) return;

        const adminServices = readAdminServices();

        if (adminServices.length === 0) {
            return;
        }

        servicesGrid.innerHTML = adminServices.map((service) => `
            <article class="service-card reveal visible" data-category="${escapeHtml(service.category || "service")}">
                <img src="${escapeHtml(service.image || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=82")}" alt="${escapeHtml(service.name)} service">
                <div class="service-body">
                    <div class="service-topline">
                        <span>${escapeHtml(service.category || "Service")}</span>
                        <strong>${escapeHtml(formatCurrency(service.price))}</strong>
                    </div>
                    <h3>${escapeHtml(service.name)}</h3>
                    <p>${escapeHtml(service.description)}</p>
                    <div class="service-meta">
                        <span>${escapeHtml(service.duration)}</span>
                        <span>${escapeHtml(service.note || "Salon service")}</span>
                    </div>
                    <a class="book-link" href="booking.html?service=${encodeURIComponent(service.name)}">Book now</a>
                </div>
            </article>
        `).join("");
    };

    const updateHeader = () => {
        if (!header) return;
        header.classList.toggle("scrolled", window.scrollY > 12);
    };

    renderAdminServices();
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

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const selectedCategory = button.dataset.filter;
            const serviceCards = document.querySelectorAll("[data-category]");

            filterButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", String(isActive));
            });

            serviceCards.forEach((card) => {
                const shouldShow = selectedCategory === "all" || card.dataset.category === selectedCategory;
                card.classList.toggle("is-hidden", !shouldShow);
            });
        });
    });

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
