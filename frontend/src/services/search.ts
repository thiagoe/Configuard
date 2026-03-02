/**
 * Search service - API calls for configuration search
 */

import api from "./api";

export interface SearchSnippet {
  line: number;
  content: string;
}

export interface SearchResult {
  configuration_id: string;
  device_id: string;
  device_name: string;
  version: number;
  collected_at: string;
  matches: number;
  snippets: SearchSnippet[];
}

export interface SearchResponse {
  items: SearchResult[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function searchConfigurations(params: {
  q: string;
  page?: number;
  page_size?: number;
  device_ids?: string[];
  category_id?: string;
  days?: number;
  latest_only?: boolean;
  regex_mode?: boolean;
}): Promise<SearchResponse> {
  const query = new URLSearchParams();
  query.set("q", params.q);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.device_ids && params.device_ids.length > 0) {
    query.set("device_ids", params.device_ids.join(","));
  }
  if (params.category_id) query.set("category_id", params.category_id);
  if (params.days) query.set("days", params.days.toString());
  if (params.latest_only) query.set("latest_only", "true");
  if (params.regex_mode) query.set("regex_mode", "true");
  const response = await api.get<SearchResponse>(`/search?${query.toString()}`);
  return response.data;
}
