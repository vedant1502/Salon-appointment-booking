document.addEventListener("DOMContentLoaded", () => {
    const reviewsKey = "glow-grace-reviews";
    const notificationsKey = "glow-grace-notifications";
    const reviewList = document.querySelector("[data-review-list]");
    const filterButtons = document.querySelectorAll("[data-filter]");
    const ratingFilter = document.querySelector("[data-rating-filter]");
    const searchInput = document.querySelector("[data-search]");
    const resultCount = document.querySelector("[data-result-count]");
    let activeFilter = "all";
    let reviews = [];
    const demoReviewIds = new Set([
        "review-apt-gg063515",
        "review-glow-facial-001",
        "review-spa-002",
        "review-color-003",
        "review-party-makeup-004",
        "review-nail-005",
    ]);

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

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "Date not added";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const readReviews = () => {
        const storedReviews = readJson(reviewsKey, []);
        const reviewItems = Array.isArray(storedReviews) ? storedReviews : [];
        const cleanedReviews = reviewItems.filter((review) => !demoReviewIds.has(String(review.id || "")));

        if (cleanedReviews.length !== reviewItems.length) {
            saveJson(reviewsKey, cleanedReviews);
        }

        return cleanedReviews;
    };

    const saveReviews = () => {
        saveJson(reviewsKey, reviews);
    };

    const readNotifications = () => {
        const notifications = readJson(notificationsKey, []);
        return Array.isArray(notifications) ? notifications : [];
    };

    const addNotification = ({ title, message, appointmentId }) => {
        const notifications = readNotifications();

        notifications.unshift({
            id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            type: "review",
            title,
            message,
            appointmentId,
            read: false,
            createdAt: new Date().toISOString(),
        });

        saveJson(notificationsKey, notifications.slice(0, 50));
    };

    const setText = (selector, value) => {
        const element = document.querySelector(selector);

        if (element) {
            element.textContent = value;
        }
    };

    const getRating = (review) => Math.max(1, Math.min(5, Math.round(Number(review.rating) || 0)));

    const getStars = (review) => "★".repeat(getRating(review)) + "☆".repeat(5 - getRating(review));

    const isLowRating = (review) => getRating(review) <= 3;

    const buildSearchText = (review) => [
        review.customerName,
        review.customerEmail,
        review.service,
        review.stylist,
        review.appointmentId,
        review.title,
        review.message,
        review.adminReply,
        review.hidden ? "hidden" : "visible",
        review.featured ? "featured" : "",
    ].join(" ").toLowerCase();

    const reviewMatchesFilter = (review) => {
        if (activeFilter === "featured") return review.featured === true;
        if (activeFilter === "visible") return review.hidden !== true;
        if (activeFilter === "hidden") return review.hidden === true;
        if (activeFilter === "low") return isLowRating(review);
        return true;
    };

    const getVisibleReviews = () => {
        const ratingValue = ratingFilter ? ratingFilter.value : "all";
        const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

        return reviews.filter((review) => {
            const matchesFilter = reviewMatchesFilter(review);
            const matchesRating = ratingValue === "all" || getRating(review) === Number(ratingValue);
            const matchesSearch = !query || buildSearchText(review).includes(query);
            return matchesFilter && matchesRating && matchesSearch;
        });
    };

    const updateCounts = () => {
        const total = reviews.length;
        const average = total
            ? (reviews.reduce((sum, review) => sum + getRating(review), 0) / total).toFixed(1)
            : "0.0";

        setText('[data-count="total"]', total);
        setText('[data-count="average"]', average);
        setText('[data-count="featured"]', reviews.filter((review) => review.featured).length);
        setText('[data-count="low"]', reviews.filter(isLowRating).length);
        setText('[data-count="hidden"]', reviews.filter((review) => review.hidden).length);
    };

    const renderReviewCard = (review) => {
        const rating = getRating(review);
        const hidden = review.hidden === true;
        const featured = review.featured === true;
        const replied = Boolean(review.adminReply);
        const low = isLowRating(review);

        return `
            <article class="review-card ${hidden ? "is-hidden-review" : ""}" data-review-id="${escapeHtml(review.id)}">
                <div class="review-info">
                    <div class="review-topline">
                        <div>
                            <div class="status-row">
                                <span class="status-pill ${hidden ? "hidden" : "visible"}">${hidden ? "Hidden" : "Visible"}</span>
                                ${featured ? '<span class="status-pill featured">Featured</span>' : ""}
                                ${replied ? '<span class="status-pill replied">Replied</span>' : ""}
                                ${low ? '<span class="status-pill low">Low rating</span>' : ""}
                            </div>
                            <h3>${escapeHtml(review.title || "Customer review")}</h3>
                        </div>
                        <span class="rating-badge ${low ? "low" : ""}" aria-label="${escapeHtml(rating)} out of 5 stars">${escapeHtml(getStars(review))}</span>
                    </div>

                    <p class="review-copy">${escapeHtml(review.message || "No review message added.")}</p>

                    <div class="review-meta">
                        <span>${escapeHtml(review.customerName || "Customer")}</span>
                        <span>${escapeHtml(review.service || "Salon service")}</span>
                        <span>${escapeHtml(review.stylist || "Salon team")}</span>
                        <span>${escapeHtml(formatDate(review.createdAt))}</span>
                        <span>${escapeHtml(review.appointmentId || "No appointment ID")}</span>
                    </div>
                </div>

                <div class="reply-box">
                    <label>
                        <span>Admin reply</span>
                        <textarea data-reply-input placeholder="Write a polite reply to this customer">${escapeHtml(review.adminReply || "")}</textarea>
                    </label>
                    <p>${replied ? `Last reply saved for ${escapeHtml(review.customerName || "customer")}.` : "No admin reply yet."}</p>
                    <div class="review-actions">
                        <button class="primary" type="button" data-action="save-reply">Save reply</button>
                        <button type="button" data-action="feature">${featured ? "Remove feature" : "Feature"}</button>
                        <button class="${hidden ? "" : "danger"}" type="button" data-action="visibility">${hidden ? "Show" : "Hide"}</button>
                        <button type="button" data-action="clear-reply">Clear reply</button>
                    </div>
                    <p class="form-message" role="status">${escapeHtml(review.adminMessage || "")}</p>
                </div>
            </article>
        `;
    };

    const renderReviews = () => {
        if (!reviewList) {
            return;
        }

        updateCounts();
        const visibleReviews = getVisibleReviews();

        if (resultCount) {
            resultCount.textContent = `${visibleReviews.length} review${visibleReviews.length === 1 ? "" : "s"} shown`;
        }

        if (visibleReviews.length === 0) {
            reviewList.innerHTML = '<div class="empty-state">No reviews match this filter.</div>';
            return;
        }

        reviewList.innerHTML = visibleReviews
            .slice()
            .sort((first, second) => {
                const firstTime = new Date(first.updatedAt || first.createdAt || 0).getTime();
                const secondTime = new Date(second.updatedAt || second.createdAt || 0).getTime();
                return secondTime - firstTime;
            })
            .map(renderReviewCard)
            .join("");
    };

    const updateReview = (reviewId, updater) => {
        reviews = reviews.map((review) => {
            if (review.id !== reviewId) {
                return review;
            }

            return {
                ...review,
                ...updater(review),
                updatedAt: new Date().toISOString(),
            };
        });

        saveReviews();
        renderReviews();
    };

    if (reviewList) {
        reviewList.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            const card = event.target.closest("[data-review-id]");

            if (!button || !card || !reviewList.contains(card)) {
                return;
            }

            const reviewId = card.dataset.reviewId;
            const review = reviews.find((item) => item.id === reviewId);

            if (!review) {
                return;
            }

            if (button.dataset.action === "feature") {
                updateReview(reviewId, (currentReview) => ({
                    featured: !currentReview.featured,
                    hidden: false,
                    adminMessage: !currentReview.featured ? "Review is now featured." : "Review removed from featured list.",
                }));
                return;
            }

            if (button.dataset.action === "visibility") {
                updateReview(reviewId, (currentReview) => {
                    const nextHidden = !currentReview.hidden;

                    return {
                        hidden: nextHidden,
                        featured: nextHidden ? false : currentReview.featured,
                        adminMessage: nextHidden ? "Review hidden from customer-facing sections." : "Review is visible again.",
                    };
                });
                return;
            }

            if (button.dataset.action === "save-reply") {
                const replyInput = card.querySelector("[data-reply-input]");
                const reply = replyInput ? replyInput.value.trim() : "";
                const previousReply = review.adminReply || "";

                updateReview(reviewId, () => ({
                    adminReply: reply,
                    replyUpdatedAt: reply ? new Date().toISOString() : "",
                    adminMessage: reply ? "Reply saved." : "Reply cleared.",
                }));

                if (reply && reply !== previousReply) {
                    addNotification({
                        title: "Salon replied to your review",
                        message: `Admin replied to your feedback for ${review.service || "your salon visit"}.`,
                        appointmentId: review.appointmentId || "",
                    });
                }

                return;
            }

            if (button.dataset.action === "clear-reply") {
                updateReview(reviewId, () => ({
                    adminReply: "",
                    replyUpdatedAt: "",
                    adminMessage: "Reply cleared.",
                }));
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

            renderReviews();
        });
    });

    if (ratingFilter) {
        ratingFilter.addEventListener("change", renderReviews);
    }

    if (searchInput) {
        searchInput.addEventListener("input", renderReviews);
    }

    window.addEventListener("storage", (event) => {
        if (event.key !== reviewsKey) {
            return;
        }

        reviews = readReviews();
        renderReviews();
    });

    reviews = readReviews();
    renderReviews();
});
