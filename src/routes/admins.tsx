import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreHorizontal, Mail } from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { subAdmins } from "@/lib/mock-data";

export const Route = createFileRoute("/admins")({ component: AdminsPage });

function AdminsPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Sub Admins"
        description="Create, disable, and monitor admin accounts across the platform."
        actions={<Button><Plus className="size-4" /> Invite Admin</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {subAdmins.map((a) => (
          <GlassCard key={a.id} className="hover:bg-white/[0.07] transition-colors">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-2xl bg-gradient-to-br from-cyan-400/40 to-fuchsia-400/40 grid place-items-center font-semibold">
                {a.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                  <Mail className="size-3" /> {a.email}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5">
              <div><div className="text-[10px] uppercase text-muted-foreground">Devices</div><div className="font-semibold mt-0.5">{a.devices}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Templates</div><div className="font-semibold mt-0.5">{a.templates}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Responses</div><div className="font-semibold mt-0.5">{a.responses.toLocaleString()}</div></div>
            </div>
            <div className="flex items-center justify-between mt-4 text-xs">
              <span className="text-muted-foreground">Joined {a.joined}</span>
              <span className={`px-2 py-0.5 rounded-full ${a.status === "active" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
                {a.status}
              </span>
            </div>
          </GlassCard>
        ))}
      </div>
    </DashboardLayout>
  );
}
