import { loadPacks, packCard } from "@/server/packs";

/** The style packs in public/packs, as the template galleries show them; `problems` lists folders that don't load. */
export async function GET() {
  const { packs, problems } = await loadPacks();
  return Response.json({ packs: packs.map(packCard), problems });
}
