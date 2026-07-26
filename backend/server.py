from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
DATA_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DATA_DIR / "salon.db"
SESSION_COOKIE = "gg_session"
HASH_ITERATIONS = 210_000


def utc_now():
    return int(time.time())


def iso_now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def normalize_email(value):
    return str(value or "").strip().lower()


def normalize_mobile(value):
    return "".join(character for character in str(value or "").strip() if character.isdigit() or character == "+")


def is_valid_mobile(value):
    digits = "".join(character for character in str(value or "") if character.isdigit())
    return 10 <= len(digits) <= 15


def normalize_recovery_question(value):
    return str(value or "").strip()


def normalize_recovery_answer(value):
    return " ".join(str(value or "").strip().lower().split())


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password):
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        HASH_ITERATIONS,
    )
    return "pbkdf2_sha256${}${}${}".format(
        HASH_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(password_hash).decode("ascii"),
    )


def verify_password(password, stored_hash):
    try:
        algorithm, iterations, salt, expected_hash = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False

        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            base64.b64decode(salt),
            int(iterations),
        )
        return hmac.compare_digest(password_hash, base64.b64decode(expected_hash))
    except (ValueError, TypeError):
        return False


def get_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def ensure_column(db, table_name, column_name, definition):
    columns = {row["name"] for row in db.execute(f"PRAGMA table_info({table_name})")}

    if column_name not in columns:
        db.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def init_db():
    with get_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                mobile TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                recovery_question TEXT,
                recovery_answer_hash TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_hash TEXT NOT NULL UNIQUE,
                account_type TEXT NOT NULL,
                account_id INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            DROP TABLE IF EXISTS otps;
            """
        )

        ensure_column(db, "users", "recovery_question", "TEXT")
        ensure_column(db, "users", "recovery_answer_hash", "TEXT")

        admin_email = normalize_email(os.environ.get("GLOW_GRACE_ADMIN_EMAIL", "admin@glowgrace.com"))
        admin_password = os.environ.get("GLOW_GRACE_ADMIN_PASSWORD", "Admin@12345")
        admin_role = os.environ.get("GLOW_GRACE_ADMIN_ROLE", "manager")
        existing_admin = db.execute("SELECT id FROM admins WHERE email = ?", (admin_email,)).fetchone()

        if not existing_admin:
            now = iso_now()
            db.execute(
                """
                INSERT INTO admins (role, email, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (admin_role, admin_email, hash_password(admin_password), now, now),
            )

        db.execute("DELETE FROM sessions WHERE expires_at < ?", (utc_now(),))


