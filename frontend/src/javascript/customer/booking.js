document.addEventListener("DOMContentLoaded", () => {
    const staffKey = "glow-grace-staff";
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const bookingForm = document.querySelector("[data-booking-form]");
    const serviceSelect = document.querySelector("[data-service-select]");
    const stylistSelect = document.querySelector("[data-stylist-select]");
    const dateInput = document.querySelector("[data-date-input]");
    const timeInput = document.querySelector("[data-time-input]");
    const timeButtons = document.querySelectorAll("[data-time-slot]");
    const serviceChips = document.querySelectorAll("[data-service-chip]");
    const stylistChipContainer = document.querySelector(".booking-form .stylist-grid");
    const formMessage = document.querySelector("[data-form-message]");
    const revealItems = document.querySelectorAll(".reveal");

    const serviceDetails = {
        "Haircut and Blow Dry": {
            price: 499,
            duration: "45 min",
            description: "Face-framing haircut, shampoo, light conditioning, and a smooth blow dry finish.",
            suggestedStylist: "Aarohi Sharma",
        },
        "Glow Facial": {
            price: 899,
            duration: "60 min",
            description: "Gentle cleanse, exfoliation, massage, mask, and moisturizer for a fresh event-ready glow.",
            suggestedStylist: "Nisha Kapoor",
        },
        "Relaxing Body Spa": {
            price: 1499,
            duration: "75 min",
            description: "A calming oil massage and steam session to refresh tired muscles and reduce stress.",
            suggestedStylist: "Riya Malhotra",
        },
        "Bridal Makeup": {
            price: 5499,
            duration: "3 hr 30 min",
            description: "Long-lasting HD makeup with hairstyling, lashes, touch-up guidance, and draping.",
            suggestedStylist: "Meera Rao",
        },
        "Global Hair Coloring": {
            price: 1999,
            duration: "2 hr 15 min",
            description: "Full hair color consultation, application, wash, and finishing style for a fresh new shade.",
            suggestedStylist: "Kavya Sen",
        },
        "Manicure and Nail Art": {
            price: 699,
            duration: "50 min",
            description: "Nail shaping, cuticle care, polish, and simple nail art for clean everyday elegance.",
            suggestedStylist: "Tara Joshi",
        },
        "Hair Spa Therapy": {
            price: 1199,
            duration: "70 min",
            description: "Deep conditioning, scalp massage, steam, and rinse for softer, smoother hair texture.",
            suggestedStylist: "Aarohi Sharma",
        },
        "Party Makeup": {
            price: 2499,
            duration: "1 hr 30 min",
            description: "Soft glam makeup with base, eyes, lips, and setting finish for birthdays, parties, and photos.",
            suggestedStylist: "Meera Rao",
        },
        "Threading and Waxing": {
            price: 299,
            duration: "25 min",
            description: "Quick grooming for brows, upper lip, arms, or face with clean shaping and soothing aftercare.",
            suggestedStylist: "Nisha Kapoor",
        },
        "Bridal Glow Package": {
            price: 5499,
            duration: "3 hr 30 min",
            description: "Makeup, hair styling, draping, and pre-event skin prep for the big day.",
            suggestedStylist: "Meera Rao",
        },
        "Fresh Start Combo": {
            price: 1799,
            duration: "1 hr 45 min",
            description: "Haircut, blow dry, threading, and quick cleanup bundled for a fresh everyday reset.",
            suggestedStylist: "Aarohi Sharma",
        },
        "Glow Day Combo": {
            price: 2999,
            duration: "2 hr 45 min",
            description: "Glow facial, hair spa, manicure, and light styling planned as one relaxed salon visit.",
            suggestedStylist: "Nisha Kapoor",
        },
        "Wedding Ready Combo": {
            price: 7499,
            duration: "4 hr 30 min",
            description: "Bridal makeup, hairstyling, draping, facial, and nails for a complete event-ready look.",
            suggestedStylist: "Meera Rao",
        },
    };

    const serviceAliases = {
        "Hair styling": "Haircut and Blow Dry",
        "Facial care": "Glow Facial",
        Makeup: "Party Makeup",
        Nails: "Manicure and Nail Art",
    };

    const formatCurrency = (amount) => `Rs. ${amount.toLocaleString("en-IN")}`;

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const readAdminStaff = () => {
        try {
            const storedStaff = JSON.parse(localStorage.getItem(staffKey) || "null");
            return Array.isArray(storedStaff) ? storedStaff.filter((member) => member.available !== false) : null;
        } catch (error) {
            return null;
        }
    };

    const getStylistChips = () => document.querySelectorAll("[data-stylist-chip]");

    const bindStylistChips = () => {
        getStylistChips().forEach((chip) => {
            chip.addEventListener("click", () => {
                stylistSelect.value = chip.dataset.stylistChip;
                updatePreview();
            });
        });
    };

    const populateAdminStylists = () => {
        const adminStaff = readAdminStaff();

        if (!adminStaff || !stylistSelect) {
            return;
        }

        if (adminStaff.length === 0) {
            stylistSelect.innerHTML = '<option value="">No available stylists</option>';

            if (stylistChipContainer) {
                stylistChipContainer.innerHTML = '<p class="booking-empty">No stylists are marked available right now.</p>';
            }

            return;
        }

        stylistSelect.innerHTML = [
            '<option value="">Select a stylist</option>',
            ...adminStaff.map((member) => `
                <option value="${escapeHtml(member.name)}" data-specialty="${escapeHtml(member.category || "salon")}">
                    ${escapeHtml(member.name)} - ${escapeHtml(member.specialization || "Salon stylist")}
                </option>
            `),
        ].join("");

        if (stylistChipContainer) {
            stylistChipContainer.innerHTML = adminStaff.slice(0, 4).map((member) => `
                <button type="button" data-stylist-chip="${escapeHtml(member.name)}">
                    <strong>${escapeHtml(String(member.name || "Stylist").split(" ")[0])}</strong>
                    <span>${escapeHtml(member.category || "Salon")} - ${escapeHtml(String(member.rating || "4.8"))}</span>
                </button>
            `).join("");
        }
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

    const setPreviewText = (selector, value) => {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = value;
        }
    };

    const updateActiveChips = () => {
        serviceChips.forEach((chip) => {
            chip.classList.toggle("active", chip.dataset.serviceChip === serviceSelect.value);
        });

        getStylistChips().forEach((chip) => {
            chip.classList.toggle("active", chip.dataset.stylistChip === stylistSelect.value);
        });

        timeButtons.forEach((button) => {
            button.classList.toggle("active", button.dataset.timeSlot === timeInput.value);
        });
    };

    const updateStylistSuggestion = () => {
        const details = serviceDetails[serviceSelect.value];

        if (!details || stylistSelect.value) {
            return;
        }

        const suggestedOption = Array.from(stylistSelect.options).some((option) => option.value === details.suggestedStylist);

        if (suggestedOption) {
            stylistSelect.value = details.suggestedStylist;
        }
    };

    const updatePreview = () => {
        const selectedService = serviceSelect.value;
        const details = serviceDetails[selectedService];
        const selectedStylist = stylistSelect.value;
        const selectedDate = dateInput.value;

        if (details) {
            setPreviewText("[data-preview-service]", selectedService);
            setPreviewText("[data-preview-description]", details.description);
            setPreviewText("[data-preview-duration]", details.duration);
            setPreviewText("[data-preview-price]", formatCurrency(details.price));
        } else {
            setPreviewText("[data-preview-service]", "Select a service");
            setPreviewText("[data-preview-description]", "Your service details will appear here once selected.");
            setPreviewText("[data-preview-duration]", "--");
            setPreviewText("[data-preview-price]", "Rs. 0");
        }

        setPreviewText("[data-preview-stylist]", selectedStylist || "Not selected");

        if (selectedDate) {
            const dateValue = new Date(`${selectedDate}T00:00:00`);
            setPreviewText(
                "[data-preview-date]",
                Number.isNaN(dateValue.getTime())
                    ? selectedDate
                    : dateValue.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
            );
        } else {
            setPreviewText("[data-preview-date]", "Not selected");
        }

        setPreviewText("[data-preview-time]", timeInput.value || "Not selected");
        updateActiveChips();
    };

    const setDateMinimum = () => {
        const today = new Date();
        const formattedDate = today.toISOString().split("T")[0];
        dateInput.min = formattedDate;
    };

    const applyUrlSelections = () => {
        const params = new URLSearchParams(window.location.search);
        const service = params.get("service");
        const stylist = params.get("stylist");
        const date = params.get("date");
        const time = params.get("time");

        if (service) {
            const normalizedService = serviceDetails[service] ? service : serviceAliases[service];

            if (normalizedService && serviceDetails[normalizedService]) {
                serviceSelect.value = normalizedService;
            }
        }

        updateStylistSuggestion();

        if (stylist) {
            stylistSelect.value = stylist;
        }

        if (date) {
            dateInput.value = date;
        }

        if (time) {
            timeInput.value = time;
        }
    };

    serviceSelect.addEventListener("change", () => {
        stylistSelect.value = "";
        updateStylistSuggestion();
        updatePreview();
    });

    stylistSelect.addEventListener("change", updatePreview);
    dateInput.addEventListener("change", updatePreview);

    serviceChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            serviceSelect.value = chip.dataset.serviceChip;
            stylistSelect.value = "";
            updateStylistSuggestion();
            updatePreview();
        });
    });

    populateAdminStylists();
    bindStylistChips();

    timeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            timeInput.value = button.dataset.timeSlot;
            updatePreview();
        });
    });

    bookingForm.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!timeInput.value) {
            formMessage.classList.add("error");
            formMessage.textContent = "Please choose a time slot before continuing.";
            return;
        }

        if (!bookingForm.checkValidity()) {
            bookingForm.reportValidity();
            return;
        }

        const formData = new FormData(bookingForm);
        const params = new URLSearchParams();

        ["service", "stylist", "date", "time", "notes"].forEach((key) => {
            const value = formData.get(key);
            if (value) {
                params.set(key, value);
            }
        });

        formMessage.classList.remove("error");
        formMessage.textContent = "Opening your booking summary...";

        window.setTimeout(() => {
            window.location.href = `booking-summary.html?${params.toString()}`;
        }, 500);
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

    setDateMinimum();
    applyUrlSelections();
    updatePreview();
});
