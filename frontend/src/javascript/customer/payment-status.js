document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const paymentList = document.querySelector("[data-payment-list]");
    const historyCount = document.querySelector("[data-history-count]");
    const revealItems = document.querySelectorAll(".reveal");
    const appointmentsKey = "glow-grace-appointments";
    let selectedPaymentId = "";

    const formatCurrency = (amount) => `Rs. ${(Number(amount) || 0).toLocaleString("en-IN")}`;

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const setText = (selector, text) => {
        const element = document.querySelector(selector);

        if (element) {
            element.textContent = text;
        }
    };

    const readAppointments = () => {
        try {
            const storedAppointments = JSON.parse(localStorage.getItem(appointmentsKey) || "[]");
            return Array.isArray(storedAppointments) ? storedAppointments : [];
        } catch (error) {
            return [];
        }
    };

    const saveAppointments = (appointments) => {
        localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
    };

    const normalizeMethod = (method) => {
        const value = String(method || "Not selected").trim();
        return value ? value.toUpperCase() : "Not selected";
    };

    const getPaymentState = (appointment) => {
        const status = String(appointment.paymentStatus || "").toLowerCase();
        const paid = Number(appointment.amountPaid) || 0;
        const remaining = Number(appointment.remaining) || 0;

        if (status === "refunded") return "refunded";
        if (status === "failed") return "failed";
        if (status === "paid" || remaining === 0 && paid > 0) return "paid";
        if (paid > 0 && remaining > 0) return "part-paid";
        return "pending";
    };

    const getPaymentLabel = (appointment) => ({
        paid: "Paid",
        pending: "Pending",
        "part-paid": "Part paid",
        failed: "Failed",
        refunded: "Refunded",
    }[getPaymentState(appointment)]);

    const getStatusContent = (appointment) => {
        const state = getPaymentState(appointment);

        if (state === "paid") {
            return {
                className: "status-success",
                icon: "OK",
                eyebrow: "Payment successful",
                title: "Payment completed.",
                message: "This appointment payment is completed and saved in your payment history.",
            };
        }

        if (state === "failed") {
            return {
                className: "status-failed",
                icon: "!",
                eyebrow: "Payment failed",
                title: "Payment needs attention.",
                message: "No payment was captured for this appointment. You can retry payment or contact the salon.",
            };
        }

        if (state === "refunded") {
            return {
                className: "status-failed",
                icon: "RF",
                eyebrow: "Payment refunded",
                title: "Refund processed.",
                message: "This payment was refunded by the salon team.",
            };
        }

        if (state === "part-paid") {
            return {
                className: "status-pending",
                icon: "...",
                eyebrow: "Part payment",
                title: "Some balance is still pending.",
                message: "A partial amount has been paid. Please clear the remaining balance online or at the salon.",
            };
        }

        return {
            className: "status-pending",
            icon: "...",
            eyebrow: "Payment pending",
            title: "Payment is pending.",
            message: "This appointment still has a pending balance. Please complete payment when ready.",
        };
    };

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "";
        }

        const date = new Date(`${dateValue}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const getSlotLabel = (appointment) => {
        const date = formatDate(appointment.date);
        const time = appointment.time || "";
        return [date, time].filter(Boolean).join(" at ") || "Not selected";
    };

    const paymentHasDetails = (appointment) => Boolean(
        appointment
        && (
            appointment.paymentRef
            || appointment.paymentStatus
            || Number(appointment.total) > 0
            || Number(appointment.amountPaid) > 0
            || Number(appointment.remaining) > 0
        )
    );

    const getPaymentRecords = () => readAppointments()
        .filter(paymentHasDetails)
        .sort((first, second) => {
            const firstTime = new Date(first.paymentUpdatedAt || first.updatedAt || first.createdAt || first.date || 0).getTime();
            const secondTime = new Date(second.paymentUpdatedAt || second.updatedAt || second.createdAt || second.date || 0).getTime();
            return secondTime - firstTime;
        });

    const getPaymentId = (payment = {}) => String(payment.id || payment.paymentRef || "");

    const saveAppointment = (appointment) => {
        const appointments = readAppointments();
        const existingIndex = appointments.findIndex((item) => item.id === appointment.id);

        if (existingIndex >= 0) {
            const existingStatus = appointments[existingIndex].status;
            const shouldKeepManualStatus = existingStatus === "completed" || existingStatus === "cancelled";

            appointments[existingIndex] = {
                ...appointments[existingIndex],
                ...appointment,
                status: shouldKeepManualStatus ? existingStatus : appointment.status,
                createdAt: appointments[existingIndex].createdAt || appointment.createdAt,
                updatedAt: new Date().toISOString(),
            };
        } else {
            appointments.unshift(appointment);
        }

        saveAppointments(appointments);
    };

    const savePaymentFromUrl = () => {
        const params = new URLSearchParams(window.location.search);

        if (!params.has("status") && !params.has("appointmentId")) {
            return "";
        }

        const requestedStatus = params.get("status") || "pending";
        const status = ["success", "pending", "failed"].includes(requestedStatus) ? requestedStatus : "pending";
        const method = params.get("method") || "Not selected";
        const amount = Number(params.get("amount")) || 0;
        const total = Number(params.get("total")) || amount;
        const remaining = Number(params.get("remaining")) || (status === "success" ? 0 : total);
        const ref = params.get("ref") || `GG${Date.now().toString().slice(-6)}`;
        const appointmentId = params.get("appointmentId") || `APT-${ref}`;
        const service = params.get("service") || "";
        const stylist = params.get("stylist") || "";
        const hasChosenSlot = Boolean(params.get("date") || params.get("time"));
        const hasChosenService = Boolean(
            service
            && service !== "Salon appointment"
            && stylist
            && stylist !== "Salon team"
        );

        if (!hasChosenSlot && !hasChosenService) {
            return "";
        }

        saveAppointment({
            id: appointmentId,
            paymentRef: ref,
            customerName: params.get("customerName") || "",
            customerEmail: params.get("customerEmail") || "",
            customerMobile: params.get("customerMobile") || "",
            service: service || "Salon appointment",
            stylist: stylist || "Salon team",
            date: params.get("date") || "",
            time: params.get("time") || "",
            notes: params.get("notes") || "",
            duration: params.get("duration") || "",
            description: params.get("description") || "",
            status: "upcoming",
            paymentStatus: status === "success" ? "Paid" : status === "failed" ? "Failed" : "Pending",
            paymentMethod: normalizeMethod(method),
            amountPaid: status === "success" ? amount : 0,
            total,
            remaining: status === "success" ? 0 : remaining,
            createdAt: new Date().toISOString(),
            paymentUpdatedAt: new Date().toISOString(),
        });

        return appointmentId;
    };

    const buildPaymentUrl = (appointment) => {
        const remaining = Number(appointment.remaining) || 0;
        const total = Number(appointment.total) || 0;
        const amount = remaining > 0 ? remaining : total;
        const params = new URLSearchParams({
            amount: String(amount),
            total: String(total || amount),
            customerName: appointment.customerName || "",
            customerEmail: appointment.customerEmail || "",
            customerMobile: appointment.customerMobile || "",
            service: appointment.service || "",
            stylist: appointment.stylist || "",
            date: appointment.date || "",
            time: appointment.time || "",
            notes: appointment.notes || "",
            duration: appointment.duration || "",
            description: appointment.description || "",
            ref: appointment.paymentRef || "",
            appointmentId: appointment.id || "",
        });

        return `payment.html?${params.toString()}`;
    };

    const renderInlineDetails = (payment) => {
        const state = getPaymentState(payment);
        const secondaryAction = state === "paid" || state === "refunded"
            ? '<a class="secondary-action" href="booking.html">Book another</a>'
            : `<a class="secondary-action" href="${escapeHtml(buildPaymentUrl(payment))}">Pay now</a>`;

        return `
            <div class="payment-inline-details" data-inline-receipt>
                <div class="inline-details-heading">
                    <div>
                        <span class="receipt-tag">Receipt</span>
                        <h4>Transaction details</h4>
                    </div>
                    <button class="secondary-action" type="button" data-print-receipt="${escapeHtml(payment.id || "")}">Print receipt</button>
                </div>
                <div class="receipt-list">
                    <div>
                        <span>Status</span>
                        <strong>${escapeHtml(getPaymentLabel(payment))}</strong>
                    </div>
                    <div>
                        <span>Appointment ID</span>
                        <strong>${escapeHtml(payment.id || "--")}</strong>
                    </div>
                    <div>
                        <span>Reference ID</span>
                        <strong>${escapeHtml(payment.paymentRef || "--")}</strong>
                    </div>
                    <div>
                        <span>Payment method</span>
                        <strong>${escapeHtml(normalizeMethod(payment.paymentMethod))}</strong>
                    </div>
                    <div>
                        <span>Amount paid</span>
                        <strong>${escapeHtml(formatCurrency(payment.amountPaid))}</strong>
                    </div>
                    <div>
                        <span>Total amount</span>
                        <strong>${escapeHtml(formatCurrency(payment.total))}</strong>
                    </div>
                    <div>
                        <span>Remaining</span>
                        <strong>${escapeHtml(formatCurrency(payment.remaining))}</strong>
                    </div>
                    <div>
                        <span>Service</span>
                        <strong>${escapeHtml(payment.service || "Salon appointment")}</strong>
                    </div>
                    <div>
                        <span>Stylist</span>
                        <strong>${escapeHtml(payment.stylist || "Salon team")}</strong>
                    </div>
                    <div>
                        <span>Date & time</span>
                        <strong>${escapeHtml(getSlotLabel(payment))}</strong>
                    </div>
                    <div>
                        <span>Customer</span>
                        <strong>${escapeHtml(payment.customerName || payment.customerEmail || payment.customerMobile || "Not added")}</strong>
                    </div>
                </div>
                <div class="inline-receipt-actions">
                    <a class="primary-action" href="my-appointments.html">View appointments</a>
                    ${secondaryAction}
                </div>
            </div>
        `;
    };

    const renderPaymentHistory = () => {
        if (!paymentList) return;

        const payments = getPaymentRecords();

        if (historyCount) {
            historyCount.textContent = `${payments.length} payment${payments.length === 1 ? "" : "s"}`;
        }

        if (payments.length === 0) {
            paymentList.innerHTML = '<div class="empty-history">No payment records yet. Complete a booking to see payments here.</div>';
            return;
        }

        if (selectedPaymentId && !payments.some((payment) => getPaymentId(payment) === selectedPaymentId)) {
            selectedPaymentId = "";
        }

        paymentList.innerHTML = payments.map((payment) => {
            const paymentId = getPaymentId(payment);
            const isSelected = paymentId === selectedPaymentId;
            const state = getPaymentState(payment);
            const paid = Number(payment.amountPaid) || 0;
            const remaining = Number(payment.remaining) || 0;

            return `
                <article class="payment-item ${isSelected ? "active" : ""}" data-payment-id="${escapeHtml(paymentId)}">
                    <div class="payment-main">
                        <div class="payment-topline">
                            <h3>${escapeHtml(payment.service || "Salon appointment")}</h3>
                            <span class="status-pill ${escapeHtml(state)}">${escapeHtml(getPaymentLabel(payment))}</span>
                        </div>
                        <div class="payment-meta">
                            <span>${escapeHtml(payment.id || "No appointment ID")}</span>
                            <span>${escapeHtml(getSlotLabel(payment))}</span>
                            <span>${escapeHtml(normalizeMethod(payment.paymentMethod))}</span>
                            <span>Ref ${escapeHtml(payment.paymentRef || "Not added")}</span>
                        </div>
                        <div class="payment-money">
                            <span>Total ${escapeHtml(formatCurrency(payment.total))}</span>
                            <span>Paid ${escapeHtml(formatCurrency(paid))}</span>
                            <span>Remaining ${escapeHtml(formatCurrency(remaining))}</span>
                        </div>
                    </div>
                    <button class="view-payment" type="button" data-view-payment="${escapeHtml(paymentId)}">${isSelected ? "Hide" : "View"}</button>
                    ${isSelected ? renderInlineDetails(payment) : ""}
                </article>
            `;
        }).join("");

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

    if (paymentList) {
        paymentList.addEventListener("click", (event) => {
            const viewButton = event.target.closest("[data-view-payment]");

            if (!viewButton || !paymentList.contains(viewButton)) {
                return;
            }

            const nextPaymentId = viewButton.dataset.viewPayment;
            selectedPaymentId = selectedPaymentId === nextPaymentId ? "" : nextPaymentId;
            renderPaymentHistory();
            if (selectedPaymentId) {
                Array.from(paymentList.querySelectorAll("[data-payment-id]"))
                    .find((item) => item.dataset.paymentId === selectedPaymentId)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        });
    }

    document.addEventListener("click", (event) => {
        if (event.target.closest("[data-print-receipt]")) {
            document.body.classList.add("printing-receipt");
            window.print();
            window.setTimeout(() => document.body.classList.remove("printing-receipt"), 250);
        }
    });

    window.addEventListener("storage", (event) => {
        if (event.key === appointmentsKey) {
            renderPaymentHistory();
        }
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

    savePaymentFromUrl();
    selectedPaymentId = "";
    renderPaymentHistory();
});
