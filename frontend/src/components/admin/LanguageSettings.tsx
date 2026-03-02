import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages } from "lucide-react";

const LANGUAGES = [
  { code: "pt-BR", flag: "🇧🇷", labelKey: "portuguese", descKey: "portugueseDesc" },
  { code: "en",    flag: "🇺🇸", labelKey: "english",    descKey: "englishDesc" },
];

export function LanguageSettings() {
  const { t } = useTranslation("admin");
  const { locale, changeLocale } = useAuth();

  const handleChange = (lang: string) => {
    if (lang === locale) return;
    changeLocale(lang);
    toast.success(t("language.saved"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t("language.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("language.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {LANGUAGES.map((lang) => {
          const selected = locale === lang.code;
          return (
            <Card
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              className={`cursor-pointer transition-all border-2 ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className="text-2xl">{lang.flag}</span>
                  {t(`language.${lang.labelKey}`)}
                  {selected && (
                    <span className="ml-auto text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {t("language.current")}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t(`language.${lang.descKey}`)}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
