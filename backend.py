import os
import secrets
import sqlite3
import ssl
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode, urlsplit, urlunsplit
import threading
import json
import re
import time
from contextlib import contextmanager
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, send_file, send_from_directory, session
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY') or secrets.token_hex(32)
if not os.getenv('FLASK_SECRET_KEY'):
    app.logger.warning('FLASK_SECRET_KEY is not configured; OAuth sessions will not survive server restarts.')
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.getenv('SESSION_COOKIE_SECURE', '').lower() == 'true',
    MAX_CONTENT_LENGTH=25 * 1024 * 1024,  # 25 MB max upload
)


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'Dung lượng file vượt quá giới hạn 25MB.'}), 413

WEB_ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOADS_ROOT = os.path.join(WEB_ROOT, 'uploads')
DATABASE_PATH = os.getenv('DATABASE_PATH', 'codenest.sqlite3')
TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_ADMIN_CHAT_ID', '8592672929')
ADMIN_APPROVAL_KEY = os.getenv('ADMIN_APPROVAL_KEY')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'ADM').strip()
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', '')
TELEGRAM_CA_BUNDLE = os.getenv('TELEGRAM_CA_BUNDLE')
TELEGRAM_ALLOW_INSECURE_TLS = os.getenv('TELEGRAM_ALLOW_INSECURE_TLS', '').lower() == 'true'
OAUTH_PROVIDERS = {
    'google': {
        'client_id': os.getenv('GOOGLE_CLIENT_ID'),
        'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'),
        'redirect_uri': os.getenv('GOOGLE_REDIRECT_URI'),
    },
    'github': {
        'client_id': os.getenv('GITHUB_CLIENT_ID'),
        'client_secret': os.getenv('GITHUB_CLIENT_SECRET'),
        'redirect_uri': os.getenv('GITHUB_REDIRECT_URI'),
    },
}


class OAuthError(Exception):
    pass


def oauth_redirect_uri(provider):
    configured_uri = OAUTH_PROVIDERS[provider]['redirect_uri']
    if configured_uri:
        return configured_uri
    return f'{request.url_root.rstrip("/")}/api/auth/{provider}/callback'


def oauth_request_json(url, data=None, headers=None):
    request_headers = {'Accept': 'application/json', 'User-Agent': 'CodeNest'}
    request_headers.update(headers or {})
    request_object = Request(
        url,
        data=urlencode(data).encode() if data is not None else None,
        headers=request_headers,
        method='POST' if data is not None else 'GET',
    )
    try:
        with urlopen(request_object, timeout=15) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise OAuthError('Could not communicate with the identity provider.') from exc
    if not isinstance(payload, (dict, list)):
        raise OAuthError('The identity provider returned an invalid response.')
    return payload


def oauth_failure(reason):
    return redirect(f'/?oauth_error={reason}')


def oauth_user_info(provider, access_token):
    authorization = {'Authorization': f'Bearer {access_token}'}
    if provider == 'google':
        profile = oauth_request_json('https://openidconnect.googleapis.com/v1/userinfo', headers=authorization)
        if not profile.get('sub') or not profile.get('email') or profile.get('email_verified') is not True:
            raise OAuthError('Google did not return a verified email address.')
        return {
            'username': profile['email'].strip().lower(),
            'displayName': profile.get('name') or profile['email'],
            'providerUserId': profile['sub'],
        }

    profile = oauth_request_json('https://api.github.com/user', headers=authorization)
    if not profile.get('id') or not profile.get('login'):
        raise OAuthError('GitHub did not return a valid account.')
    email = profile.get('email')
    if not email:
        emails = oauth_request_json('https://api.github.com/user/emails', headers=authorization)
        if isinstance(emails, list):
            email = next(
                (item.get('email') for item in emails
                 if item.get('primary') and item.get('verified') and item.get('email')),
                None,
            )
    return {
        'username': (email or f'github_{profile["id"]}').strip().lower(),
        'displayName': profile.get('name') or profile['login'],
        'providerUserId': str(profile['id']),
    }


def begin_oauth(provider):
    config = OAUTH_PROVIDERS.get(provider)
    if not config or not config['client_id'] or not config['client_secret']:
        return oauth_failure(f'{provider}_not_configured')

    state = secrets.token_urlsafe(32)
    session.clear()
    session['oauth_state'] = state
    session['oauth_provider'] = provider
    redirect_uri = oauth_redirect_uri(provider)
    if provider == 'google':
        query = urlencode({
            'client_id': config['client_id'],
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'openid email profile',
            'state': state,
        })
        return redirect(f'https://accounts.google.com/o/oauth2/v2/auth?{query}')

    query = urlencode({
        'client_id': config['client_id'],
        'redirect_uri': redirect_uri,
        'scope': 'read:user user:email',
        'state': state,
    })
    return redirect(f'https://github.com/login/oauth/authorize?{query}')


