import { apiRoute } from "@/lib/api/v1";
import { publicKey } from "@/lib/api/keys";
import { getState } from "@/lib/store";
export const runtime = "nodejs";
export const GET = apiRoute(null, async ({ uid, key }) => {
  const { user } = await getState(uid);
  return {
    object: "identity",
    user: { display_name: user.displayName },
    key: publicKey(key),
  };
});
