import { NextResponse } from "next/server";
import { SCAMS, searchScams } from "@/lib/survey/engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const results = query ? searchScams(query) : SCAMS;
  return NextResponse.json({
    count: results.length,
    scams: results.map((scam) => ({
      slug: scam.slug,
      name: scam.name,
      platforms: scam.platforms,
      demands: scam.demands,
      frequency: scam.frequency,
      description: scam.description,
    })),
  });
}
