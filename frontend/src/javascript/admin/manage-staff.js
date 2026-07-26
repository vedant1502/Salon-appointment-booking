document.addEventListener("DOMContentLoaded", () => {
    const staffKey = "glow-grace-staff";
    const staffForm = document.querySelector("[data-staff-form]");
    const staffList = document.querySelector("[data-staff-list]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const searchInput = document.querySelector("[data-search]");
    const formTitle = document.querySelector("[data-form-title]");
    const formMessage = document.querySelector("[data-form-message]");
    const resetFormButton = document.querySelector("[data-reset-form]");
    const resetStaffButton = document.querySelector("[data-reset-staff]");
    const newStaffButton = document.querySelector("[data-new-staff]");
    const imageInput = document.querySelector("[data-staff-image]");
    const imagePreview = document.querySelector("[data-image-preview]");
    let activeFilter = "all";
    let staff = [];
    let pendingDeleteId = "";

    const defaultStaff = [
        {
            id: "staff-aarohi-sharma",
            name: "Aarohi Sharma",
            category: "hair",
            specialization: "Senior Hair Stylist",
            experience: "7 years",
            rating: 4.9,
            available: true,
            image: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=900&q=80",
            bio: "Specializes in precision haircuts, blow dry styling, layers, and hair spa treatments.",
        },
        {
            id: "staff-nisha-kapoor",
            name: "Nisha Kapoor",
            category: "skin",
            specialization: "Skin & Facial Expert",
            experience: "6 years",
            rating: 4.8,
            available: true,
            image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=900&q=80",
            bio: "Known for glow facials, cleanup, hydration care, and gentle skin consultation.",
        },
        {
            id: "staff-meera-rao",
            name: "Meera Rao",
            category: "bridal",
            specialization: "Bridal Makeup Artist",
            experience: "9 years",
            rating: 5,
            available: true,
            image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80",
            bio: "Specializes in bridal makeup, party glam, draping, lashes, and photo-ready base work.",
        },
        {
            id: "staff-riya-malhotra",
            name: "Riya Malhotra",
            category: "spa",
            specialization: "Spa Therapist",
            experience: "5 years",
            rating: 4.7,
            available: false,
            image: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=900&q=80",
            bio: "Focuses on relaxing body spa, head massage, stress relief, and calming salon care.",
        },
        {
            id: "staff-kavya-sen",
            name: "Kavya Sen",
            category: "hair",
            specialization: "Hair Color Specialist",
            experience: "8 years",
            rating: 4.8,
            available: true,
            image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80",
            bio: "Best for global color, highlights, root touch-up, shade matching, and style finishing.",
        },
        {
            id: "staff-tara-joshi",
            name: "Tara Joshi",
            category: "nails",
            specialization: "Nail Technician",
            experience: "4 years",
            rating: 4.6,
            available: true,
            image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80",
            bio: "Creates neat manicures, nail art, polish changes, and soft everyday nail looks.",
        },
    ];

    const readStaff = () => {
        try {
            const storedStaff = JSON.parse(localStorage.getItem(staffKey) || "null");
            return Array.isArray(storedStaff) && storedStaff.length > 0 ? storedStaff : [...defaultStaff];
        } catch (error) {
            return [...defaultStaff];
        }
    };

    const saveStaff = () => {
        localStorage.setItem(staffKey, JSON.stringify(staff));
    };

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

    const updateImagePreview = (imageSource) => {
        if (!imagePreview) return;

        imagePreview.innerHTML = imageSource
            ? `<img src="${escapeHtml(imageSource)}" alt="Selected stylist preview">`
            : "<span>No image selected</span>";
    };

    const makeStaffId = (name) => `staff-${String(name || Date.now())
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${Date.now().toString().slice(-4)}`;

    const updateCounts = () => {
        const availableStaff = staff.filter((member) => member.available !== false);
        const unavailableStaff = staff.filter((member) => member.available === false);
        const averageRating = staff.length
            ? staff.reduce((sum, member) => sum + (Number(member.rating) || 0), 0) / staff.length
            : 0;

        document.querySelector('[data-count="total"]').textContent = staff.length;
        document.querySelector('[data-count="available"]').textContent = availableStaff.length;
        document.querySelector('[data-count="unavailable"]').textContent = unavailableStaff.length;
        document.querySelector('[data-count="average"]').textContent = formatRating(averageRating);
    };

    const resetForm = () => {
        staffForm.reset();
        staffForm.elements.id.value = "";
        staffForm.elements.available.checked = true;
        formTitle.textContent = "Add new stylist";
        updateImagePreview("");

        if (formMessage) {
            formMessage.textContent = "";
            formMessage.classList.remove("error");
        }
    };

    const staffMatchesFilter = (member) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "available") return member.available !== false;
        if (activeFilter === "unavailable") return member.available === false;
        return member.category === activeFilter;
    };

    const buildSearchText = (member) => [
        member.name,
        member.category,
        member.specialization,
        member.experience,
        member.rating,
        member.bio,
        member.available === false ? "unavailable" : "available",
    ].join(" ").toLowerCase();

    const renderStaffCard = (member) => `
        <article class="staff-card" data-staff-id="${escapeHtml(member.id)}">
            <img src="${escapeHtml(member.image || "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=82")}" alt="${escapeHtml(member.name)} stylist">
            <div class="staff-info">
                <div class="staff-topline">
                    <span class="category-pill">${escapeHtml(formatCategory(member.category))}</span>
                    <span class="status-pill ${member.available === false ? "unavailable" : "available"}">${member.available === false ? "Unavailable" : "Available"}</span>
                </div>
                <h3>${escapeHtml(member.name)}</h3>
                <p>${escapeHtml(member.bio)}</p>
                <div class="staff-meta">
                    <span>${escapeHtml(member.specialization || "Stylist")}</span>
                    <span>${escapeHtml(member.experience || "Experience not set")}</span>
                    <span>${escapeHtml(formatRating(member.rating))} rating</span>
                </div>
            </div>
            <div class="card-actions">
                <button type="button" data-action="edit">Edit</button>
                <button type="button" data-action="toggle">${member.available === false ? "Mark available" : "Mark unavailable"}</button>
                ${pendingDeleteId === member.id
                    ? `
                        <button class="danger confirm-delete" type="button" data-action="confirm-delete">Confirm delete</button>
                        <button type="button" data-action="cancel-delete">Cancel</button>
                    `
                    : '<button class="danger" type="button" data-action="delete">Delete</button>'}
            </div>
        </article>
    `;

    const bindStaffActions = () => {
        if (!staffList) return;

        staffList.querySelectorAll(".staff-card").forEach((card) => {
            const staffId = card.dataset.staffId;
            const member = staff.find((item) => item.id === staffId);

            card.querySelectorAll("[data-action]").forEach((button) => {
                button.addEventListener("click", () => {
                    if (!member) return;

                    if (button.dataset.action === "edit") {
                        staffForm.elements.id.value = member.id;
                        staffForm.elements.name.value = member.name || "";
                        staffForm.elements.category.value = member.category || "hair";
                        staffForm.elements.specialization.value = member.specialization || "";
                        staffForm.elements.experience.value = member.experience || "";
                        staffForm.elements.rating.value = member.rating || "";
                        staffForm.elements.bio.value = member.bio || "";
                        staffForm.elements.image.value = member.image || "";
                        staffForm.elements.available.checked = member.available !== false;
                        updateImagePreview(member.image || "");
                        formTitle.textContent = "Edit stylist";
                        staffForm.scrollIntoView({ behavior: "smooth", block: "start" });
                        return;
                    }

                    if (button.dataset.action === "delete") {
                        pendingDeleteId = staffId;
                        renderStaff();
                        return;
                    }

                    if (button.dataset.action === "cancel-delete") {
                        pendingDeleteId = "";
                        renderStaff();
                        return;
                    }

                    if (button.dataset.action === "confirm-delete") {
                        staff = staff.filter((item) => item.id !== staffId);
                        pendingDeleteId = "";

                        if (staffForm.elements.id.value === staffId) {
                            resetForm();
                        }

                        saveStaff();
                        renderStaff();
                        return;
                    }

                    staff = staff.map((item) => item.id === staffId
                        ? { ...item, available: item.available === false, updatedAt: new Date().toISOString() }
                        : item);
                    saveStaff();
                    renderStaff();
                });
            });
        });
    };

    const renderStaff = () => {
        updateCounts();
        const query = (searchInput && searchInput.value.trim().toLowerCase()) || "";
        const visibleStaff = staff.filter((member) => staffMatchesFilter(member) && (!query || buildSearchText(member).includes(query)));

        if (!staffList) return;

        if (visibleStaff.length === 0) {
            staffList.innerHTML = '<div class="empty-state">No staff members match this filter.</div>';
            return;
        }

        staffList.innerHTML = visibleStaff.map(renderStaffCard).join("");
        bindStaffActions();
    };

    if (staffForm) {
        staffForm.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!staffForm.checkValidity()) {
                staffForm.reportValidity();
                return;
            }

            const formData = new FormData(staffForm);
            const staffId = formData.get("id");
            const member = {
                id: staffId || makeStaffId(formData.get("name")),
                name: formData.get("name").trim(),
                category: formData.get("category"),
                specialization: formData.get("specialization").trim(),
                experience: formData.get("experience").trim(),
                rating: Math.min(5, Math.max(0, Number(formData.get("rating")) || 0)),
                bio: formData.get("bio").trim(),
                image: formData.get("image").trim(),
                available: formData.get("available") === "on",
                updatedAt: new Date().toISOString(),
            };

            if (staffId) {
                staff = staff.map((item) => item.id === staffId ? member : item);
            } else {
                staff.unshift(member);
            }

            saveStaff();
            renderStaff();
            resetForm();

            if (formMessage) {
                formMessage.classList.remove("error");
                formMessage.textContent = "Stylist saved successfully.";
            }
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

            renderStaff();
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", renderStaff);
    }

    if (imageInput && staffForm) {
        imageInput.addEventListener("change", () => {
            const file = imageInput.files && imageInput.files[0];

            if (!file) {
                return;
            }

            const reader = new FileReader();

            reader.addEventListener("load", () => {
                staffForm.elements.image.value = reader.result;
                updateImagePreview(reader.result);
            });

            reader.readAsDataURL(file);
        });
    }

    if (staffForm && staffForm.elements.image) {
        staffForm.elements.image.addEventListener("input", () => {
            updateImagePreview(staffForm.elements.image.value.trim());
        });
    }

    if (resetFormButton) {
        resetFormButton.addEventListener("click", resetForm);
    }

    if (newStaffButton) {
        newStaffButton.addEventListener("click", () => {
            resetForm();
            staffForm.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    if (resetStaffButton) {
        resetStaffButton.addEventListener("click", () => {
            staff = [...defaultStaff];
            saveStaff();
            resetForm();
            renderStaff();
        });
    }

    staff = readStaff();
    saveStaff();
    renderStaff();
});
