import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";

const DashboardHeader = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useTranslation("common");

  const handleSignOut = async () => {
    try {
      await logout();
      toast.success(t("logoutSuccess"));
      navigate("/auth");
    } catch (error) {
      toast.error(t("logoutError"));
    }
  };

  return (
    <header className="border-b border-border bg-card shadow-[var(--shadow-card)] h-14 flex items-center px-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-lg font-bold">{t("appName")}</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user.full_name || user.email}</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="border-border hover:bg-accent"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t("logout")}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
