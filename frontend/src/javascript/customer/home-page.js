document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const counters = document.querySelectorAll("[data-counter]");
    const completedClientsCounter = document.querySelector("[data-completed-clients]");
    const activeServicesCounter = document.querySelector("[data-active-services]");
    const averageRating = document.querySelector("[data-average-rating]");
    const homeReviews = document.querySelector("[data-home-reviews]");
    const revealItems = document.querySelectorAll(".reveal");
    const servicesKey = "glow-grace-services";
    const liveData = window.GlowGraceLiveData;
    const defaultActiveServiceCount = 9;
    let liveCompletedClients = 0;
    let liveHomeReviews = [];

    const readArray = (key) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return Array.isArray(value) ? value : null;
        } catch (error) {
            return null;
        }
    };

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const countCompletedAppointments = () => liveCompletedClients;

    const countActiveServices = () => {
        const services = readArray(servicesKey);

        if (!services) {
            return defaultActiveServiceCount;
        }

        return services.filter((service) => service.active !== false).length;
    };

    const getAverageRating = () => {
        const visibleReviews = liveHomeReviews.filter((review) => review.hidden !== true && Number(review.rating) > 0);

        if (visibleReviews.length === 0) {
            return "0.0";
        }

        const total = visibleReviews.reduce((sum, review) => sum + Math.min(5, Math.max(1, Number(review.rating) || 0)), 0);
        return (total / visibleReviews.length).toFixed(1);
    };

    const getRealVisibleReviews = () => {
        return liveHomeReviews.filter((review) => review.hidden !== true && Number(review.rating) > 0);
    };

    const getStars = (rating) => {
        const safeRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
        return "&#9733;".repeat(safeRating) + "&#9734;".repeat(5 - safeRating);
    };

    const animateCounter = (element, target) => {
        const duration = 1100;
        const start = performance.now();

        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.textContent = Math.round(target * eased).toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        };

        requestAnimationFrame(tick);
    };

    const setCounterValue = (element, value) => {
        if (!element) return;

        element.dataset.target = String(value);
        element.textContent = Number(element.dataset.target).toLocaleString();
    };

    const updateHomeStats = () => {
        setCounterValue(completedClientsCounter, countCompletedAppointments());
        setCounterValue(activeServicesCounter, countActiveServices());

        if (averageRating) {
            averageRating.textContent = getAverageRating();
        }
    };

    const loadLiveHomeData = async () => {
        if (!liveData || !liveData.getSummary) {
            return;
        }

        try {
            const summary = await liveData.getSummary();
            const liveReviews = Array.isArray(summary.reviews) ? summary.reviews : [];

            liveCompletedClients = Number(summary.completedClients) || 0;

            if (completedClientsCounter) {
                setCounterValue(completedClientsCounter, liveCompletedClients);
            }

            if (averageRating) {
                averageRating.textContent = (Number(summary.averageRating) || 0).toFixed(1);
            }

            liveHomeReviews = liveReviews;
            renderHomeReviews();
        } catch (error) {
            liveCompletedClients = 0;
            liveHomeReviews = [];
            updateHomeStats();
            renderHomeReviews();
        }
    };

    const renderHomeReviews = () => {
        if (!homeReviews) return;

        const visibleReviews = getRealVisibleReviews()
            .slice()
            .sort((first, second) => {
                if (first.featured !== second.featured) {
                    return first.featured ? -1 : 1;
                }

                const firstTime = new Date(first.updatedAt || first.createdAt || 0).getTime();
                const secondTime = new Date(second.updatedAt || second.createdAt || 0).getTime();
                return secondTime - firstTime;
            })
            .slice(0, 3);

        if (visibleReviews.length === 0) {
            homeReviews.innerHTML = '<div class="review-empty">No customer reviews yet.</div>';
            return;
        }

        homeReviews.innerHTML = visibleReviews.map((review) => `
            <article class="review-card reveal visible">
                <div class="stars" aria-label="${escapeHtml(review.rating)} out of 5 rating">${getStars(review.rating)}</div>
                <p>"${escapeHtml(review.message || "Customer shared a salon review.")}"</p>
                <strong>${escapeHtml(review.customerName || "Customer")}</strong>
            </article>
        `).join("");
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

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.14 });

    revealItems.forEach((item) => revealObserver.observe(item));

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const element = entry.target;
            const target = Number(element.dataset.target);
            animateCounter(element, target);
            counterObserver.unobserve(element);
        });
    }, { threshold: 0.6 });

    updateHomeStats();
    renderHomeReviews();
    loadLiveHomeData();
    counters.forEach((counter) => counterObserver.observe(counter));

    window.addEventListener("storage", (event) => {
        if (event.key !== servicesKey) {
            return;
        }

        updateHomeStats();
    });

    window.addEventListener("pageshow", () => {
        updateHomeStats();
        renderHomeReviews();
    });

});
