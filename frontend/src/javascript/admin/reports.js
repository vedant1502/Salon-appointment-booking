document.addEventListener("DOMContentLoaded", () => {
    const appointmentsKey = "glow-grace-appointments";
    const profileKey = "glow-grace-profile";
    const servicesKey = "glow-grace-services";
    const staffKey = "glow-grace-staff";
    const liveData = window.GlowGraceLiveData;
    const periodFilter = document.querySelector("[data-period-filter]");
    const statusFilter = document.querySelector("[data-status-filter]");
    const paymentFilter = document.querySelector("[data-payment-filter]");
    const searchInput = document.querySelector("[data-report-search]");
    const clearFiltersButton = document.querySelector("[data-clear-filters]");
    const printButton = document.querySelector("[data-print-report]");
    const exportButton = document.querySelector("[data-export-report]");
    const statusReport = document.querySelector("[data-status-report]");
    const paymentReport = document.querySelector("[data-payment-report]");
    const serviceReport = document.querySelector("[data-service-report]");
    const stylistReport = document.querySelector("[data-stylist-report]");
    const periodSummary = document.querySelector("[data-period-summary]");
    const reportTable = document.querySelector("[data-report-table]");
    const reportCount = document.querySelector("[data-report-count]");
    const lastUpdated = document.querySelector("[data-last-updated]");
    let appointments = [];

    const fallbackServices = [
        { name: "Haircut and Blow Dry", category: "hair", active: true },
        { name: "Glow Facial", category: "skin", active: true },
        { name: "Relaxing Body Spa", category: "spa", active: true },
        { name: "Bridal Makeup", category: "bridal", active: true },
        { name: "Global Hair Coloring", category: "hair", active: true },
        { name: "Manicure and Nail Art", category: "nails", active: true },
        { name: "Hair Spa Therapy", category: "hair", active: true },
        { name: "Party Makeup", category: "makeup", active: true },
        { name: "Threading and Waxing", category: "skin", active: true },
        { name: "Bridal Glow Package", category: "bridal", active: true },
    ];

    const fallbackStaff = [
        { name: "Aarohi Sharma", available: true },
        { name: "Nisha Kapoor", available: true },
        { name: "Meera Rao", available: true },
        { name: "Riya Malhotra", available: false },
        { name: "Kavya Sen", available: true },
        { name: "Tara Joshi", available: true },
    ];

    const readJson = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value || fallback;
        } catch (error) {
            return fallback;
        }
    };

    const readArray = (key, fallback) => {
        const value = readJson(key, fallback);
        return Array.isArray(value) && value.length > 0 ? value : fallback;
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

    const toDateValue = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const parseDate = (dateValue) => {
        if (!dateValue) {
            return null;
        }

        const date = new Date(`${dateValue}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const normalizeStatus = (status) => {
        if (status === "completed" || status === "cancelled") {
            return status;
        }

        return "upcoming";
    };

    const getTotal = (appointment) => {
        const total = Number(appointment.total);
        const paid = Number(appointment.amountPaid);
        const remaining = Number(appointment.remaining);

        if (Number.isFinite(total) && total > 0) {
            return total;
        }

        if (Number.isFinite(paid) || Number.isFinite(remaining)) {
            return (Number(paid) || 0) + (Number(remaining) || 0);
        }

        return 0;
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
        "part-paid": "Part paid",
        pending: "Pending",
        failed: "Failed",
        refunded: "Refunded",
    }[getPaymentState(appointment)]);

    const getCustomerName = (appointment) => (
        appointment.customerName ||
        appointment.customerEmail ||
        appointment.customerMobile ||
        "Customer"
    );

    const makeCustomerId = (value) => String(value || "guest")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "guest";

    const countCustomers = (items) => {
        const ids = new Set();

        items.forEach((appointment) => {
            ids.add(makeCustomerId(appointment.customerEmail || appointment.customerMobile || appointment.customerName || "guest"));
        });

        return ids.size;
    };

    const withinPeriod = (appointment) => {
        const value = periodFilter ? periodFilter.value : "all";

        if (value === "all") {
            return true;
        }

        const appointmentDate = parseDate(appointment.date);

        if (!appointmentDate) {
            return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (value === "today") {
            return appointment.date === toDateValue(today);
        }

        const days = Number(value) || 0;
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - Math.max(days - 1, 0));

        return appointmentDate >= cutoff && appointmentDate <= today;
    };

    const buildSearchText = (appointment) => [
        appointment.id,
        appointment.paymentRef,
        getCustomerName(appointment),
        appointment.customerEmail,
        appointment.customerMobile,
        appointment.service,
        appointment.stylist,
        appointment.date,
        appointment.time,
        normalizeStatus(appointment.status),
        appointment.adminStatus,
        appointment.paymentStatus,
        appointment.paymentMethod,
    ].join(" ").toLowerCase();

    const getFilteredAppointments = () => {
        const statusValue = statusFilter ? statusFilter.value : "all";
        const paymentValue = paymentFilter ? paymentFilter.value : "all";
        const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

        return appointments.filter((appointment) => {
            const matchesPeriod = withinPeriod(appointment);
            const matchesStatus = statusValue === "all" || normalizeStatus(appointment.status) === statusValue;
            const matchesPayment = paymentValue === "all" || getPaymentState(appointment) === paymentValue;
            const matchesSearch = !query || buildSearchText(appointment).includes(query);
            return matchesPeriod && matchesStatus && matchesPayment && matchesSearch;
        });
    };

    const setText = (selector, value) => {
        const element = document.querySelector(selector);

        if (element) {
            element.textContent = value;
        }
    };

    const makePercent = (value, total) => {
        if (!total) {
            return 0;
        }

        return Math.round((value / total) * 100);
    };

    const renderBars = (target, rows, emptyText) => {
        if (!target) {
            return;
        }

        const total = rows.reduce((sum, row) => sum + row.value, 0);

        if (!total) {
            target.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
            return;
        }

        target.innerHTML = rows.map((row) => {
            const percent = makePercent(row.value, total);
            const tone = row.tone ? ` ${row.tone}` : "";

            return `
                <div class="bar-row">
                    <div class="report-row-top">
                        <strong>${escapeHtml(row.label)}</strong>
                        <span class="bar-meta">${escapeHtml(row.value)} | ${escapeHtml(percent)}%</span>
                    </div>
                    <div class="bar-track" aria-hidden="true">
                        <div class="bar-fill${escapeHtml(tone)}" style="--bar-width: ${escapeHtml(percent)}%;"></div>
                    </div>
                </div>
            `;
        }).join("");
    };

    const summarizeGroup = (items, key) => {
        const groups = new Map();

        items.forEach((appointment) => {
            const name = appointment[key] || (key === "stylist" ? "Salon team" : "Salon appointment");
            const current = groups.get(name) || {
                name,
                count: 0,
                revenue: 0,
                completed: 0,
            };

            current.count += 1;
            current.revenue += Number(appointment.amountPaid) || 0;

            if (normalizeStatus(appointment.status) === "completed") {
                current.completed += 1;
            }

            groups.set(name, current);
        });

        return [...groups.values()]
            .sort((first, second) => second.count - first.count || second.revenue - first.revenue)
            .slice(0, 6);
    };

    const renderRankList = (target, rows, emptyText) => {
        if (!target) {
            return;
        }

        if (rows.length === 0) {
            target.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
            return;
        }

        target.innerHTML = rows.map((row) => `
            <div class="rank-row">
                <div>
                    <h3>${escapeHtml(row.name)}</h3>
                    <p>${escapeHtml(row.count)} booking${row.count === 1 ? "" : "s"} | ${escapeHtml(row.completed)} completed</p>
                </div>
                <div class="rank-total">${escapeHtml(formatCurrency(row.revenue))}</div>
            </div>
        `).join("");
    };

    const getPeriodItems = (days) => {
        if (days === "today") {
            const today = toDateValue(new Date());
            return appointments.filter((appointment) => appointment.date === today);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - (days - 1));

        return appointments.filter((appointment) => {
            const appointmentDate = parseDate(appointment.date);
            return appointmentDate && appointmentDate >= cutoff && appointmentDate <= today;
        });
    };

    const renderPeriodSummary = () => {
        if (!periodSummary) {
            return;
        }

        const rows = [
            { label: "Today", items: getPeriodItems("today") },
            { label: "Last 7 days", items: getPeriodItems(7) },
            { label: "Last 30 days", items: getPeriodItems(30) },
        ];

        periodSummary.innerHTML = rows.map((row) => {
            const revenue = row.items.reduce((sum, appointment) => sum + (Number(appointment.amountPaid) || 0), 0);
            const pending = row.items.reduce((sum, appointment) => getPaymentState(appointment) === "refunded"
                ? sum
                : sum + (Number(appointment.remaining) || 0), 0);

            return `
                <div class="period-row">
                    <div>
                        <span>${escapeHtml(row.label)}</span>
                        <strong>${escapeHtml(row.items.length)} booking${row.items.length === 1 ? "" : "s"}</strong>
                        <p>${escapeHtml(formatCurrency(pending))} pending</p>
                    </div>
                    <strong>${escapeHtml(formatCurrency(revenue))}</strong>
                </div>
            `;
        }).join("");
    };

    const updateSummary = (items) => {
        const revenue = items.reduce((sum, appointment) => sum + (Number(appointment.amountPaid) || 0), 0);
        const pendingAmount = items.reduce((sum, appointment) => getPaymentState(appointment) === "refunded"
            ? sum
            : sum + (Number(appointment.remaining) || 0), 0);
        const completed = items.filter((appointment) => normalizeStatus(appointment.status) === "completed").length;
        const completionRate = makePercent(completed, items.length);

        setText('[data-summary="revenue"]', formatCurrency(revenue));
        setText('[data-summary="pending-amount"]', formatCurrency(pendingAmount));
        setText('[data-summary="bookings"]', items.length);
        setText('[data-summary="customers"]', countCustomers(items));
        setText('[data-summary="completion-rate"]', `${completionRate}%`);
        setText("[data-summary-note=\"bookings\"]", `${appointments.length} saved appointment${appointments.length === 1 ? "" : "s"}`);
    };

    const renderStatusReport = (items) => {
        const rows = [
            { label: "Upcoming", value: items.filter((appointment) => normalizeStatus(appointment.status) === "upcoming").length },
            { label: "Completed", value: items.filter((appointment) => normalizeStatus(appointment.status) === "completed").length },
            { label: "Cancelled", value: items.filter((appointment) => normalizeStatus(appointment.status) === "cancelled").length, tone: "danger" },
        ];

        renderBars(statusReport, rows, "No appointments match this report.");
    };

    const renderPaymentReport = (items) => {
        const rows = [
            { label: "Paid", value: items.filter((appointment) => getPaymentState(appointment) === "paid").length },
            { label: "Part paid", value: items.filter((appointment) => getPaymentState(appointment) === "part-paid").length, tone: "warning" },
            { label: "Pending", value: items.filter((appointment) => getPaymentState(appointment) === "pending").length, tone: "warning" },
            { label: "Failed", value: items.filter((appointment) => getPaymentState(appointment) === "failed").length, tone: "danger" },
            { label: "Refunded", value: items.filter((appointment) => getPaymentState(appointment) === "refunded").length, tone: "danger" },
        ];

        renderBars(paymentReport, rows, "No payments match this report.");
    };

    const renderTable = (items) => {
        if (!reportTable) {
            return;
        }

        if (items.length === 0) {
            reportTable.innerHTML = '<tr><td colspan="7">No bookings match this report.</td></tr>';
            return;
        }

        reportTable.innerHTML = [...items]
            .sort((first, second) => {
                const firstTime = new Date(first.updatedAt || first.createdAt || first.date || 0).getTime();
                const secondTime = new Date(second.updatedAt || second.createdAt || second.date || 0).getTime();
                return secondTime - firstTime;
            })
            .map((appointment) => {
                const status = normalizeStatus(appointment.status);
                const paymentState = getPaymentState(appointment);
                const total = getTotal(appointment);

                return `
                    <tr>
                        <td>
                            ${escapeHtml(appointment.id || "New")}
                            <small>${escapeHtml(formatDate(appointment.date))} ${escapeHtml(appointment.time || "")}</small>
                            <small>Booked ${escapeHtml(formatBookedAt(appointment))}</small>
                        </td>
                        <td>
                            ${escapeHtml(getCustomerName(appointment))}
                            <small>${escapeHtml([appointment.customerEmail, appointment.customerMobile].filter(Boolean).join(" | ") || "No contact")}</small>
                        </td>
                        <td>${escapeHtml(appointment.service || "Salon appointment")}</td>
                        <td>${escapeHtml(appointment.stylist || "Salon team")}</td>
                        <td><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
                        <td><span class="status-pill ${escapeHtml(paymentState)}">${escapeHtml(getPaymentLabel(appointment))}</span></td>
                        <td>
                            ${escapeHtml(formatCurrency(total))}
                            <small>Paid ${escapeHtml(formatCurrency(appointment.amountPaid))}</small>
                        </td>
                    </tr>
                `;
            }).join("");
    };

    const renderCatalogNote = () => {
        const services = readArray(servicesKey, fallbackServices);
        const staff = readArray(staffKey, fallbackStaff);
        const activeServices = services.filter((service) => service.active !== false).length;
        const availableStaff = staff.filter((member) => member.available !== false).length;

        if (lastUpdated) {
            lastUpdated.textContent = `${activeServices} active services | ${availableStaff} available staff`;
        }
    };

    const renderReports = () => {
        const filtered = getFilteredAppointments();

        updateSummary(filtered);
        renderStatusReport(filtered);
        renderPaymentReport(filtered);
        renderPeriodSummary();
        renderRankList(serviceReport, summarizeGroup(filtered, "service"), "No services match this report.");
        renderRankList(stylistReport, summarizeGroup(filtered, "stylist"), "No stylists match this report.");
        renderTable(filtered);
        renderCatalogNote();

        if (reportCount) {
            reportCount.textContent = `${filtered.length} shown`;
        }
    };

    const makeCsvValue = (value) => `"${String(value || "").replace(/"/g, '""')}"`;

    const exportReport = () => {
        const rows = getFilteredAppointments().map((appointment) => [
            appointment.id || "",
            getCustomerName(appointment),
            appointment.customerEmail || "",
            appointment.customerMobile || "",
            appointment.service || "",
            appointment.stylist || "",
            appointment.date || "",
            appointment.time || "",
            formatBookedAt(appointment),
            normalizeStatus(appointment.status),
            getPaymentLabel(appointment),
            getTotal(appointment),
            Number(appointment.amountPaid) || 0,
            Number(appointment.remaining) || 0,
        ]);
        const headings = ["Appointment ID", "Customer", "Email", "Mobile", "Service", "Stylist", "Visit Date", "Visit Time", "Booked At", "Status", "Payment", "Total", "Paid", "Remaining"];
        const csv = [headings, ...rows].map((row) => row.map(makeCsvValue).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `glow-grace-report-${toDateValue(new Date())}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    [periodFilter, statusFilter, paymentFilter].forEach((filter) => {
        if (filter) {
            filter.addEventListener("change", renderReports);
        }
    });

    if (searchInput) {
        searchInput.addEventListener("input", renderReports);
    }

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener("click", () => {
            if (periodFilter) periodFilter.value = "all";
            if (statusFilter) statusFilter.value = "all";
            if (paymentFilter) paymentFilter.value = "all";
            if (searchInput) searchInput.value = "";
            renderReports();
        });
    }

    if (printButton) {
        printButton.addEventListener("click", () => window.print());
    }

    if (exportButton) {
        exportButton.addEventListener("click", exportReport);
    }

    const loadReports = async () => {
        if (window.GlowGraceAdminAuth) {
            const admin = await window.GlowGraceAdminAuth.ensure();

            if (!admin) {
                return;
            }
        }

        appointments = [];
        localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
        renderReports();

        if (liveData && liveData.getAdminAppointments) {
            try {
                appointments = await liveData.getAdminAppointments();
                localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
                renderReports();
            } catch (error) {
                if (error.status === 401) {
                    appointments = [];
                    localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
                    renderReports();
                }
            }
        }
    };

    loadReports();
});
