document.addEventListener("DOMContentLoaded", () => {
    const staffKey = "glow-grace-staff";
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const stylistGrid = document.querySelector("[data-stylist-grid]");
    const revealItems = document.querySelectorAll(".reveal");

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const formatRating = (rating) => (Number(rating) || 0).toFixed(1);

    const formatCategory = (category) => {
        const labels = {
            hair: "Hair",
            skin: "Skin",
            makeup: "Makeup",
            bridal: "Bridal",
            spa: "Spa",
            nails: "Nails",
        };

        return labels[category] || "Salon";
    };

    const defaultServiceByCategory = {
        hair: "Haircut and Blow Dry",
        skin: "Glow Facial",
        makeup: "Party Makeup",
        bridal: "Bridal Makeup",
        spa: "Relaxing Body Spa",
        nails: "Manicure and Nail Art",
    };

    const getFirstName = (name) => String(name || "stylist").trim().split(" ")[0] || "stylist";

    const parseExperienceYears = (experience) => {
        const match = String(experience || "").match(/\d+(\.\d+)?/);
        return match ? Number(match[0]) : 0;
    };

    const readAdminStaff = () => {
        try {
            const storedStaff = JSON.parse(localStorage.getItem(staffKey) || "null");
            return Array.isArray(storedStaff) ? storedStaff.filter((member) => member.available !== false) : null;
        } catch (error) {
            return null;
        }
    };

    const updateStaffSummary = (staffMembers) => {
        const countTarget = document.querySelector("[data-staff-count]");
        const ratingTarget = document.querySelector("[data-average-rating]");
        const experienceTarget = document.querySelector("[data-average-experience]");

        if (countTarget) {
            countTarget.textContent = `${staffMembers.length} ${staffMembers.length === 1 ? "stylist" : "stylists"} available`;
        }

        if (ratingTarget) {
            const averageRating = staffMembers.length
                ? staffMembers.reduce((sum, member) => sum + (Number(member.rating) || 0), 0) / staffMembers.length
                : 0;
            ratingTarget.textContent = formatRating(averageRating);
        }

        if (experienceTarget) {
            const averageExperience = staffMembers.length
                ? staffMembers.reduce((sum, member) => sum + parseExperienceYears(member.experience), 0) / staffMembers.length
                : 0;
            experienceTarget.textContent = averageExperience > 0 ? `${Math.round(averageExperience)}+` : "0";
        }
    };

    const renderAdminStaff = () => {
        if (!stylistGrid) return;

        const adminStaff = readAdminStaff();

        if (!adminStaff) {
            return;
        }

        updateStaffSummary(adminStaff);

        if (adminStaff.length === 0) {
            stylistGrid.innerHTML = '<div class="empty-staff">No stylists are marked available right now. Please check again later or contact the salon.</div>';
            return;
        }

        stylistGrid.innerHTML = adminStaff.map((member) => {
            const category = member.category || "salon";
            const service = defaultServiceByCategory[category] || "Salon appointment";
            const firstName = getFirstName(member.name);

            return `
                <article class="stylist-card reveal visible ${category === "bridal" ? "featured" : ""}" data-specialization="${escapeHtml(category)}">
                    <img src="${escapeHtml(member.image || "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=82")}" alt="${escapeHtml(member.name)} stylist">
                    <div class="stylist-body">
                        <div class="availability">Available for booking</div>
                        <h3>${escapeHtml(member.name)}</h3>
                        <p class="role">${escapeHtml(member.specialization || `${formatCategory(category)} stylist`)}</p>
                        <p>${escapeHtml(member.bio || "Salon specialist ready for customer appointments.")}</p>
                        <div class="stats-row">
                            <span><strong>${escapeHtml(formatRating(member.rating))}</strong> rating</span>
                            <span><strong>${escapeHtml(member.experience || "New")}</strong> experience</span>
                        </div>
                        <div class="tag-row">
                            <span>${escapeHtml(formatCategory(category))}</span>
                            <span>${escapeHtml(member.specialization || "Stylist")}</span>
                            <span>Available</span>
                        </div>
                        <a href="booking.html?stylist=${encodeURIComponent(member.name)}&service=${encodeURIComponent(service)}">Book ${escapeHtml(firstName)}</a>
                    </div>
                </article>
            `;
        }).join("");
    };

    const updateHeader = () => {
        if (!header) return;
        header.classList.toggle("scrolled", window.scrollY > 12);
    };

    renderAdminStaff();
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
            const selectedSpecialization = button.dataset.filter;
            const stylistCards = document.querySelectorAll("[data-specialization]");

            filterButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", String(isActive));
            });

            stylistCards.forEach((card) => {
                const shouldShow = selectedSpecialization === "all" || card.dataset.specialization === selectedSpecialization;
                card.classList.toggle("is-hidden", !shouldShow);
            });
        });
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
});
