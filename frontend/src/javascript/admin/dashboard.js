document.addEventListener("DOMContentLoaded", () => {
    const appointmentsKey = "glow-grace-appointments";
    const adminSessionKey = "glow-grace-admin-session";
    const activityDateKey = "glow-grace-admin-activity-date";
    const profileKey = "glow-grace-profile";
    const servicesKey = "glow-grace-services";
    const staffKey = "glow-grace-staff";
    const liveData = window.GlowGraceLiveData;
    const recentBookings = document.querySelector("[data-recent-bookings]");
    const todayList = document.querySelector("[data-today-list]");
    const dateInput = document.querySelector("[data-date-filter]");
    const logoutButton = document.querySelector("[data-logout]");

    const readJson = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value || fallback;
        } catch (error) {
            return fallback;
        }
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

    const getAppointments = () => {
        const appointments = readJson(appointmentsKey, []);
        return Array.isArray(appointments) ? appointments : [];
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

    const getSelectedDate = () => dateInput?.value || toDateValue(new Date());

    const getActivityForSelectedDate = (appointments) => {
        const selectedDate = getSelectedDate();
        return appointments.filter((appointment) => getActivityDate(appointment) === selectedDate);
    };

    const getActiveServicesCount = () => {
        const services = readJson(servicesKey, null);

        if (!Array.isArray(services) || services.length === 0) {
            return 10;
        }

        return services.filter((service) => service.active !== false).length;
    };

    const getAvailableStaffCount = () => {
        const staff = readJson(staffKey, null);

        if (!Array.isArray(staff) || staff.length === 0) {
            return 5;
        }

        return staff.filter((member) => member.available !== false).length;
    };

    const makeCustomerId = (value) => String(value || "guest")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "guest";

    const getCustomerCount = (appointments) => {
        const customerIds = new Set();

        appointments.forEach((appointment) => {
            const identifier = appointment.customerEmail || appointment.customerMobile || appointment.customerName;

            if (identifier) {
                customerIds.add(makeCustomerId(identifier));
                return;
            }

            customerIds.add("guest");
        });

        return customerIds.size;
    };

    const setText = (selector, value) => {
        const element = document.querySelector(selector);

        if (element) {
            element.textContent = value;
        }
    };

    const normalizeStatus = (status) => {
        if (status === "completed" || status === "cancelled") {
            return status;
        }

        return "upcoming";
    };

    const renderSession = () => {
        const session = readJson(adminSessionKey, null);
        const greeting = document.querySelector("[data-admin-greeting]");

        if (!greeting) {
            return;
        }

        if (!session || !session.email) {
            greeting.textContent = "Welcome back, admin.";
            return;
        }

        const role = String(session.role || "admin").replace(/-/g, " ");
        greeting.textContent = `${session.email} signed in as ${role}.`;
    };

    const renderStats = (appointments, allAppointments) => {
        const selectedDate = getSelectedDate();
        const totalBookings = appointments.length;
        const pendingAppointments = appointments.filter((appointment) => normalizeStatus(appointment.status) === "upcoming").length;
        const completedAppointments = appointments.filter((appointment) => appointment.status === "completed").length;
        const selectedDateAppointments = allAppointments.filter((appointment) => appointment.date === selectedDate).length;
        const revenue = appointments.reduce((total, appointment) => total + (Number(appointment.amountPaid) || 0), 0);
        const paidCount = appointments.filter((appointment) => Number(appointment.amountPaid) > 0 || appointment.paymentStatus === "Paid").length;
        const pendingPayments = appointments.filter((appointment) => Number(appointment.remaining) > 0 || appointment.paymentStatus === "Pending").length;
        const cancelledCount = appointments.filter((appointment) => appointment.status === "cancelled").length;

        setText('[data-stat="total-bookings"]', totalBookings);
        setText('[data-stat="revenue"]', formatCurrency(revenue));
        setText('[data-stat="pending-appointments"]', pendingAppointments);
        setText('[data-stat="completed-appointments"]', completedAppointments);
        setText('[data-insight="today-appointments"]', selectedDateAppointments);
        setText('[data-insight="total-customers"]', getCustomerCount(appointments));
        setText('[data-insight="pending-payments"]', pendingPayments);
        setText('[data-insight="active-services"]', getActiveServicesCount());
        setText('[data-insight="available-staff"]', getAvailableStaffCount());
        setText('[data-payment="paid"]', paidCount);
        setText('[data-payment="pending"]', pendingPayments);
        setText('[data-payment="cancelled"]', cancelledCount);
    };

    const renderTodayList = (appointments) => {
        if (!todayList) {
            return;
        }

        const selectedDate = getSelectedDate();
        const selectedDateAppointments = appointments
            .filter((appointment) => appointment.date === selectedDate)
            .sort((first, second) => {
                const firstKey = `${first.date || ""} ${first.time || ""}`;
                const secondKey = `${second.date || ""} ${second.time || ""}`;
                return firstKey.localeCompare(secondKey);
            })
            .slice(0, 4);

        if (selectedDateAppointments.length === 0) {
            todayList.innerHTML = '<div class="empty-line">No appointments scheduled for the selected date.</div>';
            return;
        }

        todayList.innerHTML = selectedDateAppointments.map((appointment) => `
            <article class="timeline-item">
                <div class="timeline-time">${escapeHtml(appointment.time || "Time")}</div>
                <div>
                    <h3>${escapeHtml(appointment.service || "Salon appointment")}</h3>
                    <p>${escapeHtml(formatDate(appointment.date))} with ${escapeHtml(appointment.stylist || "salon team")}</p>
                </div>
            </article>
        `).join("");
    };

    const renderRecentBookings = (appointments) => {
        if (!recentBookings) {
            return;
        }

        const recent = [...appointments]
            .sort((first, second) => {
                const timeDelta = getActivityTime(second) - getActivityTime(first);
                return timeDelta || String(second.id || "").localeCompare(String(first.id || ""));
            })
            .slice(0, 6);

        if (recent.length === 0) {
            recentBookings.innerHTML = '<tr><td colspan="5">No customer bookings yet.</td></tr>';
            return;
        }

        recentBookings.innerHTML = recent.map((appointment) => {
            const status = normalizeStatus(appointment.status);
            const paymentClass = appointment.paymentStatus === "Paid" ? "paid" : "pending";

            return `
                <tr>
                    <td>
                        ${escapeHtml(appointment.id || "New")}
                        <small>${escapeHtml(formatDate(appointment.date))} ${escapeHtml(appointment.time || "")}</small>
                        <small>Booked ${escapeHtml(formatBookedAt(appointment))}</small>
                    </td>
                    <td>${escapeHtml(appointment.service || "Salon appointment")}</td>
                    <td>${escapeHtml(appointment.stylist || "Salon team")}</td>
                    <td><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
                    <td><span class="status-pill ${escapeHtml(paymentClass)}">${escapeHtml(appointment.paymentStatus || "Pending")}</span></td>
                </tr>
            `;
        }).join("");
    };

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try {
                if (liveData && liveData.request) {
                    await liveData.request("/auth/logout", {
                        method: "POST",
                        body: "{}",
                    });
                } else {
                    await fetch("/api/auth/logout", {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: "{}",
                    });
                }
            } catch (error) {
                // Local admin state is cleared even if the backend is not reachable.
            } finally {
                localStorage.removeItem(adminSessionKey);
                localStorage.removeItem(activityDateKey);
                window.location.href = "admin-login.html";
            }
        });
    }
    let appointments = [];
    const renderDashboard = () => {
        const selectedActivity = getActivityForSelectedDate(appointments);

        renderStats(selectedActivity, appointments);
        renderTodayList(appointments);
        renderRecentBookings(selectedActivity);
    };

    if (dateInput) {
        syncActivityDate();
        dateInput.addEventListener("change", () => {
            syncActivityDate();
            renderDashboard();
        });
    }

    const loadDashboard = async () => {
        if (window.GlowGraceAdminAuth) {
            const admin = await window.GlowGraceAdminAuth.ensure();

            if (!admin) {
                return;
            }
        }

        appointments = [];
        localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
        renderSession();
        renderDashboard();

        if (liveData && liveData.getAdminAppointments) {
            try {
                appointments = await liveData.getAdminAppointments();
                localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
                renderDashboard();
            } catch (error) {
                if (error.status === 401) {
                    appointments = [];
                    localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
                    renderDashboard();
                }
            }
        }
    };

    loadDashboard();
});
