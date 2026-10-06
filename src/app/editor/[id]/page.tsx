import { EditorLoader } from "@/editor/EditorLoader";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorLoader projectId={id} />;
}
