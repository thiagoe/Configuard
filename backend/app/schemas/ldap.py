"""
LDAP / Active Directory schemas
"""

from typing import Optional, List
from pydantic import BaseModel


class LdapGroupMapping(BaseModel):
    """A single group DN → role mapping entry"""
    group_dn: str
    role: str  # admin | moderator | user


class LdapSettingsResponse(BaseModel):
    """LDAP configuration response (bind_password masked)"""
    ldap_enabled: bool
    ldap_server: str
    ldap_port: int
    ldap_use_ssl: bool
    ldap_use_starttls: bool
    ldap_bind_dn: str
    ldap_bind_password_set: bool  # True if password configured, never returned in plain
    ldap_base_dn: str
    ldap_user_filter: str
    ldap_username_attr: str
    ldap_email_attr: str
    ldap_display_name_attr: str
    ldap_group_search_base: str
    ldap_group_search_filter: str
    ldap_group_mappings: List[LdapGroupMapping]
    ldap_default_role: str
    ldap_access_token_ttl: int


class LdapSettingsUpdate(BaseModel):
    """LDAP configuration update"""
    ldap_enabled: bool
    ldap_server: str
    ldap_port: int
    ldap_use_ssl: bool
    ldap_use_starttls: bool
    ldap_bind_dn: str
    ldap_bind_password: Optional[str] = None  # None = keep existing
    ldap_base_dn: str
    ldap_user_filter: str
    ldap_username_attr: str
    ldap_email_attr: str
    ldap_display_name_attr: str
    ldap_group_search_base: str
    ldap_group_search_filter: str
    ldap_group_mappings: List[LdapGroupMapping]
    ldap_default_role: str
    ldap_access_token_ttl: int


class LdapTestRequest(BaseModel):
    """Optional test username for LDAP connection test"""
    test_username: Optional[str] = None


class LdapTestResponse(BaseModel):
    """Result of LDAP connection test"""
    success: bool
    message: str
