import { createClient } from "@/lib/supabase/server";

export async function getLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}
