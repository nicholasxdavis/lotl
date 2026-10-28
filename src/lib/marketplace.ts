export type MarketHit = {
  id: number;
  name: string;
  description?: string;
  creator?: string;
  kind?: string;
  hasScripts?: boolean;
  insert: string;
};

type ToolboxSearch = { data?: Array<{ id?: number }> };
type ToolboxDetails = {
  data?: Array<{
    asset?: {
      id?: number;
      name?: string;
      description?: string;
      hasScripts?: boolean;
      typeId?: number;
    };
    creator?: { name?: string };
  }>;
};

export async function searchMarketplace(query: string, limit = 10): Promise<MarketHit[]> {
  const size = Math.min(Math.max(limit, 1), 30);
  const toolbox = new URL("https://apis.roblox.com/toolbox-service/v1/marketplace/Model");
  toolbox.searchParams.set("keyword", query);
  toolbox.searchParams.set("limit", String(size));

  const searchRes = await fetch(toolbox, { headers: { accept: "application/json" } });
  if (!searchRes.ok) {
    throw new Error(`Toolbox search failed (${searchRes.status})`);
  }
  const searchBody = (await searchRes.json()) as ToolboxSearch;
  const ids = (searchBody.data ?? []).map((item) => item.id).filter((id): id is number => typeof id === "number");
  if (ids.length === 0) return [];

  const detailsUrl = new URL("https://apis.roblox.com/toolbox-service/v1/items/details");
  detailsUrl.searchParams.set("assetIds", ids.join(","));
  const detailsRes = await fetch(detailsUrl, { headers: { accept: "application/json" } });
  const detailsBody = detailsRes.ok ? ((await detailsRes.json()) as ToolboxDetails) : { data: [] };
  const byId = new Map<number, NonNullable<ToolboxDetails["data"]>[number]>();
  for (const row of detailsBody.data ?? []) {
    if (row.asset?.id) byId.set(row.asset.id, row);
  }

  return ids.map((id) => {
    const row = byId.get(id);
    return {
      id,
      name: row?.asset?.name ?? `asset ${id}`,
      description: row?.asset?.description,
      creator: row?.creator?.name,
      kind: "Model",
      hasScripts: row?.asset?.hasScripts ?? false,
      insert: `Use Roblox_Studio insert_asset with asset id ${id}. Preview first if hasScripts is true.`,
    };
  });
}
