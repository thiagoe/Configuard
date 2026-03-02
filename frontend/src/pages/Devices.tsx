import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import DeviceList from "@/components/DeviceList";

const Devices = () => {
  const { user } = useAuth();
  const { t } = useTranslation("devices");

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <DeviceList />
      </main>
    </div>
  );
};

export default Devices;
