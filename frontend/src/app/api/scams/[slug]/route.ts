import { NextResponse } from "next/server";
import { findScam } from "@/lib/survey/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const scam = findScam(slug);
  if (!scam) {
    return NextResponse.json({ error: "Unknown scam pattern" }, { status: 404 });
  }
  return NextResponse.json(scam);
}
