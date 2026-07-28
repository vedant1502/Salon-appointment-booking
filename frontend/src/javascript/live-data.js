(function () {
    const getBackendBase = () => String(window.GLOW_GRACE_BACKEND_URL || "").trim().replace(/\/+$/, "");

    const getApiUrl = (path) => {
        const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
        const backendBase = getBackendBase();
        return backendBase ? `${backendBase}/api${cleanPath}` : `/api${cleanPath}`;
    };

    const request = async (path, options = {}) => {
        const response = await fetch(getApiUrl(path), {
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
            ...options,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Live data request failed.");
        }

        return data;
    };

    const asArray = (value) => (Array.isArray(value) ? value : []);

    const byRecentActivity = (first, second) => {
        const firstTime = new Date(first.paymentUpdatedAt || first.updatedAt || first.createdAt || first.date || 0).getTime();
        const secondTime = new Date(second.paymentUpdatedAt || second.updatedAt || second.createdAt || second.date || 0).getTime();
        return secondTime - firstTime || String(second.id || "").localeCompare(String(first.id || ""));
    };

    const getMyAppointments = async () => {
        const data = await request("/appointments/my");
        return asArray(data.appointments).sort(byRecentActivity);
    };

    const getAdminAppointments = async () => {
        const data = await request("/admin/appointments");
        return asArray(data.appointments).sort(byRecentActivity);
    };

    const saveAppointment = async (appointment) => {
        const data = await request("/appointments", {
            method: "POST",
            body: JSON.stringify({ appointment }),
        });
        return data.appointment;
    };

    const updateAppointment = async (appointmentId, updates, { admin = false } = {}) => {
        const prefix = admin ? "/admin/appointments" : "/appointments";
        const data = await request(`${prefix}/${encodeURIComponent(appointmentId)}`, {
            method: "PUT",
            body: JSON.stringify({ updates }),
        });
        return data.appointment;
    };

    const getPublicReviews = async () => {
        const data = await request("/reviews");
        return asArray(data.reviews);
    };

    const getAdminReviews = async () => {
        const data = await request("/admin/reviews");
        return asArray(data.reviews);
    };

    const saveReview = async (review) => {
        const data = await request("/reviews", {
            method: "POST",
            body: JSON.stringify({ review }),
        });
        return data.review;
    };

    const updateReview = async (reviewId, updates) => {
        const data = await request(`/admin/reviews/${encodeURIComponent(reviewId)}`, {
            method: "PUT",
            body: JSON.stringify({ updates }),
        });
        return data.review;
    };

    const getSummary = async () => request("/live/summary");

    window.GlowGraceLiveData = {
        request,
        getMyAppointments,
        getAdminAppointments,
        saveAppointment,
        updateAppointment,
        getPublicReviews,
        getAdminReviews,
        saveReview,
        updateReview,
        getSummary,
    };
}());