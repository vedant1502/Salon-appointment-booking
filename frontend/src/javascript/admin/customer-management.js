document.addEventListener("DOMContentLoaded", () => {
    const appointmentsKey = "glow-grace-appointments";
    const profileKey = "glow-grace-profile";
    const customersKey = "glow-grace-customers";
    const liveData = window.GlowGraceLiveData;
    const customerList = document.querySelector("[data-customer-list]");
    const customerDetails = document.querySelector("[data-customer-details]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const searchInput = document.querySelector("[data-search]");
    const resultCount = document.querySelector("[data-result-count]");
    let activeFilter = "all";
    let selectedCustomerId = "";
    let pendingDeleteId = "";
    let customers = [];

    const readJson = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value || fallback;
        } catch (error) {
            return fallback;
        }
    };

    const saveJson = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const formatCurrency = (amount) => `Rs. ${(Number(amount) || 0).toLocaleString("en-IN")}`;

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

    const makeCustomerId = (value) => {
        const normalized = String(value || "guest")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        return `customer-${normalized || "guest"}`;
    };

    const getInitials = (name) => String(name || "Guest Customer")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase() || "GG";

    const normalizeStatus = (status) => {
        if (status === "completed" || status === "cancelled") {
            return status;
        }

        return "upcoming";
    };

    const isPendingPayment = (appointment) => Number(appointment.remaining) > 0 || appointment.paymentStatus === "Pending";

    const hasProfileDetails = (profile) => Boolean(
        profile.name ||
        profile.email ||
        profile.mobile ||
        profile.city ||
        profile.hairType ||
        profile.skinType ||
        profile.preferredStylist ||
        profile.favoriteService
    );

    const readAppointments = () => {
        const appointments = readJson(appointmentsKey, []);
        return Array.isArray(appointments) ? appointments : [];
    };

    const getAppointmentCustomerId = (appointment, profileId) => {
        if (appointment.customerId) {
            return appointment.customerId;
        }

        const identifier = appointment.customerEmail || appointment.customerMobile || appointment.customerName;

        if (identifier) {
            return makeCustomerId(identifier);
        }

        return profileId || "customer-guest";
    };

    const createCustomer = ({ id, profile = {}, appointment = null, source = "Profile" }) => ({
        id,
        name: appointment?.customerName || profile.name || "Guest Customer",
        email: appointment?.customerEmail || profile.email || "",
        mobile: appointment?.customerMobile || profile.mobile || "",
        city: profile.city || "",
        hairType: profile.hairType || "",
        skinType: profile.skinType || "",
        preferredStylist: profile.preferredStylist || "",
        favoriteService: profile.favoriteService || "",
        allergies: profile.allergies || "",
        notes: profile.notes || "",
        source,
        status: "active",
        appointments: [],
        updatedAt: profile.updatedAt || appointment?.updatedAt || appointment?.createdAt || "",
    });

    const mergeAppointmentDetails = (customer, appointment) => ({
        ...customer,
        name: customer.name === "Guest Customer" && appointment.customerName ? appointment.customerName : customer.name,
        email: customer.email || appointment.customerEmail || "",
        mobile: customer.mobile || appointment.customerMobile || "",
        updatedAt: appointment.updatedAt || appointment.createdAt || customer.updatedAt,
        appointments: [...customer.appointments, appointment],
    });

    const buildCustomers = () => {
        const profile = readJson(profileKey, {});
        const appointments = readAppointments();
        const overrides = readJson(customersKey, {});
        const profileId = hasProfileDetails(profile) ? makeCustomerId(profile.email || profile.mobile || profile.name || "profile") : "";
        const customerMap = new Map();

        if (profileId) {
            customerMap.set(profileId, createCustomer({ id: profileId, profile, source: "Profile" }));
        }

        appointments.forEach((appointment) => {
            const customerId = getAppointmentCustomerId(appointment, profileId);
            const existing = customerMap.get(customerId) || createCustomer({
                id: customerId,
                profile: customerId === profileId ? profile : {},
                appointment,
                source: "Booking",
            });

            customerMap.set(customerId, mergeAppointmentDetails(existing, appointment));
        });

        return Array.from(customerMap.values()).filter((customer) => {
            const override = overrides[customer.id] || {};
            return !override.deleted;
        }).map((customer) => {
            const override = overrides[customer.id] || {};

            return {
                ...customer,
                status: override.status || customer.status || "active",
                adminUpdatedAt: override.updatedAt || "",
            };
        }).sort((first, second) => {
            const firstTime = new Date(first.updatedAt || first.adminUpdatedAt || 0).getTime();
            const secondTime = new Date(second.updatedAt || second.adminUpdatedAt || 0).getTime();
            return secondTime - firstTime;
        });
    };

    const getCustomerStats = (customer) => {
        const counts = {
            upcoming: 0,
            completed: 0,
            cancelled: 0,
            pendingPayments: 0,
            paidAmount: 0,
            dueAmount: 0,
        };

        customer.appointments.forEach((appointment) => {
            counts[normalizeStatus(appointment.status)] += 1;

            if (isPendingPayment(appointment)) {
                counts.pendingPayments += 1;
            }

            counts.paidAmount += Number(appointment.amountPaid) || 0;
            counts.dueAmount += Number(appointment.remaining) || 0;
        });

        return counts;
    };

    const updateCounts = () => {
        const totalBookings = customers.reduce((sum, customer) => sum + customer.appointments.length, 0);
        const pendingPayments = customers.reduce((sum, customer) => sum + getCustomerStats(customer).pendingPayments, 0);
        const activeCustomers = customers.filter((customer) => customer.status !== "inactive").length;

        document.querySelector('[data-count="total"]').textContent = customers.length;
        document.querySelector('[data-count="active"]').textContent = activeCustomers;
        document.querySelector('[data-count="bookings"]').textContent = totalBookings;
        document.querySelector('[data-count="pending"]').textContent = pendingPayments;
    };

    const customerMatchesFilter = (customer) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "active") return customer.status !== "inactive";
        if (activeFilter === "inactive") return customer.status === "inactive";
        if (activeFilter === "booked") return customer.appointments.length > 0;
        if (activeFilter === "pending-payment") return getCustomerStats(customer).pendingPayments > 0;
        return true;
    };

    const buildSearchText = (customer) => [
        customer.name,
        customer.email,
        customer.mobile,
        customer.city,
        customer.hairType,
        customer.skinType,
        customer.preferredStylist,
        customer.favoriteService,
        customer.status,
        ...customer.appointments.flatMap((appointment) => [
            appointment.id,
            appointment.paymentRef,
            appointment.service,
            appointment.stylist,
            appointment.paymentStatus,
            appointment.adminStatus,
            normalizeStatus(appointment.status),
        ]),
    ].join(" ").toLowerCase();

    const renderCustomerCard = (customer) => {
        const stats = getCustomerStats(customer);
        const isActive = customer.status !== "inactive";

        return `
            <article class="customer-card ${selectedCustomerId === customer.id ? "selected" : ""}" data-customer-id="${escapeHtml(customer.id)}">
                <div class="customer-avatar" aria-hidden="true">${escapeHtml(getInitials(customer.name))}</div>
                <div class="customer-info">
                    <div class="status-row">
                        <span class="status-pill ${isActive ? "active" : "inactive"}">${isActive ? "Active" : "Inactive"}</span>
                        <span class="status-pill ${stats.pendingPayments > 0 ? "pending" : "paid"}">${stats.pendingPayments > 0 ? "Payment due" : "Payment clear"}</span>
                    </div>
                    <h3>${escapeHtml(customer.name)}</h3>
                    <p>${escapeHtml([customer.email, customer.mobile].filter(Boolean).join(" | ") || "Contact not added")}</p>
                    <div class="customer-meta">
                        <span>${escapeHtml(customer.city || "City not set")}</span>
                        <span>${escapeHtml(customer.source)}</span>
                        <span>${escapeHtml(customer.favoriteService || "No favorite service")}</span>
                    </div>
                    <div class="customer-stats">
                        <div class="customer-stat"><span>Bookings</span><strong>${customer.appointments.length}</strong></div>
                        <div class="customer-stat"><span>Upcoming</span><strong>${stats.upcoming}</strong></div>
                        <div class="customer-stat"><span>Completed</span><strong>${stats.completed}</strong></div>
                        <div class="customer-stat"><span>Due</span><strong>${escapeHtml(formatCurrency(stats.dueAmount))}</strong></div>
                    </div>
                </div>
                <div class="card-actions">
                    <button type="button" data-action="details">Open details</button>
                    <button class="${isActive ? "danger" : ""}" type="button" data-action="toggle">${isActive ? "Mark inactive" : "Mark active"}</button>
                    ${pendingDeleteId === customer.id
                        ? `
                            <button class="danger confirm-delete" type="button" data-action="confirm-delete">Confirm delete</button>
                            <button type="button" data-action="cancel-delete">Cancel</button>
                        `
                        : '<button class="danger" type="button" data-action="delete">Delete</button>'}
                </div>
            </article>
        `;
    };

    const renderAppointmentItems = (customer) => {
        if (customer.appointments.length === 0) {
            return '<div class="empty-state">No bookings found for this customer yet.</div>';
        }

        return customer.appointments
            .slice()
            .sort((first, second) => {
                const firstKey = `${first.date || ""} ${first.time || ""}`;
                const secondKey = `${second.date || ""} ${second.time || ""}`;
                return secondKey.localeCompare(firstKey);
            })
            .map((appointment) => {
                const status = normalizeStatus(appointment.status);
                const paymentClass = isPendingPayment(appointment) ? "pending" : "paid";
                const paymentLabel = appointment.paymentStatus || (isPendingPayment(appointment) ? "Pending" : "Paid");

                return `
                    <article class="appointment-item">
                        <div class="status-row">
                            <span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>
                            <span class="status-pill ${paymentClass}">${escapeHtml(paymentLabel)}</span>
                        </div>
                        <strong>${escapeHtml(appointment.service || "Salon appointment")}</strong>
                        <p>${escapeHtml(formatDate(appointment.date))} at ${escapeHtml(appointment.time || "time not set")} with ${escapeHtml(appointment.stylist || "salon team")}</p>
                        <p>Booked at ${escapeHtml(formatBookedAt(appointment))}</p>
                        <span>${escapeHtml(appointment.id || "No appointment ID")}</span>
                    </article>
                `;
            }).join("");
    };

    const renderCustomerDetails = () => {
        if (!customerDetails) return;

        const customer = customers.find((item) => item.id === selectedCustomerId);

        if (!customer) {
            customerDetails.innerHTML = '<div class="empty-state">Select a customer to view full details.</div>';
            return;
        }

        const stats = getCustomerStats(customer);
        const isActive = customer.status !== "inactive";

        customerDetails.innerHTML = `
            <div class="detail-header">
                <div class="detail-avatar" aria-hidden="true">${escapeHtml(getInitials(customer.name))}</div>
                <div>
                    <p class="eyebrow">Customer details</p>
                    <h2>${escapeHtml(customer.name)}</h2>
                    <span class="status-pill ${isActive ? "active" : "inactive"}">${isActive ? "Active" : "Inactive"}</span>
                </div>
            </div>

            <div class="contact-grid">
                <div><span>Email</span><strong>${escapeHtml(customer.email || "Not added")}</strong></div>
                <div><span>Mobile</span><strong>${escapeHtml(customer.mobile || "Not added")}</strong></div>
                <div><span>City</span><strong>${escapeHtml(customer.city || "Not added")}</strong></div>
                <div><span>Source</span><strong>${escapeHtml(customer.source)}</strong></div>
            </div>

            <div class="detail-stats">
                <div><span>Total bookings</span><strong>${customer.appointments.length}</strong></div>
                <div><span>Upcoming</span><strong>${stats.upcoming}</strong></div>
                <div><span>Completed</span><strong>${stats.completed}</strong></div>
                <div><span>Paid amount</span><strong>${escapeHtml(formatCurrency(stats.paidAmount))}</strong></div>
            </div>

            <div class="preference-box">
                <p class="eyebrow">Preferences</p>
                <p class="detail-muted">Hair: ${escapeHtml(customer.hairType || "Not set")} | Skin: ${escapeHtml(customer.skinType || "Not set")}</p>
                <p class="detail-muted">Preferred stylist: ${escapeHtml(customer.preferredStylist || "Not set")}</p>
                <p class="detail-muted">Favorite service: ${escapeHtml(customer.favoriteService || "Not set")}</p>
                <p class="detail-muted">Allergies: ${escapeHtml(customer.allergies || "None added")}</p>
            </div>

            <div>
                <div class="panel-heading">
                    <div>
                        <p class="eyebrow">Bookings</p>
                        <h2>Appointment history</h2>
                    </div>
                    <a class="ghost-action" href="manage-appointments.html">Appointments</a>
                </div>
                <div class="appointment-list">
                    ${renderAppointmentItems(customer)}
                </div>
            </div>
        `;
    };

    const renderCustomers = () => {
        if (!customerList) return;

        updateCounts();
        const query = (searchInput && searchInput.value.trim().toLowerCase()) || "";
        const visibleCustomers = customers.filter((customer) => {
            const matchesFilter = customerMatchesFilter(customer);
            const matchesSearch = !query || buildSearchText(customer).includes(query);
            return matchesFilter && matchesSearch;
        });

        if (resultCount) {
            resultCount.textContent = `${visibleCustomers.length} customer${visibleCustomers.length === 1 ? "" : "s"} shown`;
        }

        if (visibleCustomers.length === 0) {
            customerList.innerHTML = '<div class="empty-state">No customers match this filter.</div>';
            renderCustomerDetails();
            return;
        }

        customerList.innerHTML = visibleCustomers.map(renderCustomerCard).join("");
        renderCustomerDetails();
    };

    const toggleCustomerStatus = (customerId) => {
        const customer = customers.find((item) => item.id === customerId);

        if (!customer) return;

        const overrides = readJson(customersKey, {});
        const nextStatus = customer.status === "inactive" ? "active" : "inactive";
        overrides[customerId] = {
            ...(overrides[customerId] || {}),
            status: nextStatus,
            updatedAt: new Date().toISOString(),
        };

        saveJson(customersKey, overrides);
        customers = buildCustomers();
        renderCustomers();
    };

    const deleteCustomer = (customerId) => {
        const overrides = readJson(customersKey, {});
        overrides[customerId] = {
            ...(overrides[customerId] || {}),
            deleted: true,
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        saveJson(customersKey, overrides);
        pendingDeleteId = "";

        if (selectedCustomerId === customerId) {
            selectedCustomerId = "";
        }

        customers = buildCustomers();
        renderCustomers();
    };

    if (customerList) {
        customerList.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");

            if (!button) return;

            const card = button.closest("[data-customer-id]");
            const customerId = card ? card.dataset.customerId : "";

            if (!customerId) return;

            if (button.dataset.action === "details") {
                selectedCustomerId = customerId;
                renderCustomers();
                return;
            }

            if (button.dataset.action === "toggle") {
                selectedCustomerId = customerId;
                toggleCustomerStatus(customerId);
                return;
            }

            if (button.dataset.action === "delete") {
                pendingDeleteId = customerId;
                renderCustomers();
                return;
            }

            if (button.dataset.action === "cancel-delete") {
                pendingDeleteId = "";
                renderCustomers();
                return;
            }

            if (button.dataset.action === "confirm-delete") {
                deleteCustomer(customerId);
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

            renderCustomers();
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", renderCustomers);
    }

    const loadCustomers = async () => {
        if (window.GlowGraceAdminAuth) {
            const admin = await window.GlowGraceAdminAuth.ensure();

            if (!admin) {
                return;
            }
        }

        customers = buildCustomers();
        renderCustomers();

        if (liveData && liveData.getAdminAppointments) {
            try {
                localStorage.setItem(appointmentsKey, JSON.stringify(await liveData.getAdminAppointments()));
                customers = buildCustomers();
                renderCustomers();
            } catch (error) {
                if (error.status === 401) {
                    localStorage.setItem(appointmentsKey, JSON.stringify([]));
                    customers = buildCustomers();
                    renderCustomers();
                }
            }
        }
    };

    loadCustomers();
});
