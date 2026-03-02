import { ReactNode } from "react";
import DashboardHeader from "./DashboardHeader";

interface LayoutWrapperProps {
  children: ReactNode;
}

export const LayoutWrapper = ({ children }: LayoutWrapperProps) => {
  return (
    <>
      <DashboardHeader />
      {children}
    </>
  );
};
