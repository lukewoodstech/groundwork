import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { fallbackPlan, validPlan, type Candidate, type Suggestion } from "@/lib/scoring";
import type { Appointment } from "@/lib/data/types";

export type PlanResponse = {
  source: "claude" | "fallback";
  suggestions: Suggestion[];
  /** Why the fallback was used, when it was. */
  note?: string;
};

const PlanSchema = z.object({
  suggestions: z
    .array(
      z.object({
        zoneId: z.string(),
        type: z.enum(["NEARBY", "REPEAT_WHAT_WORKED", "NEGLECTED"]),
        reason: z.string(),
      }),
    )
    .length(3),
});

const SYSTEM = `You help a pair of missionaries decide where to work today in their area.
You receive up to six candidate zones with statistics, and today's appointments.
Pick exactly three zones. Label each one:
- NEARBY: a short walk from one of today's appointments, ideally somewhere little worked.
- REPEAT_WHAT_WORKED: the highest share of street contacts turning into lessons recently (compare lessonRatePercent, with enough contacts to mean something).
- NEGLECTED: a long time since anyone worked it, or never.
Use each label at most once when the data supports it. Prefer the zone whose numbers make the strongest case for each label.
For each zone write one plain sentence, under 25 words, that cites the actual numbers from its statistics: days since last worked, contacts and lessons, street name, or walking minutes. Never invent a number. Refer to a zone by its name. Say "your 2:00 PM lesson" style phrases for appointments.`;

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });

export async function POST(req: Request) {
  let body: { candidates?: Candidate[]; appointments?: Appointment[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const candidates = body.candidates ?? [];
  const appointments = body.appointments ?? [];
  if (!candidates.length) {
    return Response.json({ error: "No candidates" }, { status: 400 });
  }

  const fallback = (note: string): PlanResponse => ({
    source: "fallback",
    note,
    suggestions: fallbackPlan(candidates),
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(fallback("No API key configured"));
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse(
      {
        model: "claude-opus-5-5",
        max_tokens: 2000,
        output_config: { effort: "low", format: zodOutputFormat(PlanSchema) },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                appointments: appointments.map((a) => ({ id: a.id, time: clock(a.time), label: a.label })),
                candidates: candidates.map((c) => ({
                  zoneId: c.zoneId,
                  name: c.name,
                  daysSinceLastWorked: c.daysSinceLast ?? "never",
                  actionsAllTime: c.actionsAllTime,
                  last60Days: {
                    streetContacts: c.contacts60,
                    becameLessons: c.lessonsFromContacts60,
                    lessonRatePercent: c.rate60 === null ? null : Math.round(c.rate60 * 100),
                  },
                  bestStreetLast30Days: c.topStreet,
                  nearestAppointment: {
                    label: c.nearest.label,
                    time: clock(c.nearest.time),
                    walkMinutes: c.nearest.walkMinutes,
                  },
                })),
              },
              null,
              1,
            ),
          },
        ],
      },
      { timeout: 25_000 },
    );

    if (response.stop_reason === "refusal") return Response.json(fallback("The model declined"));
    const suggestions = response.parsed_output?.suggestions;
    if (!validPlan(suggestions, candidates)) {
      return Response.json(fallback("The model's answer did not match the candidates"));
    }
    return Response.json({ source: "claude", suggestions } satisfies PlanResponse);
  } catch (error) {
    const note =
      error instanceof Anthropic.AuthenticationError
        ? "API key rejected"
        : error instanceof Anthropic.RateLimitError
          ? "Rate limited"
          : error instanceof Anthropic.APIError
            ? `API error ${error.status}`
            : "Could not reach the API";
    return Response.json(fallback(note));
  }
}
