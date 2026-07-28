document.addEventListener("DOMContentLoaded", () => {
    const appointmentsKey = "glow-grace-appointments";
    const liveData = window.GlowGraceLiveData;
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const filterButtons = document.querySelectorAll("[data-status-filter]");
    const appointmentList = document.querySelector("[data-appointment-list]");
    const searchInput = document.querySelector("[data-appointment-search]");
    const emptyState = document.querySelector("[data-empty-state]");
    const countTargets = document.querySelectorAll("[data-count]");
    const revealItems = document.querySelectorAll(".reveal");
    let activeFilter = "all";
    let appointments = [];

    const statusLabels = {
        upcoming: "Upcoming",
        completed: "Completed",
        cancelled: "Cancelled",
    };

    const serviceDurations = {
        "Haircut and Blow Dry": "45 min",
        "Glow Facial": "60 min",
        "Relaxing Body Spa": "75 min",
        "Bridal Makeup": "3 hr 30 min",
        "Global Hair Coloring": "2 hr 15 min",
        "Manicure and Nail Art": "50 min",
        "Hair Spa Therapy": "70 min",
        "Party Makeup": "1 hr 30 min",
        "Threading and Waxing": "25 min",
        "Bridal Glow Package": "3 hr 30 min",
        "Fresh Start Combo": "1 hr 45 min",
        "Glow Day Combo": "2 hr 45 min",
        "Wedding Ready Combo": "4 hr 30 min",
    };

    const serviceDescriptions = {
        "Haircut and Blow Dry": "Face-framing haircut, shampoo, light conditioning, and a smooth blow dry finish.",
        "Glow Facial": "Gentle cleanse, exfoliation, massage, mask, and moisturizer for a fresh event-ready glow.",
        "Relaxing Body Spa": "Calming body spa and steam relaxation session.",
        "Bridal Makeup": "Long-lasting HD makeup with hairstyling, lashes, touch-up guidance, and draping.",
        "Global Hair Coloring": "Full hair color consultation, application, wash, and finishing style.",
        "Manicure and Nail Art": "Nail shaping, cuticle care, polish, and simple nail art.",
        "Hair Spa Therapy": "Deep conditioning, scalp massage, steam, and rinse.",
        "Party Makeup": "Soft glam makeup with base, eyes, lips, and setting finish.",
        "Threading and Waxing": "Quick grooming with clean shaping and soothing aftercare.",
        "Bridal Glow Package": "Makeup, hair styling, draping, and pre-event skin prep.",
        "Fresh Start Combo": "Haircut, blow dry, threading, and quick cleanup bundled together.",
        "Glow Day Combo": "Glow facial, hair spa, manicure, and light styling in one salon visit.",
        "Wedding Ready Combo": "Bridal makeup, hairstyling, draping, facial, and nails.",
    };

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const formatCurrency = (amount) => {
        const numericAmount = Number(amount) || 0;
        return `Rs. ${numericAmount.toLocaleString("en-IN")}`;
    };

    const readAppointments = () => {
        try {
            const storedAppointments = JSON.parse(localStorage.getItem(appointmentsKey) || "[]");
            return Array.isArray(storedAppointments) ? storedAppointments : [];
        } catch (error) {
            return [];
        }
    };

    const saveAppointments = () => {
        localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
    };

    const getActivitySource = (appointment) => (
        appointment.paymentUpdatedAt
        || appointment.updatedAt
        || appointment.createdAt
        || appointment.date
        || ""
    );

    const getActivityTime = (appointment) => {
        const source = getActivitySource(appointment);
        const date = source && source.includes("T")
            ? new Date(source)
            : new Date(`${source}T00:00:00`);

        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };

    const updateHeader = () => {
        if (!header) return;
        header.classList.toggle("scrolled", window.scrollY > 12);
    };

    const buildDateParts = (dateValue) => {
        const fallback = { month: "New", day: "--", weekday: "Slot" };

        if (!dateValue) {
            return fallback;
        }

        const date = new Date(`${dateValue}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return {
                month: String(dateValue).slice(0, 3) || fallback.month,
                day: "--",
                weekday: "Date",
            };
        }

        return {
            month: date.toLocaleDateString("en-IN", { month: "short" }),
            day: date.toLocaleDateString("en-IN", { day: "2-digit" }),
            weekday: date.toLocaleDateString("en-IN", { weekday: "short" }),
        };
    };

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "Date not selected";
        }

        const date = new Date(`${dateValue}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    };

    const formatBookedAt = (appointment) => {
        const source = appointment.createdAt || appointment.updatedAt || "";

        if (!source) {
            return "Not recorded";
        }

        const date = source.includes("T") ? new Date(source) : new Date(`${source}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return "Not recorded";
        }

        return date.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    };

    const buildPaymentLink = (appointment) => {
        const amount = Number(appointment.remaining || appointment.total || appointment.amountPaid) || 0;
        const params = new URLSearchParams({
            amount: String(amount),
            service: appointment.service || "",
            stylist: appointment.stylist || "",
            date: appointment.date || "",
            time: appointment.time || "",
            notes: appointment.notes || "",
            appointmentId: appointment.id || "",
            ref: appointment.paymentRef || "",
        });

        return `payment.html?${params.toString()}`;
    };

    const buildBookingLink = (appointment) => {
        const params = new URLSearchParams({
            service: appointment.service || "",
            stylist: appointment.stylist || "",
            date: appointment.date || "",
            time: appointment.time || "",
            notes: appointment.notes || "",
        });

        return `booking.html?${params.toString()}`;
    };

    const updateCounts = () => {
        const counts = { upcoming: 0, completed: 0, cancelled: 0 };

        appointments.forEach((appointment) => {
            if (counts[appointment.status] !== undefined) {
                counts[appointment.status] += 1;
            }
        });

        countTargets.forEach((target) => {
            target.textContent = counts[target.dataset.count] || 0;
        });
    };

    const setAppointmentStatus = async (appointmentId, status) => {
        const appointment = appointments.find((item) => item.id === appointmentId);

        if (!appointment) {
            return;
        }

        const updates = {
            status,
            updatedAt: new Date().toISOString(),
        };
        const localAppointment = {
            ...appointment,
            ...updates,
        };
        let savedAppointment = localAppointment;

        if (liveData && liveData.updateAppointment) {
            try {
                savedAppointment = {
                    ...localAppointment,
                    ...await liveData.updateAppointment(appointmentId, updates),
                };
            } catch (error) {
                renderAppointments();
                return;
            }
        }

        appointments = appointments.map((item) => (
            item.id === appointmentId ? savedAppointment : item
        ));
        saveAppointments();
        renderAppointments();
    };

    const renderAppointment = (appointment) => {
        const dateParts = buildDateParts(appointment.date);
        const status = statusLabels[appointment.status] ? appointment.status : "upcoming";
        const statusLabel = statusLabels[status];
        const service = appointment.service || "Salon appointment";
        const stylist = appointment.stylist || "Salon team";
        const time = appointment.time || "Time not selected";
        const duration = appointment.duration || serviceDurations[service] || "Service duration";
        const description = appointment.description || serviceDescriptions[service] || "Your selected salon service is saved for this appointment.";
        const paymentStatus = appointment.paymentStatus || (Number(appointment.remaining) > 0 ? "Pending" : "Paid");
        const adminStatus = appointment.adminStatus || "";
        const displayedStatus = adminStatus || statusLabel;
        const displayedStatusClass = adminStatus === "Rejected" || adminStatus === "Cancelled"
            ? "cancelled"
            : adminStatus === "Completed"
                ? "completed"
                : status;
        const searchText = [
            service,
            stylist,
            appointment.id,
            appointment.paymentRef,
            appointment.date,
            formatDate(appointment.date),
            formatBookedAt(appointment),
            time,
            status,
            paymentStatus,
            adminStatus,
        ].join(" ").toLowerCase();
        const notesHtml = appointment.notes
            ? `<p><strong>Customer request:</strong> ${escapeHtml(appointment.notes)}</p>`
            : `<p><strong>Customer request:</strong> No special notes added.</p>`;
        const paymentAction = status === "upcoming" && Number(appointment.remaining || 0) > 0
            ? `<a href="${escapeHtml(buildPaymentLink(appointment))}">Pay now</a>`
            : "";
        const upcomingActions = status === "upcoming"
            ? `
                <a href="${escapeHtml(buildBookingLink(appointment))}">Reschedule</a>
                ${paymentAction}
                <button type="button" data-complete-appointment>Mark completed</button>
                <button type="button" class="danger" data-cancel-appointment>Cancel</button>
            `
            : "";
        const completedActions = status === "completed"
            ? `
                <a href="${escapeHtml(buildBookingLink(appointment))}">Book again</a>
                <a href="reviews-ratings.html">Rate service</a>
            `
            : "";
        const cancelledActions = status === "cancelled"
            ? `<a href="${escapeHtml(buildBookingLink(appointment))}">Book again</a>`
            : "";

        const card = document.createElement("article");
        card.className = "appointment-card reveal visible";
        card.dataset.status = status;
        card.dataset.search = searchText;
        card.dataset.appointmentId = appointment.id || "";
        card.innerHTML = `
            <div class="date-tile">
                <span>${escapeHtml(dateParts.month)}</span>
                <strong>${escapeHtml(dateParts.day)}</strong>
                <small>${escapeHtml(dateParts.weekday)}</small>
            </div>
            <div class="appointment-main">
                <div class="appointment-topline">
                    <span class="status-badge ${escapeHtml(displayedStatusClass)}">${escapeHtml(displayedStatus)}</span>
                    <span class="appointment-id">#${escapeHtml(appointment.id || "New")}</span>
                </div>
                <h3>${escapeHtml(service)}</h3>
                <p>With ${escapeHtml(stylist)} at ${escapeHtml(time)}. ${escapeHtml(description)}</p>
                <div class="meta-grid">
                    <span><strong>Booked at</strong>${escapeHtml(formatBookedAt(appointment))}</span>
                    <span><strong>Duration</strong>${escapeHtml(duration)}</span>
                    <span><strong>Total</strong>${escapeHtml(formatCurrency(appointment.total))}</span>
                    <span><strong>Payment</strong>${escapeHtml(paymentStatus)}</span>
                </div>
                <div class="appointment-details" hidden>
                    <p><strong>Date:</strong> ${escapeHtml(formatDate(appointment.date))}</p>
                    <p><strong>Booked at:</strong> ${escapeHtml(formatBookedAt(appointment))}</p>
                    <p><strong>Admin status:</strong> ${escapeHtml(adminStatus || "Waiting for admin review")}</p>
                    <p><strong>Reference:</strong> ${escapeHtml(appointment.paymentRef || "Not available")}</p>
                    <p><strong>Remaining:</strong> ${escapeHtml(formatCurrency(appointment.remaining))}</p>
                    ${notesHtml}
                </div>
                <div class="card-actions">
                    <button type="button" data-details-toggle>View details</button>
                    ${upcomingActions}
                    ${completedActions}
                    ${cancelledActions}
                </div>
            </div>
        `;

        return card;
    };

    const applyFilters = () => {
        const appointmentCards = appointmentList ? appointmentList.querySelectorAll("[data-status]") : [];
        const query = (searchInput && searchInput.value.trim().toLowerCase()) || "";
        let visibleCount = 0;

        appointmentCards.forEach((card) => {
            const matchesStatus = activeFilter === "all" || card.dataset.status === activeFilter;
            const matchesSearch = !query || card.dataset.search.includes(query);
            const shouldShow = matchesStatus && matchesSearch;

            card.classList.toggle("is-hidden", !shouldShow);

            if (shouldShow) {
                visibleCount += 1;
            }
        });

        if (emptyState) {
            const hasStoredAppointments = appointments.length > 0;
            emptyState.hidden = visibleCount > 0;
            const title = emptyState.querySelector("strong");
            const message = emptyState.querySelector("p");

            if (title && message) {
                title.textContent = hasStoredAppointments ? "No appointments found" : "No appointments booked yet";
                message.textContent = hasStoredAppointments
                    ? "Try another status filter or search term."
                    : "Book an appointment first, then it will appear here.";
            }
        }
    };

    const bindAppointmentActions = () => {
        if (!appointmentList) return;

        appointmentList.querySelectorAll(".appointment-card").forEach((card) => {
            const detailsButton = card.querySelector("[data-details-toggle]");
            const details = card.querySelector(".appointment-details");
            const cancelButton = card.querySelector("[data-cancel-appointment]");
            const completeButton = card.querySelector("[data-complete-appointment]");
            const appointmentId = card.dataset.appointmentId;

            if (detailsButton && details) {
                detailsButton.addEventListener("click", () => {
                    const willShow = details.hidden;

                    details.hidden = !willShow;
                    detailsButton.textContent = willShow ? "Hide details" : "View details";
                });
            }

            if (cancelButton) {
                cancelButton.addEventListener("click", () => {
                    setAppointmentStatus(appointmentId, "cancelled");
                });
            }

            if (completeButton) {
                completeButton.addEventListener("click", () => {
                    setAppointmentStatus(appointmentId, "completed");
                });
            }
        });
    };

    const renderAppointments = () => {
        if (!appointmentList) return;

        appointmentList.textContent = "";
        appointments
            .slice()
            .sort((first, second) => {
                const timeDelta = getActivityTime(second) - getActivityTime(first);
                return timeDelta || String(second.id || "").localeCompare(String(first.id || ""));
            })
            .forEach((appointment) => {
                appointmentList.appendChild(renderAppointment(appointment));
            });

        updateCounts();
        bindAppointmentActions();
        applyFilters();
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

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.statusFilter;

            filterButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", String(isActive));
            });

            applyFilters();
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
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

    const loadAppointments = async () => {
        if (window.GlowGraceCustomerSession) {
            const session = await window.GlowGraceCustomerSession.refresh({ redirectIfMissing: true });

            if (!session) {
                appointments = [];
                renderAppointments();
                return;
            }
        }

        appointments = [];
        saveAppointments();
        renderAppointments();

        if (liveData && liveData.getMyAppointments) {
            try {
                appointments = await liveData.getMyAppointments();
                saveAppointments();
                renderAppointments();
            } catch (error) {
                if (error.status === 401) {
                    appointments = [];
                    saveAppointments();
                    renderAppointments();
                }
            }
        }
    };

    loadAppointments();
});
