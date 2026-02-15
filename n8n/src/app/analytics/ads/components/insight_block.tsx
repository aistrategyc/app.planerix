import { Lightbulb, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Recommendation {
  text: string;
  priority: "high" | "medium" | "low";
}

interface Insight {
  topic: string;
  summary: string;
  recommendations: Recommendation[];
}

export function InsightBlock({ topic, insights }: { topic: string; insights: Insight[] }) {
  const insight = insights.find(i => i.topic === topic);
  if (!insight) return null;

  const priorityColor = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Lightbulb className="h-4 w-4 text-yellow-600" />
        Инсайт: <span className="italic font-normal">{insight.summary}</span>
      </div>
      {insight.recommendations?.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <p className="text-sm font-medium text-muted-foreground">📌 Рекомендации:</p>
          <ul className="space-y-1 pl-3">
            {insight.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-[2px] text-muted-foreground" />
                <span className="text-sm">{rec.text}</span>
                <Badge className={cn("ml-auto", priorityColor[rec.priority])}>
                  {rec.priority}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
