document.addEventListener("DOMContentLoaded", () => {
    const appointmentsKey = "glow-grace-appointments";
    const notificationsKey = "glow-grace-notifications";
    const activityDateKey = "glow-grace-admin-activity-date";
    const liveData = window.GlowGraceLiveData;
    const paymentList = document.querySelector("[data-payment-list]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const searchInput = document.querySelector("[data-search]");
    const dateInput = document.querySelector("[data-date-filter]");
    const resultCount = document.querySelector("[data-result-count]");
    let activeFilter = "all";
    let appointments = [];
    let pendingRefundId = "";

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

    const readNotifications = () => {
        try {
            const storedNotifications = JSON.parse(localStorage.getItem(notificationsKey) || "[]");
            return Array.isArray(storedNotifications) ? storedNotifications : [];
        } catch (error) {
            return [];
        }
    };

    const addNotification = ({ title, message, appointmentId, type = "payment" }) => {
        const notifications = readNotifications();

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

    const getPaymentActivitySource = (appointment) => (
        appointment.paymentUpdatedAt
        || appointment.updatedAt
        || appointment.createdAt
        || appointment.date
        || ""
    );

    const getPaymentActivityTime = (appointment) => {
        const source = getPaymentActivitySource(appointment);
        const date = source && source.includes("T")
            ? new Date(source)
            : new Date(`${source}T00:00:00`);

        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };

    const getPaymentActivityDate = (appointment) => {
        const source = getPaymentActivitySource(appointment);
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
        || getPaymentActivityDate(appointment) === dateInput.value;

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

    const getCustomerName = (appointment) => (
        appointment.customerName ||
        appointment.customerEmail ||
        appointment.customerMobile ||
        "Customer"
    );

    const getTotal = (appointment) => {
        const total = Number(appointment.total);
        const paid = Number(appointment.amountPaid);
        const remaining = Number(appointment.remaining);

        if (Number.isFinite(total) && total > 0) return total;
        if (Number.isFinite(paid) || Number.isFinite(remaining)) {
            return (Number(paid) || 0) + (Number(remaining) || 0);
        }

        return 0;
    };

    const getPaymentState = (appointment) => {
        const status = String(appointment.paymentStatus || "").toLowerCase();
        const remaining = Number(appointment.remaining) || 0;

        if (status === "refunded") return "refunded";
        if (status === "failed") return "failed";
        if (status === "paid" || remaining === 0 && Number(appointment.amountPaid) > 0) return "paid";
        return "pending";
    };

    const getPaymentLabel = (appointment) => {
        const state = getPaymentState(appointment);
        const paid = Number(appointment.amountPaid) || 0;
        const total = getTotal(appointment);

        if (state === "pending" && paid > 0 && paid < total) {
            return "Part paid";
        }

        return {
            paid: "Paid",
            pending: "Pending",
            failed: "Failed",
            refunded: "Refunded",
        }[state];
    };

    const normalizeMethod = (method) => {
        const value = String(method || "Pending").toUpperCase();

        if (value === "SALON") return "CASH";
        if (value === "PENDING") return "Pending";
        return value;
    };

    const updateCounts = () => {
        const scopedAppointments = appointments.filter(matchesSelectedDate);
        const collected = scopedAppointments.reduce((sum, appointment) => sum + (Number(appointment.amountPaid) || 0), 0);
        const pendingAmount = scopedAppointments.reduce((sum, appointment) => sum + (getPaymentState(appointment) === "refunded" ? 0 : Number(appointment.remaining) || 0), 0);
        const paid = scopedAppointments.filter((appointment) => getPaymentState(appointment) === "paid").length;
        const pending = scopedAppointments.filter((appointment) => getPaymentState(appointment) === "pending").length;

        document.querySelector('[data-count="collected"]').textContent = formatCurrency(collected);
        document.querySelector('[data-count="pending-amount"]').textContent = formatCurrency(pendingAmount);
        document.querySelector('[data-count="paid"]').textContent = paid;
        document.querySelector('[data-count="pending"]').textContent = pending;
    };

    const paymentMatchesFilter = (appointment) => {
        if (activeFilter === "all") return true;
        return getPaymentState(appointment) === activeFilter;
    };

    const buildSearchText = (appointment) => [
        appointment.id,
        appointment.paymentRef,
        getCustomerName(appointment),
        appointment.customerEmail,
        appointment.customerMobile,
        appointment.service,
        appointment.stylist,
        appointment.paymentStatus,
        appointment.paymentMethod,
        appointment.date,
        appointment.time,
    ].join(" ").toLowerCase();

    const updateAppointment = async (appointmentId, updater, notificationBuilder) => {
        let notification = null;
        let updates = null;

        appointments = appointments.map((appointment) => {
            if (appointment.id !== appointmentId) {
                return appointment;
            }

            updates = {
                ...updater(appointment),
                paymentUpdatedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            const updatedAppointment = {
                ...appointment,
                ...updates,
            };

            if (notificationBuilder) {
                notification = notificationBuilder(updatedAppointment, appointment);
            }

            return updatedAppointment;
        });

        saveAppointments();

        if (notification) {
            addNotification(notification);
        }

        renderPayments();

        if (liveData && liveData.updateAppointment && updates) {
            try {
                const syncedAppointment = await liveData.updateAppointment(appointmentId, updates, { admin: true });

                if (syncedAppointment) {
                    appointments = appointments.map((appointment) => (
                        appointment.id === appointmentId ? { ...appointment, ...syncedAppointment } : appointment
                    ));
                    saveAppointments();
                    renderPayments();
                }
            } catch (error) {
                // Local admin edits remain visible if the live backend is temporarily unavailable.
            }
        }
    };
    const renderPaymentCard = (appointment) => {
        const state = getPaymentState(appointment);
        const total = getTotal(appointment);
        const paid = Number(appointment.amountPaid) || 0;
        const remaining = Number(appointment.remaining) || 0;
        const method = normalizeMethod(appointment.paymentMethod);
        const refundConfirm = pendingRefundId === appointment.id;

        return `
            <article class="payment-card" data-payment-id="${escapeHtml(appointment.id)}">
                <div class="payment-info">
                    <div class="status-row">
                        <span class="status-pill ${escapeHtml(state)}">${escapeHtml(getPaymentLabel(appointment))}</span>
                        <span class="status-pill ${remaining > 0 ? "pending" : "paid"}">${remaining > 0 ? "Balance due" : "No balance"}</span>
                    </div>
                    <h3>${escapeHtml(appointment.service || "Salon appointment")}</h3>
                    <p>${escapeHtml(getCustomerName(appointment))} | ${escapeHtml(formatDate(appointment.date))} at ${escapeHtml(appointment.time || "time not set")}</p>
                    <div class="payment-meta">
                        <span>#${escapeHtml(appointment.id || "No ID")}</span>
                        <span>Ref ${escapeHtml(appointment.paymentRef || "Not added")}</span>
                        <span>${escapeHtml(method)}</span>
                        <span>${escapeHtml(appointment.stylist || "Salon team")}</span>
                    </div>
                    <div class="money-grid">
                        <div><span>Total</span><strong>${escapeHtml(formatCurrency(total))}</strong></div>
                        <div><span>Paid</span><strong>${escapeHtml(formatCurrency(paid))}</strong></div>
                        <div><span>Remaining</span><strong>${escapeHtml(formatCurrency(remaining))}</strong></div>
                    </div>
                    <div class="payment-details">
                        Customer contact: ${escapeHtml([appointment.customerEmail, appointment.customerMobile].filter(Boolean).join(" | ") || "Not added")}
                    </div>
                </div>

                <div class="payment-editor">
                    <div class="editor-grid">
                        <div class="readonly-field">
                            <span>Payment method</span>
                            <strong>${escapeHtml(method)}</strong>
                        </div>
                        <div class="readonly-field">
                            <span>Paid amount</span>
                            <strong>${escapeHtml(formatCurrency(paid))}</strong>
                        </div>
                    </div>
                    <div class="payment-actions">
                        <button type="button" data-action="paid">Mark paid</button>
                        <button type="button" data-action="pending">Mark pending</button>
                        <button type="button" data-action="failed">Mark failed</button>
                        ${refundConfirm
                            ? `
                                <button class="confirm-refund" type="button" data-action="confirm-refund">Confirm refund</button>
                                <button type="button" data-action="cancel-refund">Cancel</button>
                            `
                            : '<button class="danger" type="button" data-action="refund">Refund</button>'}
                    </div>
                    <p class="form-message" role="status">${escapeHtml(appointment.adminPaymentNote || "")}</p>
                </div>
            </article>
        `;
    };

    const bindPaymentActions = () => {
        if (!paymentList) return;

        paymentList.querySelectorAll(".payment-card").forEach((card) => {
            const appointmentId = card.dataset.paymentId;

            card.querySelectorAll("[data-action]").forEach((button) => {
                button.addEventListener("click", () => {
                    const action = button.dataset.action;

                    if (action === "refund") {
                        pendingRefundId = appointmentId;
                        renderPayments();
                        return;
                    }

                    if (action === "cancel-refund") {
                        pendingRefundId = "";
                        renderPayments();
                        return;
                    }

                    if (action === "paid") {
                        updateAppointment(appointmentId, (appointment) => {
                            const total = getTotal(appointment);

                            return {
                                amountPaid: total,
                                remaining: 0,
                                total,
                                paymentStatus: "Paid",
                                adminPaymentNote: "Payment marked paid by admin.",
                            };
                        }, (appointment) => ({
                            title: "Payment marked paid",
                            message: `Your payment for ${appointment.service || "your appointment"} is now marked paid.`,
                            appointmentId: appointment.id,
                        }));
                        return;
                    }

                    if (action === "pending") {
                        updateAppointment(appointmentId, (appointment) => {
                            const total = getTotal(appointment);

                            return {
                                amountPaid: 0,
                                remaining: total,
                                total,
                                paymentStatus: "Pending",
                                adminPaymentNote: "Payment marked pending by admin.",
                            };
                        }, (appointment) => ({
                            title: "Payment pending",
                            message: `Your payment for ${appointment.service || "your appointment"} is pending. Remaining balance is ${formatCurrency(appointment.remaining)}.`,
                            appointmentId: appointment.id,
                        }));
                        return;
                    }

                    if (action === "failed") {
                        updateAppointment(appointmentId, (appointment) => {
                            const total = getTotal(appointment);

                            return {
                                amountPaid: 0,
                                remaining: total,
                                total,
                                paymentStatus: "Failed",
                                adminPaymentNote: "Payment marked failed by admin.",
                            };
                        }, (appointment) => ({
                            title: "Payment failed",
                            message: `Your payment for ${appointment.service || "your appointment"} was marked failed. Please retry or contact the salon.`,
                            appointmentId: appointment.id,
                        }));
                        return;
                    }

                    if (action === "confirm-refund") {
                        pendingRefundId = "";
                        updateAppointment(
                            appointmentId,
                            (appointment) => ({
                                amountPaid: 0,
                                remaining: 0,
                                total: getTotal(appointment),
                                paymentStatus: "Refunded",
                                adminPaymentNote: "Payment refunded by admin.",
                            }),
                            (appointment) => ({
                                title: "Refund processed",
                                message: `A refund was processed for ${appointment.service || "your appointment"}.`,
                                appointmentId: appointment.id,
                            })
                        );
                    }
                });
            });
        });
    };

    const renderPayments = () => {
        if (!paymentList) return;

        updateCounts();
        const query = (searchInput && searchInput.value.trim().toLowerCase()) || "";
        const visibleAppointments = appointments.filter((appointment) => {
            const matchesDate = matchesSelectedDate(appointment);
            const matchesFilter = paymentMatchesFilter(appointment);
            const matchesSearch = !query || buildSearchText(appointment).includes(query);
            return matchesDate && matchesFilter && matchesSearch;
        });

        if (resultCount) {
            resultCount.textContent = `${visibleAppointments.length} payment${visibleAppointments.length === 1 ? "" : "s"} shown`;
        }

        if (visibleAppointments.length === 0) {
            paymentList.innerHTML = '<div class="empty-state">No payment records match this filter.</div>';
            return;
        }

        paymentList.innerHTML = visibleAppointments
            .slice()
            .sort((first, second) => {
                const timeDelta = getPaymentActivityTime(second) - getPaymentActivityTime(first);
                return timeDelta || String(second.id || "").localeCompare(String(first.id || ""));
            })
            .map(renderPaymentCard)
            .join("");
        bindPaymentActions();
    };

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter;

            filterButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", String(isActive));
            });

            renderPayments();
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", renderPayments);
    }

    if (dateInput) {
        syncActivityDate();
        dateInput.addEventListener("change", () => {
            syncActivityDate();
            renderPayments();
        });
    }

    const loadPayments = async () => {
        appointments = readAppointments();
        renderPayments();

        if (liveData && liveData.getAdminAppointments) {
            try {
                appointments = await liveData.getAdminAppointments();
                saveAppointments();
                renderPayments();
            } catch (error) {
                // Local payment records remain visible if the live backend is waking up.
            }
        }
    };

    loadPayments();
});
