import { supabase } from "@/lib/supabase";

export const edgeApi = {
  invoke: async <TRes>(
    name: string,
    body: Record<string, unknown>,
  ): Promise<TRes> => {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) throw new Error(error.message);
    return data as TRes;
  },
};
