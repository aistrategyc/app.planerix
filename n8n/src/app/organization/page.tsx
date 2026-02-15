"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { CompanyAPI } from "@/lib/api/company";

export default function OrganizationIndexPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const redirectToOrg = async () => {
      try {
        const org = await CompanyAPI.getCurrentCompany();
        if (!active) return;
        if (org?.id) {
          router.replace(`/organization/${org.id}`);
          return;
        }
      } catch {
        // Fall through to onboarding redirect.
      }

      if (active) {
        router.replace("/onboarding");
      }
    };

    redirectToOrg();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Redirecting...
    </div>
  );
}