def finish_oauth(provider):
    expected_state = session.pop('oauth_state', None)
    expected_provider = session.pop('oauth_provider', None)
    if not expected_state or not secrets.compare_digest(
        expected_state, request.args.get('state', '')
    ) or expected_provider != provider:
        session.clear()
        return oauth_failure('invalid_state')
    if request.args.get('error'):
        session.clear()
        return oauth_failure('cancelled')

    code = request.args.get('code', '').strip()
    config = OAUTH_PROVIDERS[provider]
    if not config['client_id'] or not config['client_secret']:
        session.clear()
        return oauth_failure(f'{provider}_not_configured')
    if not code:
        session.clear()
        return oauth_failure('provider_error')

    token_url = (
        'https://oauth2.googleapis.com/token'
        if provider == 'google'
        else 'https://github.com/login/oauth/access_token'
    )
    try:
        token_response = oauth_request_json(token_url, {
            'client_id': config['client_id'],
            'client_secret': config['client_secret'],
            'code': code,
            'redirect_uri': oauth_redirect_uri(provider),
            'grant_type': 'authorization_code',
        })
        access_token = token_response.get('access_token')
        if not access_token:
            raise OAuthError('The identity provider did not issue an access token.')
        user = oauth_user_info(provider, access_token)
    except OAuthError:
        app.logger.exception('%s OAuth sign-in failed', provider)
        session.clear()
        return oauth_failure('provider_error')

    now = utc_now()
    with db() as connection:
        identity = connection.execute(
            'SELECT username FROM oauth_identities WHERE provider = ? AND provider_user_id = ?',
            (provider, user['providerUserId']),
        ).fetchone()
        alias = None
        if not identity:
            alias = connection.execute(
                'SELECT username FROM oauth_username_aliases WHERE alias = ? COLLATE NOCASE',
                (user['username'],),
            ).fetchone()
        account_username = (
            identity['username'] if identity
            else alias['username'] if alias
            else user['username']
        )
        connection.execute(
            'INSERT INTO users '
            '(username, display_name, role, auth_provider, created_at, last_login_at) '
            'VALUES (?, ?, ?, ?, ?, ?) '
            'ON CONFLICT(username) DO UPDATE SET '
            'display_name = excluded.display_name, '
            'auth_provider = COALESCE(users.auth_provider, excluded.auth_provider), '
            'last_login_at = excluded.last_login_at',
            (account_username, user['displayName'], 'user', provider, now, now),
        )
        connection.execute(
            'INSERT INTO oauth_identities(provider, provider_user_id, username) VALUES (?, ?, ?) '
            'ON CONFLICT(provider, provider_user_id) DO UPDATE SET username = excluded.username',
            (provider, user['providerUserId'], account_username),
        )

    session.clear()
    session['app_user'] = {
        'username': account_username,
        'displayName': user['displayName'],
        'provider': provider,
        'role': 'user',
    }
    return redirect('/?oauth=complete')


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Admin-Key'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def active_user():
    return session.get('app_user')


def admin_user():
    user = active_user()
    return user if (
        user
        and user.get('role') == 'admin'
        and user.get('username', '').casefold() == ADMIN_USERNAME.casefold()
        and ADMIN_PASSWORD
    ) else None


def is_authenticated_as(username):
    user = active_user()
    return bool(user and (
        admin_user()
        or user.get('username', '').casefold() == username.casefold()
    ))


