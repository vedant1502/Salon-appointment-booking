document.addEventListener("DOMContentLoaded", () => {
    const profileKey = "glow-grace-profile";
    const appointmentsKey = "glow-grace-appointments";
    const notificationsKey = "glow-grace-notifications";
    const customerSession = window.GlowGraceCustomerSession;
    const liveData = window.GlowGraceLiveData;
    const header = document.querySelector("[data-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navMenu = document.querySelector("[data-nav-menu]");
    const profileForm = document.querySelector("[data-profile-form]");
    const profileMessage = document.querySelector("[data-profile-message]");
    const editButton = document.querySelector("[data-edit-profile]");
    const logoutButton = document.querySelector("[data-logout-profile]");
    const resetButton = document.querySelector("[data-reset-profile]");
    const cancelButton = document.querySelector("[data-cancel-edit]");
    const saveButton = document.querySelector("[data-save-profile]");
    const editPanel = document.querySelector("[data-edit-panel]");
    const notificationList = document.querySelector("[data-notification-list]");
    const notificationCount = document.querySelector("[data-notification-count]");
    const markNotificationsButton = document.querySelector("[data-mark-notifications]");
    const clearNotificationsButton = document.querySelector("[data-clear-notifications]");
    const editableFields = profileForm ? profileForm.querySelectorAll("input, select, textarea") : [];
    const revealItems = document.querySelectorAll(".reveal");

    const defaultProfile = {
        name: "",
        email: "",
        mobile: "",
        city: "",
        hairType: "",
        skinType: "",
        preferredStylist: "",
        favoriteService: "",
        allergies: "",
        notes: "",
        reminders: [],
    };
    let currentProfile = defaultProfile;

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

    const getInitials = (name) => {
        const words = String(name || "Guest Customer").trim().split(/\s+/).slice(0, 2);
        return words.map((word) => word[0]).join("").toUpperCase() || "GG";
    };

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "Date not selected";
        }

        const date = new Date(`${dateValue}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    };

    const formatNotificationTime = (dateValue) => {
        if (!dateValue) {
            return "Just now";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Just now";
        }

        return date.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const readProfile = () => {
        const profile = {
            ...defaultProfile,
            ...readJson(profileKey, defaultProfile),
        };

        profile.reminders = Array.isArray(profile.reminders) ? profile.reminders : [];
        return profile;
    };

    const readAppointments = () => {
        const appointments = readJson(appointmentsKey, []);
        return Array.isArray(appointments) ? appointments : [];
    };

    const readNotifications = () => {
        const notifications = readJson(notificationsKey, []);
        return Array.isArray(notifications) ? notifications : [];
    };

    const saveNotifications = (notifications) => {
        saveJson(notificationsKey, notifications);
    };

    const updateHeader = () => {
        if (!header) return;
        header.classList.toggle("scrolled", window.scrollY > 12);
    };

    const updateOverview = (profile) => {
        const avatar = document.querySelector("[data-profile-avatar]");
        const profileName = document.querySelector("[data-profile-name]");
        const profileContact = document.querySelector("[data-profile-contact]");

        if (avatar) {
            avatar.textContent = getInitials(profile.name);
        }

        if (profileName) {
            profileName.textContent = profile.name || "Guest Customer";
        }

        if (profileContact) {
            const contactParts = [profile.email, profile.mobile].filter(Boolean);
            profileContact.textContent = contactParts.length > 0
                ? contactParts.join(" | ")
                : "Add your email and mobile number.";
        }
    };

    const updateAppointmentStats = () => {
        const appointments = readAppointments();
        const counts = { upcoming: 0, completed: 0, cancelled: 0 };

        appointments.forEach((appointment) => {
            if (counts[appointment.status] !== undefined) {
                counts[appointment.status] += 1;
            }
        });

        Object.entries(counts).forEach(([status, count]) => {
            const target = document.querySelector(`[data-stat="${status}"]`);

            if (target) {
                target.textContent = count;
            }
        });
    };

    const updateNextVisit = () => {
        const appointments = readAppointments()
            .filter((appointment) => appointment.status === "upcoming")
            .sort((first, second) => String(first.date || "").localeCompare(String(second.date || "")));
        const nextVisit = appointments[0];
        const serviceTarget = document.querySelector("[data-next-service]");
        const detailsTarget = document.querySelector("[data-next-details]");

        if (!serviceTarget || !detailsTarget) {
            return;
        }

        if (!nextVisit) {
            serviceTarget.textContent = "No upcoming appointment";
            detailsTarget.textContent = "Book a service to see your next salon visit here.";
            return;
        }

        serviceTarget.textContent = nextVisit.service || "Salon appointment";
        detailsTarget.textContent = `${formatDate(nextVisit.date)} at ${nextVisit.time || "selected time"} with ${nextVisit.stylist || "salon team"}.`;
    };

    const renderNotifications = () => {
        if (!notificationList) {
            return;
        }

        const notifications = readNotifications();
        const unreadCount = notifications.filter((notification) => !notification.read).length;

        if (notificationCount) {
            notificationCount.textContent = `${unreadCount} new`;
        }

        if (notifications.length === 0) {
            notificationList.innerHTML = '<div class="empty-notification">No notifications yet.</div>';
            return;
        }

        notificationList.innerHTML = notifications.map((notification, index) => `
            <article
                class="notification-item ${notification.read ? "read" : "unread"}"
                data-notification-index="${index}"
                role="button"
                tabindex="0"
                aria-label="${notification.read ? "Notification already read" : "Mark notification as read"}: ${escapeHtml(notification.title || "Salon update")}"
            >
                <h3>${escapeHtml(notification.title || "Salon update")}</h3>
                <p>${escapeHtml(notification.message || "")}</p>
                <span>${escapeHtml(formatNotificationTime(notification.createdAt))}${notification.appointmentId ? ` | ${escapeHtml(notification.appointmentId)}` : ""}</span>
            </article>
        `).join("");
    };

    const markNotificationRead = (index) => {
        const notifications = readNotifications();
        const notification = notifications[index];

        if (!notification || notification.read) {
            return;
        }

        notifications[index] = {
            ...notification,
            read: true,
        };

        saveNotifications(notifications);
        renderNotifications();
    };

    const fillForm = (profile) => {
        if (!profileForm) return;

        Object.entries(defaultProfile).forEach(([key]) => {
            if (key === "reminders") {
                return;
            }

            const field = profileForm.elements[key];

            if (field) {
                field.value = profile[key] || "";
            }
        });

        profileForm.querySelectorAll('input[name="reminders"]').forEach((input) => {
            input.checked = profile.reminders.includes(input.value);
        });
    };

    const setEditMode = (isEditing) => {
        if (profileForm) {
            profileForm.classList.toggle("is-editing", isEditing);
        }

        editableFields.forEach((field) => {
            field.disabled = !isEditing;
        });

        if (editPanel) {
            editPanel.hidden = !isEditing;
        }

        if (editButton) {
            editButton.hidden = isEditing;
        }

        if (resetButton) {
            resetButton.hidden = !isEditing;
        }

        if (cancelButton) {
            cancelButton.hidden = !isEditing;
        }

        if (saveButton) {
            saveButton.disabled = !isEditing;
        }

        if (isEditing && editableFields[0]) {
            window.setTimeout(() => editableFields[0].focus(), 80);
        }
    };

    const readFormProfile = () => {
        const formData = new FormData(profileForm);
        const profile = {
            name: formData.get("name").trim(),
            email: formData.get("email").trim(),
            mobile: formData.get("mobile").trim(),
            city: formData.get("city").trim(),
            hairType: formData.get("hairType"),
            skinType: formData.get("skinType"),
            preferredStylist: formData.get("preferredStylist"),
            favoriteService: formData.get("favoriteService"),
            allergies: formData.get("allergies").trim(),
            notes: formData.get("notes").trim(),
            reminders: formData.getAll("reminders"),
            updatedAt: new Date().toISOString(),
        };

        return profile;
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

    if (profileForm) {
        profileForm.addEventListener("input", () => {
            if (!profileForm.classList.contains("is-editing")) {
                return;
            }

            updateOverview(readFormProfile());

            if (profileMessage) {
                profileMessage.textContent = "";
                profileMessage.classList.remove("error");
            }
        });

        profileForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!profileForm.checkValidity()) {
                profileForm.reportValidity();
                return;
            }

            const profile = readFormProfile();

            if (saveButton) {
                saveButton.disabled = true;
            }

            try {
                let savedProfile = profile;

                if (customerSession && customerSession.request) {
                    const data = await customerSession.request("/profile", {
                        method: "PUT",
                        body: JSON.stringify(profile),
                    });
                    savedProfile = {
                        ...profile,
                        ...(data.user || {}),
                    };
                    customerSession.save(savedProfile);
                }

                saveJson(profileKey, savedProfile);
                currentProfile = savedProfile;
                updateOverview(savedProfile);
                setEditMode(false);

                if (profileMessage) {
                    profileMessage.classList.remove("error");
                    profileMessage.textContent = "Profile saved successfully. Click Edit details to change it again.";
                }
            } catch (error) {
                if (profileMessage) {
                    profileMessage.classList.add("error");
                    profileMessage.textContent = error.message || "Profile could not be saved.";
                }
            } finally {
                if (saveButton && profileForm.classList.contains("is-editing")) {
                    saveButton.disabled = false;
                }
            }
        });
    }

    if (editButton && profileForm) {
        editButton.addEventListener("click", () => {
            fillForm(currentProfile);
            setEditMode(true);

            if (profileMessage) {
                profileMessage.textContent = "";
                profileMessage.classList.remove("error");
            }
        });
    }

    if (cancelButton && profileForm) {
        cancelButton.addEventListener("click", () => {
            fillForm(currentProfile);
            updateOverview(currentProfile);
            setEditMode(false);

            if (profileMessage) {
                profileMessage.classList.remove("error");
                profileMessage.textContent = "No changes saved.";
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            if (customerSession) {
                await customerSession.clear();
            } else {
                saveJson("glow-grace-customer-session", {
                    signedIn: false,
                    signedOutAt: new Date().toISOString(),
                });
            }

            if (profileMessage) {
                profileMessage.classList.remove("error");
                profileMessage.textContent = "Logged out successfully. Opening login page...";
            }

            window.setTimeout(() => {
                window.location.href = "login-register.html";
            }, 650);
        });
    }

    if (resetButton && profileForm) {
        resetButton.addEventListener("click", () => {
            localStorage.removeItem(profileKey);
            currentProfile = { ...defaultProfile, reminders: [] };
            fillForm(defaultProfile);
            updateOverview(defaultProfile);
            setEditMode(false);

            if (profileMessage) {
                profileMessage.classList.remove("error");
                profileMessage.textContent = "Profile details cleared.";
            }
        });
    }

    if (notificationList) {
        notificationList.addEventListener("click", (event) => {
            const notificationItem = event.target.closest("[data-notification-index]");

            if (!notificationItem || !notificationList.contains(notificationItem)) {
                return;
            }

            markNotificationRead(Number(notificationItem.dataset.notificationIndex));
        });

        notificationList.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            const notificationItem = event.target.closest("[data-notification-index]");

            if (!notificationItem || !notificationList.contains(notificationItem)) {
                return;
            }

            event.preventDefault();
            markNotificationRead(Number(notificationItem.dataset.notificationIndex));
        });
    }

    if (markNotificationsButton) {
        markNotificationsButton.addEventListener("click", () => {
            const notifications = readNotifications().map((notification) => ({
                ...notification,
                read: true,
            }));

            saveNotifications(notifications);
            renderNotifications();
        });
    }

    if (clearNotificationsButton) {
        clearNotificationsButton.addEventListener("click", () => {
            saveNotifications([]);
            renderNotifications();
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

    currentProfile = readProfile();
    fillForm(currentProfile);
    updateOverview(currentProfile);
    updateAppointmentStats();
    updateNextVisit();
    renderNotifications();
    setEditMode(false);

    const loadProfileAppointments = async () => {
        if (!liveData || !liveData.getMyAppointments) {
            return;
        }

        try {
            saveJson(appointmentsKey, await liveData.getMyAppointments());
            updateAppointmentStats();
            updateNextVisit();
        } catch (error) {
            // Local profile appointment data remains visible if live data is unavailable.
        }
    };

    loadProfileAppointments();

    if (customerSession && customerSession.refresh) {
        customerSession.refresh({ redirectIfMissing: true }).then((session) => {
            if (!session) {
                return;
            }

            currentProfile = {
                ...readProfile(),
                ...session,
            };
            saveJson(profileKey, currentProfile);
            fillForm(currentProfile);
            updateOverview(currentProfile);
        });
    }
});
