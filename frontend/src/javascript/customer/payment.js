document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const paymentForm = document.querySelector("[data-payment-form]");
    const methodRadios = document.querySelectorAll("[data-method-radio]");
    const methodOptions = document.querySelectorAll(".method-option");
    const methodPanels = document.querySelectorAll("[data-method-panel]");
    const formMessage = document.querySelector("[data-form-message]");
    const payButton = document.querySelector("[data-pay-button]");
    const cardNumberInput = document.querySelector("[data-card-number]");
    const expiryInput = document.querySelector("[data-expiry]");
    const revealItems = document.querySelectorAll(".reveal");
    const appointmentsKey = "glow-grace-appointments";
    let payableAmount = 0;
    let totalAmount = 0;
    let bookingDetails = {
        service: "",
        stylist: "Salon team",
        date: "",
        time: "",
        notes: "",
        duration: "",
        description: "",
        customerName: "",
        customerEmail: "",
        customerMobile: "",
        appointmentId: "",
        ref: "",
    };

    const formatCurrency = (amount) => `Rs. ${amount.toLocaleString("en-IN")}`;

    const hasPaymentDetails = () => payableAmount > 0 && Boolean(bookingDetails.service);

    const readAppointments = () => {
        try {
            const storedAppointments = JSON.parse(localStorage.getItem(appointmentsKey) || "[]");
            return Array.isArray(storedAppointments) ? storedAppointments : [];
        } catch (error) {
            return [];
        }
    };

    const normalizeMethod = (method) => {
        if (method === "upi") return "UPI";
        if (method === "card") return "Card";
        if (method === "salon") return "Pay at salon";
        return "Not selected";
    };

    const saveConfirmedBooking = (status, method) => {
        const appointments = readAppointments();
        const amountPaid = status === "pending" ? 0 : payableAmount;
        const ref = bookingDetails.ref || `GG${Date.now().toString().slice(-6)}`;
        const appointmentId = bookingDetails.appointmentId || `APT-${ref}`;
        const now = new Date().toISOString();
        const appointment = {
            id: appointmentId,
            paymentRef: ref,
            customerName: bookingDetails.customerName,
            customerEmail: bookingDetails.customerEmail,
            customerMobile: bookingDetails.customerMobile,
            service: bookingDetails.service || "Salon appointment",
            stylist: bookingDetails.stylist || "Salon team",
            date: bookingDetails.date,
            time: bookingDetails.time,
            notes: bookingDetails.notes,
            duration: bookingDetails.duration,
            description: bookingDetails.description,
            status: "upcoming",
            paymentStatus: status === "success" ? "Paid" : "Pending",
            paymentMethod: normalizeMethod(method),
            amountPaid,
            total: totalAmount,
            remaining: status === "pending" ? totalAmount : 0,
            createdAt: now,
            paymentUpdatedAt: now,
        };
        const existingIndex = appointments.findIndex((item) => item.id === appointment.id);

        bookingDetails.ref = ref;
        bookingDetails.appointmentId = appointmentId;

        if (existingIndex >= 0) {
            const existingStatus = appointments[existingIndex].status;
            const shouldKeepManualStatus = existingStatus === "completed" || existingStatus === "cancelled";

            appointments[existingIndex] = {
                ...appointments[existingIndex],
                ...appointment,
                status: shouldKeepManualStatus ? existingStatus : appointment.status,
                createdAt: appointments[existingIndex].createdAt || appointment.createdAt,
                updatedAt: now,
            };
        } else {
            appointments.unshift(appointment);
        }

        appointments.sort((first, second) => {
            const firstTime = new Date(first.paymentUpdatedAt || first.updatedAt || first.createdAt || first.date || 0).getTime();
            const secondTime = new Date(second.paymentUpdatedAt || second.updatedAt || second.createdAt || second.date || 0).getTime();
            return secondTime - firstTime;
        });

        localStorage.setItem(appointmentsKey, JSON.stringify(appointments));

        return {
            amountPaid,
            ref,
            appointmentId,
            remaining: appointment.remaining,
        };
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

    const setText = (selector, text) => {
        const element = document.querySelector(selector);

        if (element) {
            element.textContent = text;
        }
    };

    const readUrlData = () => {
        const params = new URLSearchParams(window.location.search);
        const amount = Number(params.get("amount"));

        bookingDetails = {
            service: params.get("service") || bookingDetails.service,
            stylist: params.get("stylist") || bookingDetails.stylist,
            date: params.get("date") || bookingDetails.date,
            time: params.get("time") || bookingDetails.time,
            notes: params.get("notes") || bookingDetails.notes,
            duration: params.get("duration") || bookingDetails.duration,
            description: params.get("description") || bookingDetails.description,
            customerName: params.get("customerName") || bookingDetails.customerName,
            customerEmail: params.get("customerEmail") || bookingDetails.customerEmail,
            customerMobile: params.get("customerMobile") || bookingDetails.customerMobile,
            appointmentId: params.get("appointmentId") || bookingDetails.appointmentId,
            ref: params.get("ref") || bookingDetails.ref,
        };

        if (Number.isFinite(amount) && amount > 0) {
            payableAmount = Math.round(amount);
            totalAmount = payableAmount;
        }

        setText("[data-order-title]", bookingDetails.service || "No booking selected");

        setText("[data-payable-amount]", formatCurrency(payableAmount));
    };

    const updateMethod = () => {
        const selectedMethod = document.querySelector("[data-method-radio]:checked").value;
        const isSalonPayment = selectedMethod === "salon";

        methodOptions.forEach((option) => {
            const input = option.querySelector("input");
            option.classList.toggle("active", input.checked);
        });

        methodPanels.forEach((panel) => {
            const isActive = panel.dataset.methodPanel === selectedMethod;

            panel.hidden = !isActive;
            panel.classList.toggle("active", isActive);
            panel.querySelectorAll("[data-required]").forEach((input) => {
                input.required = isActive && !isSalonPayment;
            });
        });

        payButton.textContent = "Pay now";
        payButton.disabled = !hasPaymentDetails();

        if (!hasPaymentDetails() && formMessage) {
            formMessage.classList.add("error");
            formMessage.textContent = "Please start from booking before making a payment.";
        }
    };

    const redirectToStatus = (status, method) => {
        const savedBooking = saveConfirmedBooking(status, method);
        const params = new URLSearchParams({
            status,
            method,
            amount: String(savedBooking.amountPaid),
            total: String(totalAmount),
            remaining: String(savedBooking.remaining),
            ref: savedBooking.ref,
            appointmentId: savedBooking.appointmentId,
            customerName: bookingDetails.customerName,
            customerEmail: bookingDetails.customerEmail,
            customerMobile: bookingDetails.customerMobile,
            service: bookingDetails.service,
            stylist: bookingDetails.stylist,
            date: bookingDetails.date,
            time: bookingDetails.time,
            notes: bookingDetails.notes,
            duration: bookingDetails.duration,
            description: bookingDetails.description,
        });

        window.location.href = `payment-status.html?${params.toString()}`;
    };

    methodRadios.forEach((radio) => {
        radio.addEventListener("change", updateMethod);
    });

    if (cardNumberInput) {
        cardNumberInput.addEventListener("input", () => {
            const digits = cardNumberInput.value.replace(/\D/g, "").slice(0, 16);
            cardNumberInput.value = digits.replace(/(.{4})/g, "$1 ").trim();
        });
    }

    if (expiryInput) {
        expiryInput.addEventListener("input", () => {
            const digits = expiryInput.value.replace(/\D/g, "").slice(0, 4);
            expiryInput.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
        });
    }

    paymentForm.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!hasPaymentDetails()) {
            formMessage.classList.add("error");
            formMessage.textContent = "Please start from booking before making a payment.";
            return;
        }

        if (!paymentForm.checkValidity()) {
            paymentForm.reportValidity();
            return;
        }

        const method = document.querySelector("[data-method-radio]:checked").value;
        const status = method === "salon" ? "pending" : "success";

        formMessage.classList.remove("error");
        formMessage.textContent = method === "salon"
            ? "Booking confirmed. Opening payment status..."
            : "Payment completed. Opening payment status...";

        window.setTimeout(() => redirectToStatus(status, method), 650);
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

    readUrlData();
    updateMethod();
});