@contextmanager
def db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def init_db():
    os.makedirs(UPLOADS_ROOT, exist_ok=True)
    with db() as connection:
        connection.execute('''
            CREATE TABLE IF NOT EXISTS topups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                amount INTEGER NOT NULL,
                content TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                bank_reference TEXT,
                created_at TEXT NOT NULL,
                approved_at TEXT
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS balances (
                username TEXT PRIMARY KEY,
                amount INTEGER NOT NULL DEFAULT 0
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY COLLATE NOCASE,
                password_hash TEXT,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                auth_provider TEXT,
                created_at TEXT NOT NULL,
                last_login_at TEXT
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS oauth_username_aliases (
                alias TEXT PRIMARY KEY COLLATE NOCASE,
                username TEXT NOT NULL
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS oauth_identities (
                provider TEXT NOT NULL,
                provider_user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                PRIMARY KEY (provider, provider_user_id)
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS balance_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                amount INTEGER NOT NULL,
                reason TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS site_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        ''')
        if ADMIN_USERNAME:
            connection.execute(
                'INSERT OR IGNORE INTO users '
                '(username, display_name, role, created_at) VALUES (?, ?, ?, ?)',
                (ADMIN_USERNAME, 'Quản trị viên', 'admin', utc_now()),
            )
        connection.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                price INTEGER NOT NULL,
                category TEXT NOT NULL,
                file_name TEXT NOT NULL,
                stored_name TEXT NOT NULL UNIQUE,
                content_type TEXT,
                file_size INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS music_tracks (
                title TEXT PRIMARY KEY COLLATE NOCASE,
                url TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            )
        ''')


def telegram_ssl_context():
    if TELEGRAM_CA_BUNDLE:
        return ssl.create_default_context(cafile=TELEGRAM_CA_BUNDLE)
    if TELEGRAM_ALLOW_INSECURE_TLS:
        app.logger.warning('Telegram TLS verification is disabled; configure TELEGRAM_CA_BUNDLE when possible.')
        return ssl._create_unverified_context()
    return ssl.create_default_context()


def telegram_message(text):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        app.logger.warning('Telegram is not configured; message was not sent.')
        return False


    payload = urlencode({'chat_id': TELEGRAM_CHAT_ID, 'text': text}).encode()
    url = f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage'
    try:
        request_object = Request(url, data=payload, method='POST')
        with urlopen(request_object, timeout=10, context=telegram_ssl_context()) as response:
            return response.status == 200
    except ssl.SSLCertVerificationError:
        app.logger.error('Telegram TLS certificate verification failed. Configure TELEGRAM_CA_BUNDLE with a trusted CA certificate or fix the network proxy certificate.')
        return False
    except Exception:
        app.logger.exception('Telegram notification failed')
        return False


def telegram_api(method, params=None, timeout=10):
    if not TELEGRAM_TOKEN:
        return None
    request_object = Request(
        f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/{method}',
        data=urlencode(params or {}).encode(),
        method='POST',
    )
    with urlopen(request_object, timeout=timeout, context=telegram_ssl_context()) as response:
        return json.loads(response.read().decode('utf-8'))


def approve_topup_by_content(content):
    with db() as connection:
        topup = connection.execute('SELECT * FROM topups WHERE content = ?', (content.upper(),)).fetchone()
        if not topup:
            return None, 'not_found'
        if topup['status'] == 'approved':
            return topup, 'already_approved'
        connection.execute(
            'UPDATE topups SET status = ?, approved_at = ? WHERE id = ?',
            ('approved', utc_now(), topup['id']),
        )
        connection.execute(
            'INSERT INTO balances(username, amount) VALUES (?, ?) '
            'ON CONFLICT(username) DO UPDATE SET amount = amount + excluded.amount',
            (topup['username'], topup['amount']),
        )
        connection.execute(
            'INSERT INTO balance_transactions(username, amount, reason, admin_username, created_at) '
            'VALUES (?, ?, ?, ?, ?)',
            (topup['username'], topup['amount'], f'Duyệt nạp tiền {topup["content"]}', 'telegram', utc_now()),
        )
        return topup, 'approved'


def telegram_polling_loop():
    offset = None
    while True:
        try:
            params = {'timeout': 25}
            if offset is not None:
                params['offset'] = offset
            response = telegram_api('getUpdates', params, timeout=35) or {}
            for update in response.get('result', []):
                offset = update['update_id'] + 1
                telegram_handle_update(update)
        except Exception:
            app.logger.exception('Telegram polling failed')
            time.sleep(5)


def telegram_handle_update(update):
    message = update.get('message') or {}
    chat = message.get('chat') or {}
    if str(chat.get('id')) != str(TELEGRAM_CHAT_ID):
        return
    text = str(message.get('text', '')).strip()
    parts = text.split(maxsplit=1)
    command = parts[0].split('@', 1)[0].lower() if parts else ''
    if command in ('/start', '/trogiup', '/help'):
        telegram_message('Lệnh quản trị CodeNest:\n/duyet CN-XXXXXX - duyệt đơn theo mã\n/trogiup - xem hướng dẫn')
    elif command == '/duyet':
        if len(parts) != 2:
            telegram_message('Cú pháp đúng: /duyet CN-XXXXXX')
            return
        content = parts[1].strip().split()[0].upper()
        topup, result = approve_topup_by_content(content)
        if result == 'not_found':
            telegram_message(f'Không tìm thấy đơn có mã {content}.')
        elif result == 'already_approved':
            telegram_message(f'Đơn {content} đã được duyệt trước đó.')
        else:
            telegram_message(
                f'Đã duyệt đơn {content}.\nKhách hàng: {topup["username"]}\n'
                f'Số tiền: {topup["amount"]:,} VNĐ\nSố dư đã được cộng.'
            )


def make_content():
    return f'CN-{secrets.token_hex(3).upper()}'


@app.get('/')
def home():
    return send_from_directory(WEB_ROOT, 'index.html')




@app.get('/<path:filename>')
def frontend_file(filename):
    if filename.startswith('api/'):
        return jsonify({'error': 'not found'}), 404
    return send_from_directory(WEB_ROOT, filename)


@app.get('/api/health')
def health():
    return jsonify({'ok': True, 'telegram_configured': bool(TELEGRAM_TOKEN)})


def normalize_soundcloud_track_url(value):
    if not isinstance(value, str) or len(value) > 2048:
        return None
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return None
    parts = [part for part in parsed.path.split('/') if part]
    if (
        parsed.scheme != 'https'
        or parsed.hostname not in ('soundcloud.com', 'www.soundcloud.com')
        or parsed.username
        or parsed.password
        or len(parts) < 2
        or parts[0] in ('search', 'you', 'discover')
        or parts[1] == 'sets'
    ):
        return None
    return urlunsplit(('https', 'soundcloud.com', parsed.path.rstrip('/'), '', ''))


@app.get('/api/music/tracks')
def list_music_tracks():
    with db() as connection:
        rows = connection.execute(
            'SELECT title, url FROM music_tracks ORDER BY created_at DESC'
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post('/api/music/tracks')
def save_music_track():
    data = request.get_json(silent=True) or {}
    title = str(data.get('title', '')).strip()
    url = normalize_soundcloud_track_url(data.get('url'))
    if not title or len(title) > 120:
        return jsonify({'error': 'title must contain 1 to 120 characters'}), 400
    if not url:
        return jsonify({'error': 'a public SoundCloud track URL is required'}), 400

    try:
        with db() as connection:
            connection.execute(
                'INSERT INTO music_tracks(title, url, created_at) VALUES (?, ?, ?) '
                'ON CONFLICT(title) DO UPDATE SET url = excluded.url, created_at = excluded.created_at',
                (title, url, utc_now()),
            )
            row = connection.execute(
                'SELECT title, url FROM music_tracks WHERE title = ?', (title,)
            ).fetchone()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'this SoundCloud track is already saved under another title'}), 409
    return jsonify({'track': dict(row)}), 201


@app.get('/api/auth/<provider>')
def oauth_start(provider):
    if provider not in OAUTH_PROVIDERS:
        return jsonify({'error': 'unsupported identity provider'}), 404
    return begin_oauth(provider)


@app.get('/api/auth/<provider>/callback')
def oauth_callback(provider):
    if provider not in OAUTH_PROVIDERS:
        return jsonify({'error': 'unsupported identity provider'}), 404
    return finish_oauth(provider)


@app.get('/api/auth/me')
def oauth_current_user():
    user = active_user()
    if not user:
        return jsonify({'error': 'not authenticated'}), 401
    with db() as connection:
        profile = connection.execute(
            'SELECT display_name AS displayName, created_at AS createdAt, '
            'last_login_at AS lastLoginAt, auth_provider AS provider '
            'FROM users WHERE username = ? COLLATE NOCASE',
            (user['username'],),
        ).fetchone()
    return jsonify({**user, **(dict(profile) if profile else {})})


@app.post('/api/auth/register')
def register_user():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip()
    password = data.get('password')
    if (
        not isinstance(password, str)
        or len(password) < 6
        or len(password) > 128
        or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', username)
        or len(username) > 254
    ):
        return jsonify({'error': 'valid email and password (6 to 128 characters) are required'}), 400
    if username.casefold() == ADMIN_USERNAME.casefold():
        return jsonify({'error': 'this username is reserved'}), 409

    now = utc_now()
    try:
        with db() as connection:
            connection.execute(
                'INSERT INTO users '
                '(username, password_hash, display_name, role, auth_provider, created_at, last_login_at) '
                'VALUES (?, ?, ?, ?, ?, ?, ?)',
                (username, generate_password_hash(password), username, 'user', 'password', now, now),
            )
            connection.execute(
                'INSERT INTO balances(username, amount) VALUES (?, 0)',
                (username,),
            )
    except sqlite3.IntegrityError:
        return jsonify({'error': 'account already exists'}), 409

    session.clear()
    session['app_user'] = {'username': username, 'displayName': username, 'role': 'user'}
    return jsonify(session['app_user']), 201


@app.post('/api/auth/login')
def login_user():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip()
    password = data.get('password')
    if not username or not isinstance(password, str) or len(password) > 128:
        return jsonify({'error': 'username and password are required'}), 400

    is_admin_login = username.casefold() == ADMIN_USERNAME.casefold()
    if is_admin_login:
        if not ADMIN_PASSWORD:
            return jsonify({'error': 'admin login is not configured on the server'}), 503
        if not secrets.compare_digest(password, ADMIN_PASSWORD):
            return jsonify({'error': 'invalid username or password'}), 401
        user = {'username': ADMIN_USERNAME, 'displayName': 'Quản trị viên', 'role': 'admin'}
    else:
        with db() as connection:
            row = connection.execute(
                'SELECT username, password_hash, display_name, role '
                'FROM users WHERE username = ? COLLATE NOCASE',
                (username,),
            ).fetchone()
        if not row or row['role'] != 'user' or not row['password_hash'] or not check_password_hash(row['password_hash'], password):
            return jsonify({'error': 'invalid username or password'}), 401
        user = {
            'username': row['username'],
            'displayName': row['display_name'],
            'role': row['role'],
        }

    now = utc_now()
    with db() as connection:
        connection.execute(
            'UPDATE users SET last_login_at = ? WHERE username = ? COLLATE NOCASE',
            (now, user['username']),
        )
    session.clear()
    session['app_user'] = user
    return jsonify(user)


@app.post('/api/auth/change-password')
def change_password():
    user = active_user()
    if not user:
        return jsonify({'error': 'not authenticated'}), 401
    if user.get('role') != 'user':
        return jsonify({'error': 'password changes are not available for this account'}), 403

    data = request.get_json(silent=True) or {}
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')
    if (
        not isinstance(current_password, str)
        or not isinstance(new_password, str)
        or len(new_password) < 6
        or len(new_password) > 128
    ):
        return jsonify({'error': 'valid current and new passwords are required'}), 400

    with db() as connection:
        row = connection.execute(
            'SELECT password_hash FROM users WHERE username = ? COLLATE NOCASE',
            (user['username'],),
        ).fetchone()
        if not row or not row['password_hash'] or not check_password_hash(row['password_hash'], current_password):
            return jsonify({'error': 'current password is incorrect'}), 400
        connection.execute(
            'UPDATE users SET password_hash = ? WHERE username = ? COLLATE NOCASE',
            (generate_password_hash(new_password), user['username']),
        )
    return jsonify({'changed': True})


@app.post('/api/auth/logout')
def oauth_logout():
    session.clear()
    return jsonify({'logged_out': True})


@app.get('/api/site/theme')
def get_site_theme():
    defaults = {'background': '#060608', 'accent': '#d4af37'}
    with db() as connection:
        rows = connection.execute(
            'SELECT key, value FROM site_settings WHERE key IN (?, ?)',
            ('theme_background', 'theme_accent'),
        ).fetchall()
    settings = {row['key']: row['value'] for row in rows}
    return jsonify({
        'background': settings.get('theme_background', defaults['background']),
        'accent': settings.get('theme_accent', defaults['accent']),
    })


@app.post('/api/admin/theme')
def save_site_theme():
    if not admin_user():
        return jsonify({'error': 'admin access required'}), 403
    data = request.get_json(silent=True) or {}
    background = data.get('background')
    accent = data.get('accent')
    if any(
        not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color)
        for color in (background, accent)
    ):
        return jsonify({'error': 'background and accent must be six-digit hex colors'}), 400
    with db() as connection:
        connection.executemany(
            'INSERT INTO site_settings(key, value) VALUES (?, ?) '
            'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            (('theme_background', background.lower()), ('theme_accent', accent.lower())),
        )
    return jsonify({'background': background.lower(), 'accent': accent.lower()})


@app.get('/api/admin/users')
def list_admin_users():
    if not admin_user():
        return jsonify({'error': 'admin access required'}), 403
    with db() as connection:
        rows = connection.execute(
            'SELECT users.username, users.display_name AS displayName, users.role, '
            'users.auth_provider AS authProvider, users.created_at AS createdAt, '
            'users.last_login_at AS lastLoginAt, COALESCE(balances.amount, 0) AS balance '
            'FROM users LEFT JOIN balances ON balances.username = users.username '
            'ORDER BY users.created_at DESC'
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.get('/api/admin/users/<path:username>/activity')
def get_admin_user_activity(username):
    if not admin_user():
        return jsonify({'error': 'admin access required'}), 403
    with db() as connection:
        user = connection.execute(
            'SELECT username, display_name AS displayName FROM users '
            'WHERE username = ? COLLATE NOCASE AND role = ?',
            (username, 'user'),
        ).fetchone()
        if not user:
            return jsonify({'error': 'member account not found'}), 404
        rows = connection.execute(
            'SELECT eventType, amount, description, status, eventAt, completedAt, bankReference '
            'FROM ('
            'SELECT \'topup\' AS eventType, amount, '
            '\'Nạp tiền · \' || content AS description, status, created_at AS eventAt, '
            'approved_at AS completedAt, bank_reference AS bankReference '
            'FROM topups WHERE username = ? COLLATE NOCASE '
            'UNION ALL '
            'SELECT CASE WHEN admin_username = \'system\' AND amount < 0 '
            'THEN \'purchase\' ELSE \'adjustment\' END, '
            'amount, reason, \'completed\', created_at, created_at, NULL '
            'FROM balance_transactions WHERE username = ? COLLATE NOCASE '
            'AND admin_username != \'telegram\''
            ') ORDER BY eventAt DESC',
            (user['username'], user['username']),
        ).fetchall()

    activity = [dict(row) for row in rows]
    return jsonify({
        'username': user['username'],
        'displayName': user['displayName'],
        'activity': activity,
        'summary': {
            'approvedTopups': sum(
                row['amount'] for row in activity
                if row['eventType'] == 'topup' and row['status'] == 'approved'
            ),
            'pendingTopups': sum(
                row['amount'] for row in activity
                if row['eventType'] == 'topup' and row['status'] == 'pending'
            ),
            'purchases': sum(
                -row['amount'] for row in activity if row['eventType'] == 'purchase'
            ),
        },
    })


@app.post('/api/admin/users/<path:username>/account')
def update_admin_user_account(username):
    if not admin_user():
        return jsonify({'error': 'admin access required'}), 403

    data = request.get_json(silent=True) or {}
    new_username = data.get('newUsername')
    new_password = data.get('newPassword', '')
    if (
        not isinstance(new_username, str)
        or not new_username.strip()
        or len(new_username.strip()) > 254
        or any(character.isspace() for character in new_username.strip())
    ):
        return jsonify({'error': 'a username of 1 to 254 non-space characters is required'}), 400
    if not isinstance(new_password, str) or (new_password and not 6 <= len(new_password) <= 128):
        return jsonify({'error': 'new password must be empty or 6 to 128 characters'}), 400

    new_username = new_username.strip()
    if new_username.casefold() == ADMIN_USERNAME.casefold():
        return jsonify({'error': 'username is reserved'}), 409
    password_hash = generate_password_hash(new_password) if new_password else None

    try:
        with db() as connection:
            target = connection.execute(
                'SELECT username, display_name, role, auth_provider FROM users '
                'WHERE username = ? COLLATE NOCASE',
                (username,),
            ).fetchone()
            if not target or target['role'] != 'user':
                return jsonify({'error': 'member account not found'}), 404

            current_username = target['username']
            if new_username.casefold() != current_username.casefold():
                existing_user = connection.execute(
                    'SELECT 1 FROM users WHERE username = ? COLLATE NOCASE',
                    (new_username,),
                ).fetchone()
                existing_balance = connection.execute(
                    'SELECT 1 FROM balances WHERE username = ? COLLATE NOCASE',
                    (new_username,),
                ).fetchone()
                existing_alias = connection.execute(
                    'SELECT username FROM oauth_username_aliases WHERE alias = ? COLLATE NOCASE',
                    (new_username,),
                ).fetchone()
                if existing_user or existing_balance or (
                    existing_alias and existing_alias['username'].casefold() != current_username.casefold()
                ):
                    return jsonify({'error': 'username already exists'}), 409

                connection.execute(
                    'UPDATE users SET username = ?, display_name = ? '
                    'WHERE username = ? COLLATE NOCASE',
                    (
                        new_username,
                        new_username if target['display_name'] == current_username else target['display_name'],
                        current_username,
                    ),
                )
                connection.execute(
                    'UPDATE balances SET username = ? WHERE username = ? COLLATE NOCASE',
                    (new_username, current_username),
                )
                connection.execute(
                    'UPDATE topups SET username = ? WHERE username = ? COLLATE NOCASE',
                    (new_username, current_username),
                )
                connection.execute(
                    'UPDATE balance_transactions SET username = ? WHERE username = ? COLLATE NOCASE',
                    (new_username, current_username),
                )
                connection.execute(
                    'UPDATE oauth_identities SET username = ? WHERE username = ? COLLATE NOCASE',
                    (new_username, current_username),
                )
                connection.execute(
                    'UPDATE oauth_username_aliases SET username = ? WHERE username = ? COLLATE NOCASE',
                    (new_username, current_username),
                )
                if target['auth_provider'] in ('google', 'github'):
                    connection.execute(
                        'INSERT INTO oauth_username_aliases(alias, username) VALUES (?, ?) '
                        'ON CONFLICT(alias) DO UPDATE SET username = excluded.username',
                        (current_username, new_username),
                    )
                connection.execute(
                    'DELETE FROM oauth_username_aliases WHERE alias = ? COLLATE NOCASE',
                    (new_username,),
                )

            if password_hash:
                connection.execute(
                    'UPDATE users SET password_hash = ? WHERE username = ? COLLATE NOCASE',
                    (password_hash, new_username if new_username.casefold() != current_username.casefold() else current_username),
                )
    except sqlite3.IntegrityError:
        return jsonify({'error': 'username already exists'}), 409

    return jsonify({
        'username': new_username if new_username.casefold() != current_username.casefold() else current_username,
        'usernameChanged': new_username.casefold() != current_username.casefold(),
        'passwordChanged': bool(password_hash),
    })


@app.post('/api/admin/users/<path:username>/balance')
def adjust_user_balance(username):
    admin = admin_user()
    if not admin:
        return jsonify({'error': 'admin access required'}), 403
    data = request.get_json(silent=True) or {}
    amount = data.get('amount')
    reason = str(data.get('reason', '')).strip()
    if isinstance(amount, bool) or not isinstance(amount, int) or amount == 0 or abs(amount) > 1_000_000_000:
        return jsonify({'error': 'amount must be a non-zero integer within the supported limit'}), 400
    if not reason or len(reason) > 160:
        return jsonify({'error': 'a reason of 1 to 160 characters is required'}), 400

    with db() as connection:
        target = connection.execute(
            'SELECT username FROM users WHERE username = ? COLLATE NOCASE',
            (username,),
        ).fetchone()
        if not target:
            return jsonify({'error': 'user not found'}), 404
        connection.execute(
            'INSERT OR IGNORE INTO balances(username, amount) VALUES (?, 0)',
            (target['username'],),
        )
        result = connection.execute(
            'UPDATE balances SET amount = amount + ? '
            'WHERE username = ? AND amount + ? >= 0',
            (amount, target['username'], amount),
        )
        if result.rowcount != 1:
            return jsonify({'error': 'adjustment would make the balance negative'}), 409
        connection.execute(
            'INSERT INTO balance_transactions '
            '(username, amount, reason, admin_username, created_at) VALUES (?, ?, ?, ?, ?)',
            (target['username'], amount, reason, admin['username'], utc_now()),
        )
        balance = connection.execute(
            'SELECT amount FROM balances WHERE username = ?', (target['username'],)
        ).fetchone()['amount']
    return jsonify({'username': target['username'], 'amount': amount, 'balance': balance})


@app.get('/api/products')
def list_products():
    with db() as connection:
        rows = connection.execute(
            'SELECT id, name, description, price, category, file_name AS fileName, '
            'file_size AS fileSize, created_at AS createdAt FROM products ORDER BY created_at DESC'
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post('/api/products')
def create_product():
    if not admin_user():
        return jsonify({'error': 'admin access required'}), 403
    uploaded = request.files.get('file')
    if not uploaded or not uploaded.filename:
        return jsonify({'error': 'file is required'}), 400

    name = str(request.form.get('name', '')).strip()
    description = str(request.form.get('description', '')).strip()
    category = str(request.form.get('category', 'web')).strip() or 'web'
    try:
        price = int(request.form.get('price', '0'))
    except (TypeError, ValueError):
        price = 0
    if not name or not description or price < 0:
        return jsonify({'error': 'name, description and price >= 0 are required'}), 400

    original_name = uploaded.filename
    safe_name = secure_filename(original_name) or 'download'
    product_id = str(uuid.uuid4())
    stored_name = f'{product_id}-{safe_name}'
    stored_path = os.path.join(UPLOADS_ROOT, stored_name)
    uploaded.save(stored_path)
    file_size = os.path.getsize(stored_path)
    if file_size > 25 * 1024 * 1024:
        if os.path.exists(stored_path):
            os.remove(stored_path)
        return jsonify({'error': 'Dung lượng file vượt quá giới hạn 25MB.'}), 400

    try:
        with db() as connection:
            connection.execute(
                'INSERT INTO products '
                '(id, name, description, price, category, file_name, stored_name, content_type, file_size, created_at) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (product_id, name, description, price, category, original_name, stored_name,
                 uploaded.mimetype, file_size, utc_now()),
            )
    except Exception:
        if os.path.exists(stored_path):
            os.remove(stored_path)
        raise

    return jsonify({
        'id': product_id,
        'name': name,
        'description': description,
        'price': price,
        'category': category,
        'fileName': original_name,
        'fileSize': file_size,
    }), 201


@app.get('/api/products/<product_id>/download')
def download_product(product_id):
    with db() as connection:
        product = connection.execute(
            'SELECT stored_name, file_name, content_type FROM products WHERE id = ?',
            (product_id,),
        ).fetchone()
    if not product:
        return jsonify({'error': 'product not found'}), 404
    file_path = os.path.join(UPLOADS_ROOT, product['stored_name'])
    if not os.path.isfile(file_path):
        return jsonify({'error': 'file not found'}), 404
    return send_file(
        file_path,
        as_attachment=True,
        download_name=product['file_name'],
        mimetype=product['content_type'] or 'application/octet-stream',
    )


@app.post('/api/products/<product_id>/purchase')
def purchase_product(product_id):
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip()
    if not username:
        return jsonify({'error': 'username is required'}), 400
    if not is_authenticated_as(username):
        return jsonify({'error': 'not authorized for this account'}), 403

    with db() as connection:
        product = connection.execute(
            'SELECT id, name, price FROM products WHERE id = ?', (product_id,)
        ).fetchone()
        if not product:
            return jsonify({'error': 'product not found'}), 404

        result = connection.execute(
            'UPDATE balances SET amount = amount - ? '
            'WHERE username = ? AND amount >= ?',
            (product['price'], username, product['price']),
        )
        if result.rowcount != 1:
            balance = connection.execute(
                'SELECT amount FROM balances WHERE username = ?', (username,)
            ).fetchone()
            return jsonify({
                'error': 'insufficient_balance',
                'balance': balance['amount'] if balance else 0,
                'price': product['price'],
            }), 402
        connection.execute(
            'INSERT INTO balance_transactions '
            '(username, amount, reason, admin_username, created_at) VALUES (?, ?, ?, ?, ?)',
            (username, -product['price'], f'Mua sản phẩm {product["name"]}', 'system', utc_now()),
        )

    return jsonify({
        'purchased': True,
        'productId': product['id'],
        'productName': product['name'],
        'price': product['price'],
    })


@app.delete('/api/products/<product_id>')
def delete_product(product_id):
    if not admin_user():
        return jsonify({'error': 'admin access required'}), 403
    with db() as connection:
        product = connection.execute(
            'SELECT stored_name FROM products WHERE id = ?', (product_id,)
        ).fetchone()
        if not product:
            return jsonify({'error': 'product not found'}), 404
        connection.execute('DELETE FROM products WHERE id = ?', (product_id,))
    file_path = os.path.join(UPLOADS_ROOT, product['stored_name'])
    if os.path.isfile(file_path):
        os.remove(file_path)
    return jsonify({'deleted': True})


@app.get('/api/balances/<path:username>')
def get_balance(username):
    if not is_authenticated_as(username):
        return jsonify({'error': 'not authorized for this account'}), 403
    with db() as connection:
        row = connection.execute('SELECT amount FROM balances WHERE username = ?', (username,)).fetchone()
    return jsonify({'username': username, 'amount': row['amount'] if row else 0})


@app.post('/api/topups')
def create_topup():
    data = request.get_json(silent=True) or {}


    username = str(data.get('username', '')).strip()
    amount = data.get('amount')
    if not is_authenticated_as(username):
        return jsonify({'error': 'not authorized for this account'}), 403
    if not username or not isinstance(amount, int) or amount < 1000:
        return jsonify({'error': 'username and amount >= 1000 are required'}), 400

    content = make_content()
    created_at = utc_now()
    with db() as connection:
        connection.execute(
            'INSERT INTO topups(username, amount, content, created_at) VALUES (?, ?, ?, ?)',
            (username, amount, content, created_at),
        )
        topup_id = connection.execute('SELECT last_insert_rowid()').fetchone()[0]

    sent = telegram_message(
        f'ĐƠN NẠP TIỀN MỚI\n'
        f'Mã đơn: {content}\n'
        f'Khách hàng: {username}\n'
        f'Số tiền: {amount:,} VNĐ\n'
        f'Trạng thái: CHỜ DUYỆT\n\n'
        f'Duyệt đơn bằng lệnh:\n/duyet {content}'
    )
    return jsonify({'id': topup_id, 'amount': amount, 'content': content, 'status': 'pending', 'telegram_sent': sent}), 201


@app.post('/api/webhooks/bank')
def bank_webhook():
    data = request.get_json(silent=True) or {}
    content = str(data.get('content', '')).strip().upper()
    amount = data.get('amount')
    reference = str(data.get('reference', '')).strip()
    if not content or not isinstance(amount, int):
        return jsonify({'error': 'content and integer amount are required'}), 400

    with db() as connection:
        topup = connection.execute('SELECT * FROM topups WHERE content = ?', (content,)).fetchone()
        if not topup:
            telegram_message(f'GIAO DỊCH KHÔNG KHỚP\nSố tiền: {amount:,} VNĐ\nNội dung: {content}')
            return jsonify({'matched': False}), 404
        if topup['amount'] != amount:
            telegram_message(f'SAI SỐ TIỀN\nMã đơn: {topup["content"]}\nCần nhận: {topup["amount"]:,} VNĐ\nĐã nhận: {amount:,} VNĐ')
            return jsonify({'matched': True, 'status': 'amount_mismatch'}), 409
        connection.execute('UPDATE topups SET bank_reference = ? WHERE id = ?', (reference, topup['id']))

    telegram_message(f'ĐÃ NHẬN THANH TOÁN\nMã đơn: {topup["content"]}\nKhách hàng: {topup["username"]}\nSố tiền: {amount:,} VNĐ\nTrạng thái: CHỜ ADMIN DUYỆT\n\nDuyệt: /duyet {topup["content"]}')
    return jsonify({'matched': True, 'status': 'waiting_admin_approval'}), 200


@app.get('/api/admin/topups')
def list_topups():
    provided_key = request.headers.get('X-Admin-Key', '')
    if not ADMIN_APPROVAL_KEY or not secrets.compare_digest(provided_key, ADMIN_APPROVAL_KEY):
        return jsonify({'error': 'unauthorized'}), 401
    with db() as connection:
        rows = connection.execute('SELECT * FROM topups ORDER BY id DESC').fetchall()
    return jsonify([dict(row) for row in rows])


@app.post('/api/admin/topups/<int:topup_id>/approve')
def approve_topup(topup_id):
    provided_key = request.headers.get('X-Admin-Key', '')
    if not ADMIN_APPROVAL_KEY or not secrets.compare_digest(provided_key, ADMIN_APPROVAL_KEY):
        return jsonify({'error': 'unauthorized'}), 401
    with db() as connection:
        topup = connection.execute('SELECT content FROM topups WHERE id = ?', (topup_id,)).fetchone()
    if not topup:
        return jsonify({'error': 'topup not found'}), 404
    topup, result = approve_topup_by_content(topup['content'])
    if result == 'already_approved':
        return jsonify({'error': 'already approved'}), 409
    telegram_message(f'ĐÃ DUYỆT ĐƠN\nMã đơn: {topup["content"]}\nKhách hàng: {topup["username"]}\nSố tiền: {topup["amount"]:,} VNĐ')
    return jsonify({'approved': True, 'username': topup['username'], 'amount': topup['amount']})


init_db()

if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
    threading.Thread(target=telegram_polling_loop, name='telegram-polling', daemon=True).start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
