"""
LDAP / Active Directory authentication service.
Authenticates users against LDAP without creating local user accounts.
"""

import json
import ssl
from typing import Optional

from sqlalchemy.orm import Session

from app.models.system_setting import SystemSetting
from app.services.encryption import decrypt, is_encrypted
from app.core.logging import get_auth_logger

auth_logger = get_auth_logger()

_LDAP_SETTING_KEYS = [
    "ldap_enabled",
    "ldap_server",
    "ldap_port",
    "ldap_use_ssl",
    "ldap_use_starttls",
    "ldap_bind_dn",
    "ldap_bind_password",
    "ldap_base_dn",
    "ldap_user_filter",
    "ldap_username_attr",
    "ldap_email_attr",
    "ldap_display_name_attr",
    "ldap_group_search_base",
    "ldap_group_search_filter",
    "ldap_group_mappings",
    "ldap_default_role",
    "ldap_access_token_ttl",
]


def get_ldap_config(db: Session) -> dict:
    """Load LDAP settings from database, decrypting bind_password."""
    rows = db.query(SystemSetting).filter(
        SystemSetting.key.in_(_LDAP_SETTING_KEYS)
    ).all()
    result = {r.key: (r.value or "") for r in rows}

    pwd = result.get("ldap_bind_password", "")
    if pwd and is_encrypted(pwd):
        try:
            result["ldap_bind_password"] = decrypt(pwd)
        except Exception:
            result["ldap_bind_password"] = ""

    return result


