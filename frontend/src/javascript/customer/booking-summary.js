document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const revealItems = document.querySelectorAll(".reveal");
    const couponForm = document.querySelector("[data-coupon-form]");
    const couponMessage = document.querySelector("[data-coupon-message]");
    const discountRow = document.querySelector("[data-discount-row]");
    const discountPrice = document.querySelector("[data-discount-price]");
    const confirmCheck = document.querySelector("[data-confirm-check]");
    const confirmMessage = document.querySelector("[data-confirm-message]");
    const paymentLink = document.querySelector("[data-payment-link]");
    const customerForm = document.querySelector("[data-customer-form]");
    const formMessage = document.querySelector("[data-form-message]");
    const profileKey = "glow-grace-profile";
    const bookingRef = `GG${Date.now().toString().slice(-6)}`;

    const serviceDetails = {
        "Haircut and Blow Dry": { price: 499, duration: "45 min", description: "Face-framing haircut, shampoo, light conditioning, and a smooth blow dry finish." },
        "Glow Facial": { price: 899, duration: "60 min", description: "Gentle cleanse, exfoliation, massage, mask, and moisturizer for a fresh event-ready glow." },
        "Relaxing Body Spa": { price: 1499, duration: "75 min", description: "A calming oil massage and steam session to refresh tired muscles and reduce stress." },
        "Bridal Makeup": { price: 5499, duration: "3 hr 30 min", description: "Long-lasting HD makeup with hairstyling, lashes, touch-up guidance, and draping." },
        "Global Hair Coloring": { price: 1999, duration: "2 hr 15 min", description: "Full hair color consultation, application, wash, and finishing style for a fresh new shade." },
        "Manicure and Nail Art": { price: 699, duration: "50 min", description: "Nail shaping, cuticle care, polish, and simple nail art for clean everyday elegance." },
        "Hair Spa Therapy": { price: 1199, duration: "70 min", description: "Deep conditioning, scalp massage, steam, and rinse for softer, smoother hair texture." },
        "Party Makeup": { price: 2499, duration: "1 hr 30 min", description: "Soft glam makeup with base, eyes, lips, and setting finish for birthdays, parties, and photos." },
        "Threading and Waxing": { price: 299, duration: "25 min", description: "Quick grooming for brows, upper lip, arms, or face with clean shaping and soothing aftercare." },
        "Bridal Glow Package": { price: 5499, duration: "3 hr 30 min", description: "Makeup, hair styling, draping, and pre-event skin prep for the big day." },
        "Fresh Start Combo": { price: 1799, duration: "1 hr 45 min", description: "Haircut, blow dry, threading, and quick cleanup bundled for a fresh everyday reset." },
        "Glow Day Combo": { price: 2999, duration: "2 hr 45 min", description: "Glow facial, hair spa, manicure, and light styling planned as one relaxed salon visit." },
        "Wedding Ready Combo": { price: 7499, duration: "4 hr 30 min", description: "Bridal makeup, hairstyling, draping, facial, and nails for a complete event-ready look." },
    };

    let priceState = {
        service: 0,
        stylistFee: 0,
        tax: 0,
        discount: 0,
    };
    let currentTotal = 0;

    let bookingDetails = {
        service: "",
        stylist: "",
        date: "",
        time: "",
        notes: "",
        duration: "",
        description: "",
        ref: bookingRef,
        appointmentId: "",
    };

    const formatCurrency = (amount) => `Rs. ${amount.toLocaleString("en-IN")}`;

    const readJson = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value || fallback;
        } catch (error) {
            return fallback;
        }
    };

    const getCustomerDetails = () => {
        const formData = customerForm ? new FormData(customerForm) : new FormData();

        return {
            name: String(formData.get("name") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            mobile: String(formData.get("mobile") || "").trim(),
        };
    };

    const fillCustomerFormFromProfile = () => {
        if (!customerForm) return;

        const profile = readJson(profileKey, {});

        if (profile.name && customerForm.elements.name) {
            customerForm.elements.name.value = profile.name;
        }

        if (profile.mobile && customerForm.elements.mobile) {
            customerForm.elements.mobile.value = profile.mobile;
        }

        if (profile.email && customerForm.elements.email) {
            customerForm.elements.email.value = profile.email;
        }
    };

    const hasBookingDetails = () => Boolean(
        bookingDetails.service
        && bookingDetails.date
        && bookingDetails.time
    );

    const updatePaymentLinkState = () => {
        if (!paymentLink || !confirmCheck) {
            return;
        }

        const canContinue = confirmCheck.checked && hasBookingDetails();
        paymentLink.classList.toggle("is-disabled", !canContinue);
        paymentLink.setAttribute("aria-disabled", String(!canContinue));
    };

    const syncAppointmentId = () => {
        if (!bookingDetails.appointmentId && hasBookingDetails()) {
            bookingDetails.appointmentId = `APT-${bookingDetails.ref}`;
        }
    };

    const showMissingBookingMessage = () => {
        if (!confirmMessage) {
            return;
        }

        confirmMessage.classList.add("error");
        confirmMessage.textContent = "Please select a service, stylist, date, and time from the booking page first.";
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

    const updatePrices = () => {
        const total = priceState.service + priceState.stylistFee + priceState.tax - priceState.discount;
        currentTotal = total;

        document.querySelector("[data-service-price]").textContent = formatCurrency(priceState.service);
        document.querySelector("[data-stylist-fee]").textContent = formatCurrency(priceState.stylistFee);
        document.querySelector("[data-tax-price]").textContent = formatCurrency(priceState.tax);
        document.querySelector("[data-total-price]").textContent = formatCurrency(total);

        if (discountRow && discountPrice) {
            discountRow.hidden = priceState.discount === 0;
            discountPrice.textContent = `- ${formatCurrency(priceState.discount)}`;
        }

        if (paymentLink) {
            if (!hasBookingDetails()) {
                paymentLink.href = "booking.html";
                paymentLink.textContent = "Start booking first";
                updatePaymentLinkState();
                return;
            }

            syncAppointmentId();

            const notesField = document.querySelector('textarea[name="notes"]');
            const customer = getCustomerDetails();
            const service = document.querySelector("[data-summary-service]").textContent;
            const stylist = document.querySelector("[data-summary-stylist]").textContent;
            const time = document.querySelector("[data-summary-time]").textContent;
            const duration = document.querySelector("[data-summary-duration]").textContent;
            const description = document.querySelector("[data-summary-description]").textContent;

            bookingDetails = {
                ...bookingDetails,
                service,
                stylist,
                time,
                duration,
                description,
                notes: notesField ? notesField.value : bookingDetails.notes,
            };

            const params = new URLSearchParams({
                amount: String(total),
                customerName: customer.name,
                customerEmail: customer.email,
                customerMobile: customer.mobile,
                service: bookingDetails.service,
                stylist: bookingDetails.stylist,
                date: bookingDetails.date,
                time: bookingDetails.time,
                notes: bookingDetails.notes,
                duration: bookingDetails.duration,
                description: bookingDetails.description,
                ref: bookingDetails.ref,
                appointmentId: bookingDetails.appointmentId,
            });

            paymentLink.href = `payment.html?${params.toString()}`;
            paymentLink.textContent = "Continue to payment";
            updatePaymentLinkState();
        }
    };

    const applyUrlData = () => {
        const params = new URLSearchParams(window.location.search);
        const service = params.get("service");
        const stylist = params.get("stylist");
        const date = params.get("date");
        const time = params.get("time");
        const notes = params.get("notes");
        const ref = params.get("ref");
        const appointmentId = params.get("appointmentId");

        bookingDetails = {
            ...bookingDetails,
            service: service || bookingDetails.service,
            stylist: stylist || bookingDetails.stylist,
            date: date || bookingDetails.date,
            time: time || bookingDetails.time,
            notes: notes || bookingDetails.notes,
            ref: ref || bookingDetails.ref,
            appointmentId: appointmentId || bookingDetails.appointmentId,
        };

        if (!bookingDetails.appointmentId && service && date && time) {
            bookingDetails.appointmentId = `APT-${bookingDetails.ref}`;
        }

        if (service) {
            const normalizedService = service.replace(/ and /g, " and ");
            const details = serviceDetails[normalizedService] || serviceDetails[service];

            document.querySelector("[data-summary-service]").textContent = service;

            if (details) {
                priceState.service = details.price;
                priceState.stylistFee = 300;
                priceState.tax = Math.round((details.price + priceState.stylistFee) * 0.05);
                document.querySelector("[data-summary-duration]").textContent = details.duration;
                document.querySelector("[data-summary-description]").textContent = details.description;
                bookingDetails.duration = details.duration;
                bookingDetails.description = details.description;
            }
        }

        if (stylist) {
            document.querySelector("[data-summary-stylist]").textContent = stylist;
        }

        if (date) {
            const dateValue = new Date(`${date}T00:00:00`);
            document.querySelector("[data-summary-date]").textContent = Number.isNaN(dateValue.getTime())
                ? date
                : dateValue.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        }

        if (time) {
            document.querySelector("[data-summary-time]").textContent = time;
        }

        if (notes) {
            const notesField = document.querySelector('textarea[name="notes"]');

            if (notesField) {
                notesField.value = notes;
            }
        }
    };

    if (couponForm && couponMessage) {
        couponForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const code = new FormData(couponForm).get("coupon").trim().toUpperCase();

            if (code === "GLOW10") {
                priceState.discount = Math.round(priceState.service * 0.1);
                couponMessage.classList.remove("error");
                couponMessage.textContent = "GLOW10 applied successfully.";
            } else {
                priceState.discount = 0;
                couponMessage.classList.add("error");
                couponMessage.textContent = "Invalid coupon. Try GLOW10.";
            }

            updatePrices();
        });
    }

    if (confirmCheck) {
        confirmCheck.addEventListener("change", () => {
            updatePaymentLinkState();
        });
    }

    if (customerForm && formMessage) {
        customerForm.addEventListener("input", () => {
            updatePrices();
            formMessage.textContent = "Customer details updated for this booking summary.";
        });
    }

    if (paymentLink && confirmMessage && customerForm) {
        paymentLink.addEventListener("click", (event) => {
            if (!hasBookingDetails()) {
                event.preventDefault();
                showMissingBookingMessage();
                updatePaymentLinkState();
                return;
            }

            if (!confirmCheck || !confirmCheck.checked) {
                event.preventDefault();
                confirmMessage.classList.add("error");
                confirmMessage.textContent = "Please check your appointment details before continuing to payment.";
                updatePaymentLinkState();
                return;
            }

            if (!customerForm.checkValidity()) {
                event.preventDefault();
                customerForm.reportValidity();
                return;
            }

            confirmMessage.classList.remove("error");
            updatePrices();
            confirmMessage.textContent = "Opening payment. Your booking will confirm after Pay now.";
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

    fillCustomerFormFromProfile();
    applyUrlData();
    if (!hasBookingDetails() && formMessage) {
        formMessage.textContent = "Start from the booking page to fill this summary.";
    }
    updatePrices();
    updatePaymentLinkState();
});
