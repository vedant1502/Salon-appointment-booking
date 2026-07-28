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

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None
import time


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
DATA_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DATA_DIR / "salon.db"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
USE_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))
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


def safe_float(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0


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


class DatabaseCursor:
    def __init__(self, cursor):
        self.cursor = cursor
        self.lastrowid = getattr(cursor, "lastrowid", None)

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()


class Database:
    def __init__(self, connection, dialect):
        self.connection = connection
        self.dialect = dialect

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type:
            self.connection.rollback()
        else:
            self.connection.commit()
        self.connection.close()

    def format_sql(self, sql):
        if self.dialect == "postgres":
            return sql.replace("?", "%s")
        return sql

    def execute(self, sql, params=()):
        cursor = self.connection.cursor()
        cursor.execute(self.format_sql(sql), params)
        return DatabaseCursor(cursor)

    def executescript(self, script):
        if self.dialect == "sqlite":
            self.connection.executescript(script)
            return

        for statement in script.split(";"):
            statement = statement.strip()
            if statement:
                self.execute(statement)


def get_db():
    if USE_POSTGRES:
        if psycopg2 is None:
            raise RuntimeError("psycopg2-binary is required when DATABASE_URL is set.")

        connection = psycopg2.connect(
            DATABASE_URL,
            sslmode=os.environ.get("PGSSLMODE", "require"),
            cursor_factory=RealDictCursor,
        )
        return Database(connection, "postgres")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return Database(connection, "sqlite")


def ensure_column(db, table_name, column_name, definition):
    if db.dialect == "postgres":
        existing = db.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
            """,
            (table_name, column_name),
        ).fetchone()
    else:
        existing = next(
            (row for row in db.execute(f"PRAGMA table_info({table_name})").fetchall() if row["name"] == column_name),
            None,
        )

    if not existing:
        db.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def init_db():
    sqlite_schema = """
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

        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contact_messages (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS staff (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        DROP TABLE IF EXISTS otps;
    """
    postgres_schema = """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
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
            id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            role TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            token_hash TEXT NOT NULL UNIQUE,
            account_type TEXT NOT NULL,
            account_id INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contact_messages (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS staff (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        DROP TABLE IF EXISTS otps;
    """

    with get_db() as db:
        db.executescript(postgres_schema if db.dialect == "postgres" else sqlite_schema)

        ensure_column(db, "users", "recovery_question", "TEXT")
        ensure_column(db, "users", "recovery_answer_hash", "TEXT")

        admin_email = normalize_email(os.environ.get("GLOW_GRACE_ADMIN_EMAIL", "admin@glowgrace.com"))
        admin_password = os.environ.get("GLOW_GRACE_ADMIN_PASSWORD", "Admin@12345")
        admin_role = os.environ.get("GLOW_GRACE_ADMIN_ROLE", "manager")
        existing_admin = db.execute("SELECT id FROM admins WHERE email = ?", (admin_email,)).fetchone()

        now = iso_now()

        if not existing_admin:
            db.execute(
                """
                INSERT INTO admins (role, email, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (admin_role, admin_email, hash_password(admin_password), now, now),
            )
        elif "GLOW_GRACE_ADMIN_PASSWORD" in os.environ or "GLOW_GRACE_ADMIN_ROLE" in os.environ:
            db.execute(
                """
                UPDATE admins
                SET role = ?, password_hash = ?, updated_at = ?
                WHERE id = ?
                """,
                (admin_role, hash_password(admin_password), now, existing_admin["id"]),
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

        if parsed_path.path == "/api/appointments/my":
            self.handle_my_appointments()
            return

        if parsed_path.path == "/api/admin/appointments":
            self.handle_admin_appointments()
            return

        if parsed_path.path == "/api/reviews":
            self.handle_public_reviews()
            return

        if parsed_path.path == "/api/admin/reviews":
            self.handle_admin_reviews()
            return

        if parsed_path.path == "/api/live/summary":
            self.handle_live_summary()
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
            "/api/appointments": self.handle_save_appointment,
            "/api/reviews": self.handle_save_review,
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

        if parsed_path.path.startswith("/api/appointments/"):
            self.handle_update_appointment(parsed_path.path.removeprefix("/api/appointments/"), admin=False)
            return

        if parsed_path.path.startswith("/api/admin/appointments/"):
            self.handle_update_appointment(parsed_path.path.removeprefix("/api/admin/appointments/"), admin=True)
            return

        if parsed_path.path.startswith("/api/admin/reviews/"):
            self.handle_update_review(parsed_path.path.removeprefix("/api/admin/reviews/"))
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

    def use_secure_cookies(self):
        value = os.environ.get("SECURE_COOKIES", "").strip().lower()
        return bool(os.environ.get("RENDER")) or value in {"1", "true", "yes", "on"}

    def make_session_cookie(self, token, max_age):
        jar = cookies.SimpleCookie()
        secure_cookie = self.use_secure_cookies()
        jar[SESSION_COOKIE] = token
        jar[SESSION_COOKIE]["path"] = "/"
        jar[SESSION_COOKIE]["httponly"] = True
        jar[SESSION_COOKIE]["samesite"] = "None" if secure_cookie else "Lax"
        jar[SESSION_COOKIE]["max-age"] = str(max_age)

        if secure_cookie:
            jar[SESSION_COOKIE]["secure"] = True

        return jar.output(header="").strip()

    def clear_session_cookie(self):
        secure_cookie = self.use_secure_cookies()
        same_site = "None" if secure_cookie else "Lax"
        cookie = f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite={same_site}; Max-Age=0"
        return f"{cookie}; Secure" if secure_cookie else cookie

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
                user_values = (
                    name,
                    email,
                    mobile,
                    hash_password(password),
                    recovery_question,
                    hash_password(recovery_answer),
                    now,
                    now,
                )

                if db.dialect == "postgres":
                    user = db.execute(
                        """
                        INSERT INTO users
                            (name, email, mobile, password_hash, recovery_question, recovery_answer_hash, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        RETURNING *
                        """,
                        user_values,
                    ).fetchone()
                else:
                    cursor = db.execute(
                        """
                        INSERT INTO users
                            (name, email, mobile, password_hash, recovery_question, recovery_answer_hash, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        user_values,
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

    def require_account(self, db, account_type):
        session, account = self.get_current_session(db)

        if not session or not account or session["account_type"] != account_type:
            label = "Admin" if account_type == "admin" else "Customer"
            self.send_json({"error": f"{label} login is required."}, status=401)
            return None, None

        return session, account

    def decode_live_record(self, row):
        try:
            data = json.loads(row["data"] or "{}")
        except (TypeError, json.JSONDecodeError):
            data = {}

        data.setdefault("id", row["id"])
        data.setdefault("createdAt", row["created_at"])
        data.setdefault("updatedAt", row["updated_at"])
        return data

    def encode_live_record(self, data):
        return json.dumps(data, separators=(",", ":"), sort_keys=True)

    def fetch_appointment(self, db, appointment_id):
        return db.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,)).fetchone()

    def fetch_review(self, db, review_id):
        return db.execute("SELECT * FROM reviews WHERE id = ?", (review_id,)).fetchone()

    def make_record_id(self, prefix):
        return f"{prefix}-{secrets.token_hex(4).upper()}"

    def handle_my_appointments(self):
        with get_db() as db:
            session, account = self.require_account(db, "customer")

            if not session:
                return

            rows = db.execute(
                "SELECT * FROM appointments WHERE user_id = ? ORDER BY updated_at DESC",
                (account["id"],),
            ).fetchall()
            self.send_json({"appointments": [self.decode_live_record(row) for row in rows]})

    def handle_admin_appointments(self):
        with get_db() as db:
            session, account = self.require_account(db, "admin")

            if not session:
                return

            rows = db.execute("SELECT * FROM appointments ORDER BY updated_at DESC").fetchall()
            self.send_json({"appointments": [self.decode_live_record(row) for row in rows]})

    def handle_save_appointment(self):
        try:
            payload = self.read_json_body()
            appointment = payload.get("appointment") if isinstance(payload.get("appointment"), dict) else payload

            if not isinstance(appointment, dict):
                self.send_json({"error": "Appointment details are required."}, status=400)
                return

            with get_db() as db:
                session, account = self.require_account(db, "customer")

                if not session:
                    return

                now = iso_now()
                appointment_id = str(appointment.get("id") or self.make_record_id("APT-GG"))
                existing = self.fetch_appointment(db, appointment_id)

                if existing and existing["user_id"] != account["id"]:
                    self.send_json({"error": "You cannot update another customer's appointment."}, status=403)
                    return

                previous = self.decode_live_record(existing) if existing else {}
                saved = {
                    **previous,
                    **appointment,
                    "id": appointment_id,
                    "customerId": account["id"],
                    "customerName": appointment.get("customerName") or previous.get("customerName") or account["name"],
                    "customerEmail": appointment.get("customerEmail") or previous.get("customerEmail") or account["email"],
                    "customerMobile": appointment.get("customerMobile") or previous.get("customerMobile") or account["mobile"],
                    "createdAt": previous.get("createdAt") or appointment.get("createdAt") or now,
                    "updatedAt": now,
                }
                saved.setdefault("status", "upcoming")
                saved.setdefault("paymentStatus", "Pending")

                if existing:
                    db.execute(
                        "UPDATE appointments SET data = ?, updated_at = ? WHERE id = ?",
                        (self.encode_live_record(saved), now, appointment_id),
                    )
                else:
                    db.execute(
                        """
                        INSERT INTO appointments (id, user_id, data, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (appointment_id, account["id"], self.encode_live_record(saved), saved["createdAt"], now),
                    )

                self.send_json({"appointment": saved}, status=201 if not existing else 200)
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid appointment request."}, status=400)

    def handle_update_appointment(self, appointment_id, admin=False):
        appointment_id = unquote(str(appointment_id or "").strip())

        if not appointment_id:
            self.send_json({"error": "Appointment ID is required."}, status=400)
            return

        try:
            payload = self.read_json_body()
            updates = payload.get("updates") if isinstance(payload.get("updates"), dict) else payload

            if not isinstance(updates, dict):
                self.send_json({"error": "Appointment updates are required."}, status=400)
                return

            with get_db() as db:
                required_account = "admin" if admin else "customer"
                session, account = self.require_account(db, required_account)

                if not session:
                    return

                row = self.fetch_appointment(db, appointment_id)

                if not row:
                    self.send_json({"error": "Appointment was not found."}, status=404)
                    return

                if not admin and row["user_id"] != account["id"]:
                    self.send_json({"error": "You cannot update another customer's appointment."}, status=403)
                    return

                now = iso_now()
                existing = self.decode_live_record(row)
                saved = {
                    **existing,
                    **updates,
                    "id": appointment_id,
                    "customerId": existing.get("customerId") or row["user_id"],
                    "createdAt": existing.get("createdAt") or row["created_at"],
                    "updatedAt": now,
                }

                db.execute(
                    "UPDATE appointments SET data = ?, updated_at = ? WHERE id = ?",
                    (self.encode_live_record(saved), now, appointment_id),
                )
                self.send_json({"appointment": saved})
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid appointment update request."}, status=400)

    def handle_public_reviews(self):
        with get_db() as db:
            rows = db.execute("SELECT * FROM reviews ORDER BY updated_at DESC").fetchall()
            reviews = [self.decode_live_record(row) for row in rows]
            self.send_json({"reviews": [review for review in reviews if review.get("hidden") is not True]})

    def handle_admin_reviews(self):
        with get_db() as db:
            session, account = self.require_account(db, "admin")

            if not session:
                return

            rows = db.execute("SELECT * FROM reviews ORDER BY updated_at DESC").fetchall()
            self.send_json({"reviews": [self.decode_live_record(row) for row in rows]})

    def handle_save_review(self):
        try:
            payload = self.read_json_body()
            review = payload.get("review") if isinstance(payload.get("review"), dict) else payload

            if not isinstance(review, dict):
                self.send_json({"error": "Review details are required."}, status=400)
                return

            with get_db() as db:
                session, account = self.get_current_session(db)
                now = iso_now()
                review_id = str(review.get("id") or self.make_record_id("review"))
                user_id = account["id"] if session and session["account_type"] == "customer" and account else None
                existing = self.fetch_review(db, review_id)
                previous = self.decode_live_record(existing) if existing else {}
                saved = {
                    **previous,
                    **review,
                    "id": review_id,
                    "createdAt": previous.get("createdAt") or review.get("createdAt") or now,
                    "updatedAt": now,
                    "featured": bool(review.get("featured") if "featured" in review else previous.get("featured", False)),
                    "hidden": bool(review.get("hidden") if "hidden" in review else previous.get("hidden", False)),
                }

                if account and session and session["account_type"] == "customer":
                    saved["customerId"] = account["id"]
                    saved["customerName"] = saved.get("customerName") or account["name"]
                    saved["customerEmail"] = saved.get("customerEmail") or account["email"]
                    saved["customerMobile"] = saved.get("customerMobile") or account["mobile"]

                if existing:
                    if existing["user_id"] and user_id and existing["user_id"] != user_id:
                        self.send_json({"error": "You cannot update another customer's review."}, status=403)
                        return

                    db.execute(
                        "UPDATE reviews SET data = ?, updated_at = ? WHERE id = ?",
                        (self.encode_live_record(saved), now, review_id),
                    )
                else:
                    db.execute(
                        """
                        INSERT INTO reviews (id, user_id, data, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (review_id, user_id, self.encode_live_record(saved), saved["createdAt"], now),
                    )

                self.send_json({"review": saved}, status=201 if not existing else 200)
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid review request."}, status=400)

    def handle_update_review(self, review_id):
        review_id = unquote(str(review_id or "").strip())

        if not review_id:
            self.send_json({"error": "Review ID is required."}, status=400)
            return

        try:
            payload = self.read_json_body()
            updates = payload.get("updates") if isinstance(payload.get("updates"), dict) else payload

            if not isinstance(updates, dict):
                self.send_json({"error": "Review updates are required."}, status=400)
                return

            with get_db() as db:
                session, account = self.require_account(db, "admin")

                if not session:
                    return

                row = self.fetch_review(db, review_id)

                if not row:
                    self.send_json({"error": "Review was not found."}, status=404)
                    return

                now = iso_now()
                existing = self.decode_live_record(row)
                saved = {
                    **existing,
                    **updates,
                    "id": review_id,
                    "createdAt": existing.get("createdAt") or row["created_at"],
                    "updatedAt": now,
                }
                db.execute(
                    "UPDATE reviews SET data = ?, updated_at = ? WHERE id = ?",
                    (self.encode_live_record(saved), now, review_id),
                )
                self.send_json({"review": saved})
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Invalid review update request."}, status=400)

    def handle_live_summary(self):
        with get_db() as db:
            appointment_rows = db.execute("SELECT * FROM appointments ORDER BY updated_at DESC").fetchall()
            review_rows = db.execute("SELECT * FROM reviews ORDER BY updated_at DESC").fetchall()
            appointments = [self.decode_live_record(row) for row in appointment_rows]
            reviews = [self.decode_live_record(row) for row in review_rows]
            visible_reviews = [review for review in reviews if review.get("hidden") is not True and safe_float(review.get("rating")) > 0]
            completed_clients = sum(
                1 for appointment in appointments
                if str(appointment.get("status") or "").lower() == "completed"
                or str(appointment.get("adminStatus") or "").lower() == "completed"
            )
            average_rating = 0

            if visible_reviews:
                average_rating = sum(safe_float(review.get("rating")) for review in visible_reviews) / len(visible_reviews)

            self.send_json({
                "completedClients": completed_clients,
                "averageRating": round(average_rating, 1),
                "reviews": visible_reviews[:12],
            })
    def handle_logout(self):
        with get_db() as db:
            token = self.parse_session_cookie()

            if token:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))

        self.send_json({"ok": True}, extra_headers={"Set-Cookie": self.clear_session_cookie()})


def run():
    init_db()
    default_host = "0.0.0.0" if os.environ.get("RENDER") else "localhost"
    host = os.environ.get("HOST", default_host)
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
