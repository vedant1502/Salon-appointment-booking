document.addEventListener("DOMContentLoaded", () => {
    const reviewsKey = "glow-grace-reviews";
    const appointmentsKey = "glow-grace-appointments";
    const profileKey = "glow-grace-profile";
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const reviewForm = document.querySelector("[data-review-form]");
    const appointmentSelect = document.querySelector("[data-appointment-select]");
    const formMessage = document.querySelector("[data-form-message]");
    const reviewList = document.querySelector("[data-review-list]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const ratingFilter = document.querySelector("[data-rating-filter]");
    const resultCount = document.querySelector("[data-result-count]");
    const revealItems = document.querySelectorAll(".reveal");
    const demoReviewIds = new Set([
        "review-apt-gg063515",
        "review-glow-facial-001",
        "review-spa-002",
        "review-color-003",
        "review-party-makeup-004",
        "review-nail-005",
    ]);
    let activeFilter = "all";
    let reviews = [];
    let completedAppointments = [];

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

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const cleanReviews = (items) => {
        const safeItems = Array.isArray(items) ? items : [];
        return safeItems.filter((review) => !demoReviewIds.has(String(review.id || "")));
    };

    const readReviews = () => {
        const storedReviews = readJson(reviewsKey, []);
        const cleanedReviews = cleanReviews(storedReviews);

        if (Array.isArray(storedReviews) && cleanedReviews.length !== storedReviews.length) {
            saveJson(reviewsKey, cleanedReviews);
        }

        return cleanedReviews;
    };

    const saveReviews = () => {
        saveJson(reviewsKey, reviews);
    };

    const readAppointments = () => {
        const appointments = readJson(appointmentsKey, []);
        return Array.isArray(appointments) ? appointments : [];
    };

    const getProfile = () => {
        const session = window.GlowGraceCustomerSession ? window.GlowGraceCustomerSession.get() : null;
        return {
            ...readJson(profileKey, {}),
            ...(session || {}),
        };
    };

    const normalizeStatus = (appointment) => {
        const status = String(appointment.status || "").toLowerCase();
        const adminStatus = String(appointment.adminStatus || "").toLowerCase();
        return status === "completed" || adminStatus === "completed" ? "completed" : status;
    };

    const getRating = (review) => Math.max(1, Math.min(5, Math.round(Number(review.rating) || 0)));

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "Date not added";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const makeReviewId = () => `review-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    const getCustomerIdentity = () => {
        const profile = getProfile();
        const formData = reviewForm ? new FormData(reviewForm) : new FormData();

        return {
            name: String(formData.get("customerName") || profile.name || "").trim(),
            email: String(formData.get("customerEmail") || profile.email || "").trim().toLowerCase(),
            mobile: String(profile.mobile || "").trim(),
        };
    };

    const reviewBelongsToCustomer = (review) => {
        const identity = getCustomerIdentity();
        const reviewEmail = String(review.customerEmail || "").trim().toLowerCase();
        const reviewMobile = String(review.customerMobile || "").trim();
        const reviewName = String(review.customerName || "").trim().toLowerCase();

        return Boolean(
            identity.email && reviewEmail === identity.email
            || identity.mobile && reviewMobile === identity.mobile
            || identity.name && reviewName === identity.name.toLowerCase()
        );
    };

    const getVisibleReviews = () => {
        const ratingValue = ratingFilter ? ratingFilter.value : "all";

        return reviews.filter((review) => {
            const isVisible = review.hidden !== true;
            const matchesFilter = activeFilter === "featured"
                ? review.featured === true
                : activeFilter === "mine"
                    ? reviewBelongsToCustomer(review)
                    : true;
            const matchesRating = ratingValue === "all" || getRating(review) === Number(ratingValue);
            return isVisible && matchesFilter && matchesRating;
        });
    };

    const updateHeader = () => {
        if (!header) return;
        header.classList.toggle("scrolled", window.scrollY > 12);
    };

    const setText = (selector, value) => {
        const element = document.querySelector(selector);

        if (element) {
            element.textContent = value;
        }
    };

    const updateSummary = () => {
        const visibleReviews = reviews.filter((review) => review.hidden !== true);
        const average = visibleReviews.length
            ? (visibleReviews.reduce((sum, review) => sum + getRating(review), 0) / visibleReviews.length).toFixed(1)
            : "0.0";

        setText("[data-average-rating]", average);
        setText("[data-total-reviews]", visibleReviews.length);
        setText("[data-featured-reviews]", visibleReviews.filter((review) => review.featured).length);
        setText("[data-completed-count]", `${completedAppointments.length} completed visit${completedAppointments.length === 1 ? "" : "s"}`);
    };

    const fillProfileFields = () => {
        if (!reviewForm) return;

        const profile = getProfile();

        if (reviewForm.elements.customerName) {
            reviewForm.elements.customerName.value = profile.name || "";
        }

        if (reviewForm.elements.customerEmail) {
            reviewForm.elements.customerEmail.value = profile.email || "";
        }
    };

    const populateAppointments = () => {
        if (!appointmentSelect) return;

        completedAppointments = readAppointments()
            .filter((appointment) => normalizeStatus(appointment) === "completed")
            .sort((first, second) => String(second.date || "").localeCompare(String(first.date || "")));

        appointmentSelect.innerHTML = [
            '<option value="">General salon visit</option>',
            ...completedAppointments.map((appointment) => {
                const label = [
                    appointment.service || "Salon appointment",
                    appointment.date ? formatDate(`${appointment.date}T00:00:00`) : "",
                    appointment.id || "",
                ].filter(Boolean).join(" | ");
                return `<option value="${escapeHtml(appointment.id || "")}">${escapeHtml(label)}</option>`;
            }),
        ].join("");

        updateSummary();
    };

    const applyAppointmentToForm = () => {
        if (!reviewForm || !appointmentSelect) return;

        const appointment = completedAppointments.find((item) => item.id === appointmentSelect.value);

        if (!appointment) {
            return;
        }

        if (reviewForm.elements.service) {
            reviewForm.elements.service.value = appointment.service || "";
        }

        if (reviewForm.elements.stylist) {
            reviewForm.elements.stylist.value = appointment.stylist || "";
        }

        if (reviewForm.elements.customerName && appointment.customerName) {
            reviewForm.elements.customerName.value = appointment.customerName;
        }

        if (reviewForm.elements.customerEmail && appointment.customerEmail) {
            reviewForm.elements.customerEmail.value = appointment.customerEmail;
        }
    };

    const renderReviewCard = (review) => {
        const rating = getRating(review);
        const featured = review.featured === true;
        const ownReview = reviewBelongsToCustomer(review);

        return `
            <article class="review-card">
                <div class="review-topline">
                    <div>
                        <div class="review-badges">
                            <span class="rating-badge">${escapeHtml(rating)} / 5</span>
                            ${featured ? '<span class="status-pill featured">Featured</span>' : ""}
                            ${ownReview ? '<span class="status-pill">Your review</span>' : ""}
                        </div>
                        <h3>${escapeHtml(review.title || "Customer review")}</h3>
                    </div>
                </div>
                <p class="review-copy">${escapeHtml(review.message || "")}</p>
                <div class="review-meta">
                    <span>${escapeHtml(review.customerName || "Customer")}</span>
                    <span>${escapeHtml(review.service || "Salon service")}</span>
                    <span>${escapeHtml(review.stylist || "Salon team")}</span>
                    <span>${escapeHtml(formatDate(review.createdAt))}</span>
                    ${review.appointmentId ? `<span>${escapeHtml(review.appointmentId)}</span>` : ""}
                </div>
                ${review.adminReply ? `
                    <div class="admin-reply">
                        <strong>Salon reply</strong>
                        <p>${escapeHtml(review.adminReply)}</p>
                    </div>
                ` : ""}
            </article>
        `;
    };

    const renderReviews = () => {
        if (!reviewList) return;

        updateSummary();
        const visibleReviews = getVisibleReviews()
            .slice()
            .sort((first, second) => {
                if (first.featured !== second.featured) {
                    return first.featured ? -1 : 1;
                }

                const firstTime = new Date(first.updatedAt || first.createdAt || 0).getTime();
                const secondTime = new Date(second.updatedAt || second.createdAt || 0).getTime();
                return secondTime - firstTime;
            });

        if (resultCount) {
            resultCount.textContent = `${visibleReviews.length} review${visibleReviews.length === 1 ? "" : "s"} shown`;
        }

        if (visibleReviews.length === 0) {
            reviewList.innerHTML = '<div class="empty-state">No customer reviews yet.</div>';
            return;
        }

        reviewList.innerHTML = visibleReviews.map(renderReviewCard).join("");
    };

    const saveSubmittedReview = () => {
        const formData = new FormData(reviewForm);
        const appointmentId = String(formData.get("appointmentId") || "").trim();
        const selectedAppointment = completedAppointments.find((appointment) => appointment.id === appointmentId);
        const identity = getCustomerIdentity();
        const review = {
            id: makeReviewId(),
            appointmentId,
            customerName: identity.name || "Customer",
            customerEmail: identity.email,
            customerMobile: identity.mobile,
            service: String(formData.get("service") || selectedAppointment?.service || "Salon service").trim(),
            stylist: String(formData.get("stylist") || selectedAppointment?.stylist || "Salon team").trim(),
            rating: Number(formData.get("rating")) || 0,
            title: String(formData.get("title") || "").trim(),
            message: String(formData.get("message") || "").trim(),
            createdAt: new Date().toISOString(),
            featured: false,
            hidden: false,
            adminReply: "",
            source: "customer",
        };

        reviews = [review, ...readReviews()];
        saveReviews();
        renderReviews();
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

    if (appointmentSelect) {
        appointmentSelect.addEventListener("change", applyAppointmentToForm);
    }

    if (reviewForm && formMessage) {
        reviewForm.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!reviewForm.checkValidity()) {
                reviewForm.reportValidity();
                return;
            }

            saveSubmittedReview();
            formMessage.classList.remove("error");
            formMessage.textContent = "Review submitted. The salon team can now see it in admin.";
            reviewForm.reset();
            fillProfileFields();
        });

        reviewForm.addEventListener("reset", () => {
            window.setTimeout(() => {
                fillProfileFields();

                if (formMessage) {
                    formMessage.textContent = "";
                    formMessage.classList.remove("error");
                }
            }, 0);
        });
    }

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter;

            filterButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", String(isActive));
            });

            renderReviews();
        });
    });

    if (ratingFilter) {
        ratingFilter.addEventListener("change", renderReviews);
    }

    window.addEventListener("storage", (event) => {
        if (event.key !== reviewsKey && event.key !== appointmentsKey) {
            return;
        }

        reviews = readReviews();
        populateAppointments();
        renderReviews();
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

    reviews = readReviews();
    fillProfileFields();
    populateAppointments();
    renderReviews();
});
