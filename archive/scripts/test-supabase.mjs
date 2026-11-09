import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://tvtfxkavjqvurdezhyvu.supabase.co",
  "sb_publishable_xlZ3YKF6h5XBMhARWkE9_g_PVudo5r8"
);

const run = async () => {
  const { data, error } = await supabase.from("wishlist").select("*");

  console.log("DATA:", data);
  console.log("ERROR:", error);
};

run();
