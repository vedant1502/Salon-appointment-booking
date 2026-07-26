document.addEventListener("DOMContentLoaded", () => {
    const servicesKey = "glow-grace-services";
    const serviceForm = document.querySelector("[data-service-form]");
    const serviceList = document.querySelector("[data-service-list]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const searchInput = document.querySelector("[data-search]");
    const formTitle = document.querySelector("[data-form-title]");
    const formMessage = document.querySelector("[data-form-message]");
    const resetFormButton = document.querySelector("[data-reset-form]");
    const resetServicesButton = document.querySelector("[data-reset-services]");
    const newServiceButton = document.querySelector("[data-new-service]");
    const imageInput = document.querySelector("[data-service-image]");
    const imagePreview = document.querySelector("[data-image-preview]");
    let activeFilter = "all";
    let services = [];
    let pendingDeleteId = "";

    const defaultServices = [
        {
            id: "service-haircut-blow-dry",
            name: "Haircut and Blow Dry",
            category: "hair",
            price: 499,
            duration: "45 min",
            note: "Stylist choice",
            active: true,
            image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80",
            description: "Face-framing haircut, shampoo, light conditioning, and a smooth blow dry finish.",
        },
        {
            id: "service-glow-facial",
            name: "Glow Facial",
            category: "skin",
            price: 899,
            duration: "60 min",
            note: "Best for dull skin",
            active: true,
            image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=80",
            description: "Gentle cleanse, exfoliation, massage, mask, and moisturizer for a fresh event-ready glow.",
        },
        {
            id: "service-relaxing-body-spa",
            name: "Relaxing Body Spa",
            category: "spa",
            price: 1499,
            duration: "75 min",
            note: "Relaxation care",
            active: true,
            image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80",
            description: "A calming oil massage and steam session to refresh tired muscles and reduce stress.",
        },
        {
            id: "service-bridal-makeup",
            name: "Bridal Makeup",
            category: "bridal",
            price: 5499,
            duration: "3 hr 30 min",
            note: "Trial available",
            active: true,
            image: "https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=900&q=80",
            description: "Long-lasting HD makeup with hairstyling, lashes, touch-up guidance, and saree or dupatta draping.",
        },
        {
            id: "service-global-hair-coloring",
            name: "Global Hair Coloring",
            category: "hair",
            price: 1999,
            duration: "2 hr 15 min",
            note: "Patch test advised",
            active: true,
            image: "https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?auto=format&fit=crop&w=900&q=80",
            description: "Full hair color consultation, application, wash, and finishing style for a fresh new shade.",
        },
        {
            id: "service-manicure-nail-art",
            name: "Manicure and Nail Art",
            category: "nails",
            price: 699,
            duration: "50 min",
            note: "Custom designs",
            active: true,
            image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80",
            description: "Nail shaping, cuticle care, polish, and simple nail art for clean everyday elegance.",
        },
        {
            id: "service-hair-spa-therapy",
            name: "Hair Spa Therapy",
            category: "hair",
            price: 1199,
            duration: "70 min",
            note: "Dryness control",
            active: true,
            image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=900&q=80",
            description: "Deep conditioning, scalp massage, steam, and rinse for softer, smoother hair texture.",
        },
        {
            id: "service-party-makeup",
            name: "Party Makeup",
            category: "makeup",
            price: 2499,
            duration: "1 hr 30 min",
            note: "Event ready",
            active: true,
            image: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=900&q=80",
            description: "Soft glam makeup with base, eyes, lips, and setting finish for birthdays, parties, and photos.",
        },
        {
            id: "service-threading-waxing",
            name: "Threading and Waxing",
            category: "skin",
            price: 299,
            duration: "25 min",
            note: "Quick visit",
            active: true,
            image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=80",
            description: "Quick grooming for brows, upper lip, arms, or face with clean shaping and soothing aftercare.",
        },
        {
            id: "service-bridal-glow-package",
            name: "Bridal Glow Package",
            category: "bridal",
            price: 5499,
            duration: "3 hr 30 min",
            note: "Most loved",
            active: true,
            image: "https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=900&q=80",
            description: "Makeup, hair styling, draping, and pre-event skin prep for the big day.",
        },
    ];

    const readServices = () => {
        try {
            const storedServices = JSON.parse(localStorage.getItem(servicesKey) || "null");
            return Array.isArray(storedServices) && storedServices.length > 0 ? storedServices : [...defaultServices];
        } catch (error) {
            return [...defaultServices];
        }
    };

    const saveServices = () => {
        localStorage.setItem(servicesKey, JSON.stringify(services));
    };

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const formatCurrency = (amount) => `Rs. ${(Number(amount) || 0).toLocaleString("en-IN")}`;

    const updateImagePreview = (imageSource) => {
        if (!imagePreview) return;

        imagePreview.innerHTML = imageSource
            ? `<img src="${escapeHtml(imageSource)}" alt="Selected service preview">`
            : "<span>No image selected</span>";
    };

    const makeServiceId = (name) => `service-${String(name || Date.now())
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${Date.now().toString().slice(-4)}`;

    const updateCounts = () => {
        const activeServices = services.filter((service) => service.active !== false);
        const inactiveServices = services.filter((service) => service.active === false);
        const averagePrice = services.length
            ? Math.round(services.reduce((sum, service) => sum + Number(service.price || 0), 0) / services.length)
            : 0;

        document.querySelector('[data-count="total"]').textContent = services.length;
        document.querySelector('[data-count="active"]').textContent = activeServices.length;
        document.querySelector('[data-count="inactive"]').textContent = inactiveServices.length;
        document.querySelector('[data-count="average"]').textContent = formatCurrency(averagePrice);
    };

    const resetForm = () => {
        serviceForm.reset();
        serviceForm.elements.id.value = "";
        serviceForm.elements.active.checked = true;
        formTitle.textContent = "Add new service";
        updateImagePreview("");

        if (formMessage) {
            formMessage.textContent = "";
            formMessage.classList.remove("error");
        }
    };

    const serviceMatchesFilter = (service) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "active") return service.active !== false;
        if (activeFilter === "inactive") return service.active === false;
        return service.category === activeFilter;
    };

    const buildSearchText = (service) => [
        service.name,
        service.category,
        service.price,
        service.duration,
        service.description,
        service.note,
        service.active === false ? "inactive" : "active",
    ].join(" ").toLowerCase();

    const renderServiceCard = (service) => `
        <article class="service-card" data-service-id="${escapeHtml(service.id)}">
            <img src="${escapeHtml(service.image || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=82")}" alt="${escapeHtml(service.name)} service">
            <div class="service-info">
                <div class="service-topline">
                    <span class="category-pill">${escapeHtml(service.category || "service")}</span>
                    <span class="status-pill ${service.active === false ? "inactive" : "active"}">${service.active === false ? "Inactive" : "Active"}</span>
                </div>
                <h3>${escapeHtml(service.name)}</h3>
                <p>${escapeHtml(service.description)}</p>
                <div class="service-meta">
                    <span>${escapeHtml(formatCurrency(service.price))}</span>
                    <span>${escapeHtml(service.duration)}</span>
                    <span>${escapeHtml(service.note || "General")}</span>
                </div>
            </div>
            <div class="card-actions">
                <button type="button" data-action="edit">Edit</button>
                <button type="button" data-action="toggle">${service.active === false ? "Activate" : "Deactivate"}</button>
                ${pendingDeleteId === service.id
                    ? `
                        <button class="danger confirm-delete" type="button" data-action="confirm-delete">Confirm delete</button>
                        <button type="button" data-action="cancel-delete">Cancel</button>
                    `
                    : '<button class="danger" type="button" data-action="delete">Delete</button>'}
            </div>
        </article>
    `;

    const bindServiceActions = () => {
        if (!serviceList) return;

        serviceList.querySelectorAll(".service-card").forEach((card) => {
            const serviceId = card.dataset.serviceId;
            const service = services.find((item) => item.id === serviceId);

            card.querySelectorAll("[data-action]").forEach((button) => {
                button.addEventListener("click", () => {
                    if (!service) return;

                    if (button.dataset.action === "edit") {
                        serviceForm.elements.id.value = service.id;
                        serviceForm.elements.name.value = service.name || "";
                        serviceForm.elements.category.value = service.category || "hair";
                        serviceForm.elements.price.value = service.price || "";
                        serviceForm.elements.duration.value = service.duration || "";
                        serviceForm.elements.description.value = service.description || "";
                        serviceForm.elements.note.value = service.note || "";
                        serviceForm.elements.image.value = service.image || "";
                        serviceForm.elements.active.checked = service.active !== false;
                        updateImagePreview(service.image || "");
                        formTitle.textContent = "Edit service";
                        serviceForm.scrollIntoView({ behavior: "smooth", block: "start" });
                        return;
                    }

                    if (button.dataset.action === "delete") {
                        pendingDeleteId = serviceId;
                        renderServices();
                        return;
                    }

                    if (button.dataset.action === "cancel-delete") {
                        pendingDeleteId = "";
                        renderServices();
                        return;
                    }

                    if (button.dataset.action === "confirm-delete") {
                        services = services.filter((item) => item.id !== serviceId);
                        pendingDeleteId = "";

                        if (serviceForm.elements.id.value === serviceId) {
                            resetForm();
                        }

                        saveServices();
                        renderServices();
                        return;
                    }

                    services = services.map((item) => item.id === serviceId
                        ? { ...item, active: item.active === false, updatedAt: new Date().toISOString() }
                        : item);
                    saveServices();
                    renderServices();
                });
            });
        });
    };

    const renderServices = () => {
        updateCounts();
        const query = (searchInput && searchInput.value.trim().toLowerCase()) || "";
        const visibleServices = services.filter((service) => serviceMatchesFilter(service) && (!query || buildSearchText(service).includes(query)));

        if (!serviceList) return;

        if (visibleServices.length === 0) {
            serviceList.innerHTML = '<div class="empty-state">No services match this filter.</div>';
            return;
        }

        serviceList.innerHTML = visibleServices.map(renderServiceCard).join("");
        bindServiceActions();
    };

    if (serviceForm) {
        serviceForm.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!serviceForm.checkValidity()) {
                serviceForm.reportValidity();
                return;
            }

            const formData = new FormData(serviceForm);
            const serviceId = formData.get("id");
            const service = {
                id: serviceId || makeServiceId(formData.get("name")),
                name: formData.get("name").trim(),
                category: formData.get("category"),
                price: Number(formData.get("price")) || 0,
                duration: formData.get("duration").trim(),
                description: formData.get("description").trim(),
                note: formData.get("note").trim(),
                image: formData.get("image").trim(),
                active: formData.get("active") === "on",
                updatedAt: new Date().toISOString(),
            };

            if (serviceId) {
                services = services.map((item) => item.id === serviceId ? service : item);
            } else {
                services.unshift(service);
            }

            saveServices();
            renderServices();
            resetForm();

            if (formMessage) {
                formMessage.classList.remove("error");
                formMessage.textContent = "Service saved successfully.";
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

            renderServices();
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", renderServices);
    }

    if (imageInput && serviceForm) {
        imageInput.addEventListener("change", () => {
            const file = imageInput.files && imageInput.files[0];

            if (!file) {
                return;
            }

            const reader = new FileReader();

            reader.addEventListener("load", () => {
                serviceForm.elements.image.value = reader.result;
                updateImagePreview(reader.result);
            });

            reader.readAsDataURL(file);
        });
    }

    if (serviceForm && serviceForm.elements.image) {
        serviceForm.elements.image.addEventListener("input", () => {
            updateImagePreview(serviceForm.elements.image.value.trim());
        });
    }

    if (resetFormButton) {
        resetFormButton.addEventListener("click", resetForm);
    }

    if (newServiceButton) {
        newServiceButton.addEventListener("click", () => {
            resetForm();
            serviceForm.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    if (resetServicesButton) {
        resetServicesButton.addEventListener("click", () => {
            services = [...defaultServices];
            saveServices();
            resetForm();
            renderServices();
        });
    }

    services = readServices();
    saveServices();
    renderServices();
});
