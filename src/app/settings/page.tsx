import { prisma } from "@/lib/prisma";
import SettingsClientForm from "./SettingsClientForm";
import SocialAccountsManager from "@/components/SocialAccountsManager";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const settings = await prisma.automationSettings.upsert({
    where: { userId },
    update: {},
    create: {
      id: userId + "_settings",
      userId,
      enabled: false,
      autoGenerate: true,
      autoSchedule: true,
      autoPublish: true,
      autoRegenerate: true,
      maxRegenerationAttempts: 3,
      postsPerDay: 3,
      minimumIntervalMinutes: 240,
      postingDays: "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday",
      postingTimes: "08:00,13:00,19:00",
      timezone: "Asia/Makassar",
      similarityThreshold: 0.7,
      threadsUserId: "",
      threadsAccessToken: "",
      telegramBotToken: "",
      telegramChatId: "",
      telegramEnabled: false,
    },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Automation Settings</h1>
        <p className="text-sm text-slate-400">
          Konfigurasi sakelar otomasi, aturan jadwal tayang, dan kredensial API Threads.
        </p>
      </div>

      <SettingsClientForm initialSettings={settings} />
      
      <hr className="border-slate-800" />
      <SocialAccountsManager />
    </div>
  );
}
