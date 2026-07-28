document.addEventListener("DOMContentLoaded", () => {
    const appointmentsKey = "glow-grace-appointments";
    const profileKey = "glow-grace-profile";
    const notificationsKey = "glow-grace-notifications";
    const activityDateKey = "glow-grace-admin-activity-date";
    const liveData = window.GlowGraceLiveData;
    const appointmentList = document.querySelector("[data-appointment-list]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const searchInput = document.querySelector("[data-search]");
    const dateInput = document.querySelector("[data-date-filter]");
    const resultCount = document.querySelector("[data-result-count]");
    let appointments = [];
    let activeFilter = "all";

    const readJson = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value || fallback;
        } catch (error) {
            return fallback;
        }
    };

    const saveAppointments = () => {
        localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
    };

    const addNotification = ({ title, message, appointmentId, type = "appointment" }) => {
        const storedNotifications = readJson(notificationsKey, []);
        const notifications = Array.isArray(storedNotifications) ? storedNotifications : [];

        notifications.unshift({
            id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            type,
            title,
            message,
            appointmentId,
            read: false,
            createdAt: new Date().toISOString(),
        });

        localStorage.setItem(notificationsKey, JSON.stringify(notifications.slice(0, 50)));
    };

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const formatCurrency = (amount) => `Rs. ${(Number(amount) || 0).toLocaleString("en-IN")}`;

    const toDateValue = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const syncActivityDate = () => {
        if (!dateInput) {
            return;
        }

        const todayValue = toDateValue(new Date());
        const savedDate = localStorage.getItem(activityDateKey) || "";
        dateInput.max = todayValue;

        if (!dateInput.value) {
            dateInput.value = savedDate && savedDate <= todayValue ? savedDate : todayValue;
        }

        if (dateInput.value > todayValue) {
            dateInput.value = todayValue;
        }

        localStorage.setItem(activityDateKey, dateInput.value);
    };

    const getActivitySource = (appointment) => (
        appointment.createdAt
        || appointment.bookedAt
        || appointment.paymentUpdatedAt
        || appointment.updatedAt
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

    const getActivityDate = (appointment) => {
        const source = getActivitySource(appointment);
        const date = source && source.includes("T")
            ? new Date(source)
            : new Date(`${source}T00:00:00`);

        if (!Number.isNaN(date.getTime())) {
            return toDateValue(date);
        }

        return appointment.date || "";
    };

    const matchesSelectedDate = (appointment) => !dateInput
        || !dateInput.value
        || getActivityDate(appointment) === dateInput.value;

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "Date not set";
        }

        const date = new Date(`${dateValue}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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

    const formatTime = (timeValue) => {
        if (!timeValue) {
            return "";
        }

        const [hourValue, minuteValue] = timeValue.split(":");
        const hour = Number(hourValue);
        const minute = Number(minuteValue);

        if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
            return timeValue;
        }

        const period = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
    };

    const normalizeStatus = (status) => {
        if (status === "completed" || status === "cancelled") {
            return status;
        }

        return "upcoming";
    };

    const getCustomerName = (appointment = {}) => {
        if (appointment.customerName || appointment.customerEmail || appointment.customerMobile) {
            return appointment.customerName || appointment.customerEmail || appointment.customerMobile;
        }

        const profile = readJson(profileKey, {});
        return profile.name || profile.email || profile.mobile || "Customer";
    };

    const getAppointments = () => {
        const storedAppointments = readJson(appointmentsKey, []);
        return Array.isArray(storedAppointments) ? storedAppointments : [];
    };

    const isPendingPayment = (appointment) => Number(appointment.remaining) > 0 || appointment.paymentStatus === "Pending";

    const getAdminLabel = (appointment) => {
        if (appointment.adminStatus) {
            return appointment.adminStatus;
        }

        const status = normalizeStatus(appointment.status);

        if (status === "completed") {
            return "Completed";
        }

        if (status === "cancelled") {
            return "Cancelled";
        }

        return "Waiting";
    };

    const updateCounts = () => {
        const scopedAppointments = appointments.filter(matchesSelectedDate);
        const counts = {
            all: scopedAppointments.length,
            upcoming: 0,
            completed: 0,
            cancelled: 0,
            "pending-payment": 0,
        };

        scopedAppointments.forEach((appointment) => {
            const status = normalizeStatus(appointment.status);
            counts[status] += 1;

            if (isPendingPayment(appointment)) {
                counts["pending-payment"] += 1;
            }
        });

        Object.entries(counts).forEach(([key, value]) => {
            const target = document.querySelector(`[data-count="${key}"]`);

            if (target) {
                target.textContent = value;
            }
        });
    };

    const updateAppointment = async (appointmentId, updater, notificationBuilder) => {
        const appointment = appointments.find((item) => item.id === appointmentId);

        if (!appointment) {
            return;
        }

        const updates = {
            ...updater(appointment),
            updatedAt: new Date().toISOString(),
        };
        let updatedAppointment = {
            ...appointment,
            ...updates,
        };
        const notification = notificationBuilder ? notificationBuilder(updatedAppointment, appointment) : null;

        if (liveData && liveData.updateAppointment) {
            try {
                updatedAppointment = {
                    ...updatedAppointment,
                    ...await liveData.updateAppointment(appointmentId, updates, { admin: true }),
                };
            } catch (error) {
                renderAppointments();
                return;
            }
        }

        appointments = appointments.map((item) => (
            item.id === appointmentId ? updatedAppointment : item
        ));
        saveAppointments();

        if (notification) {
            addNotification(notification);
        }

        renderAppointments();
    };
    const buildSearchText = (appointment, customerName) => [
        appointment.id,
        appointment.paymentRef,
        customerName,
        appointment.service,
        appointment.stylist,
        appointment.date,
        appointment.time,
        formatBookedAt(appointment),
        appointment.paymentStatus,
        appointment.adminStatus,
        normalizeStatus(appointment.status),
    ].join(" ").toLowerCase();

    const appointmentMatchesFilter = (appointment) => {
        if (activeFilter === "all") {
            return true;
        }

        if (activeFilter === "pending-payment") {
            return isPendingPayment(appointment);
        }

        return normalizeStatus(appointment.status) === activeFilter;
    };

    const renderAppointmentCard = (appointment) => {
        const status = normalizeStatus(appointment.status);
        const customerName = getCustomerName(appointment);
        const paymentStatus = appointment.paymentStatus || (isPendingPayment(appointment) ? "Pending" : "Paid");
        const adminLabel = getAdminLabel(appointment);
        const canOperate = status === "upcoming";
        const rescheduledNote = appointment.adminStatus === "Rescheduled"
            ? `<p><strong>Admin update:</strong> This appointment was rescheduled by admin.</p>`
            : "";

        return `
            <article class="appointment-card" data-appointment-id="${escapeHtml(appointment.id)}">
                <div class="appointment-main">
                    <div class="appointment-topline">
                        <div>
                            <span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>
                            <span class="status-pill admin">${escapeHtml(adminLabel)}</span>
                            <span class="status-pill ${isPendingPayment(appointment) ? "pending" : "paid"}">${escapeHtml(paymentStatus)}</span>
                        </div>
                        <strong>#${escapeHtml(appointment.id || "New")}</strong>
                    </div>

                    <div class="booking-grid">
                        <div>
                            <span>Customer</span>
                            <strong>${escapeHtml(customerName)}</strong>
                        </div>
                        <div>
                            <span>Service</span>
                            <strong>${escapeHtml(appointment.service || "Salon appointment")}</strong>
                        </div>
                        <div>
                            <span>Stylist</span>
                            <strong>${escapeHtml(appointment.stylist || "Salon team")}</strong>
                        </div>
                        <div>
                            <span>Date & time</span>
                            <strong>${escapeHtml(formatDate(appointment.date))} at ${escapeHtml(appointment.time || "time not set")}</strong>
                        </div>
                        <div>
                            <span>Booked at</span>
                            <strong>${escapeHtml(formatBookedAt(appointment))}</strong>
                        </div>
                    </div>

                    <div class="reschedule-row">
                        <label>
                            <span>New date</span>
                            <input type="date" value="${escapeHtml(appointment.date || "")}" data-reschedule-date>
                        </label>
                        <label>
                            <span>New time</span>
                            <input type="time" value="${escapeHtml(appointment.time24 || "")}" data-reschedule-time>
                        </label>
                        <button type="button" data-action="reschedule">Save reschedule</button>
                    </div>

                    <div class="payment-details" data-payment-details hidden>
                        <p><strong>Payment:</strong> ${escapeHtml(paymentStatus)} via ${escapeHtml(appointment.paymentMethod || "Not selected")}</p>
                        <p><strong>Booked at:</strong> ${escapeHtml(formatBookedAt(appointment))}</p>
                        <p><strong>Total:</strong> ${escapeHtml(formatCurrency(appointment.total))} | <strong>Paid:</strong> ${escapeHtml(formatCurrency(appointment.amountPaid))} | <strong>Remaining:</strong> ${escapeHtml(formatCurrency(appointment.remaining))}</p>
                        <p><strong>Reference:</strong> ${escapeHtml(appointment.paymentRef || "Not available")}</p>
                        ${rescheduledNote}
                    </div>
                </div>

                <div class="card-actions">
                    <button type="button" data-action="accept" ${canOperate ? "" : "disabled"}>Accept</button>
                    <button type="button" data-action="reject" ${canOperate ? "" : "disabled"}>Reject</button>
                    <button type="button" data-action="complete" ${canOperate ? "" : "disabled"}>Mark completed</button>
                    <button type="button" class="danger" data-action="cancel" ${status === "cancelled" ? "disabled" : ""}>Cancel</button>
                    <button type="button" data-action="payment">View payment</button>
                </div>
            </article>
        `;
    };

    const bindAppointmentActions = () => {
        if (!appointmentList) return;

        appointmentList.querySelectorAll(".appointment-card").forEach((card) => {
            const appointmentId = card.dataset.appointmentId;

            card.querySelectorAll("[data-action]").forEach((button) => {
                button.addEventListener("click", () => {
                    const action = button.dataset.action;

                    if (action === "payment") {
                        const details = card.querySelector("[data-payment-details]");
                        details.hidden = !details.hidden;
                        button.textContent = details.hidden ? "View payment" : "Hide payment";
                        return;
                    }

                    if (action === "reschedule") {
                        const dateField = card.querySelector("[data-reschedule-date]");
                        const timeField = card.querySelector("[data-reschedule-time]");
                        const selectedTime = timeField.value || "";

                        updateAppointment(
                            appointmentId,
                            (appointment) => ({
                                date: dateField.value || appointment.date,
                                time: selectedTime ? formatTime(selectedTime) : appointment.time,
                                time24: selectedTime || appointment.time24 || "",
                                status: "upcoming",
                                adminStatus: "Rescheduled",
                            }),
                            (appointment) => ({
                                title: "Appointment rescheduled",
                                message: `Your ${appointment.service || "salon appointment"} was rescheduled to ${formatDate(appointment.date)} at ${appointment.time || "the selected time"}.`,
                                appointmentId: appointment.id,
                            })
                        );
                        return;
                    }

                    const updates = {
                        accept: { status: "upcoming", adminStatus: "Accepted" },
                        reject: { status: "cancelled", adminStatus: "Rejected" },
                        complete: { status: "completed", adminStatus: "Completed" },
                        cancel: { status: "cancelled", adminStatus: "Cancelled" },
                    };

                    if (updates[action]) {
                        const notificationCopy = {
                            accept: {
                                title: "Appointment accepted",
                                getMessage: (appointment) => `Your ${appointment.service || "salon appointment"} has been accepted by the salon.`,
                            },
                            reject: {
                                title: "Appointment rejected",
                                getMessage: (appointment) => `Your ${appointment.service || "salon appointment"} was rejected by the salon. Please book another slot.`,
                            },
                            complete: {
                                title: "Appointment completed",
                                getMessage: (appointment) => `Your ${appointment.service || "salon appointment"} has been marked completed.`,
                            },
                            cancel: {
                                title: "Appointment cancelled",
                                getMessage: (appointment) => `Your ${appointment.service || "salon appointment"} was cancelled by the salon.`,
                            },
                        };

                        updateAppointment(
                            appointmentId,
                            () => updates[action],
                            (appointment) => ({
                                title: notificationCopy[action].title,
                                message: notificationCopy[action].getMessage(appointment),
                                appointmentId: appointment.id,
                            })
                        );
                    }
                });
            });
        });
    };

    const renderAppointments = () => {
        if (!appointmentList) return;

        updateCounts();
        const query = (searchInput && searchInput.value.trim().toLowerCase()) || "";
        const visibleAppointments = appointments.filter((appointment) => {
            const matchesDate = matchesSelectedDate(appointment);
            const matchesFilter = appointmentMatchesFilter(appointment);
            const matchesSearch = !query || buildSearchText(appointment, getCustomerName(appointment)).includes(query);
            return matchesDate && matchesFilter && matchesSearch;
        });

        if (resultCount) {
            resultCount.textContent = `${visibleAppointments.length} booking${visibleAppointments.length === 1 ? "" : "s"} shown`;
        }

        if (visibleAppointments.length === 0) {
            appointmentList.innerHTML = '<div class="empty-state">No appointments match this filter.</div>';
            return;
        }

        appointmentList.innerHTML = visibleAppointments
            .slice()
            .sort((first, second) => {
                const timeDelta = getActivityTime(second) - getActivityTime(first);
                return timeDelta || String(second.id || "").localeCompare(String(first.id || ""));
            })
            .map(renderAppointmentCard)
            .join("");

        bindAppointmentActions();
    };

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter;

            filterButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", String(isActive));
            });

            renderAppointments();
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", renderAppointments);
    }

    if (dateInput) {
        syncActivityDate();
        dateInput.addEventListener("change", () => {
            syncActivityDate();
            renderAppointments();
        });
    }

    const loadAppointments = async () => {
        if (window.GlowGraceAdminAuth) {
            const admin = await window.GlowGraceAdminAuth.ensure();

            if (!admin) {
                return;
            }
        }

        appointments = [];
        saveAppointments();
        renderAppointments();

        if (liveData && liveData.getAdminAppointments) {
            try {
                appointments = await liveData.getAdminAppointments();
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
