import { NextRequest } from "next/server";
import { getRealtimeHub, RealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const centreId = url.searchParams.get("centreId");
  const farmerId = url.searchParams.get("farmerId");

  const encoder = new TextEncoder();
  const hub = getRealtimeHub();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connect message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`));

      const listener = (event: RealtimeEvent) => {
        // Filter by centreId or farmerId if specified
        if (centreId && event.centreId && event.centreId !== centreId) return;
        if (farmerId && event.farmerId && event.farmerId !== farmerId) return;

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed
        }
      };

      hub.on("event", listener);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
          hub.off("event", listener);
        }
      }, 15000);

      cleanup = () => {
        clearInterval(heartbeat);
        hub.off("event", listener);
      };

      req.signal.addEventListener("abort", () => {
        cleanup?.();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