class SalonRequestHandler(SimpleHTTPRequestHandler):
    server_version = "GlowGraceAuth/1.0"

    def send_cors_headers(self):
        origin = self.headers.get("Origin")

        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == "/api/health":
            self.send_json({"ok": True, "service": "Glow & Grace auth"})
            return

        if parsed_path.path == "/api/auth/me":
            self.handle_me()
            return

        self.serve_static(parsed_path.path)

    def do_POST(self):
        parsed_path = urlparse(self.path)
        routes = {
            "/api/auth/register": self.handle_register,
            "/api/auth/login": self.handle_login,
            "/api/auth/admin-login": self.handle_admin_login,
            "/api/auth/google-login": self.handle_google_login,
            "/api/auth/verify-recovery": self.handle_verify_recovery,
            "/api/auth/reset-password": self.handle_reset_password,
            "/api/auth/logout": self.handle_logout,
        }
        handler = routes.get(parsed_path.path)

        if handler:
            handler()
            return

        self.send_json({"error": "API route not found."}, status=404)

    def do_PUT(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == "/api/auth/profile":
            self.handle_profile_update()
            return

        self.send_json({"error": "API route not found."}, status=404)

    def serve_static(self, request_path):
        clean_path = unquote(request_path).lstrip("/")
        if not clean_path:
            clean_path = "public/index.html"

        target = (FRONTEND_ROOT / clean_path).resolve()

        if not str(target).startswith(str(FRONTEND_ROOT.resolve())) or not target.is_file():
            self.send_error(404, "File not found")
            return

        self.path = "/" + target.relative_to(FRONTEND_ROOT).as_posix()
        self.directory = str(FRONTEND_ROOT)
        return SimpleHTTPRequestHandler.do_GET(self)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0") or 0)
        if content_length > 100_000:
            raise ValueError("Request body is too large.")

        if content_length == 0:
            return {}

        raw_body = self.rfile.read(content_length).decode("utf-8")
        return json.loads(raw_body or "{}")

    def send_json(self, payload, status=200, extra_headers=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))

        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)

        self.end_headers()
        self.wfile.write(body)

    def parse_session_cookie(self):
        cookie_header = self.headers.get("Cookie", "")
        jar = cookies.SimpleCookie(cookie_header)
        morsel = jar.get(SESSION_COOKIE)
        return morsel.value if morsel else ""

    def make_session_cookie(self, token, max_age):
        jar = cookies.SimpleCookie()
        jar[SESSION_COOKIE] = token
        jar[SESSION_COOKIE]["path"] = "/"
        jar[SESSION_COOKIE]["httponly"] = True
        jar[SESSION_COOKIE]["samesite"] = "Lax"
        jar[SESSION_COOKIE]["max-age"] = str(max_age)
        return jar.output(header="").strip()

    def clear_session_cookie(self):
        return f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"

    def create_session(self, db, account_type, account_id, remember=False):
        token = secrets.token_urlsafe(36)
        max_age = 60 * 60 * 24 * 30 if remember else 60 * 60 * 10
        db.execute(
            """
            INSERT INTO sessions (token_hash, account_type, account_id, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (hash_token(token), account_type, account_id, utc_now() + max_age, iso_now()),
        )
        return token, max_age

    def get_current_session(self, db):
        token = self.parse_session_cookie()

        if not token:
            return None, None

        session = db.execute(
            "SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?",
            (hash_token(token), utc_now()),
        ).fetchone()

        if not session:
            return None, None

        if session["account_type"] == "customer":
            account = db.execute("SELECT * FROM users WHERE id = ?", (session["account_id"],)).fetchone()
        else:
            account = db.execute("SELECT * FROM admins WHERE id = ?", (session["account_id"],)).fetchone()

        return session, account

    def serialize_user(self, account_type, account):
        if account_type == "admin":
            return {
                "id": account["id"],
                "role": account["role"],
                "email": account["email"],
                "accountType": "admin",
            }

        return {
            "id": account["id"],
            "name": account["name"],
            "email": account["email"],
            "mobile": account["mobile"],
            "role": "customer",
            "accountType": "customer",
        }

    def handle_register(self):
        try:
            payload = self.read_json_body()
            name = str(payload.get("name") or "").strip()
            email = normalize_email(payload.get("email"))
            mobile = normalize_mobile(payload.get("mobile"))
            password = str(payload.get("password") or "")
            recovery_question = normalize_recovery_question(payload.get("recoveryQuestion"))
            recovery_answer = normalize_recovery_answer(payload.get("recoveryAnswer"))

            if not name or not email or not mobile or len(password) < 6 or not recovery_question or len(recovery_answer) < 2:
                self.send_json(
                    {"error": "Name, email, mobile, password, security question, and security answer are required."},
                    status=400,
                )
                return

            if not is_valid_mobile(mobile):
                self.send_json({"error": "Enter a valid mobile number with at least 10 digits."}, status=400)
                return

            with get_db() as db:
                existing = db.execute(
                    "SELECT id FROM users WHERE email = ? OR mobile = ?",
                    (email, mobile),
                ).fetchone()

                if existing:
                    self.send_json({"error": "An account with this email or mobile already exists."}, status=409)
                    return

                now = iso_now()
                cursor = db.execute(
                    """
                    INSERT INTO users
                        (name, email, mobile, password_hash, recovery_question, recovery_answer_hash, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        name,
                        email,
                        mobile,
                        hash_password(password),
                        recovery_question,
                        hash_password(recovery_answer),
                        now,
                        now,
                    ),
                )
                user = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
                token, max_age = self.create_session(db, "customer", user["id"], bool(payload.get("remember")))

                self.send_json(
                    {"user": self.serialize_user("customer", user)},
                    status=201,
                    extra_headers={"Set-Cookie": self.make_session_cookie(token, max_age)},
                )
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid registration request."}, status=400)

    def handle_login(self):
        try:
            payload = self.read_json_body()
            identifier = str(payload.get("identifier") or payload.get("email") or "").strip()
            email = normalize_email(identifier)
            mobile = normalize_mobile(identifier)
            password = str(payload.get("password") or "")

            if not identifier or not password:
                self.send_json({"error": "Email or mobile number and password are required."}, status=400)
                return

            with get_db() as db:
                user = db.execute(
                    "SELECT * FROM users WHERE email = ? OR mobile = ?",
                    (email, mobile),
                ).fetchone()

                if not user or not verify_password(password, user["password_hash"]):
                    self.send_json({"error": "Email/mobile number or password is incorrect."}, status=401)
                    return

                token, max_age = self.create_session(db, "customer", user["id"], bool(payload.get("remember")))
                self.send_json(
                    {"user": self.serialize_user("customer", user)},
                    extra_headers={"Set-Cookie": self.make_session_cookie(token, max_age)},
                )
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid login request."}, status=400)

    def validate_recovery_request(self, db, payload):
        email = normalize_email(payload.get("email"))
        mobile = normalize_mobile(payload.get("mobile"))
        recovery_question = normalize_recovery_question(payload.get("recoveryQuestion"))
        recovery_answer = normalize_recovery_answer(payload.get("recoveryAnswer"))

        if not email or not mobile or not recovery_question or not recovery_answer:
            return None, "Email, mobile number, security question, and security answer are required.", 400

        if not is_valid_mobile(mobile):
            return None, "Enter the valid mobile number used during registration.", 400

        user = db.execute(
            "SELECT * FROM users WHERE email = ? AND mobile = ?",
            (email, mobile),
        ).fetchone()

        if not user:
            return None, "No customer account matches that email and mobile number.", 404

        if not user["recovery_question"] or not user["recovery_answer_hash"]:
            return None, "This account does not have a security question saved yet.", 409

        if normalize_recovery_question(user["recovery_question"]) != recovery_question:
            return None, "Security question or answer is incorrect.", 401

        if not verify_password(recovery_answer, user["recovery_answer_hash"]):
            return None, "Security question or answer is incorrect.", 401

        return user, "", 200

    def handle_verify_recovery(self):
        try:
            payload = self.read_json_body()

            with get_db() as db:
                user, error, status = self.validate_recovery_request(db, payload)

                if error:
                    self.send_json({"error": error}, status=status)
                    return

                self.send_json({"ok": True, "email": user["email"], "mobile": user["mobile"]})
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid recovery verification request."}, status=400)

    def handle_reset_password(self):
        try:
            payload = self.read_json_body()
            new_password = str(payload.get("newPassword") or payload.get("password") or "")

            if len(new_password) < 6:
                self.send_json({"error": "New password must be at least 6 characters."}, status=400)
                return

            with get_db() as db:
                user, error, status = self.validate_recovery_request(db, payload)

                if error:
                    self.send_json({"error": error}, status=status)
                    return

                db.execute(
                    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                    (hash_password(new_password), iso_now(), user["id"]),
                )
                db.execute(
                    "DELETE FROM sessions WHERE account_type = ? AND account_id = ?",
                    ("customer", user["id"]),
                )

                self.send_json({"ok": True})
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid password reset request."}, status=400)

    def handle_admin_login(self):
        try:
            payload = self.read_json_body()
            email = normalize_email(payload.get("email"))
            password = str(payload.get("password") or "")
            selected_role = str(payload.get("role") or "").strip()

            with get_db() as db:
                admin = db.execute("SELECT * FROM admins WHERE email = ?", (email,)).fetchone()

                if not admin or not verify_password(password, admin["password_hash"]):
                    self.send_json({"error": "Admin email or password is incorrect."}, status=401)
                    return

                if selected_role and selected_role != admin["role"]:
                    self.send_json({"error": "Selected role does not match this admin account."}, status=403)
                    return

                token, max_age = self.create_session(db, "admin", admin["id"], bool(payload.get("remember")))
                self.send_json(
                    {"user": self.serialize_user("admin", admin)},
                    extra_headers={"Set-Cookie": self.make_session_cookie(token, max_age)},
                )
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid admin login request."}, status=400)

    def handle_google_login(self):
        self.send_json(
            {"error": "Google sign-in needs a Google OAuth client ID before it can be enabled."},
            status=501,
        )

    def handle_me(self):
        with get_db() as db:
            session, account = self.get_current_session(db)

            if not session or not account:
                self.send_json({"authenticated": False}, status=401)
                return

            self.send_json({
                "authenticated": True,
                "user": self.serialize_user(session["account_type"], account),
            })

    def handle_profile_update(self):
        try:
            payload = self.read_json_body()

            with get_db() as db:
                session, account = self.get_current_session(db)

                if not session or session["account_type"] != "customer" or not account:
                    self.send_json({"error": "Customer login is required."}, status=401)
                    return

                name = str(payload.get("name") or account["name"]).strip()
                email = normalize_email(payload.get("email") or account["email"])
                mobile = normalize_mobile(payload.get("mobile") or account["mobile"])

                if not name or not email or not mobile:
                    self.send_json({"error": "Name, email, and mobile are required."}, status=400)
                    return

                if not is_valid_mobile(mobile):
                    self.send_json({"error": "Enter a valid mobile number with at least 10 digits."}, status=400)
                    return

                duplicate = db.execute(
                    "SELECT id FROM users WHERE (email = ? OR mobile = ?) AND id != ?",
                    (email, mobile, account["id"]),
                ).fetchone()

                if duplicate:
                    self.send_json({"error": "Another customer already uses this email or mobile."}, status=409)
                    return

                db.execute(
                    "UPDATE users SET name = ?, email = ?, mobile = ?, updated_at = ? WHERE id = ?",
                    (name, email, mobile, iso_now(), account["id"]),
                )
                user = db.execute("SELECT * FROM users WHERE id = ?", (account["id"],)).fetchone()
                self.send_json({"user": self.serialize_user("customer", user)})
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid profile update request."}, status=400)

    def handle_logout(self):
        with get_db() as db:
            token = self.parse_session_cookie()

            if token:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))

        self.send_json({"ok": True}, extra_headers={"Set-Cookie": self.clear_session_cookie()})


def run():
    init_db()
    host = os.environ.get("HOST", "localhost")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), SalonRequestHandler)
    admin_email = normalize_email(os.environ.get("GLOW_GRACE_ADMIN_EMAIL", "admin@glowgrace.com"))
    print(f"Glow & Grace server running at http://{host}:{port}")
    print(f"Default admin email: {admin_email}")
    print("Default admin password: Admin@12345")
    print("Change the default password with GLOW_GRACE_ADMIN_PASSWORD before real use.")
    server.serve_forever()


if __name__ == "__main__":
    run()
