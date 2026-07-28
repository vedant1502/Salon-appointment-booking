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
    const appointmentsKey = "glow-grace-appointments";
    const servicesKey = "glow-grace-services";
    const reviewsKey = "glow-grace-reviews";
    const liveData = window.GlowGraceLiveData;
    const defaultActiveServiceCount = 9;
    const demoReviewIds = new Set([
        "review-apt-gg063515",
        "review-glow-facial-001",
        "review-spa-002",
        "review-color-003",
        "review-party-makeup-004",
        "review-nail-005",
    ]);

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

    const countCompletedAppointments = () => (readArray(appointmentsKey) || []).filter((appointment) => {
        const status = String(appointment.status || "").toLowerCase();
        const adminStatus = String(appointment.adminStatus || "").toLowerCase();
        return status === "completed" || adminStatus === "completed";
    }).length;

    const countActiveServices = () => {
        const services = readArray(servicesKey);

        if (!services) {
            return defaultActiveServiceCount;
        }

        return services.filter((service) => service.active !== false).length;
    };

    const getAverageRating = () => {
        const reviews = readArray(reviewsKey) || [];
        const visibleReviews = reviews.filter((review) => {
            const rating = Number(review.rating);
            const isDemoReview = demoReviewIds.has(String(review.id || ""));
            return !isDemoReview && review.hidden !== true && rating > 0;
        });

        if (visibleReviews.length === 0) {
            return "0.0";
        }

        const total = visibleReviews.reduce((sum, review) => sum + Math.min(5, Math.max(1, Number(review.rating) || 0)), 0);
        return (total / visibleReviews.length).toFixed(1);
    };

    const getRealVisibleReviews = () => {
        const reviews = readArray(reviewsKey) || [];
        return reviews.filter((review) => (
            !demoReviewIds.has(String(review.id || ""))
            && review.hidden !== true
            && Number(review.rating) > 0
        ));
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

            if (completedClientsCounter) {
                setCounterValue(completedClientsCounter, Number(summary.completedClients) || 0);
            }

            if (averageRating) {
                averageRating.textContent = (Number(summary.averageRating) || 0).toFixed(1);
            }

            localStorage.setItem(reviewsKey, JSON.stringify(liveReviews));
            renderHomeReviews();
        } catch (error) {
            // Local home stats stay visible if the live backend is waking up.
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
        if (![appointmentsKey, servicesKey, reviewsKey].includes(event.key)) {
            return;
        }

        updateHomeStats();
        renderHomeReviews();
    });

    window.addEventListener("pageshow", () => {
        updateHomeStats();
        renderHomeReviews();
    });

});