class LDAPService:
    """Service for LDAP authentication and connection testing."""

    def __init__(self, config: dict):
        self.server_host = config.get("ldap_server", "")
        self.port = int(config.get("ldap_port") or 389)
        self.use_ssl = config.get("ldap_use_ssl") == "true"
        self.use_starttls = config.get("ldap_use_starttls") == "true"
        self.bind_dn = config.get("ldap_bind_dn", "")
        self.bind_password = config.get("ldap_bind_password", "")
        self.base_dn = config.get("ldap_base_dn", "")
        self.user_filter = config.get("ldap_user_filter") or "(&(objectClass=person)(sAMAccountName={username}))"
        self.email_attr = config.get("ldap_email_attr") or "mail"
        self.display_name_attr = config.get("ldap_display_name_attr") or "displayName"
        self.username_attr = config.get("ldap_username_attr") or "sAMAccountName"
        self.group_search_base = config.get("ldap_group_search_base") or self.base_dn
        self.group_filter = config.get("ldap_group_search_filter") or "(&(objectClass=group)(member={dn}))"
        self.default_role = config.get("ldap_default_role") or "user"
        try:
            self.group_mappings = json.loads(config.get("ldap_group_mappings") or "[]")
        except (json.JSONDecodeError, TypeError):
            self.group_mappings = []

    def _get_server(self):
        from ldap3 import Server, Tls
        tls = None
        if self.use_ssl or self.use_starttls:
            tls = Tls(validate=ssl.CERT_NONE)
        return Server(
            self.server_host,
            port=self.port,
            use_ssl=self.use_ssl,
            tls=tls,
        )

    def _get_attr_value(self, entry, attr: str) -> str:
        """Safely extract a single string value from an LDAP entry attribute."""
        try:
            val = entry[attr].value
            if isinstance(val, list):
                return str(val[0]) if val else ""
            return str(val) if val else ""
        except Exception:
            return ""

    def authenticate(self, username: str, password: str) -> Optional[dict]:
        """
        Authenticate user against LDAP.

        Steps:
        1. Bind with service account
        2. Search for user by username
        3. Extract user DN
        4. Bind again with user DN + supplied password (actual auth)
        5. Read user attributes (email, displayName)
        6. Search groups and map to role

        Returns:
            dict with {email, full_name, role} or None if authentication failed.
        """
        from ldap3 import Connection, SUBTREE, ALL_ATTRIBUTES

        if not self.server_host:
            auth_logger.warning("LDAP authentication skipped: server not configured")
            return None

        try:
            server = self._get_server()

            # Step 1: Bind with service account
            with Connection(
                server,
                user=self.bind_dn,
                password=self.bind_password,
                auto_bind=True,
                raise_exceptions=True,
            ) as conn:
                if self.use_starttls:
                    conn.start_tls()

                # Step 2: Search for user
                user_filter = self.user_filter.replace("{username}", username)
                conn.search(
                    search_base=self.base_dn,
                    search_filter=user_filter,
                    search_scope=SUBTREE,
                    attributes=[self.email_attr, self.display_name_attr, self.username_attr],
                )

                if not conn.entries:
                    auth_logger.warning("LDAP user not found", username=username)
                    return None

                user_entry = conn.entries[0]
                user_dn = user_entry.entry_dn

                email = self._get_attr_value(user_entry, self.email_attr)
                full_name = self._get_attr_value(user_entry, self.display_name_attr)

                # Use username as email fallback
                if not email:
                    email = f"{username}@ldap"

                # Step 3: Search groups while still bound as service account
                role = self.default_role
                group_matched = False
                if self.group_mappings and self.group_search_base:
                    group_filter = self.group_filter.replace("{dn}", user_dn)
                    conn.search(
                        search_base=self.group_search_base,
                        search_filter=group_filter,
                        search_scope=SUBTREE,
                        attributes=["cn"],
                    )
                    user_group_dns = {e.entry_dn.lower() for e in conn.entries}

                    for mapping in self.group_mappings:
                        group_dn = mapping.get("group_dn", "").lower()
                        mapped_role = mapping.get("role", "user")
                        if group_dn and group_dn in user_group_dns:
                            role = mapped_role
                            group_matched = True
                            break

                # If default role is "none" and no group was matched, deny access
                if role == "none" and not group_matched:
                    auth_logger.warning(
                        "LDAP access denied: no group match and default role is blocked",
                        username=username,
                    )
                    return None

            # Step 4: Bind with user credentials to verify password
            with Connection(
                server,
                user=user_dn,
                password=password,
                auto_bind=True,
                raise_exceptions=True,
            ) as user_conn:
                if self.use_starttls:
                    user_conn.start_tls()

            auth_logger.info(
                "LDAP authentication successful",
                username=username,
                email=email,
                role=role,
            )
            return {"email": email, "full_name": full_name or username, "role": role}

        except Exception as exc:
            err = str(exc)
            if "invalidCredentials" in err or "52e" in err or "Invalid credentials" in err.lower():
                auth_logger.warning("LDAP authentication failed: invalid credentials", username=username)
            else:
                auth_logger.error("LDAP authentication error", username=username, error=err)
            return None

    def test_connection(self, test_username: Optional[str] = None) -> dict:
        """
        Test LDAP connection with service account.
        Optionally searches for a test user.
        Returns {"success": bool, "message": str}.
        """
        from ldap3 import Connection, SUBTREE

        if not self.server_host:
            return {"success": False, "message": "Servidor LDAP não configurado"}

        if not self.bind_dn:
            return {"success": False, "message": "Bind DN não configurado"}

        try:
            server = self._get_server()

            with Connection(
                server,
                user=self.bind_dn,
                password=self.bind_password,
                auto_bind=True,
                raise_exceptions=True,
            ) as conn:
                if self.use_starttls:
                    conn.start_tls()

                if test_username:
                    user_filter = self.user_filter.replace("{username}", test_username)
                    conn.search(
                        search_base=self.base_dn,
                        search_filter=user_filter,
                        search_scope=SUBTREE,
                        attributes=[self.email_attr, self.display_name_attr],
                    )
                    if conn.entries:
                        entry = conn.entries[0]
                        email = self._get_attr_value(entry, self.email_attr)
                        name = self._get_attr_value(entry, self.display_name_attr)
                        return {
                            "success": True,
                            "message": f"Conexão OK. Usuário '{test_username}' encontrado: {name} <{email}>",
                        }
                    else:
                        return {
                            "success": True,
                            "message": f"Conexão OK, mas usuário '{test_username}' não encontrado na base '{self.base_dn}'",
                        }

                return {"success": True, "message": f"Conexão com {self.server_host}:{self.port} estabelecida com sucesso"}

        except Exception as exc:
            err = str(exc)
            auth_logger.error("LDAP connection test failed", error=err)
            return {"success": False, "message": f"Falha na conexão LDAP: {err}"}
