import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your Nexa AI account, workspace summary and session security details.",
};

export default function ProfilePage() {
  return <ProfileView />;
}
