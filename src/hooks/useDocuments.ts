import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Document = {
  id: string;
  name: string;
  mime_type: string;
  storage_path: string;
  size_bytes: number;
  uploaded_at: string;
  status: "pending" | "processing" | "indexed" | "error";
  error: string | null;
  extracted_chars: number;
  /** The text read from the file. The demo stores it on the row; the real schema does not. */
  extracted_text?: string;
};

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Loading covers the first fetch only, so a refresh never blanks the list.
  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .order("uploaded_at", { ascending: false });
    setDocuments((data ?? []) as Document[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channelName = `documents_${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { documents, loading, refresh };
}

/** Deletes a document and its indexed text. */
export async function deleteDocument(password: string, id: string) {
  const { data, error } = await supabase.functions.invoke("ingest-document", {
    body: { action: "delete", password, document_id: id },
  });
  if (error) throw error;
  if (!data?.ok) {
    const e = data?.error;
    throw new Error(typeof e === "string" ? e : e?.message || "Failed to delete");
  }
}
