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
};

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
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
