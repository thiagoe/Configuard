import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// pt-BR
import ptBRCommon from "../locales/pt-BR/common.json";
import ptBRSidebar from "../locales/pt-BR/sidebar.json";
import ptBRAuth from "../locales/pt-BR/auth.json";
import ptBRDashboard from "../locales/pt-BR/dashboard.json";
import ptBRDevices from "../locales/pt-BR/devices.json";
import ptBRBackups from "../locales/pt-BR/backups.json";
import ptBRTemplates from "../locales/pt-BR/templates.json";
import ptBRAdmin from "../locales/pt-BR/admin.json";
import ptBRSchedules from "../locales/pt-BR/schedules.json";
import ptBRSearch from "../locales/pt-BR/search.json";
import ptBRAudit from "../locales/pt-BR/audit.json";

// en
import enCommon from "../locales/en/common.json";
import enSidebar from "../locales/en/sidebar.json";
import enAuth from "../locales/en/auth.json";
import enDashboard from "../locales/en/dashboard.json";
import enDevices from "../locales/en/devices.json";
import enBackups from "../locales/en/backups.json";
import enTemplates from "../locales/en/templates.json";
import enAdmin from "../locales/en/admin.json";
import enSchedules from "../locales/en/schedules.json";
import enSearch from "../locales/en/search.json";
import enAudit from "../locales/en/audit.json";

const savedLocale = localStorage.getItem("configuard_locale") || "pt-BR";

i18n.use(initReactI18next).init({
  lng: savedLocale,
  fallbackLng: "pt-BR",
  ns: [
    "common",
    "sidebar",
    "auth",
    "dashboard",
    "devices",
    "backups",
    "templates",
    "admin",
    "schedules",
    "search",
    "audit",
  ],
  defaultNS: "common",
  resources: {
    "pt-BR": {
      common: ptBRCommon,
      sidebar: ptBRSidebar,
      auth: ptBRAuth,
      dashboard: ptBRDashboard,
      devices: ptBRDevices,
      backups: ptBRBackups,
      templates: ptBRTemplates,
      admin: ptBRAdmin,
      schedules: ptBRSchedules,
      search: ptBRSearch,
      audit: ptBRAudit,
    },
    en: {
      common: enCommon,
      sidebar: enSidebar,
      auth: enAuth,
      dashboard: enDashboard,
      devices: enDevices,
      backups: enBackups,
      templates: enTemplates,
      admin: enAdmin,
      schedules: enSchedules,
      search: enSearch,
      audit: enAudit,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
